import { geoMercator } from 'd3-geo'
import { projectRegions, type ProjectionResult, type Region, type Ring } from './mapGeometry'

export const MAP_PLANE_MAX = 110
export const GEOJSON_MAX_BYTES = 10 * 1024 * 1024
export const GEOJSON_MAX_FEATURES = 500
export const GEOJSON_MAX_POSITIONS = 250_000
export const METRICS_MAX_BYTES = 2 * 1024 * 1024
export const METRICS_MAX_REGIONS = 500

export type MapImportErrorCode =
  | 'invalid-json'
  | 'file-too-large'
  | 'invalid-root'
  | 'empty-features'
  | 'too-many-features'
  | 'unsupported-geometry'
  | 'invalid-coordinate'
  | 'invalid-ring'
  | 'dateline-crossing'
  | 'too-many-positions'
  | 'invalid-name-property'
  | 'duplicate-name'
  | 'invalid-metrics'
  | 'invalid-visualization'

export class MapImportError extends Error {
  readonly code: MapImportErrorCode
  readonly path: string
  readonly userMessage: string

  constructor(code: MapImportErrorCode, path: string, userMessage: string) {
    super(userMessage)
    this.name = 'MapImportError'
    this.code = code
    this.path = path
    this.userMessage = userMessage
  }
}

export interface MapRegionMetrics {
  name: string
  displayName: string
  primary: number
  secondary: number
}

export interface MapMetricLabels {
  primary: { label: string; unit: string }
  secondary: { label: string; unit: string }
}

export interface MapVisualizationRegionDraft {
  regionKey: string
  displayName: string
  enabled: boolean
  primary: number | null
  secondary: number | null
}

export interface MapVisualizationDraft {
  labels: MapMetricLabels
  regions: MapVisualizationRegionDraft[]
}

export interface MapDocument {
  version: 1
  source: { kind: 'builtin' | 'geojson'; displayName: string }
  geometry: ProjectionResult
  metrics: ReadonlyMap<string, MapRegionMetrics>
  metricLabels: MapMetricLabels | null
  appearance:
    | { kind: 'terrain-texture'; textureUrl: string }
    | { kind: 'tech-blue' }
  drilldown: boolean
}

export interface PersistedMapPackage {
  version: 1
  geometryText: string
  geometryFileName: string
  nameProperty: string
  metricsText?: string
}

export interface MapMetricsSummary {
  matchedNames: string[]
  missingNames: string[]
  extraNames: string[]
}

export interface MapImportSummary {
  geometryFileName: string
  featureCount: number
  totalPositionCount: number
  polygonCount: number
  multiPolygonCount: number
  nameProperty: string
  metrics: MapMetricsSummary | null
}

export interface PreparedMapPackage {
  document: MapDocument
  persisted: PersistedMapPackage
  summary: MapImportSummary
}

export interface GeoJsonInspection {
  featureCount: number
  totalPositionCount: number
  polygonCount: number
  multiPolygonCount: number
  usableNameProperties: string[]
  namePropertyConflicts: Array<{
    property: string
    duplicateValues: string[]
  }>
}

export interface PrepareGeoJsonMapPackageInput {
  geometryText: string
  geometryFileName: string
  nameProperty: string
  metricsText?: string
}

type JsonRecord = Record<string, unknown>

interface ParsedFeature {
  properties: JsonRecord
  regionOuters: Region['outers']
}

interface ParsedGeoJson {
  features: ParsedFeature[]
  inspection: Omit<GeoJsonInspection, 'usableNameProperties' | 'namePropertyConflicts'>
}

interface ParsedMetrics {
  labels: MapMetricLabels
  byName: Map<string, MapRegionMetrics>
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength
}

function fail(code: MapImportErrorCode, path: string, message: string): never {
  throw new MapImportError(code, path, message)
}

function parseJson(text: string, maxBytes: number, fileLabel: string): unknown {
  if (byteLength(text) > maxBytes) {
    fail('file-too-large', '$', `${fileLabel}超过大小限制`)
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    fail('invalid-json', '$', `${fileLabel}不是有效 JSON`)
  }
}

function primitiveName(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.trim() ? value : null
  }
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : null
}

function readPosition(value: unknown, path: string): [number, number] {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    typeof value[0] !== 'number' ||
    typeof value[1] !== 'number' ||
    !Number.isFinite(value[0]) ||
    !Number.isFinite(value[1]) ||
    value[0] < -180 ||
    value[0] > 180 ||
    value[1] < -85.05112878 ||
    value[1] > 85.05112878
  ) {
    fail('invalid-coordinate', path, `${path} 必须是有效的 [longitude, latitude]`)
  }
  return [value[0], value[1]]
}

function positionsEqual(left: readonly number[], right: readonly number[]): boolean {
  return left[0] === right[0] && left[1] === right[1]
}

function projectedRingArea(ring: Ring): number {
  return ring.reduce((sum, [x1, y1], index) => {
    const [x2, y2] = ring[(index + 1) % ring.length]
    return sum + x1 * y2 - x2 * y1
  }, 0) / 2
}

function readRing(value: unknown, path: string, incrementPositionCount: () => void): Ring {
  if (!Array.isArray(value) || value.length < 4) {
    fail('invalid-ring', path, `${path} 至少需要四个位置`)
  }
  const geographic = value.map((position, index) => {
    incrementPositionCount()
    return readPosition(position, `${path}[${index}]`)
  })
  if (!positionsEqual(geographic[0], geographic[geographic.length - 1])) {
    fail('invalid-ring', path, `${path} 必须闭合`)
  }
  for (let index = 1; index < geographic.length; index += 1) {
    if (Math.abs(geographic[index][0] - geographic[index - 1][0]) > 180) {
      fail('dateline-crossing', `${path}[${index}]`, `${path} 不支持跨越国际日期变更线`)
    }
  }

  const projection = geoMercator().scale(1).translate([0, 0])
  const projected = geographic.slice(0, -1).map((position, index) => {
    const point = projection(position)
    if (!point) fail('invalid-coordinate', `${path}[${index}]`, `${path}[${index}] 无法投影`)
    return point as [number, number]
  })
  if (Math.abs(projectedRingArea(projected)) <= Number.EPSILON) {
    fail('invalid-ring', path, `${path} 不能是零面积环`)
  }
  return projected
}

function readPolygon(
  value: unknown,
  path: string,
  incrementPositionCount: () => void
): Region['outers'][number] {
  if (!Array.isArray(value) || value.length === 0) {
    fail('invalid-ring', path, `${path} 必须包含外环`)
  }
  return {
    ring: readRing(value[0], `${path}[0]`, incrementPositionCount),
    holes: value.slice(1).map((ring, index) =>
      readRing(ring, `${path}[${index + 1}]`, incrementPositionCount)
    )
  }
}

function parseGeoJson(text: string): ParsedGeoJson {
  const root = parseJson(text, GEOJSON_MAX_BYTES, 'GeoJSON')
  if (!isRecord(root) || root.type !== 'FeatureCollection' || !Array.isArray(root.features)) {
    fail('invalid-root', '$', 'GeoJSON 根对象必须是 FeatureCollection')
  }
  if (root.features.length === 0) fail('empty-features', 'features', 'GeoJSON 至少需要一个 feature')
  if (root.features.length > GEOJSON_MAX_FEATURES) {
    fail('too-many-features', 'features', `GeoJSON 区域数不能超过 ${GEOJSON_MAX_FEATURES}`)
  }

  let totalPositionCount = 0
  let polygonCount = 0
  let multiPolygonCount = 0
  const incrementPositionCount = () => {
    totalPositionCount += 1
    if (totalPositionCount > GEOJSON_MAX_POSITIONS) {
      fail('too-many-positions', 'features', `GeoJSON 总位置数不能超过 ${GEOJSON_MAX_POSITIONS}`)
    }
  }

  const features = root.features.map((candidate, featureIndex): ParsedFeature => {
    const featurePath = `features[${featureIndex}]`
    if (!isRecord(candidate) || candidate.type !== 'Feature' || !isRecord(candidate.properties)) {
      fail('invalid-root', featurePath, `${featurePath} 必须是包含 properties 的 Feature`)
    }
    if (!isRecord(candidate.geometry) || typeof candidate.geometry.type !== 'string') {
      fail('unsupported-geometry', `${featurePath}.geometry`, `${featurePath} 缺少受支持的 geometry`)
    }
    const coordinatePath = `${featurePath}.geometry.coordinates`
    try {
      if (candidate.geometry.type === 'Polygon') {
        polygonCount += 1
        return {
          properties: candidate.properties,
          regionOuters: [readPolygon(candidate.geometry.coordinates, coordinatePath, incrementPositionCount)]
        }
      }
      if (candidate.geometry.type === 'MultiPolygon') {
        multiPolygonCount += 1
        if (!Array.isArray(candidate.geometry.coordinates) || candidate.geometry.coordinates.length === 0) {
          fail('invalid-ring', coordinatePath, `${coordinatePath} 必须包含至少一个 Polygon`)
        }
        return {
          properties: candidate.properties,
          regionOuters: candidate.geometry.coordinates.map((polygon, polygonIndex) =>
            readPolygon(polygon, `${coordinatePath}[${polygonIndex}]`, incrementPositionCount)
          )
        }
      }
      fail(
        'unsupported-geometry',
        `${featurePath}.geometry.type`,
        `${featurePath} 只支持 Polygon 或 MultiPolygon`
      )
    } catch (cause) {
      if (cause instanceof MapImportError) {
        const name = primitiveName(candidate.properties.name)
        const featureLabel = name === null ? featurePath : `${featurePath}（${name}）`
        throw new MapImportError(cause.code, cause.path, `${featureLabel}：${cause.userMessage}`)
      }
      throw cause
    }
  })

  return {
    features,
    inspection: {
      featureCount: features.length,
      totalPositionCount,
      polygonCount,
      multiPolygonCount
    }
  }
}

function inspectNameProperties(features: ParsedFeature[]): Pick<
  GeoJsonInspection,
  'usableNameProperties' | 'namePropertyConflicts'
> {
  const first = features[0]?.properties
  if (!first) return { usableNameProperties: [], namePropertyConflicts: [] }
  const usableNameProperties: string[] = []
  const namePropertyConflicts: GeoJsonInspection['namePropertyConflicts'] = []
  for (const property of Object.keys(first)) {
    const names = features.map((feature) => primitiveName(feature.properties[property]))
    if (!names.every((name): name is string => name !== null)) continue
    const seen = new Set<string>()
    const duplicateValues = new Set<string>()
    for (const name of names) {
      if (seen.has(name)) duplicateValues.add(name)
      seen.add(name)
    }
    if (duplicateValues.size === 0) usableNameProperties.push(property)
    else namePropertyConflicts.push({ property, duplicateValues: [...duplicateValues] })
  }
  return { usableNameProperties, namePropertyConflicts }
}

function regionsWithNames(features: ParsedFeature[], nameProperty: string): Region[] {
  const names = features.map((feature, featureIndex) => {
    const name = primitiveName(feature.properties[nameProperty])
    if (name === null) {
      fail(
        'invalid-name-property',
        `features[${featureIndex}].properties.${nameProperty}`,
        `名称字段 ${nameProperty} 必须在每个 feature 中产生非空字符串或数字`
      )
    }
    return name
  })
  const seen = new Set<string>()
  for (const [index, name] of names.entries()) {
    if (seen.has(name)) {
      fail('duplicate-name', `features[${index}].properties.${nameProperty}`, `区域名称 ${name} 重复`)
    }
    seen.add(name)
  }
  return features.map((feature, index) => ({ name: names[index], outers: feature.regionOuters }))
}

function readMetricText(
  value: unknown,
  path: string,
  maxLength: number
): string {
  if (typeof value !== 'string') {
    fail('invalid-metrics', path, `${path} 必须是文本`)
  }
  const text = value.trim()
  if (!text || Array.from(text).length > maxLength) {
    fail('invalid-metrics', path, `${path} 长度必须在 1 到 ${maxLength} 个字符之间`)
  }
  return text
}

function readVisualizationText(value: unknown, path: string, maxLength: number): string {
  if (typeof value !== 'string') {
    fail('invalid-visualization', path, `${path} 必须是文本`)
  }
  const text = value.trim()
  if (!text || Array.from(text).length > maxLength) {
    fail('invalid-visualization', path, `${path} 长度必须在 1 到 ${maxLength} 个字符之间`)
  }
  return text
}

function readMetricLabel(value: unknown, path: string): { label: string; unit: string } {
  if (!isRecord(value)) fail('invalid-metrics', path, `${path} 必须包含 label 和 unit`)
  return {
    label: readMetricText(value.label, `${path}.label`, 20),
    unit: readMetricText(value.unit, `${path}.unit`, 8)
  }
}

function readMetricNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    fail('invalid-metrics', path, `${path} 必须是有限的非负数`)
  }
  return value
}

function parseMetrics(text: string): ParsedMetrics {
  const root = parseJson(text, METRICS_MAX_BYTES, '业务数据')
  if (!isRecord(root) || root.version !== 1 || !Array.isArray(root.regions)) {
    fail('invalid-metrics', '$', '业务数据必须使用 version 1 合同')
  }
  if (root.regions.length > METRICS_MAX_REGIONS) {
    fail('invalid-metrics', 'regions', `业务数据区域数不能超过 ${METRICS_MAX_REGIONS}`)
  }
  const labels: MapMetricLabels = {
    primary: readMetricLabel(root.primaryMetric, 'primaryMetric'),
    secondary: readMetricLabel(root.secondaryMetric, 'secondaryMetric')
  }
  const byName = new Map<string, MapRegionMetrics>()
  root.regions.forEach((candidate, index) => {
    const path = `regions[${index}]`
    if (!isRecord(candidate) || typeof candidate.name !== 'string' || !candidate.name.trim()) {
      fail('invalid-metrics', `${path}.name`, `${path}.name 必须是非空文本`)
    }
    const name = candidate.name
    if (byName.has(name)) fail('invalid-metrics', `${path}.name`, `业务数据区域名称 ${name} 重复`)
    byName.set(name, {
      name,
      displayName: name,
      primary: readMetricNumber(candidate.primary, `${path}.primary`),
      secondary: readMetricNumber(candidate.secondary, `${path}.secondary`)
    })
  })
  return { labels, byName }
}

export function inspectGeoJsonMap(geometryText: string): GeoJsonInspection {
  const parsed = parseGeoJson(geometryText)
  return {
    ...parsed.inspection,
    ...inspectNameProperties(parsed.features)
  }
}

export function createMapVisualizationDraft(document: MapDocument): MapVisualizationDraft {
  return {
    labels: {
      primary: { label: '扶持企业', unit: '家' },
      secondary: { label: '服务资源', unit: '项' }
    },
    regions: document.geometry.regions.map((region) => ({
      regionKey: region.name,
      displayName: region.name,
      enabled: false,
      primary: null,
      secondary: null
    }))
  }
}

export function composeMapVisualization(
  document: MapDocument,
  draft: MapVisualizationDraft
): MapDocument {
  const expectedKeys = new Set(document.geometry.regions.map((region) => region.name))
  const rowsByKey = new Map<string, MapVisualizationRegionDraft>()
  const displayNames = new Set<string>()
  const metrics = new Map<string, MapRegionMetrics>()

  for (const [index, row] of draft.regions.entries()) {
    const path = `regions[${index}]`
    if (!expectedKeys.has(row.regionKey) || rowsByKey.has(row.regionKey)) {
      fail('invalid-visualization', `${path}.regionKey`, `${path}.regionKey 必须对应唯一的地图分块`)
    }
    rowsByKey.set(row.regionKey, row)
    const displayName = readVisualizationText(row.displayName, `${path}.displayName`, 40)
    if (displayNames.has(displayName)) {
      fail('invalid-visualization', `${path}.displayName`, `展示名称 ${displayName} 重复`)
    }
    displayNames.add(displayName)
    if (!row.enabled) continue
    metrics.set(row.regionKey, {
      name: row.regionKey,
      displayName,
      primary: readMetricNumber(row.primary, `${path}.primary`),
      secondary: readMetricNumber(row.secondary, `${path}.secondary`)
    })
  }

  if (rowsByKey.size !== expectedKeys.size) {
    fail('invalid-visualization', 'regions', '每个地图分块必须且只能有一条编辑记录')
  }
  const labels = metrics.size === 0
    ? null
    : {
        primary: readMetricLabel(draft.labels.primary, 'primaryMetric'),
        secondary: readMetricLabel(draft.labels.secondary, 'secondaryMetric')
      }
  return {
    ...document,
    metrics,
    metricLabels: labels
  }
}

export function prepareGeoJsonMapPackage(input: PrepareGeoJsonMapPackageInput): PreparedMapPackage {
  const parsed = parseGeoJson(input.geometryText)
  const regions = regionsWithNames(parsed.features, input.nameProperty)
  const parsedMetrics = input.metricsText === undefined ? null : parseMetrics(input.metricsText)
  const regionNames = new Set(regions.map((region) => region.name))
  const metrics = new Map<string, MapRegionMetrics>()
  if (parsedMetrics) {
    for (const region of regions) {
      const item = parsedMetrics.byName.get(region.name)
      if (item) metrics.set(region.name, item)
    }
  }
  const document: MapDocument = {
    version: 1,
    source: { kind: 'geojson', displayName: input.geometryFileName },
    geometry: projectRegions(regions, MAP_PLANE_MAX),
    metrics,
    metricLabels: parsedMetrics?.labels ?? null,
    appearance: { kind: 'tech-blue' },
    drilldown: false
  }
  return {
    document,
    persisted: {
      version: 1,
      geometryText: input.geometryText,
      geometryFileName: input.geometryFileName,
      nameProperty: input.nameProperty,
      ...(input.metricsText === undefined ? {} : { metricsText: input.metricsText })
    },
    summary: {
      geometryFileName: input.geometryFileName,
      ...parsed.inspection,
      nameProperty: input.nameProperty,
      metrics: parsedMetrics
        ? {
            matchedNames: regions
              .map((region) => region.name)
              .filter((name) => parsedMetrics.byName.has(name)),
            missingNames: regions
              .map((region) => region.name)
              .filter((name) => !parsedMetrics.byName.has(name)),
            extraNames: [...parsedMetrics.byName.keys()].filter((name) => !regionNames.has(name))
          }
        : null
    }
  }
}
