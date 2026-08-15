export const REGION_CATALOG_SCHEMA_VERSION = 1

export type RegionCatalogSelection =
  | { kind: 'country-provinces' }
  | { kind: 'province-children'; provinceGb: string }
  | { kind: 'province-counties'; provinceGb: string }
  | { kind: 'prefecture-counties'; provinceGb: string; prefectureGb: string }

export interface RegionCatalogMapEntry {
  kind: RegionCatalogSelection['kind']
  label: string
  available: boolean
  assetPath: string | null
  featureCount: number
  byteLength: number
}

export interface RegionCatalogPrefecture {
  gb: string
  name: string
  provinceEquivalent: boolean
  counties: RegionCatalogMapEntry
}

export interface RegionCatalogProvince {
  gb: string
  name: string
  childLevelLabel: string
  nextLevel: RegionCatalogMapEntry
  counties: RegionCatalogMapEntry
  prefectures: RegionCatalogPrefecture[]
}

export interface RegionCatalog {
  schemaVersion: 1
  dataVersion: string
  sourceLabel: string
  regionKeyProperty: string
  displayNameProperty: string
  country: RegionCatalogMapEntry
  provinces: RegionCatalogProvince[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmptyText(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${path} 必须是非空文本`)
  return value
}

function nonNegativeInteger(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`${path} 必须是非负整数`)
  }
  return value
}

function mapEntry(value: unknown, path: string, expectedKind: RegionCatalogMapEntry['kind']): RegionCatalogMapEntry {
  if (!isRecord(value) || value.kind !== expectedKind || typeof value.available !== 'boolean') {
    throw new Error(`${path} 不是有效的区域地图条目`)
  }
  const assetPath = value.assetPath === null ? null : nonEmptyText(value.assetPath, `${path}.assetPath`)
  if (assetPath && (/^(?:[a-z]+:)?\/\//i.test(assetPath) || assetPath.startsWith('/') || assetPath.includes('..'))) {
    throw new Error(`${path}.assetPath 必须是安全的相对路径`)
  }
  if (value.available !== Boolean(assetPath)) throw new Error(`${path} 的可用状态和资源路径不一致`)
  const featureCount = nonNegativeInteger(value.featureCount, `${path}.featureCount`)
  const byteLength = nonNegativeInteger(value.byteLength, `${path}.byteLength`)
  if (value.available && (featureCount === 0 || byteLength === 0)) throw new Error(`${path} 的可用资源不能为空`)
  if (!value.available && (featureCount !== 0 || byteLength !== 0)) throw new Error(`${path} 的不可用资源必须为空`)
  return {
    kind: expectedKind,
    label: nonEmptyText(value.label, `${path}.label`),
    available: value.available,
    assetPath,
    featureCount,
    byteLength
  }
}

export function parseRegionCatalog(value: unknown): RegionCatalog {
  if (!isRecord(value) || value.schemaVersion !== REGION_CATALOG_SCHEMA_VERSION) {
    throw new Error(`区域库 schemaVersion 必须是 ${REGION_CATALOG_SCHEMA_VERSION}`)
  }
  if (!Array.isArray(value.provinces)) throw new Error('区域库 provinces 必须是数组')
  const provinceKeys = new Set<string>()
  const provinces = value.provinces.map((candidate, provinceIndex): RegionCatalogProvince => {
    const path = `provinces[${provinceIndex}]`
    if (!isRecord(candidate) || !Array.isArray(candidate.prefectures)) throw new Error(`${path} 无效`)
    const gb = nonEmptyText(candidate.gb, `${path}.gb`)
    if (provinceKeys.has(gb)) throw new Error(`${path}.gb 重复`)
    provinceKeys.add(gb)
    const prefectureKeys = new Set<string>()
    const prefectures = candidate.prefectures.map((item, prefectureIndex): RegionCatalogPrefecture => {
      const prefecturePath = `${path}.prefectures[${prefectureIndex}]`
      if (!isRecord(item) || typeof item.provinceEquivalent !== 'boolean') throw new Error(`${prefecturePath} 无效`)
      const prefectureGb = nonEmptyText(item.gb, `${prefecturePath}.gb`)
      if (prefectureKeys.has(prefectureGb)) throw new Error(`${prefecturePath}.gb 重复`)
      prefectureKeys.add(prefectureGb)
      return {
        gb: prefectureGb,
        name: nonEmptyText(item.name, `${prefecturePath}.name`),
        provinceEquivalent: item.provinceEquivalent,
        counties: mapEntry(item.counties, `${prefecturePath}.counties`, 'prefecture-counties')
      }
    })
    return {
      gb,
      name: nonEmptyText(candidate.name, `${path}.name`),
      childLevelLabel: nonEmptyText(candidate.childLevelLabel, `${path}.childLevelLabel`),
      nextLevel: mapEntry(candidate.nextLevel, `${path}.nextLevel`, 'province-children'),
      counties: mapEntry(candidate.counties, `${path}.counties`, 'province-counties'),
      prefectures
    }
  })
  return {
    schemaVersion: 1,
    dataVersion: nonEmptyText(value.dataVersion, 'dataVersion'),
    sourceLabel: nonEmptyText(value.sourceLabel, 'sourceLabel'),
    regionKeyProperty: nonEmptyText(value.regionKeyProperty, 'regionKeyProperty'),
    displayNameProperty: nonEmptyText(value.displayNameProperty, 'displayNameProperty'),
    country: mapEntry(value.country, 'country', 'country-provinces'),
    provinces
  }
}

export function resolveRegionCatalogSelection(
  catalog: RegionCatalog,
  selection: RegionCatalogSelection
): RegionCatalogMapEntry | null {
  if (selection.kind === 'country-provinces') return catalog.country
  const province = catalog.provinces.find((candidate) => candidate.gb === selection.provinceGb)
  if (!province) return null
  if (selection.kind === 'province-children') return province.nextLevel
  if (selection.kind === 'province-counties') return province.counties
  return province.prefectures.find((candidate) => candidate.gb === selection.prefectureGb)?.counties ?? null
}

export function regionCatalogAssetUrl(baseUrl: string, assetPath: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${assetPath.replace(/^\/+/, '')}`
}
