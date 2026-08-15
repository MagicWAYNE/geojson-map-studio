import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

export const REGION_CATALOG_SCHEMA_VERSION = 1
export const REGION_CATALOG_DATA_VERSION = '2025-09'
export const REGION_CATALOG_LIMITS = Object.freeze({
  maxBytes: 10 * 1024 * 1024,
  maxFeatures: 500,
  maxPositions: 250_000
})

const SOURCE_LABEL = '天地图行政区划 2025-09'
const KEY_PROPERTY = 'gb'
const DISPLAY_PROPERTY = 'name'

function byteLength(value) {
  return Buffer.byteLength(value, 'utf8')
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function positionsEqual(left, right) {
  return left[0] === right[0] && left[1] === right[1]
}

function validatePosition(value, pathLabel) {
  assert(
    Array.isArray(value) && value.length === 2 &&
    value.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate)) &&
    value[0] >= -180 && value[0] <= 180 && value[1] >= -85.05112878 && value[1] <= 85.05112878,
    `${pathLabel}: invalid coordinate`
  )
  return value
}

function validateRing(value, pathLabel) {
  assert(Array.isArray(value) && value.length >= 4, `${pathLabel}: ring must contain at least four positions`)
  const positions = value.map((position, index) => validatePosition(position, `${pathLabel}[${index}]`))
  assert(positionsEqual(positions[0], positions.at(-1)), `${pathLabel}: ring must be closed`)
  let twiceArea = 0
  for (let index = 0; index < positions.length - 1; index += 1) {
    assert(Math.abs(positions[index + 1][0] - positions[index][0]) <= 180, `${pathLabel}: dateline crossing`)
    twiceArea += positions[index][0] * positions[index + 1][1] - positions[index + 1][0] * positions[index][1]
  }
  assert(Math.abs(twiceArea) > Number.EPSILON, `${pathLabel}: zero-area ring`)
  return positions.length
}

function validatePolygon(value, pathLabel) {
  assert(Array.isArray(value) && value.length > 0, `${pathLabel}: polygon must contain an outer ring`)
  return value.reduce((sum, ring, index) => sum + validateRing(ring, `${pathLabel}[${index}]`), 0)
}

function validateGeometry(geometry, pathLabel) {
  if (geometry.type === 'Polygon') return validatePolygon(geometry.coordinates, `${pathLabel}.coordinates`)
  assert(Array.isArray(geometry.coordinates) && geometry.coordinates.length > 0, `${pathLabel}: multipolygon must not be empty`)
  return geometry.coordinates.reduce(
    (sum, polygon, index) => sum + validatePolygon(polygon, `${pathLabel}.coordinates[${index}]`),
    0
  )
}

export function validateCatalogGeoJson(text, sourceLabel, { allowEmpty = false } = {}) {
  const sourceBytes = byteLength(text)
  assert(sourceBytes <= REGION_CATALOG_LIMITS.maxBytes, `${sourceLabel}: exceeds byte limit`)
  let root
  try {
    root = JSON.parse(text)
  } catch {
    throw new Error(`${sourceLabel}: invalid JSON`)
  }
  assert(root && root.type === 'FeatureCollection' && Array.isArray(root.features), `${sourceLabel}: expected FeatureCollection`)
  assert(allowEmpty || root.features.length > 0, `${sourceLabel}: empty feature collection`)
  assert(root.features.length <= REGION_CATALOG_LIMITS.maxFeatures, `${sourceLabel}: exceeds feature limit`)

  const keys = new Set()
  let positionCount = 0
  for (const [index, feature] of root.features.entries()) {
    assert(feature?.type === 'Feature' && feature.properties && feature.geometry, `${sourceLabel}: invalid feature ${index}`)
    assert(['Polygon', 'MultiPolygon'].includes(feature.geometry.type), `${sourceLabel}: unsupported geometry at feature ${index}`)
    const key = String(feature.properties[KEY_PROPERTY] ?? '').trim()
    const displayName = String(feature.properties[DISPLAY_PROPERTY] ?? '').trim()
    assert(key, `${sourceLabel}: missing ${KEY_PROPERTY} at feature ${index}`)
    assert(!keys.has(key), `${sourceLabel}: duplicate ${KEY_PROPERTY} ${key}`)
    assert(displayName, `${sourceLabel}: missing ${DISPLAY_PROPERTY} at feature ${index}`)
    keys.add(key)
    positionCount += validateGeometry(feature.geometry, `${sourceLabel}: features[${index}].geometry`)
  }
  assert(positionCount <= REGION_CATALOG_LIMITS.maxPositions, `${sourceLabel}: exceeds position limit`)

  return {
    root,
    featureCount: root.features.length,
    positionCount,
    sourceBytes
  }
}

function shortCode(gb) {
  return String(gb).replace(/^156/, '')
}

async function fileByCode(directory, gb) {
  const prefix = `${shortCode(gb)}-`
  const matches = (await readdir(directory)).filter((name) => name.startsWith(prefix) && name.endsWith('.geojson'))
  assert(matches.length === 1, `${directory}: expected one file for ${gb}, found ${matches.length}`)
  return path.join(directory, matches[0])
}

async function directoryByCode(directory, gb) {
  const prefix = `${shortCode(gb)}-`
  const matches = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
  assert(matches.length === 1, `${directory}: expected one directory for ${gb}, found ${matches.length}`)
  return path.join(directory, matches[0].name)
}

async function publishMap({ sourcePath, destinationRoot, assetPath, kind, label, allowEmpty = false }) {
  const sourceText = await readFile(sourcePath, 'utf8')
  const validated = validateCatalogGeoJson(sourceText, sourcePath, { allowEmpty })
  const minified = JSON.stringify(validated.root)
  const available = validated.featureCount > 0
  if (available) {
    const destination = path.join(destinationRoot, assetPath)
    await mkdir(path.dirname(destination), { recursive: true })
    await writeFile(destination, minified)
  }
  return {
    kind,
    label,
    available,
    assetPath: available ? assetPath : null,
    featureCount: validated.featureCount,
    byteLength: available ? byteLength(minified) : 0
  }
}

function assertSafeDestination(destinationRoot) {
  const resolved = path.resolve(destinationRoot)
  assert(path.basename(resolved) === `tianditu-${REGION_CATALOG_DATA_VERSION}`, `unsafe catalog destination: ${resolved}`)
}

export async function buildRegionCatalog({ sourceRoot, destinationRoot }) {
  assertSafeDestination(destinationRoot)
  const manifest = JSON.parse(await readFile(path.join(sourceRoot, 'manifest.json'), 'utf8'))
  assert(Array.isArray(manifest.provinceSummaries) && manifest.provinceSummaries.length === 34, 'manifest must contain 34 provinces')
  assert(Array.isArray(manifest.citySummaries) && manifest.citySummaries.length === 342, 'manifest must contain 342 prefectures')

  await rm(destinationRoot, { recursive: true, force: true })
  await mkdir(destinationRoot, { recursive: true })

  const country = await publishMap({
    sourcePath: path.join(sourceRoot, '01-country-provinces.geojson'),
    destinationRoot,
    assetPath: 'maps/country-provinces.geojson',
    kind: 'country-provinces',
    label: '全国 → 省级区域'
  })

  const citiesByProvince = new Map()
  for (const city of manifest.citySummaries) {
    const list = citiesByProvince.get(city.province) ?? []
    list.push(city)
    citiesByProvince.set(city.province, list)
  }

  const provinces = []
  for (const province of manifest.provinceSummaries) {
    const provinceCode = shortCode(province.gb)
    const nextLevel = await publishMap({
      sourcePath: await fileByCode(path.join(sourceRoot, '02-provinces-prefectures'), province.gb),
      destinationRoot,
      assetPath: `maps/provinces/${provinceCode}/children.geojson`,
      kind: 'province-children',
      label: `${province.province} → 下一级区域`,
      allowEmpty: true
    })
    const counties = await publishMap({
      sourcePath: await fileByCode(path.join(sourceRoot, '03-provinces-counties'), province.gb),
      destinationRoot,
      assetPath: `maps/provinces/${provinceCode}/counties.geojson`,
      kind: 'province-counties',
      label: `${province.province} → 区县`,
      allowEmpty: true
    })
    const prefectures = []
    for (const city of citiesByProvince.get(province.province) ?? []) {
      const cityCode = shortCode(city.gb)
      const citySourceDirectory = await directoryByCode(
        path.join(sourceRoot, '04-prefectures-counties'),
        province.gb
      )
      const citySourcePath = (await fileByCode(citySourceDirectory, city.gb))
      prefectures.push({
        gb: String(city.gb),
        name: city.prefecture,
        provinceEquivalent: Boolean(city.provinceEquivalent),
        counties: await publishMap({
          sourcePath: citySourcePath,
          destinationRoot,
          assetPath: `maps/prefectures/${cityCode}/counties.geojson`,
          kind: 'prefecture-counties',
          label: `${city.prefecture} → 区县`,
          allowEmpty: true
        })
      })
    }
    provinces.push({
      gb: String(province.gb),
      name: province.province,
      childLevelLabel: '下一级区域',
      nextLevel,
      counties,
      prefectures
    })
  }

  const catalog = {
    schemaVersion: REGION_CATALOG_SCHEMA_VERSION,
    dataVersion: REGION_CATALOG_DATA_VERSION,
    sourceLabel: SOURCE_LABEL,
    regionKeyProperty: KEY_PROPERTY,
    displayNameProperty: DISPLAY_PROPERTY,
    country,
    provinces
  }
  const catalogText = `${JSON.stringify(catalog)}\n`
  await writeFile(path.join(destinationRoot, 'catalog.json'), catalogText)
  return catalog
}

const scriptPath = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const projectRoot = path.resolve(path.dirname(scriptPath), '..')
  const sourceRoot = path.resolve(process.argv[2] ?? path.join(projectRoot, 'output', `tianditu-administrative-geojson-${REGION_CATALOG_DATA_VERSION}`))
  const destinationRoot = path.resolve(process.argv[3] ?? path.join(projectRoot, 'public', 'region-catalog', `tianditu-${REGION_CATALOG_DATA_VERSION}`))
  const catalog = await buildRegionCatalog({ sourceRoot, destinationRoot })
  const mapCount = 1 + catalog.provinces.reduce((sum, province) => sum + 2 + province.prefectures.length, 0)
  process.stdout.write(`Built region catalog: ${mapCount} entries at ${destinationRoot}\n`)
}
