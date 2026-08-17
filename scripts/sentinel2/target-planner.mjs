import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

export const IMAGERY_JOB_MANIFEST_SCHEMA_VERSION = 1
export const WEB_MERCATOR_MAX = 20_037_508.342789244
export const WEB_MERCATOR_MAX_LATITUDE = 85.0511287798066
export const DEFAULT_PLANNING_OPTIONS = Object.freeze({
  paddingPerSide: 0.08,
  maxDimension: 2000,
  processApiMaxDimension: 2500
})

const EARTH_RADIUS = 6_378_137
const PROCESSING_UNIT_PIXELS = 512 * 512
const TARGET_COUNTS = Object.freeze({ country: 1, province: 34, prefecture: 342 })
const SOURCE_CONTRACT = Object.freeze({
  stacCollection: 'sentinel-2-global-mosaics',
  sentinelHubCollection: 'byoc-5460de54-082e-473a-b6ea-d5cbe3c17cca',
  candidateQuarters: ['2025-Q2', '2025-Q3', '2025-Q4'],
  sourceDecisionState: 'requires-pinned-quarter-before-processing'
})

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function round(value, digits) {
  const factor = 10 ** digits
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function sha256(text) {
  return createHash('sha256').update(text).digest('hex')
}

function shortGb(value) {
  const gb = String(value).trim()
  assert(/^\d+$/.test(gb), `invalid gb identity: ${gb}`)
  return gb.startsWith('156') && gb.length === 9 ? gb.slice(3) : gb
}

function visitGeometryPositions(geometry, label, visit) {
  assert(geometry && typeof geometry === 'object', `${label}: missing geometry`)
  const polygons = geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.type === 'MultiPolygon'
      ? geometry.coordinates
      : null
  assert(Array.isArray(polygons), `${label}: geometry must be Polygon or MultiPolygon`)
  assert(polygons.length > 0, `${label}: empty geometry`)
  for (const [polygonIndex, polygon] of polygons.entries()) {
    assert(Array.isArray(polygon) && polygon.length > 0, `${label}: empty polygon ${polygonIndex}`)
    for (const [ringIndex, ring] of polygon.entries()) {
      assert(Array.isArray(ring) && ring.length >= 4, `${label}: invalid ring ${polygonIndex}.${ringIndex}`)
      for (const [positionIndex, position] of ring.entries()) {
        assert(
          Array.isArray(position) && position.length >= 2 &&
          Number.isFinite(position[0]) && Number.isFinite(position[1]),
          `${label}: invalid coordinate ${polygonIndex}.${ringIndex}.${positionIndex}`
        )
        const longitude = Number(position[0])
        const latitude = Number(position[1])
        assert(
          longitude >= -180 && longitude <= 180 &&
          latitude >= -WEB_MERCATOR_MAX_LATITUDE && latitude <= WEB_MERCATOR_MAX_LATITUDE,
          `${label}: coordinate outside Web Mercator bounds`
        )
        visit(longitude, latitude)
      }
    }
  }
}

export function boundsFromGeoJson(value, label = 'GeoJSON') {
  assert(
    value && value.type === 'FeatureCollection' && Array.isArray(value.features),
    `${label}: expected FeatureCollection`
  )
  assert(value.features.length > 0, `${label}: empty FeatureCollection`)
  let minLongitude = Infinity
  let minLatitude = Infinity
  let maxLongitude = -Infinity
  let maxLatitude = -Infinity
  for (const [featureIndex, feature] of value.features.entries()) {
    assert(feature?.type === 'Feature', `${label}: invalid feature ${featureIndex}`)
    visitGeometryPositions(feature.geometry, `${label}.features[${featureIndex}]`, (longitude, latitude) => {
      minLongitude = Math.min(minLongitude, longitude)
      minLatitude = Math.min(minLatitude, latitude)
      maxLongitude = Math.max(maxLongitude, longitude)
      maxLatitude = Math.max(maxLatitude, latitude)
    })
  }
  assert(
    [minLongitude, minLatitude, maxLongitude, maxLatitude].every(Number.isFinite) &&
    maxLongitude > minLongitude && maxLatitude > minLatitude,
    `${label}: geometry bounds must have positive width and height`
  )
  return [minLongitude, minLatitude, maxLongitude, maxLatitude]
}

function mercatorX(longitude) {
  return EARTH_RADIUS * longitude * Math.PI / 180
}

function mercatorY(latitude) {
  const clamped = Math.max(-WEB_MERCATOR_MAX_LATITUDE, Math.min(WEB_MERCATOR_MAX_LATITUDE, latitude))
  return EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + clamped * Math.PI / 360))
}

function inverseMercatorX(x) {
  return x / EARTH_RADIUS * 180 / Math.PI
}

function inverseMercatorY(y) {
  return (2 * Math.atan(Math.exp(y / EARTH_RADIUS)) - Math.PI / 2) * 180 / Math.PI
}

function snapAxis(minimum, maximum, pixelSize, desiredCells = null) {
  const origin = -WEB_MERCATOR_MAX
  let startIndex = Math.floor((minimum - origin) / pixelSize)
  let endIndex = Math.ceil((maximum - origin) / pixelSize)
  const requiredCells = Math.max(1, endIndex - startIndex)
  const cells = desiredCells ?? requiredCells
  assert(cells >= requiredCells, 'snap grid cannot contain padded bounds')
  if (cells > requiredCells) {
    startIndex -= Math.floor((cells - requiredCells) / 2)
    endIndex = startIndex + cells
  }
  let snappedMinimum = origin + startIndex * pixelSize
  let snappedMaximum = origin + endIndex * pixelSize
  if (snappedMinimum < -WEB_MERCATOR_MAX) {
    snappedMaximum += -WEB_MERCATOR_MAX - snappedMinimum
    snappedMinimum = -WEB_MERCATOR_MAX
  }
  if (snappedMaximum > WEB_MERCATOR_MAX) {
    snappedMinimum -= snappedMaximum - WEB_MERCATOR_MAX
    snappedMaximum = WEB_MERCATOR_MAX
  }
  assert(
    snappedMinimum >= -WEB_MERCATOR_MAX - 1e-6 &&
    snappedMaximum <= WEB_MERCATOR_MAX + 1e-6,
    'snapped bounds exceed the Web Mercator world extent'
  )
  return { minimum: snappedMinimum, maximum: snappedMaximum, cells }
}

export function planProjectedExtent(
  geographicGeometryBounds,
  options = DEFAULT_PLANNING_OPTIONS
) {
  assert(Array.isArray(geographicGeometryBounds) && geographicGeometryBounds.length === 4, 'invalid geographic bounds')
  assert(geographicGeometryBounds.every(Number.isFinite), 'geographic bounds must be finite')
  const [west, south, east, north] = geographicGeometryBounds
  assert(east > west && north > south, 'geographic bounds must have positive width and height')
  const paddingPerSide = options.paddingPerSide ?? DEFAULT_PLANNING_OPTIONS.paddingPerSide
  const maxDimension = options.maxDimension ?? DEFAULT_PLANNING_OPTIONS.maxDimension
  assert(Number.isFinite(paddingPerSide) && paddingPerSide >= 0 && paddingPerSide <= 1, 'invalid paddingPerSide')
  assert(Number.isInteger(maxDimension) && maxDimension > 2 && maxDimension <= 2500, 'invalid maxDimension')

  const sourceProjectedBounds = [mercatorX(west), mercatorY(south), mercatorX(east), mercatorY(north)]
  const sourceWidth = sourceProjectedBounds[2] - sourceProjectedBounds[0]
  const sourceHeight = sourceProjectedBounds[3] - sourceProjectedBounds[1]
  const paddedBounds = [
    Math.max(-WEB_MERCATOR_MAX, sourceProjectedBounds[0] - sourceWidth * paddingPerSide),
    Math.max(-WEB_MERCATOR_MAX, sourceProjectedBounds[1] - sourceHeight * paddingPerSide),
    Math.min(WEB_MERCATOR_MAX, sourceProjectedBounds[2] + sourceWidth * paddingPerSide),
    Math.min(WEB_MERCATOR_MAX, sourceProjectedBounds[3] + sourceHeight * paddingPerSide)
  ]
  const paddedWidth = paddedBounds[2] - paddedBounds[0]
  const paddedHeight = paddedBounds[3] - paddedBounds[1]
  const xIsDominant = paddedWidth >= paddedHeight
  // Reserve at most one outward snap pixel at each edge, then force the dominant
  // axis to exactly maxDimension cells. This keeps square pixels and containment.
  const pixelSize = Math.max(paddedWidth, paddedHeight) / (maxDimension - 2)
  const x = snapAxis(paddedBounds[0], paddedBounds[2], pixelSize, xIsDominant ? maxDimension : null)
  const y = snapAxis(paddedBounds[1], paddedBounds[3], pixelSize, xIsDominant ? null : maxDimension)
  assert(x.cells <= maxDimension && y.cells <= maxDimension, 'snapped dimensions exceed maxDimension')

  const projectedBounds = [x.minimum, y.minimum, x.maximum, y.maximum].map((value) => round(value, 6))
  const geographicBounds = [
    inverseMercatorX(projectedBounds[0]),
    inverseMercatorY(projectedBounds[1]),
    inverseMercatorX(projectedBounds[2]),
    inverseMercatorY(projectedBounds[3])
  ].map((value) => round(value, 8))
  return {
    geographicBounds,
    projectedBounds,
    width: x.cells,
    height: y.cells,
    outputPixels: x.cells * y.cells,
    pixelSizeMeters: round(pixelSize, 9)
  }
}

function assertSafeAssetPath(assetPath) {
  assert(typeof assetPath === 'string' && assetPath.length > 0, 'asset path must be non-empty')
  assert(!path.isAbsolute(assetPath) && !assetPath.split('/').includes('..'), `unsafe asset path: ${assetPath}`)
}

function resolveCatalogAsset(catalogRoot, assetPath) {
  assertSafeAssetPath(assetPath)
  const root = path.resolve(catalogRoot)
  const resolved = path.resolve(root, assetPath)
  assert(resolved.startsWith(`${root}${path.sep}`), `catalog asset escapes root: ${assetPath}`)
  return resolved
}

function findFeatureByGb(collection, gb, label) {
  const feature = collection.features.find((candidate) => String(candidate?.properties?.gb ?? '') === String(gb))
  assert(feature, `${label}: no feature for gb ${gb}`)
  return feature
}

function oneFeatureCollection(feature) {
  return { type: 'FeatureCollection', features: [feature] }
}

function targetAssetPath(targetKind, gb) {
  if (targetKind === 'country') return `country/${gb}.jpg`
  if (targetKind === 'province') return `provinces/${gb}.jpg`
  return `prefectures/${gb}.jpg`
}

function createTarget({
  targetKind,
  gb,
  catalogGb,
  label,
  selection,
  geometry,
  geometrySource,
  coverageGeometrySource = geometrySource,
  options
}) {
  const geometryBounds = boundsFromGeoJson(geometry, `${targetKind}:${gb}`)
  const extent = planProjectedExtent(geometryBounds, options)
  const threeBand = extent.outputPixels / PROCESSING_UNIT_PIXELS
  return {
    id: `${targetKind}:${gb}`,
    targetKind,
    gb,
    catalogGb,
    label,
    selection,
    geometrySource,
    coverageGeometrySource,
    geometryBounds: geometryBounds.map((value) => round(value, 8)),
    geographicBounds: extent.geographicBounds,
    projectedBounds: extent.projectedBounds,
    projection: 'EPSG:3857',
    width: extent.width,
    height: extent.height,
    pixelSizeMeters: extent.pixelSizeMeters,
    outputPixels: extent.outputPixels,
    requestCount: 1,
    estimatedProcessingUnits: {
      threeBand: round(threeBand, 6),
      fourBand: round(threeBand * 4 / 3, 6)
    },
    assetPath: targetAssetPath(targetKind, gb)
  }
}

export async function buildImageryJobManifest({
  catalogRoot,
  paddingPerSide = DEFAULT_PLANNING_OPTIONS.paddingPerSide,
  maxDimension = DEFAULT_PLANNING_OPTIONS.maxDimension,
  sourceDecision = null
}) {
  const resolvedCatalogRoot = path.resolve(catalogRoot)
  const catalogPath = path.join(resolvedCatalogRoot, 'catalog.json')
  const catalogText = await readFile(catalogPath, 'utf8')
  const catalog = JSON.parse(catalogText)
  assert(catalog.schemaVersion === 1, 'unsupported region catalog schema')
  assert(catalog.dataVersion && typeof catalog.dataVersion === 'string', 'missing region catalog dataVersion')
  assert(Array.isArray(catalog.provinces) && catalog.provinces.length === TARGET_COUNTS.province, 'region catalog must contain 34 provinces')
  const prefectureCount = catalog.provinces.reduce((sum, province) => sum + province.prefectures.length, 0)
  assert(prefectureCount === TARGET_COUNTS.prefecture, 'region catalog must contain 342 prefectures')

  const countryAssetPath = catalog.country.assetPath
  assert(catalog.country.available && countryAssetPath, 'country geometry must be available')
  const countryText = await readFile(resolveCatalogAsset(resolvedCatalogRoot, countryAssetPath), 'utf8')
  const countryGeometry = JSON.parse(countryText)
  const options = { paddingPerSide, maxDimension }
  const targets = [createTarget({
    targetKind: 'country',
    gb: '100000',
    catalogGb: null,
    label: '全国',
    selection: { kind: 'country-provinces' },
    geometry: countryGeometry,
    geometrySource: {
      assetPath: countryAssetPath,
      featureGb: null,
      sha256: sha256(countryText),
      fallbackReason: null
    },
    options
  })]

  for (const province of catalog.provinces) {
    const provinceFeature = findFeatureByGb(countryGeometry, province.gb, 'country geometry')
    const provinceGb = shortGb(province.gb)
    let provinceCoverageGeometrySource = {
      assetPath: countryAssetPath,
      featureGb: province.gb,
      sha256: sha256(countryText),
      fallbackReason: 'unavailable-child-geometry'
    }
    if (province.counties.available && province.counties.assetPath) {
      const provinceCountiesText = await readFile(
        resolveCatalogAsset(resolvedCatalogRoot, province.counties.assetPath),
        'utf8'
      )
      boundsFromGeoJson(JSON.parse(provinceCountiesText), `${province.name}: county coverage geometry`)
      provinceCoverageGeometrySource = {
        assetPath: province.counties.assetPath,
        featureGb: null,
        sha256: sha256(provinceCountiesText),
        fallbackReason: null
      }
    }
    targets.push(createTarget({
      targetKind: 'province',
      gb: provinceGb,
      catalogGb: province.gb,
      label: province.name,
      selection: { kind: 'province-counties', provinceGb: province.gb },
      geometry: oneFeatureCollection(provinceFeature),
      geometrySource: {
        assetPath: countryAssetPath,
        featureGb: province.gb,
        sha256: sha256(countryText),
        fallbackReason: null
      },
      coverageGeometrySource: provinceCoverageGeometrySource,
      options
    }))

    assert(province.nextLevel.available && province.nextLevel.assetPath, `${province.name}: next-level geometry unavailable`)
    const nextLevelText = await readFile(
      resolveCatalogAsset(resolvedCatalogRoot, province.nextLevel.assetPath),
      'utf8'
    )
    const nextLevelGeometry = JSON.parse(nextLevelText)
    // Validate the complete parent collection even when a province-equivalent
    // target intentionally resolves from the country-level province feature.
    boundsFromGeoJson(nextLevelGeometry, `${province.name}: next-level geometry`)
    const nextLevelSha256 = sha256(nextLevelText)

    for (const prefecture of province.prefectures) {
      const prefectureGb = shortGb(prefecture.gb)
      const provinceEquivalent = Boolean(prefecture.provinceEquivalent)
      const emptyChildGeometry = !prefecture.counties.available || prefecture.counties.featureCount === 0
      const feature = provinceEquivalent
        ? provinceFeature
        : findFeatureByGb(nextLevelGeometry, prefecture.gb, `${province.name}: next-level geometry`)
      targets.push(createTarget({
        targetKind: 'prefecture',
        gb: prefectureGb,
        catalogGb: prefecture.gb,
        label: prefecture.name,
        selection: {
          kind: 'prefecture-counties',
          provinceGb: province.gb,
          prefectureGb: prefecture.gb
        },
        geometry: oneFeatureCollection(feature),
        geometrySource: {
          assetPath: provinceEquivalent ? countryAssetPath : province.nextLevel.assetPath,
          featureGb: provinceEquivalent ? province.gb : prefecture.gb,
          sha256: provinceEquivalent ? sha256(countryText) : nextLevelSha256,
          fallbackReason: provinceEquivalent
            ? 'province-equivalent'
            : emptyChildGeometry
              ? 'empty-child-geometry'
              : null
        },
        options
      }))
    }
  }

  const totals = targets.reduce((summary, target) => {
    summary.outputPixels += target.outputPixels
    summary.threeBand += target.outputPixels / PROCESSING_UNIT_PIXELS
    summary.fourBand += target.outputPixels / PROCESSING_UNIT_PIXELS * 4 / 3
    return summary
  }, { outputPixels: 0, threeBand: 0, fourBand: 0 })
  const pinnedSource = sourceDecision?.primaryQuarter
    ? {
        sourceDecisionState: 'pinned',
        datasetVersion: sourceDecision.datasetVersion,
        sourceYear: sourceDecision.sourceYear,
        primaryQuarter: sourceDecision.primaryQuarter,
        fallbackQuarters: sourceDecision.fallbackQuarters,
        maxNoDataRatio: sourceDecision.maxNoDataRatio,
        colorTransformSha256: sourceDecision.colorTransformSha256
      }
    : { sourceDecisionState: 'requires-pinned-quarter-before-processing' }
  const manifest = {
    schemaVersion: IMAGERY_JOB_MANIFEST_SCHEMA_VERSION,
    geometryCatalog: {
      schemaVersion: catalog.schemaVersion,
      dataVersion: catalog.dataVersion,
      catalogSha256: sha256(catalogText),
      coordinateInterpretation: 'RFC7946-longitude-latitude'
    },
    sourceContract: {
      stacCollection: SOURCE_CONTRACT.stacCollection,
      sentinelHubCollection: SOURCE_CONTRACT.sentinelHubCollection,
      candidateQuarters: SOURCE_CONTRACT.candidateQuarters,
      ...pinnedSource
    },
    planning: {
      projection: 'EPSG:3857',
      paddingPerSide,
      maxDimension,
      processApiMaxDimension: DEFAULT_PLANNING_OPTIONS.processApiMaxDimension,
      downsampling: 'BILINEAR',
      gridPolicy: 'dominant-axis-2000-with-two-cell-outward-snap-reserve'
    },
    summary: {
      targetCount: targets.length,
      countryCount: targets.filter((target) => target.targetKind === 'country').length,
      provinceCount: targets.filter((target) => target.targetKind === 'province').length,
      prefectureCount: targets.filter((target) => target.targetKind === 'prefecture').length,
      requestCount: targets.length,
      outputPixels: totals.outputPixels,
      estimatedProcessingUnits: {
        threeBand: round(totals.threeBand, 3),
        fourBand: round(totals.fourBand, 3)
      }
    },
    targets
  }
  verifyImageryJobManifest(manifest)
  return manifest
}

export function verifyImageryJobManifest(manifest) {
  assert(manifest && manifest.schemaVersion === IMAGERY_JOB_MANIFEST_SCHEMA_VERSION, 'unsupported imagery job manifest schema')
  assert(manifest.planning?.projection === 'EPSG:3857', 'job manifest projection must be EPSG:3857')
  assert(Number.isInteger(manifest.planning.maxDimension) && manifest.planning.maxDimension <= 2500, 'invalid planned max dimension')
  assert(Array.isArray(manifest.targets), 'job manifest targets must be an array')
  assert(manifest.targets.length === 377, 'job manifest must contain exactly 377 targets')
  const ids = new Set()
  const counts = { country: 0, province: 0, prefecture: 0 }
  let outputPixels = 0
  for (const [index, target] of manifest.targets.entries()) {
    assert(['country', 'province', 'prefecture'].includes(target.targetKind), `targets[${index}]: invalid target kind`)
    assert(!ids.has(target.id), `targets[${index}]: duplicate id ${target.id}`)
    ids.add(target.id)
    counts[target.targetKind] += 1
    assert(/^\d{6}$/.test(target.gb), `targets[${index}]: gb must be a six-digit identity`)
    assertSafeAssetPath(target.assetPath)
    assert(Array.isArray(target.projectedBounds) && target.projectedBounds.length === 4 && target.projectedBounds.every(Number.isFinite), `targets[${index}]: invalid projected bounds`)
    assert(Array.isArray(target.geographicBounds) && target.geographicBounds.length === 4 && target.geographicBounds.every(Number.isFinite), `targets[${index}]: invalid geographic bounds`)
    assert(target.projectedBounds[2] > target.projectedBounds[0] && target.projectedBounds[3] > target.projectedBounds[1], `targets[${index}]: empty projected bounds`)
    assert(Number.isInteger(target.width) && Number.isInteger(target.height) && target.width > 0 && target.height > 0, `targets[${index}]: invalid dimensions`)
    assert(Math.max(target.width, target.height) === manifest.planning.maxDimension, `targets[${index}]: longest dimension must equal maxDimension`)
    assert(target.width <= manifest.planning.processApiMaxDimension && target.height <= manifest.planning.processApiMaxDimension, `targets[${index}]: Process API dimension exceeded`)
    assert(target.outputPixels === target.width * target.height, `targets[${index}]: output pixel mismatch`)
    assert(target.requestCount === 1, `targets[${index}]: request count must be one`)
    assert(target.geometrySource?.sha256 && /^[a-f0-9]{64}$/.test(target.geometrySource.sha256), `targets[${index}]: invalid geometry hash`)
    outputPixels += target.outputPixels
  }
  assert(counts.country === TARGET_COUNTS.country, 'country target count mismatch')
  assert(counts.province === TARGET_COUNTS.province, 'province target count mismatch')
  assert(counts.prefecture === TARGET_COUNTS.prefecture, 'prefecture target count mismatch')
  assert(manifest.summary.targetCount === manifest.targets.length, 'summary target count mismatch')
  assert(manifest.summary.requestCount === manifest.targets.length, 'summary request count mismatch')
  assert(manifest.summary.outputPixels === outputPixels, 'summary output pixels mismatch')
  if (manifest.sourceContract.sourceDecisionState === 'pinned') {
    assert(typeof manifest.sourceContract.datasetVersion === 'string' && manifest.sourceContract.datasetVersion.length > 0, 'pinned source requires datasetVersion')
    quarterTimeContract(manifest.sourceContract.primaryQuarter, manifest.sourceContract.candidateQuarters)
    assert(Array.isArray(manifest.sourceContract.fallbackQuarters), 'pinned source requires fallback quarters')
    for (const quarter of manifest.sourceContract.fallbackQuarters) {
      quarterTimeContract(quarter, manifest.sourceContract.candidateQuarters)
    }
    assert(Number.isFinite(manifest.sourceContract.maxNoDataRatio), 'pinned source requires no-data threshold')
    assert(/^[a-f0-9]{64}$/.test(manifest.sourceContract.colorTransformSha256), 'pinned source requires color transform hash')
  }
  const serialized = JSON.stringify(manifest).toLowerCase()
  assert(!serialized.includes('latest'), 'job manifest must not use an implicit latest source')
  assert(!/(client[_-]?secret|access[_-]?token|authorization)/.test(serialized), 'job manifest contains a credential-like field')
  return manifest
}

function quarterTimeContract(quarter, candidates) {
  assert(typeof quarter === 'string' && quarter !== 'latest' && candidates.includes(quarter), `invalid pinned quarter: ${quarter}`)
}

export function serializeImageryJobManifest(manifest) {
  verifyImageryJobManifest(manifest)
  return `${JSON.stringify(manifest, null, 2)}\n`
}
