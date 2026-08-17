import { createHash } from 'node:crypto'
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile
} from 'node:fs/promises'
import path from 'node:path'
import { jpegDimensions } from './source-quality.mjs'

const ATTRIBUTION = 'Contains modified Copernicus Sentinel data 2025'
const LEGAL_NOTICE_URL = 'https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice'
const MANIFEST_FILE = 'manifest.json'
const NOTICE_FILE = 'NOTICE-DATA.md'
const INVENTORY_FILE = 'SHA256SUMS'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function canonicalText(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function safeRelativeAsset(assetPath) {
  assert(typeof assetPath === 'string' && assetPath.length > 0, 'runtime asset path is missing')
  assert(!path.isAbsolute(assetPath), `unsafe absolute runtime asset path: ${assetPath}`)
  assert(!assetPath.includes('\\'), `unsafe runtime asset path separator: ${assetPath}`)
  const normalized = path.posix.normalize(assetPath)
  assert(normalized === assetPath && !normalized.startsWith('../') && normalized !== '..', `unsafe runtime asset path: ${assetPath}`)
  assert(normalized.startsWith('images/'), `runtime image must be under images/: ${assetPath}`)
  return normalized
}

function bestQualityAttempt(quality) {
  return quality?.attempts?.reduce(
    (best, attempt) => !best || attempt.noDataRatio < best.noDataRatio ? attempt : best,
    null
  ) ?? null
}

function assertBounds(bounds, name) {
  assert(Array.isArray(bounds) && bounds.length === 4, `${name} must contain four numbers`)
  assert(bounds.every(Number.isFinite), `${name} contains a non-finite number`)
  assert(bounds[0] < bounds[2] && bounds[1] < bounds[3], `${name} is not ordered`)
}

function validateRuntimeEntry(entry) {
  assert(typeof entry.id === 'string' && entry.id.includes(':'), 'runtime entry id is invalid')
  assert(['country', 'province', 'prefecture'].includes(entry.targetKind), `${entry.id}: invalid target kind`)
  assert(typeof entry.gb === 'string' && /^\d{6}$/.test(entry.gb), `${entry.id}: invalid gb identity`)
  assert(typeof entry.label === 'string' && entry.label.length > 0, `${entry.id}: label is missing`)
  assertBounds(entry.geographicBounds, `${entry.id}: geographic bounds`)
  assertBounds(entry.projectedBounds, `${entry.id}: projected bounds`)
  assert(entry.projection === 'EPSG:3857', `${entry.id}: projection changed`)
  assert(entry.attribution === ATTRIBUTION, `${entry.id}: attribution changed`)
  assert(['available', 'unavailable'].includes(entry.status), `${entry.id}: invalid status`)
  if (entry.status === 'available') {
    safeRelativeAsset(entry.assetPath)
    assert(Number.isInteger(entry.width) && entry.width > 0, `${entry.id}: invalid width`)
    assert(Number.isInteger(entry.height) && entry.height > 0, `${entry.id}: invalid height`)
    assert(Number.isInteger(entry.bytes) && entry.bytes > 100, `${entry.id}: invalid byte length`)
    assert(/^[a-f0-9]{64}$/.test(entry.sha256), `${entry.id}: invalid image SHA-256`)
    assert(/^\d{4}-Q[1-4]$/.test(entry.sourceQuarter), `${entry.id}: invalid source quarter`)
    assert(typeof entry.fallbackUsed === 'boolean', `${entry.id}: fallback flag is invalid`)
    assert(Number.isFinite(entry.noDataRatio) && entry.noDataRatio >= 0 && entry.noDataRatio <= 1, `${entry.id}: invalid no-data ratio`)
  } else {
    assert(entry.assetPath === null, `${entry.id}: unavailable entry must not name an asset`)
    assert(typeof entry.reason === 'string' && entry.reason.length > 0, `${entry.id}: unavailable reason is missing`)
    assert(entry.waiver?.decision === 'accepted', `${entry.id}: unavailable target lacks an accepted waiver`)
    assert(typeof entry.waiver?.rationale === 'string' && entry.waiver.rationale.length > 0, `${entry.id}: waiver rationale is missing`)
  }
}

export function buildRuntimeManifest({
  plan,
  planText,
  imageCheckpoint,
  qualityCheckpoint,
  expectedTargetCount = 377,
  includedTargetKinds = ['country', 'province', 'prefecture']
}) {
  const planSha256 = sha256(planText)
  assert(plan?.schemaVersion === 1 && Array.isArray(plan.targets), 'job manifest is invalid')
  assert(plan.targets.length === expectedTargetCount, `expected ${expectedTargetCount} targets, found ${plan.targets.length}`)
  assert(imageCheckpoint?.kind === 'image-generation' && imageCheckpoint.planSha256 === planSha256, 'image checkpoint belongs to a different plan')
  assert(qualityCheckpoint?.kind === 'quality-selection' && qualityCheckpoint.planSha256 === planSha256, 'quality checkpoint belongs to a different plan')
  const allPlanIds = new Set()
  for (const target of plan.targets) {
    assert(!allPlanIds.has(target.id), `duplicate target identity: ${target.id}`)
    allPlanIds.add(target.id)
  }
  const ids = new Set()
  let availableCount = 0
  let unavailableCount = 0
  let totalBytes = 0
  const includedKinds = new Set(includedTargetKinds)
  assert(includedKinds.size > 0, 'at least one runtime target kind is required')
  for (const kind of includedKinds) assert(['country', 'province', 'prefecture'].includes(kind), `invalid runtime target kind: ${kind}`)
  const entries = plan.targets.filter((target) => includedKinds.has(target.targetKind)).map((target) => {
    assert(!ids.has(target.id), `duplicate target identity: ${target.id}`)
    ids.add(target.id)
    const image = imageCheckpoint.entries?.[target.id]
    const quality = qualityCheckpoint.entries?.[target.id]
    assert(image && ['complete', 'unavailable'].includes(image.status), `${target.id}: image state is not terminal`)
    assert(quality && ['available', 'unavailable'].includes(quality.status), `${target.id}: quality state is not terminal`)
    const common = {
      id: target.id,
      targetKind: target.targetKind,
      gb: target.gb,
      catalogGb: target.catalogGb,
      label: target.label,
      selection: target.selection,
      status: image.status === 'complete' ? 'available' : 'unavailable',
      geographicBounds: target.geographicBounds,
      projectedBounds: target.projectedBounds,
      projection: target.projection,
      pixelSizeMeters: target.pixelSizeMeters,
      attribution: ATTRIBUTION
    }
    if (image.status === 'complete') {
      assert(quality.status === 'available', `${target.id}: complete image has unavailable quality state`)
      assert(image.chosenQuarter === quality.chosenQuarter, `${target.id}: image quarter differs from quality decision`)
      assert(image.width === target.width && image.height === target.height, `${target.id}: checkpoint dimensions differ from plan`)
      assert(image.evalscriptSha256 === plan.sourceContract.colorTransformSha256, `${target.id}: color transform changed`)
      availableCount += 1
      totalBytes += image.bytes
      return {
        ...common,
        assetPath: safeRelativeAsset(`images/${target.assetPath}`),
        width: image.width,
        height: image.height,
        bytes: image.bytes,
        sha256: image.sha256,
        sourceQuarter: image.chosenQuarter,
        sourceQuarters: image.constituentQuarters ?? [image.chosenQuarter],
        fallbackUsed: image.fallbackUsed,
        noDataRatio: image.noDataRatio,
        colorTransformSha256: image.evalscriptSha256,
        ...(image.compositionMode ? { compositionMode: image.compositionMode } : {})
      }
    }
    assert(quality.status === 'unavailable', `${target.id}: unavailable image has available quality state`)
    const best = bestQualityAttempt(quality)
    unavailableCount += 1
    return {
      ...common,
      assetPath: null,
      reason: image.reason ?? quality.reason,
      bestQuarter: best?.quarter ?? image.bestQuarter ?? quality.bestQuarter ?? null,
      noDataRatio: best?.noDataRatio ?? image.noDataRatio ?? quality.noDataRatio,
      waiver: {
        decision: 'accepted',
        authority: 'sentinel2-local-imagery-v1-quality-policy',
        rationale: `No candidate quarter met the ${(plan.sourceContract.maxNoDataRatio * 100).toFixed(2)}% no-data threshold; runtime falls back to the existing non-imagery appearance.`
      }
    }
  })
  assert(Object.keys(imageCheckpoint.entries).length === expectedTargetCount, 'image checkpoint contains an unexpected or missing target')
  assert(Object.keys(qualityCheckpoint.entries).length === expectedTargetCount, 'quality checkpoint contains an unexpected or missing target')
  for (const id of Object.keys(imageCheckpoint.entries)) assert(allPlanIds.has(id), `unexpected image checkpoint target: ${id}`)
  for (const id of Object.keys(qualityCheckpoint.entries)) assert(allPlanIds.has(id), `unexpected quality checkpoint target: ${id}`)
  return {
    schemaVersion: 1,
    datasetId: plan.sourceContract.datasetVersion,
    projection: 'EPSG:3857',
    attribution: ATTRIBUTION,
    legalNoticeUrl: LEGAL_NOTICE_URL,
    source: {
      provider: 'Copernicus Data Space Ecosystem',
      collection: plan.sourceContract.stacCollection,
      sentinelHubCollection: plan.sourceContract.sentinelHubCollection,
      sourceYear: plan.sourceContract.sourceYear,
      primaryQuarter: plan.sourceContract.primaryQuarter,
      fallbackQuarters: plan.sourceContract.fallbackQuarters,
      colorTransformSha256: plan.sourceContract.colorTransformSha256
    },
    geometryCatalog: plan.geometryCatalog,
    planSha256,
    summary: {
      targetCount: entries.length,
      availableCount,
      unavailableCount,
      totalBytes
    },
    entries
  }
}

export function serializeRuntimeManifest(manifest) {
  assert(manifest?.schemaVersion === 1 && Array.isArray(manifest.entries), 'runtime manifest is invalid')
  for (const entry of manifest.entries) validateRuntimeEntry(entry)
  return canonicalText(manifest)
}

function noticeText(manifest) {
  return `# Sentinel-2 local imagery data notice\n\n${ATTRIBUTION}.\n\nSource: Copernicus Data Space Ecosystem, Sentinel-2 Level-3 Quarterly Mosaics (${manifest.source.sourceYear}).\n\nLegal notice: ${LEGAL_NOTICE_URL}\n\nThe JPEG textures in this directory are modified, projected, resampled and color-transformed derivatives generated for local map visualization.\n`
}

async function listPackageFiles(root, relative = '') {
  const directory = path.join(root, relative)
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, 'en'))) {
    const child = relative ? `${relative}/${entry.name}` : entry.name
    assert(!entry.isSymbolicLink(), `runtime package contains a symbolic link: ${child}`)
    if (entry.isDirectory()) files.push(...await listPackageFiles(root, child))
    else if (entry.isFile()) files.push(child)
    else throw new Error(`runtime package contains an unsupported filesystem entry: ${child}`)
  }
  return files
}

async function buildInventory(root, filePaths) {
  const lines = []
  for (const filePath of [...filePaths].sort()) {
    const bytes = await readFile(path.join(root, filePath))
    lines.push(`${sha256(bytes)}  ${filePath}`)
  }
  return `${lines.join('\n')}\n`
}

async function verifyCanonicalManifest(root) {
  const text = await readFile(path.join(root, MANIFEST_FILE), 'utf8')
  const manifest = JSON.parse(text)
  assert(serializeRuntimeManifest(manifest) === text, 'runtime manifest is not canonical deterministic JSON')
  return { manifest, text }
}

export async function verifyRuntimeLibrary({ packageRoot, expectedTargetCount = 377 }) {
  const root = path.resolve(packageRoot)
  const { manifest, text: manifestText } = await verifyCanonicalManifest(root)
  assert(manifest.datasetId === 'sentinel2-quarterly-2025q2-v1', 'runtime dataset id changed')
  assert(manifest.projection === 'EPSG:3857', 'runtime package projection changed')
  assert(manifest.attribution === ATTRIBUTION, 'runtime package attribution changed')
  assert(manifest.legalNoticeUrl === LEGAL_NOTICE_URL, 'runtime package legal notice changed')
  assert(manifest.entries.length === expectedTargetCount, `expected ${expectedTargetCount} runtime entries`)
  const ids = new Set()
  const expectedAssets = new Set()
  let availableCount = 0
  let unavailableCount = 0
  let totalBytes = 0
  for (const entry of manifest.entries) {
    validateRuntimeEntry(entry)
    assert(!ids.has(entry.id), `duplicate runtime target identity: ${entry.id}`)
    ids.add(entry.id)
    if (entry.status === 'unavailable') {
      unavailableCount += 1
      continue
    }
    availableCount += 1
    totalBytes += entry.bytes
    assert(!expectedAssets.has(entry.assetPath), `duplicate runtime asset path: ${entry.assetPath}`)
    expectedAssets.add(entry.assetPath)
    const assetFile = path.join(root, entry.assetPath)
    const assetStat = await stat(assetFile).catch(() => null)
    assert(assetStat?.isFile(), `${entry.id}: runtime image is missing`)
    assert(assetStat.size === entry.bytes, `${entry.id}: runtime image byte length changed`)
    const bytes = await readFile(assetFile)
    assert(sha256(bytes) === entry.sha256, `${entry.id}: runtime image hash changed`)
    const dimensions = jpegDimensions(bytes)
    assert(dimensions.width === entry.width && dimensions.height === entry.height, `${entry.id}: runtime image dimensions changed`)
  }
  assert(manifest.summary.targetCount === manifest.entries.length, 'runtime summary target count changed')
  assert(manifest.summary.availableCount === availableCount, 'runtime summary available count changed')
  assert(manifest.summary.unavailableCount === unavailableCount, 'runtime summary unavailable count changed')
  assert(manifest.summary.totalBytes === totalBytes, 'runtime summary byte count changed')
  const notice = await readFile(path.join(root, NOTICE_FILE), 'utf8')
  assert(notice === noticeText(manifest), 'runtime data notice changed')
  const files = await listPackageFiles(root)
  const allowed = new Set([MANIFEST_FILE, NOTICE_FILE, INVENTORY_FILE, ...expectedAssets])
  for (const file of files) assert(allowed.has(file), `orphan or forbidden runtime package file: ${file}`)
  for (const file of allowed) assert(files.includes(file), `runtime package file is missing: ${file}`)
  const inventoryInput = files.filter((file) => file !== INVENTORY_FILE)
  const expectedInventory = await buildInventory(root, inventoryInput)
  const inventory = await readFile(path.join(root, INVENTORY_FILE), 'utf8')
  assert(inventory === expectedInventory, 'runtime SHA-256 inventory changed')
  const sensitivePattern = /S2_CLIENT_(?:ID|SECRET)|access[_-]?token|authorization\s*:\s*bearer|bearer\s+[A-Za-z0-9._~-]{8,}/i
  for (const file of [MANIFEST_FILE, NOTICE_FILE, INVENTORY_FILE]) {
    assert(!sensitivePattern.test(await readFile(path.join(root, file), 'utf8')), `runtime package text contains credential material: ${file}`)
  }
  return {
    manifestSha256: sha256(manifestText),
    inventorySha256: sha256(inventory),
    targetCount: manifest.entries.length,
    availableCount,
    unavailableCount,
    totalBytes,
    fileCount: files.length
  }
}

export async function packageRuntimeLibrary({
  plan,
  planText,
  imageCheckpoint,
  qualityCheckpoint,
  imageRoot,
  packageRoot,
  expectedTargetCount = 377,
  includedTargetKinds = ['country', 'province', 'prefecture']
}) {
  const destination = path.resolve(packageRoot)
  const destinationParent = path.dirname(destination)
  const staging = path.join(destinationParent, `.${path.basename(destination)}.staging-${process.pid}`)
  const existing = await lstat(destination).catch(() => null)
  assert(!existing, `runtime package destination already exists: ${destination}`)
  await rm(staging, { recursive: true, force: true })
  await mkdir(staging, { recursive: true })
  try {
    const manifest = buildRuntimeManifest({
      plan,
      planText,
      imageCheckpoint,
      qualityCheckpoint,
      expectedTargetCount,
      includedTargetKinds
    })
    for (const entry of manifest.entries) {
      if (entry.status !== 'available') continue
      const sourceRelative = entry.assetPath.slice('images/'.length)
      const source = path.resolve(imageRoot, sourceRelative)
      const root = path.resolve(imageRoot)
      assert(source.startsWith(`${root}${path.sep}`), `${entry.id}: source image escapes image root`)
      const destinationFile = path.join(staging, entry.assetPath)
      await mkdir(path.dirname(destinationFile), { recursive: true })
      await copyFile(source, destinationFile)
    }
    await writeFile(path.join(staging, MANIFEST_FILE), serializeRuntimeManifest(manifest), { flag: 'wx' })
    await writeFile(path.join(staging, NOTICE_FILE), noticeText(manifest), { flag: 'wx' })
    const files = await listPackageFiles(staging)
    await writeFile(path.join(staging, INVENTORY_FILE), await buildInventory(staging, files), { flag: 'wx' })
    const verification = await verifyRuntimeLibrary({ packageRoot: staging, expectedTargetCount: manifest.entries.length })
    await mkdir(destinationParent, { recursive: true })
    await rename(staging, destination)
    return verification
  } catch (cause) {
    await rm(staging, { recursive: true, force: true })
    throw cause
  }
}

export const runtimeLibraryContract = Object.freeze({
  attribution: ATTRIBUTION,
  legalNoticeUrl: LEGAL_NOTICE_URL,
  manifestFile: MANIFEST_FILE,
  noticeFile: NOTICE_FILE,
  inventoryFile: INVENTORY_FILE
})
