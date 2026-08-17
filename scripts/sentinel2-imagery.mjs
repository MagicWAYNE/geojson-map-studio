#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import {
  buildImageryJobManifest,
  serializeImageryJobManifest,
  verifyImageryJobManifest
} from './sentinel2/target-planner.mjs'
import { createOAuthClient } from './sentinel2/oauth-client.mjs'
import {
  assertWithinBudget,
  buildQualityProbeRequest,
  buildRgbProcessRequest,
  estimateProbeBudget,
  jpegDimensions,
  probeDimensions,
  qualityFromPng,
  quarterTimeRange,
  validateOfficialCollection,
  validateOfficialStacCollection,
  validateQuarterlyItems
} from './sentinel2/source-quality.mjs'
import {
  qualityBudgetForTargets,
  planRgbTiles,
  readVerifiedCheckpoint,
  runImageGeneration,
  runQualitySelection
} from './sentinel2/generator.mjs'
import {
  packageRuntimeLibrary,
  verifyRuntimeLibrary
} from './sentinel2/runtime-library.mjs'

const scriptPath = fileURLToPath(import.meta.url)
const projectRoot = path.resolve(path.dirname(scriptPath), '..')
const defaults = Object.freeze({
  config: path.join(projectRoot, '.scratch/sentinel2-local-imagery-v1/harness-config.example.json'),
  output: path.join(projectRoot, '.scratch/sentinel2-local-imagery-v1/artifacts/job-manifest.json'),
  pilot: path.join(projectRoot, '.scratch/sentinel2-local-imagery-v1/fixtures/pilot-targets.json'),
  probeOutput: path.join(projectRoot, '.scratch/sentinel2-local-imagery-v1/artifacts/quality-probe.json'),
  previewOutput: path.join(projectRoot, '.scratch/sentinel2-local-imagery-v1/artifacts/rgb-previews.json'),
  qualityCheckpoint: path.join(projectRoot, '.scratch/sentinel2-local-imagery-v1/work/quality-selection-v3.json'),
  imageCheckpoint: path.join(projectRoot, '.scratch/sentinel2-local-imagery-v1/work/image-generation.json'),
  imageRoot: path.join(projectRoot, '.scratch/sentinel2-local-imagery-v1/work/images'),
  packageRoot: path.join(projectRoot, 'public/imagery-library/sentinel2-quarterly-2025q2-v1')
})

function parseArguments(argv) {
  const [command = '', ...values] = argv
  const options = {}
  for (let index = 0; index < values.length; index += 1) {
    const name = values[index]
    if (!name.startsWith('--')) {
      throw new Error(`invalid argument: ${name}`)
    }
    if (!values[index + 1] || values[index + 1].startsWith('--')) {
      options[name.slice(2)] = true
      continue
    }
    options[name.slice(2)] = values[index + 1]
    index += 1
  }
  return { command, options }
}

async function readConfig(configPath) {
  const config = JSON.parse(await readFile(configPath, 'utf8'))
  if (config.schemaVersion !== 1) throw new Error('harness config schemaVersion must be 1')
  if (config.geometry?.projection !== 'EPSG:3857') throw new Error('harness projection must be EPSG:3857')
  return config
}

async function writeAtomic(destination, text) {
  await mkdir(path.dirname(destination), { recursive: true })
  const temporary = `${destination}.tmp-${process.pid}`
  try {
    await writeFile(temporary, text, { flag: 'wx' })
    await rename(temporary, destination)
  } catch (cause) {
    await unlink(temporary).catch(() => undefined)
    throw cause
  }
}

function digest(text) {
  return createHash('sha256').update(text).digest('hex')
}

function unquote(value) {
  const text = value.trim()
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1)
  }
  return text.replace(/\s+#.*$/, '').trim()
}

async function loadCredentials(config) {
  const source = await readFile(path.join(projectRoot, '.env'), 'utf8')
  const values = {}
  for (const rawLine of source.split(/\r?\n/)) {
    const match = rawLine.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (match) values[match[1]] = unquote(match[2])
  }
  const clientId = values[config.source.credentialEnvironment.clientId]
  const clientSecret = values[config.source.credentialEnvironment.clientSecret]
  if (!clientId || !clientSecret) throw new Error('project-local CDSE OAuth credentials are missing')
  return { clientId, clientSecret }
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function checkedPublicJson(url, init = {}) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, init)
    if (response.ok) {
      try {
        return await response.json()
      } catch {
        throw new Error('official public source response was not valid JSON')
      }
    }
    const retryable = response.status === 429 || response.status >= 500
    if (!retryable || attempt === 3) {
      throw new Error(`official public source request failed (HTTP ${response.status})`)
    }
    const retryAfter = Number(response.headers.get('retry-after'))
    const delay = Number.isFinite(retryAfter) && retryAfter >= 0
      ? Math.min(retryAfter * 1000, 10_000)
      : 1000 * 2 ** attempt
    await sleep(delay)
  }
  throw new Error('official public source request exhausted retries')
}

function resolvePilotTargets(manifest, fixture) {
  return fixture.targets.map((pilot) => {
    const matches = manifest.targets.filter((target) => target.gb === pilot.gb)
    const target = pilot.case === 'province-equivalent'
      ? matches.find((candidate) => candidate.targetKind === 'prefecture')
      : matches.find((candidate) => candidate.targetKind === 'prefecture') ?? matches[0]
    if (!target || target.label !== pilot.name) throw new Error(`pilot target not found: ${pilot.gb} ${pilot.name}`)
    return { ...pilot, target }
  })
}

async function authenticatedSourcePreflight(config, oauth, pilots, quarters) {
  const collectionResponse = await oauth.checkedFetch(config.source.collectionEndpoint)
  const collection = validateOfficialCollection(await collectionResponse.json())
  const stacCollection = validateOfficialStacCollection(
    await checkedPublicJson(config.source.stacCollectionEndpoint)
  )
  const availability = []
  for (const pilot of pilots) {
    const firstRange = quarterTimeRange(quarters[0])
    const lastRange = quarterTimeRange(quarters.at(-1))
    const response = await checkedPublicJson(config.source.stacSearchEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        collections: [config.source.stacCollection],
        bbox: pilot.target.geometryBounds,
        datetime: `${firstRange.from}/${lastRange.to}`,
        limit: 1000
      })
    })
    validateQuarterlyItems(response, quarters)
    for (const quarter of quarters) {
      const marker = quarter.replace('-', '_')
      const itemIds = response.features
        .map((item) => item.id)
        .filter((id) => String(id).includes(marker))
        .sort()
      availability.push({
        gb: pilot.gb,
        quarter,
        itemCount: itemIds.length,
        itemIdsSha256: digest(`${itemIds.join('\n')}\n`)
      })
    }
    await sleep(250)
  }
  return {
    oauthTokenLifetimeSeconds: 1800,
    sentinelHubCollection: collection.id,
    collectionTitle: collection.title,
    bands: collection.summaries['eo:bands'].map((band) => band.name),
    stacCollection: stacCollection.id,
    availability
  }
}

async function loadProbeInputs(configPath, options) {
  const config = await readConfig(configPath)
  const planPath = path.resolve(options.plan ?? defaults.output)
  const planText = await readFile(planPath, 'utf8')
  const manifest = verifyImageryJobManifest(JSON.parse(planText))
  const fixturePath = path.resolve(typeof options.pilot === 'string' ? options.pilot : defaults.pilot)
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'))
  if (fixture.schemaVersion !== 1 || !Array.isArray(fixture.targets)) throw new Error('invalid pilot fixture')
  const pilots = resolvePilotTargets(manifest, fixture)
  const quarters = config.sourceDecision.candidateQuarters
  for (const quarter of quarters) quarterTimeRange(quarter)
  const estimate = assertWithinBudget(
    estimateProbeBudget({
      targets: pilots.map((pilot) => pilot.target),
      quarterCount: quarters.length,
      minimumLongDimension: config.qualityProbe.minimumLongDimension,
      maximumMetersPerPixel: config.qualityProbe.maximumMetersPerPixel
    }),
    config.qualityProbe
  )
  return { config, planPath, planText, pilots, quarters, estimate }
}

async function preflight(options) {
  const configPath = path.resolve(options.config ?? defaults.config)
  const inputs = await loadProbeInputs(configPath, options)
  process.stdout.write(
    `Preflight budget: ${inputs.estimate.requestCount} quality requests, ` +
    `<=${inputs.estimate.estimatedProcessingUnits} estimated PU\n`
  )
  if (!options.execute) {
    process.stdout.write('Dry run only; pass --execute to perform authenticated source checks.\n')
    return
  }
  const credentials = await loadCredentials(inputs.config)
  const oauth = createOAuthClient({
    tokenEndpoint: inputs.config.source.tokenEndpoint,
    ...credentials
  })
  const evidence = await authenticatedSourcePreflight(
    inputs.config,
    oauth,
    inputs.pilots,
    inputs.quarters
  )
  process.stdout.write(
    `Authenticated source preflight passed: ${evidence.sentinelHubCollection}; ` +
    `${evidence.availability.length} target-quarter availability checks.\n`
  )
}

async function probe(options) {
  const configPath = path.resolve(options.config ?? defaults.config)
  const inputs = await loadProbeInputs(configPath, options)
  const outputPath = path.resolve(options.output ?? defaults.probeOutput)
  process.stdout.write(
    `Quality probe budget: ${inputs.estimate.requestCount} requests, ` +
    `${inputs.estimate.maximumOutputPixels} maximum pixels, ` +
    `<=${inputs.estimate.estimatedProcessingUnits} estimated PU\n`
  )
  if (!options.execute) {
    process.stdout.write('Dry run only; pass --execute to consume the stated free-quota budget.\n')
    return
  }
  const credentials = await loadCredentials(inputs.config)
  const oauth = createOAuthClient({
    tokenEndpoint: inputs.config.source.tokenEndpoint,
    ...credentials
  })
  const sourceEvidence = await authenticatedSourcePreflight(
    inputs.config,
    oauth,
    inputs.pilots,
    inputs.quarters
  )
  const results = []
  for (const pilot of inputs.pilots) {
    for (const quarter of inputs.quarters) {
      const probeRequest = buildQualityProbeRequest(
        pilot.target,
        quarter,
        inputs.config.qualityProbe.minimumLongDimension,
        inputs.config.qualityProbe.maximumMetersPerPixel
      )
      const requestText = JSON.stringify(probeRequest.request)
      const response = await oauth.checkedFetch(inputs.config.source.processEndpoint, {
        method: 'POST',
        headers: {
          accept: 'image/png',
          'content-type': 'application/json'
        },
        body: requestText
      })
      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.toLowerCase().includes('image/png')) {
        throw new Error(`quality probe returned unexpected content type for ${pilot.gb} ${quarter}`)
      }
      const bytes = Buffer.from(await response.arrayBuffer())
      const quality = qualityFromPng(bytes)
      if (quality.width !== probeRequest.dimensions.width || quality.height !== probeRequest.dimensions.height) {
        throw new Error(`quality probe dimensions changed for ${pilot.gb} ${quarter}`)
      }
      const actualPuHeader = response.headers.get('x-processingunits-spent')
        ?? response.headers.get('x-processing-units-spent')
      results.push({
        gb: pilot.gb,
        label: pilot.name,
        case: pilot.case,
        quarter,
        requestSha256: digest(requestText),
        evalscriptSha256: probeRequest.evalscriptSha256,
        responseSha256: digest(bytes),
        responseBytes: bytes.length,
        actualProcessingUnits: actualPuHeader && Number.isFinite(Number(actualPuHeader))
          ? Number(actualPuHeader)
          : null,
        ...quality
      })
      process.stdout.write(`${pilot.gb} ${quarter}: no-data ${(quality.noDataRatio * 100).toFixed(2)}%\n`)
    }
  }
  const artifact = {
    schemaVersion: 1,
    observedDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore' }).format(new Date()),
    planSha256: digest(inputs.planText),
    source: sourceEvidence,
    budget: inputs.estimate,
    minimumLongDimension: inputs.config.qualityProbe.minimumLongDimension,
    maximumMetersPerPixel: inputs.config.qualityProbe.maximumMetersPerPixel,
    results
  }
  await writeAtomic(outputPath, `${JSON.stringify(artifact, null, 2)}\n`)
  process.stdout.write(`Quality evidence: ${outputPath}\n`)
}

async function preview(options) {
  const configPath = path.resolve(options.config ?? defaults.config)
  const inputs = await loadProbeInputs(configPath, options)
  const outputPath = path.resolve(options.output ?? defaults.previewOutput)
  const previewTargets = inputs.pilots.map((pilot) => pilot.target)
  const estimate = assertWithinBudget(
    estimateProbeBudget({
      targets: previewTargets,
      quarterCount: inputs.quarters.length,
      minimumLongDimension: inputs.config.qualityProbe.minimumLongDimension,
      maximumMetersPerPixel: inputs.config.qualityProbe.maximumMetersPerPixel,
      inputBandCount: 3
    }),
    inputs.config.preview
  )
  process.stdout.write(
    `RGB preview budget: ${estimate.requestCount} requests, ` +
    `${estimate.maximumOutputPixels} pixels, <=${estimate.estimatedProcessingUnits} estimated PU\n`
  )
  if (!options.execute) {
    process.stdout.write('Dry run only; pass --execute to create RGB preview evidence.\n')
    return
  }
  const credentials = await loadCredentials(inputs.config)
  const oauth = createOAuthClient({ tokenEndpoint: inputs.config.source.tokenEndpoint, ...credentials })
  const collectionResponse = await oauth.checkedFetch(inputs.config.source.collectionEndpoint)
  validateOfficialCollection(await collectionResponse.json())
  const results = []
  for (const pilot of inputs.pilots) {
    const dimensions = probeDimensions(
      pilot.target,
      inputs.config.qualityProbe.minimumLongDimension,
      inputs.config.qualityProbe.maximumMetersPerPixel
    )
    for (const quarter of inputs.quarters) {
      const processRequest = buildRgbProcessRequest(pilot.target, quarter, dimensions)
      const requestText = JSON.stringify(processRequest.request)
      const response = await oauth.checkedFetch(inputs.config.source.processEndpoint, {
        method: 'POST',
        headers: { accept: 'image/jpeg', 'content-type': 'application/json' },
        body: requestText
      })
      const bytes = Buffer.from(await response.arrayBuffer())
      const decodedDimensions = jpegDimensions(bytes)
      if (decodedDimensions.width !== dimensions.width || decodedDimensions.height !== dimensions.height) {
        throw new Error(`RGB preview dimensions changed for ${pilot.gb} ${quarter}`)
      }
      const relativePath = `rgb-previews/${pilot.gb}-${quarter}.jpg`
      await writeAtomic(path.join(path.dirname(outputPath), relativePath), bytes)
      const actualPuHeader = response.headers.get('x-processingunits-spent')
        ?? response.headers.get('x-processing-units-spent')
      results.push({
        gb: pilot.gb,
        label: pilot.name,
        case: pilot.case,
        quarter,
        assetPath: relativePath,
        width: dimensions.width,
        height: dimensions.height,
        bytes: bytes.length,
        sha256: digest(bytes),
        requestSha256: digest(requestText),
        evalscriptSha256: processRequest.evalscriptSha256,
        actualProcessingUnits: actualPuHeader && Number.isFinite(Number(actualPuHeader))
          ? Number(actualPuHeader)
          : null
      })
      process.stdout.write(`${pilot.gb} ${quarter}: ${dimensions.width}x${dimensions.height}, ${bytes.length} bytes\n`)
    }
  }
  const artifact = {
    schemaVersion: 1,
    observedDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore' }).format(new Date()),
    planSha256: digest(inputs.planText),
    budget: estimate,
    colorTransform: 'rgb-dn10000-gain-2.5-gamma-0.9-clamp',
    results
  }
  await writeAtomic(outputPath, `${JSON.stringify(artifact, null, 2)}\n`)
  process.stdout.write(`RGB preview evidence: ${outputPath}\n`)
}

function generationTargets(manifest, pilots, options) {
  if (options.pilot === true) return pilots.map((pilot) => pilot.target)
  if (typeof options.allow === 'string') {
    const allowed = new Set(options.allow.split(',').map((value) => value.trim()).filter(Boolean))
    const matches = manifest.targets.filter((target) => allowed.has(target.id) || allowed.has(target.gb))
    if (matches.length === 0 || matches.length !== allowed.size) {
      throw new Error('--allow must resolve every comma-separated target id or unique gb')
    }
    return matches
  }
  return manifest.targets
}

function budgetLimit(config, options) {
  const override = options['max-pu'] === undefined ? null : Number(options['max-pu'])
  if (override !== null && (!Number.isFinite(override) || override <= 0)) throw new Error('--max-pu must be a positive number')
  return override ?? config.processing.maximumProcessingUnits
}

async function quality(options) {
  const configPath = path.resolve(options.config ?? defaults.config)
  const inputs = await loadProbeInputs(configPath, options)
  const targets = generationTargets(
    verifyImageryJobManifest(JSON.parse(inputs.planText)),
    inputs.pilots,
    options
  )
  const manifest = verifyImageryJobManifest(JSON.parse(inputs.planText))
  const quarterCount = 1 + manifest.sourceContract.fallbackQuarters.length
  const budget = qualityBudgetForTargets(targets, quarterCount, inputs.config.qualityProbe)
  const maximumPu = budgetLimit(inputs.config, options)
  if (budget.maximumRequestCount > inputs.config.processing.maximumRequests) {
    throw new Error(`quality request budget exceeded: ${budget.maximumRequestCount}`)
  }
  if (budget.estimatedProcessingUnits > maximumPu) {
    throw new Error(`quality PU budget exceeded: ${budget.estimatedProcessingUnits} > ${maximumPu}`)
  }
  process.stdout.write(
    `Quality-selection worst-case budget: ${targets.length} targets, ` +
    `${budget.maximumRequestCount} requests, <=${budget.estimatedProcessingUnits} estimated PU\n`
  )
  if (!options.execute) {
    process.stdout.write('Dry run only; pass --execute to run resumable geometry-masked quality selection.\n')
    return
  }
  const credentials = await loadCredentials(inputs.config)
  const oauth = createOAuthClient({ tokenEndpoint: inputs.config.source.tokenEndpoint, ...credentials })
  const collectionResponse = await oauth.checkedFetch(inputs.config.source.collectionEndpoint)
  validateOfficialCollection(await collectionResponse.json())
  const checkpointPath = path.resolve(options.checkpoint ?? defaults.qualityCheckpoint)
  const checkpoint = await runQualitySelection({
    manifest,
    planText: inputs.planText,
    catalogRoot: path.resolve(projectRoot, inputs.config.geometry.catalogBase),
    oauthClient: oauth,
    processEndpoint: inputs.config.source.processEndpoint,
    checkpointPath,
    settings: inputs.config.qualityProbe,
    targetIds: targets.map((target) => target.id),
    onProgress: ({ target, state, resumed }) => {
      process.stdout.write(
        `${resumed ? 'resume' : 'quality'} ${target.id}: ${state.status}` +
        `${state.chosenQuarter ? ` ${state.chosenQuarter}` : ''}` +
        `${Number.isFinite(state.noDataRatio) ? ` ${(state.noDataRatio * 100).toFixed(2)}%` : ''}\n`
      )
    }
  })
  const terminalCount = targets.filter((target) =>
    ['available', 'unavailable'].includes(checkpoint.entries[target.id]?.status)
  ).length
  process.stdout.write(`Quality checkpoint: ${checkpointPath} (${terminalCount}/${targets.length} selected targets terminal)\n`)
}

function imageBudget(targets) {
  let requestCount = 0
  let pixels = 0
  for (const target of targets) {
    if (target.targetKind === 'country') continue
    const tilePlan = planRgbTiles(target)
    requestCount += tilePlan.tiles.length
    pixels += tilePlan.sourceWidth * tilePlan.sourceHeight
  }
  return {
    requestCount,
    sourcePixels: pixels,
    estimatedProcessingUnits: Number((pixels / (512 * 512)).toFixed(3))
  }
}

async function fetchImages(options) {
  const configPath = path.resolve(options.config ?? defaults.config)
  const inputs = await loadProbeInputs(configPath, options)
  const manifest = verifyImageryJobManifest(JSON.parse(inputs.planText))
  const targets = generationTargets(manifest, inputs.pilots, options)
  const budget = imageBudget(targets)
  const maximumPu = budgetLimit(inputs.config, options)
  if (budget.requestCount > inputs.config.processing.maximumRequests) {
    throw new Error(`image request budget exceeded: ${budget.requestCount}`)
  }
  if (budget.estimatedProcessingUnits > maximumPu) {
    throw new Error(`image PU budget exceeded: ${budget.estimatedProcessingUnits} > ${maximumPu}`)
  }
  process.stdout.write(
    `Image-generation budget: ${targets.length} targets, ${budget.requestCount} requests, ` +
    `${budget.sourcePixels} source pixels, <=${budget.estimatedProcessingUnits} estimated PU\n`
  )
  if (!options.execute) {
    process.stdout.write('Dry run only; pass --execute to run resumable image generation.\n')
    return
  }
  const planSha256 = digest(inputs.planText)
  const qualityCheckpoint = await readVerifiedCheckpoint(
    path.resolve(options.quality ?? defaults.qualityCheckpoint),
    { kind: 'quality-selection', planSha256 }
  )
  const credentials = await loadCredentials(inputs.config)
  const oauth = createOAuthClient({ tokenEndpoint: inputs.config.source.tokenEndpoint, ...credentials })
  const collectionResponse = await oauth.checkedFetch(inputs.config.source.collectionEndpoint)
  validateOfficialCollection(await collectionResponse.json())
  const checkpointPath = path.resolve(options.checkpoint ?? defaults.imageCheckpoint)
  const outputRoot = path.resolve(options.root ?? defaults.imageRoot)
  const checkpoint = await runImageGeneration({
    manifest,
    planText: inputs.planText,
    qualityCheckpoint,
    oauthClient: oauth,
    processEndpoint: inputs.config.source.processEndpoint,
    checkpointPath,
    outputRoot,
    catalogRoot: path.resolve(projectRoot, inputs.config.geometry.catalogBase),
    targetIds: targets.map((target) => target.id),
    onProgress: ({ target, state, resumed }) => {
      process.stdout.write(
        `${resumed ? 'resume' : 'image'} ${target.id}: ${state.status}` +
        `${state.chosenQuarter ? ` ${state.chosenQuarter}` : ''}` +
        `${state.bytes ? ` ${state.bytes} bytes` : ''}\n`
      )
    }
  })
  const completeCount = targets.filter((target) =>
    ['complete', 'unavailable'].includes(checkpoint.entries[target.id]?.status)
  ).length
  process.stdout.write(`Image checkpoint: ${checkpointPath} (${completeCount}/${targets.length} selected targets terminal)\n`)
}

async function packageLibrary(options) {
  const planPath = path.resolve(options.plan ?? defaults.output)
  const planText = await readFile(planPath, 'utf8')
  const plan = verifyImageryJobManifest(JSON.parse(planText))
  const planSha256 = digest(planText)
  const imageCheckpoint = await readVerifiedCheckpoint(
    path.resolve(options.checkpoint ?? defaults.imageCheckpoint),
    { kind: 'image-generation', planSha256 }
  )
  const qualityCheckpoint = await readVerifiedCheckpoint(
    path.resolve(options.quality ?? defaults.qualityCheckpoint),
    { kind: 'quality-selection', planSha256 }
  )
  const packageRoot = path.resolve(options.root ?? defaults.packageRoot)
  const result = await packageRuntimeLibrary({
    plan,
    planText,
    imageCheckpoint,
    qualityCheckpoint,
    imageRoot: path.resolve(options.images ?? defaults.imageRoot),
    packageRoot
  })
  process.stdout.write(
    `Runtime imagery library packaged: ${result.availableCount} available, ` +
    `${result.unavailableCount} unavailable, ${result.totalBytes} image bytes\n` +
    `Package: ${packageRoot}\nManifest SHA-256: ${result.manifestSha256}\n` +
    `Inventory SHA-256: ${result.inventorySha256}\n`
  )
}

async function verifyLibrary(options) {
  const packageRoot = path.resolve(options.root ?? defaults.packageRoot)
  const result = await verifyRuntimeLibrary({ packageRoot })
  process.stdout.write(
    `Verified runtime imagery library: ${result.targetCount} targets, ` +
    `${result.availableCount} available, ${result.unavailableCount} unavailable, ` +
    `${result.fileCount} files\nManifest SHA-256: ${result.manifestSha256}\n` +
    `Inventory SHA-256: ${result.inventorySha256}\n`
  )
}

async function plan(options) {
  const configPath = path.resolve(options.config ?? defaults.config)
  const outputPath = path.resolve(options.output ?? defaults.output)
  const config = await readConfig(configPath)
  const catalogRoot = path.resolve(projectRoot, config.geometry.catalogBase)
  const manifest = await buildImageryJobManifest({
    catalogRoot,
    paddingPerSide: config.geometry.paddingPerSide,
    maxDimension: config.geometry.maxDimension,
    sourceDecision: config.sourceDecision
  })
  const text = serializeImageryJobManifest(manifest)
  await writeAtomic(outputPath, text)
  process.stdout.write(
    `Planned ${manifest.summary.targetCount} local imagery targets ` +
    `(${manifest.summary.outputPixels} pixels; ` +
    `${manifest.summary.estimatedProcessingUnits.threeBand} estimated 3-band PU)\n` +
    `Manifest: ${outputPath}\nSHA-256: ${digest(text)}\n`
  )
}

async function verifyPlan(options) {
  const inputPath = path.resolve(options.input ?? options.output ?? defaults.output)
  const text = await readFile(inputPath, 'utf8')
  const manifest = verifyImageryJobManifest(JSON.parse(text))
  const canonical = serializeImageryJobManifest(manifest)
  if (canonical !== text) throw new Error('job manifest is valid but not canonical deterministic JSON')
  process.stdout.write(
    `Verified ${manifest.summary.targetCount} local imagery targets\n` +
    `Manifest: ${inputPath}\nSHA-256: ${digest(text)}\n`
  )
}

const { command, options } = parseArguments(process.argv.slice(2))
try {
  if (command === 'plan') await plan(options)
  else if (command === 'verify-plan') await verifyPlan(options)
  else if (command === 'preflight') await preflight(options)
  else if (command === 'probe') await probe(options)
  else if (command === 'preview') await preview(options)
  else if (command === 'quality') await quality(options)
  else if (command === 'fetch') await fetchImages(options)
  else if (command === 'package') await packageLibrary(options)
  else if (command === 'verify-library') await verifyLibrary(options)
  else throw new Error('usage: sentinel2-imagery.mjs <plan|verify-plan|preflight|probe|preview|quality|fetch|package|verify-library> [--pilot|--allow ids] [--execute] [--max-pu number]')
} catch (cause) {
  const message = cause instanceof Error ? cause.message : String(cause)
  process.stderr.write(`Sentinel-2 imagery harness failed: ${message}\n`)
  process.exitCode = 1
}
