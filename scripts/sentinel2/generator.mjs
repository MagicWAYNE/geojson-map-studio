import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import {
  buildQualityProcessRequest,
  buildRgbProcessRequest,
  decodePngSamples,
  jpegDimensions
} from './source-quality.mjs'
import {
  geometryMaskedQuality,
  projectedPolygonsFromGeoJson,
  rasterizeProjectedCoverage
} from './geometry-mask.mjs'
import { planProcessTiles } from './process-tiles.mjs'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex')
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

function retryDelay(response, attempt) {
  const header = response.headers.get('retry-after')
  if (header) {
    const seconds = Number(header)
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 30_000)
    const date = Date.parse(header)
    if (Number.isFinite(date)) return Math.max(0, Math.min(date - Date.now(), 30_000))
  }
  return Math.min(1000 * 2 ** attempt, 10_000)
}

export async function requestWithRetry({
  oauthClient,
  url,
  init,
  maximumAttempts = 4,
  requestTimeoutMs = 120_000,
  wait = sleep
}) {
  assert(Number.isInteger(maximumAttempts) && maximumAttempts > 0, 'invalid maximumAttempts')
  for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
    let response
    try {
      const timeoutSignal = AbortSignal.timeout(requestTimeoutMs)
      const signal = init.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal
      response = await oauthClient.authorizedFetch(url, { ...init, signal })
    } catch (cause) {
      if (init.signal?.aborted) throw cause
      if (attempt === maximumAttempts - 1) throw cause
      await wait(Math.min(1000 * 2 ** attempt, 10_000))
      continue
    }
    if (response.ok) return { response, retryCount: attempt }
    const retryable = response.status === 408 || response.status === 425 ||
      response.status === 429 || response.status >= 500
    if (!retryable || attempt === maximumAttempts - 1) {
      const detail = (await response.text().catch(() => '')).replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]').slice(0, 500)
      throw new Error(`Process request failed (HTTP ${response.status})${detail ? `: ${detail}` : ''}`)
    }
    await wait(retryDelay(response, attempt))
  }
  throw new Error('Process request exhausted retries')
}

async function writeAtomic(destination, value) {
  await mkdir(path.dirname(destination), { recursive: true })
  const temporary = `${destination}.tmp-${process.pid}-${Date.now()}`
  try {
    await writeFile(temporary, value, { flag: 'wx' })
    await rename(temporary, destination)
  } catch (cause) {
    await unlink(temporary).catch(() => undefined)
    throw cause
  }
}

async function readJsonIfPresent(filePath) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'))
  } catch (cause) {
    if (cause?.code === 'ENOENT') return null
    throw cause
  }
}

function validateCheckpoint(checkpoint, { kind, planSha256 }) {
  assert(checkpoint?.schemaVersion === 1, `${kind} checkpoint has an unsupported schema`)
  assert(checkpoint.kind === kind, `${kind} checkpoint has the wrong kind`)
  assert(checkpoint.planSha256 === planSha256, `${kind} checkpoint belongs to a different job manifest`)
  assert(checkpoint.entries && typeof checkpoint.entries === 'object' && !Array.isArray(checkpoint.entries), `${kind} checkpoint entries are invalid`)
  return checkpoint
}

async function loadOrCreateCheckpoint(filePath, { kind, planSha256 }) {
  const existing = await readJsonIfPresent(filePath)
  return existing
    ? validateCheckpoint(existing, { kind, planSha256 })
    : { schemaVersion: 1, kind, planSha256, entries: {} }
}

async function saveCheckpoint(filePath, checkpoint) {
  await writeAtomic(filePath, `${JSON.stringify(checkpoint, null, 2)}\n`)
}

function safeCatalogAsset(catalogRoot, assetPath) {
  assert(typeof assetPath === 'string' && assetPath && !path.isAbsolute(assetPath), 'invalid geometry asset path')
  const root = path.resolve(catalogRoot)
  const resolved = path.resolve(root, assetPath)
  assert(resolved.startsWith(`${root}${path.sep}`), 'geometry asset escapes catalog root')
  return resolved
}

async function targetGeometry(target, catalogRoot) {
  const geometrySource = target.coverageGeometrySource ?? target.geometrySource
  const sourcePath = safeCatalogAsset(catalogRoot, geometrySource.assetPath)
  const text = await readFile(sourcePath, 'utf8')
  assert(hash(text) === geometrySource.sha256, `${target.id}: geometry source hash changed`)
  const source = JSON.parse(text)
  if (!geometrySource.featureGb) return source
  const feature = source.features?.find(
    (candidate) => String(candidate?.properties?.gb ?? '') === String(geometrySource.featureGb)
  )
  assert(feature, `${target.id}: geometry feature is missing`)
  return { type: 'FeatureCollection', features: [feature] }
}

export function qualityBudgetForTargets(targets, quarterCount, settings) {
  let pixels = 0
  let requests = 0
  for (const target of targets) {
    const scale = settings.minimumLongDimension / Math.max(target.width, target.height)
    const tilePlan = planProcessTiles(target, {
      desiredWidth: Math.max(1, Math.round(target.width * scale)),
      desiredHeight: Math.max(1, Math.round(target.height * scale)),
      maximumMetersPerPixel: settings.maximumMetersPerPixel,
      maximumTileDimension: settings.maximumTileDimension ?? 1600
    })
    pixels += tilePlan.sourceWidth * tilePlan.sourceHeight * quarterCount
    requests += tilePlan.tiles.length * quarterCount
  }
  return {
    maximumRequestCount: requests,
    maximumOutputPixels: pixels,
    estimatedProcessingUnits: Number((pixels / (512 * 512) * 2 / 3).toFixed(3))
  }
}

export async function runQualitySelection({
  manifest,
  planText,
  catalogRoot,
  oauthClient,
  processEndpoint,
  checkpointPath,
  settings,
  targetIds = null,
  maximumAttempts = 4,
  onProgress = () => undefined
}) {
  assert(manifest.sourceContract?.sourceDecisionState === 'pinned', 'quality selection requires a pinned source decision')
  const planSha256 = hash(planText)
  const checkpoint = await loadOrCreateCheckpoint(checkpointPath, { kind: 'quality-selection', planSha256 })
  const allowed = targetIds ? new Set(targetIds) : null
  const selectedTargets = allowed ? manifest.targets.filter((target) => allowed.has(target.id)) : manifest.targets
  const qualityRank = { prefecture: 0, province: 1, country: 2 }
  const targets = [...selectedTargets].sort((left, right) =>
    qualityRank[left.targetKind] - qualityRank[right.targetKind]
  )
  const quarters = [
    manifest.sourceContract.primaryQuarter,
    ...manifest.sourceContract.fallbackQuarters
  ]
  for (const target of targets) {
    if (['available', 'unavailable'].includes(checkpoint.entries[target.id]?.status)) {
      onProgress({ target, state: checkpoint.entries[target.id], resumed: true })
      continue
    }
    const derivedTargets = target.targetKind === 'country' && settings.deriveCountryFromProvinceQuality !== false
      ? manifest.targets.filter((candidate) => candidate.targetKind === 'province')
      : target.targetKind === 'province' && settings.deriveProvinceFromPrefectureQuality !== false
        ? manifest.targets.filter((candidate) =>
            candidate.targetKind === 'prefecture' &&
            candidate.selection?.provinceGb === target.catalogGb
          )
        : []
    if (derivedTargets.length > 0) {
      const derivedStates = derivedTargets.map((candidate) => checkpoint.entries[candidate.id])
      if (derivedStates.every((state) => state?.attempts?.[0])) {
        const quarter = manifest.sourceContract.primaryQuarter
        const primaryAttempts = derivedStates.map((state) => state.attempts.find((attempt) => attempt.quarter === quarter))
        if (primaryAttempts.every(Boolean)) {
          const coveredPixels = primaryAttempts.reduce((sum, attempt) => sum + attempt.coveredPixels, 0)
          const noDataPixels = primaryAttempts.reduce((sum, attempt) => sum + attempt.noDataPixels, 0)
          const noDataRatio = Number((noDataPixels / coveredPixels).toFixed(6))
          if (noDataRatio <= manifest.sourceContract.maxNoDataRatio) {
            const derivedFrom = target.targetKind === 'country'
              ? '34-province-primary-quality-attempts'
              : 'prefecture-primary-quality-attempts'
            checkpoint.entries[target.id] = {
              status: 'available',
              chosenQuarter: quarter,
              fallbackUsed: false,
              noDataRatio,
              derivedFrom,
              attempts: [{
                quarter,
                coveredPixels,
                noDataPixels,
                noDataRatio,
                derivedFrom
              }]
            }
            await saveCheckpoint(checkpointPath, checkpoint)
            onProgress({ target, state: checkpoint.entries[target.id], resumed: false })
            continue
          }
        }
      }
    }
    const geometry = await targetGeometry(target, catalogRoot)
    const polygons = projectedPolygonsFromGeoJson(geometry, target.id)
    const scale = settings.minimumLongDimension / Math.max(target.width, target.height)
    const tilePlan = planProcessTiles(target, {
      desiredWidth: Math.max(1, Math.round(target.width * scale)),
      desiredHeight: Math.max(1, Math.round(target.height * scale)),
      maximumMetersPerPixel: settings.maximumMetersPerPixel,
      maximumTileDimension: settings.maximumTileDimension ?? 1600
    })
    const attempts = []
    let terminal = null
    for (const quarter of quarters) {
      const tileEvidence = []
      let coveredPixels = 0
      let noDataPixels = 0
      let actualProcessingUnits = 0
      let hasActualProcessingUnits = true
      let retryCount = 0
      for (const tile of tilePlan.tiles) {
        const probe = buildQualityProcessRequest(
          tile.projectedBounds,
          { width: tile.width, height: tile.height },
          quarter
        )
        const requestText = JSON.stringify(probe.request)
        const result = await requestWithRetry({
          oauthClient,
          url: processEndpoint,
          init: {
            method: 'POST',
            headers: { accept: 'image/png', 'content-type': 'application/json' },
            body: requestText
          },
          maximumAttempts
        })
        const bytes = Buffer.from(await result.response.arrayBuffer())
        const decoded = decodePngSamples(bytes)
        assert(decoded.width === tile.width && decoded.height === tile.height, `${target.id}: quality dimensions changed`)
        const coverage = rasterizeProjectedCoverage(
          polygons,
          tile.projectedBounds,
          decoded.width,
          decoded.height
        )
        const tileCoveredPixels = coverage.reduce((sum, value) => sum + value, 0)
        const masked = tileCoveredPixels > 0
          ? geometryMaskedQuality(decoded.samples, coverage)
          : { coveredPixels: 0, noDataPixels: 0, noDataRatio: 0 }
        coveredPixels += masked.coveredPixels
        noDataPixels += masked.noDataPixels
        retryCount += result.retryCount
        const actualPuHeader = result.response.headers.get('x-processingunits-spent')
          ?? result.response.headers.get('x-processing-units-spent')
        if (actualPuHeader && Number.isFinite(Number(actualPuHeader))) {
          actualProcessingUnits += Number(actualPuHeader)
        } else hasActualProcessingUnits = false
        tileEvidence.push({
          index: tile.index,
          width: tile.width,
          height: tile.height,
          projectedBounds: tile.projectedBounds,
          requestSha256: hash(requestText),
          responseSha256: hash(bytes),
          responseBytes: bytes.length
        })
      }
      const noDataRatio = Number((noDataPixels / coveredPixels).toFixed(6))
      attempts.push({
        quarter,
        sourceWidth: tilePlan.sourceWidth,
        sourceHeight: tilePlan.sourceHeight,
        tileCount: tilePlan.tiles.length,
        coveredPixels,
        noDataPixels,
        noDataRatio,
        requestSetSha256: hash(`${tileEvidence.map((tile) => tile.requestSha256).join('\n')}\n`),
        responseSetSha256: hash(`${tileEvidence.map((tile) => tile.responseSha256).join('\n')}\n`),
        evalscriptSha256: buildQualityProcessRequest([0, 0, 1, 1], { width: 1, height: 1 }, quarter).evalscriptSha256,
        retryCount,
        actualProcessingUnits: hasActualProcessingUnits ? actualProcessingUnits : null,
        tiles: tileEvidence
      })
      if (noDataRatio <= manifest.sourceContract.maxNoDataRatio) {
        terminal = {
          status: 'available',
          chosenQuarter: quarter,
          fallbackUsed: quarter !== manifest.sourceContract.primaryQuarter,
          noDataRatio,
          attempts
        }
        break
      }
    }
    checkpoint.entries[target.id] = terminal ?? {
      status: 'unavailable',
      chosenQuarter: null,
      fallbackUsed: false,
      bestQuarter: attempts.reduce(
        (best, attempt) => !best || attempt.noDataRatio < best.noDataRatio ? attempt : best,
        null
      )?.quarter ?? null,
      noDataRatio: attempts.reduce(
        (best, attempt) => Math.min(best, attempt.noDataRatio),
        1
      ),
      reason: 'no-data-threshold-exceeded-after-fallbacks',
      attempts
    }
    await saveCheckpoint(checkpointPath, checkpoint)
    onProgress({ target, state: checkpoint.entries[target.id], resumed: false })
  }
  return checkpoint
}

async function pathExists(filePath) {
  try {
    await stat(filePath)
    return true
  } catch (cause) {
    if (cause?.code === 'ENOENT') return false
    throw cause
  }
}

async function quarantine(filePath) {
  if (!await pathExists(filePath)) return null
  let index = 1
  let quarantinePath
  do {
    quarantinePath = `${filePath}.corrupt-${index}`
    index += 1
  } while (await pathExists(quarantinePath))
  await rename(filePath, quarantinePath)
  return quarantinePath
}

async function verifyExistingImage(filePath, target, expected) {
  const bytes = await readFile(filePath)
  const dimensions = jpegDimensions(bytes)
  assert(dimensions.width === target.width && dimensions.height === target.height, `${target.id}: existing image dimensions changed`)
  assert(bytes.length === expected.bytes && hash(bytes) === expected.sha256, `${target.id}: existing image hash changed`)
  return true
}

async function stitchRgbTiles(tilePlan, tiles, target) {
  if (
    tiles.length === 1 &&
    tilePlan.sourceWidth === target.width &&
    tilePlan.sourceHeight === target.height
  ) return tiles[0].bytes
  if (tiles.length === 1) {
    return sharp(tiles[0].bytes)
      .resize(target.width, target.height, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
      .jpeg({ quality: 90, chromaSubsampling: '4:2:0', mozjpeg: false })
      .toBuffer()
  }
  const composites = tiles.map(({ tile, bytes }) => ({
    input: bytes,
    left: tile.left,
    top: tile.top
  }))
  const stitched = await sharp({
    create: {
      width: tilePlan.sourceWidth,
      height: tilePlan.sourceHeight,
      channels: 3,
      background: { r: 0, g: 0, b: 0 }
    }
  })
    .composite(composites)
    .png()
    .toBuffer()
  return sharp(stitched)
    .resize(target.width, target.height, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .jpeg({ quality: 90, chromaSubsampling: '4:2:0', mozjpeg: false })
    .toBuffer()
}

async function composeCountryFromRegionalImages({
  manifest,
  target,
  checkpoint,
  outputRoot,
  catalogRoot
}) {
  assert(catalogRoot, 'country composition requires the geometry catalog root')
  const sources = manifest.targets.filter((candidate) =>
    candidate.targetKind === 'prefecture' &&
    checkpoint.entries[candidate.id]?.status === 'complete'
  )
  assert(sources.length >= 340, 'country composition does not have complete prefecture sources')
  const [countryMinX, countryMinY, countryMaxX, countryMaxY] = target.projectedBounds
  const countrySpanX = countryMaxX - countryMinX
  const countrySpanY = countryMaxY - countryMinY
  const composites = []
  const constituents = []
  for (const sourceTarget of sources) {
    const state = checkpoint.entries[sourceTarget.id]
    const [minX, minY, maxX, maxY] = sourceTarget.projectedBounds
    const left = Math.round((minX - countryMinX) / countrySpanX * target.width)
    const right = Math.round((maxX - countryMinX) / countrySpanX * target.width)
    const top = Math.round((countryMaxY - maxY) / countrySpanY * target.height)
    const bottom = Math.round((countryMaxY - minY) / countrySpanY * target.height)
    assert(left >= 0 && top >= 0 && right <= target.width && bottom <= target.height, `${sourceTarget.id}: country composition placement is outside the target`)
    const width = right - left
    const height = bottom - top
    assert(width > 0 && height > 0, `${sourceTarget.id}: country composition placement is empty`)
    const tileBounds = [
      countryMinX + left / target.width * countrySpanX,
      countryMaxY - bottom / target.height * countrySpanY,
      countryMinX + right / target.width * countrySpanX,
      countryMaxY - top / target.height * countrySpanY
    ]
    const geometry = await targetGeometry(sourceTarget, catalogRoot)
    const polygons = projectedPolygonsFromGeoJson(geometry, sourceTarget.id)
    const coverage = rasterizeProjectedCoverage(polygons, tileBounds, width, height)
    const rgb = await sharp(path.join(outputRoot, sourceTarget.assetPath))
      .resize(width, height, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
      .removeAlpha()
      .raw()
      .toBuffer()
    const rgba = Buffer.alloc(width * height * 4)
    for (let pixel = 0; pixel < coverage.length; pixel += 1) {
      const rgbOffset = pixel * 3
      const rgbaOffset = pixel * 4
      rgba[rgbaOffset] = rgb[rgbOffset]
      rgba[rgbaOffset + 1] = rgb[rgbOffset + 1]
      rgba[rgbaOffset + 2] = rgb[rgbOffset + 2]
      rgba[rgbaOffset + 3] = coverage[pixel] ? 255 : 0
    }
    composites.push({ input: rgba, raw: { width, height, channels: 4 }, left, top })
    constituents.push({
      targetId: sourceTarget.id,
      chosenQuarter: state.chosenQuarter,
      sha256: state.sha256,
      projectedBounds: sourceTarget.projectedBounds,
      placement: { left, top, width, height }
    })
  }
  const bytes = await sharp({
    create: {
      width: target.width,
      height: target.height,
      channels: 3,
      background: { r: 0, g: 0, b: 0 }
    }
  })
    .composite(composites)
    .jpeg({ quality: 90, chromaSubsampling: '4:2:0', mozjpeg: false })
    .toBuffer()
  return { bytes, constituents }
}

export async function runImageGeneration({
  manifest,
  planText,
  qualityCheckpoint,
  oauthClient,
  processEndpoint,
  checkpointPath,
  outputRoot,
  catalogRoot = null,
  targetIds = null,
  maximumAttempts = 4,
  onProgress = () => undefined
}) {
  const planSha256 = hash(planText)
  validateCheckpoint(qualityCheckpoint, { kind: 'quality-selection', planSha256 })
  const checkpoint = await loadOrCreateCheckpoint(checkpointPath, { kind: 'image-generation', planSha256 })
  const allowed = targetIds ? new Set(targetIds) : null
  const selectedTargets = allowed ? manifest.targets.filter((target) => allowed.has(target.id)) : manifest.targets
  const targets = [...selectedTargets].sort((left, right) =>
    Number(left.targetKind === 'country') - Number(right.targetKind === 'country')
  )
  for (const target of targets) {
    const quality = qualityCheckpoint.entries[target.id]
    assert(quality && ['available', 'unavailable'].includes(quality.status), `${target.id}: missing terminal quality decision`)
    if (quality.status === 'unavailable') {
      const bestAttempt = quality.attempts?.reduce(
        (best, attempt) => !best || attempt.noDataRatio < best.noDataRatio ? attempt : best,
        null
      )
      checkpoint.entries[target.id] = {
        status: 'unavailable',
        reason: quality.reason,
        bestQuarter: bestAttempt?.quarter ?? quality.bestQuarter ?? null,
        noDataRatio: bestAttempt?.noDataRatio ?? quality.noDataRatio
      }
      await saveCheckpoint(checkpointPath, checkpoint)
      onProgress({ target, state: checkpoint.entries[target.id], resumed: false })
      continue
    }
    const existingState = checkpoint.entries[target.id]
    const outputPath = path.join(outputRoot, target.assetPath)
    if (target.targetKind === 'country') {
      if (existingState?.status === 'complete' && existingState.compositionMode === 'local-prefecture-mask-composite-v2') {
        try {
          await verifyExistingImage(outputPath, target, existingState)
          onProgress({ target, state: existingState, resumed: true })
          continue
        } catch {
          const quarantinePath = await quarantine(outputPath)
          checkpoint.entries[target.id] = {
            status: 'quarantined',
            quarantinePath: quarantinePath ? path.relative(outputRoot, quarantinePath) : null
          }
          await saveCheckpoint(checkpointPath, checkpoint)
        }
      }
      const rejectedDirectGeneration = existingState?.status === 'complete'
        ? existingState
        : existingState?.rejectedDirectGeneration ?? null
      if (await pathExists(outputPath)) {
        const rejectedPath = await quarantine(outputPath)
        if (rejectedDirectGeneration && rejectedPath) {
          rejectedDirectGeneration.rejectedAssetPath = path.relative(outputRoot, rejectedPath)
          rejectedDirectGeneration.rejectionReason = 'visual-review-black-no-data-blocks'
        }
      }
      const composed = await composeCountryFromRegionalImages({
        manifest,
        target,
        checkpoint,
        outputRoot,
        catalogRoot
      })
      const dimensions = jpegDimensions(composed.bytes)
      assert(dimensions.width === target.width && dimensions.height === target.height, `${target.id}: composed country dimensions changed`)
      await writeAtomic(outputPath, composed.bytes)
      const constituentQuarters = [...new Set(composed.constituents.map((item) => item.chosenQuarter))].sort()
      checkpoint.entries[target.id] = {
        status: 'complete',
        assetPath: target.assetPath,
        chosenQuarter: quality.chosenQuarter,
        constituentQuarters,
        fallbackUsed: constituentQuarters.some((quarter) => quarter !== manifest.sourceContract.primaryQuarter),
        noDataRatio: quality.noDataRatio,
        width: dimensions.width,
        height: dimensions.height,
        bytes: composed.bytes.length,
        sha256: hash(composed.bytes),
        sourceWidth: target.width,
        sourceHeight: target.height,
        tileCount: 0,
        requestSetSha256: hash('local-prefecture-mask-composite-v2\n'),
        responseSetSha256: hash(`${composed.constituents.map((item) => item.sha256).join('\n')}\n`),
        evalscriptSha256: manifest.sourceContract.colorTransformSha256,
        retryCount: 0,
        actualProcessingUnits: 0,
        compositionMode: 'local-prefecture-mask-composite-v2',
        constituents: composed.constituents,
        ...(rejectedDirectGeneration ? { rejectedDirectGeneration } : {})
      }
      await saveCheckpoint(checkpointPath, checkpoint)
      onProgress({ target, state: checkpoint.entries[target.id], resumed: false })
      continue
    }
    if (existingState?.status === 'complete') {
      try {
        await verifyExistingImage(outputPath, target, existingState)
        onProgress({ target, state: existingState, resumed: true })
        continue
      } catch {
        const quarantinePath = await quarantine(outputPath)
        checkpoint.entries[target.id] = {
          status: 'quarantined',
          quarantinePath: quarantinePath ? path.relative(outputRoot, quarantinePath) : null
        }
        await saveCheckpoint(checkpointPath, checkpoint)
      }
    } else if (await pathExists(outputPath)) {
      const quarantinePath = await quarantine(outputPath)
      checkpoint.entries[target.id] = {
        status: 'quarantined',
        quarantinePath: path.relative(outputRoot, quarantinePath)
      }
      await saveCheckpoint(checkpointPath, checkpoint)
    }

    const tilePlan = planRgbTiles(target)
    const tileBuffers = []
    const tileEvidence = []
    let retryCount = 0
    let actualProcessingUnits = 0
    let hasActualProcessingUnits = true
    let evalscriptSha256 = null
    for (const tile of tilePlan.tiles) {
      const processRequest = buildRgbProcessRequest(
        target,
        quality.chosenQuarter,
        { width: tile.width, height: tile.height },
        tile.projectedBounds
      )
      assert(processRequest.evalscriptSha256 === manifest.sourceContract.colorTransformSha256, `${target.id}: color transform hash changed`)
      evalscriptSha256 = processRequest.evalscriptSha256
      const requestText = JSON.stringify(processRequest.request)
      const result = await requestWithRetry({
        oauthClient,
        url: processEndpoint,
        init: {
          method: 'POST',
          headers: { accept: 'image/jpeg', 'content-type': 'application/json' },
          body: requestText
        },
        maximumAttempts
      })
      const tileBytes = Buffer.from(await result.response.arrayBuffer())
      const tileDimensions = jpegDimensions(tileBytes)
      assert(tileDimensions.width === tile.width && tileDimensions.height === tile.height, `${target.id}: generated tile dimensions changed`)
      retryCount += result.retryCount
      const actualPuHeader = result.response.headers.get('x-processingunits-spent')
        ?? result.response.headers.get('x-processing-units-spent')
      if (actualPuHeader && Number.isFinite(Number(actualPuHeader))) {
        actualProcessingUnits += Number(actualPuHeader)
      } else hasActualProcessingUnits = false
      tileBuffers.push({ tile, bytes: tileBytes })
      tileEvidence.push({
        index: tile.index,
        width: tile.width,
        height: tile.height,
        projectedBounds: tile.projectedBounds,
        requestSha256: hash(requestText),
        responseSha256: hash(tileBytes),
        responseBytes: tileBytes.length
      })
    }
    const bytes = await stitchRgbTiles(tilePlan, tileBuffers, target)
    const dimensions = jpegDimensions(bytes)
    assert(dimensions.width === target.width && dimensions.height === target.height, `${target.id}: generated image dimensions changed`)
    assert(bytes.length > 500, `${target.id}: generated image is implausibly small`)
    await writeAtomic(outputPath, bytes)
    checkpoint.entries[target.id] = {
      status: 'complete',
      assetPath: target.assetPath,
      chosenQuarter: quality.chosenQuarter,
      fallbackUsed: quality.fallbackUsed,
      noDataRatio: quality.noDataRatio,
      width: dimensions.width,
      height: dimensions.height,
      bytes: bytes.length,
      sha256: hash(bytes),
      sourceWidth: tilePlan.sourceWidth,
      sourceHeight: tilePlan.sourceHeight,
      tileCount: tilePlan.tiles.length,
      requestSetSha256: hash(`${tileEvidence.map((tile) => tile.requestSha256).join('\n')}\n`),
      responseSetSha256: hash(`${tileEvidence.map((tile) => tile.responseSha256).join('\n')}\n`),
      evalscriptSha256,
      retryCount,
      actualProcessingUnits: hasActualProcessingUnits ? actualProcessingUnits : null,
      tiles: tileEvidence
    }
    await saveCheckpoint(checkpointPath, checkpoint)
    onProgress({ target, state: checkpoint.entries[target.id], resumed: false })
  }
  return checkpoint
}

export function planRgbTiles(target) {
  const initial = planProcessTiles(target)
  return initial.tiles.length > 1
    ? planProcessTiles(target, { maximumTileDimension: 1600 })
    : initial
}

export async function readVerifiedCheckpoint(filePath, expected) {
  const checkpoint = await readJsonIfPresent(filePath)
  assert(checkpoint, `${expected.kind} checkpoint does not exist`)
  return validateCheckpoint(checkpoint, expected)
}
