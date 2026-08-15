import {
  parseRegionCatalog,
  regionCatalogAssetUrl,
  resolveRegionCatalogSelection,
  type RegionCatalog,
  type RegionCatalogMapEntry,
  type RegionCatalogSelection
} from './regionCatalog'

export const DEFAULT_REGION_CATALOG_BASE_URL = '/region-catalog/tianditu-2025-09/'

export interface RegionCatalogGeometry {
  text: string
  displayLabel: string
  regionKeyProperty: string
  displayNameProperty: string
  entry: RegionCatalogMapEntry
}

export interface RegionCatalogSource {
  loadCatalog(signal?: AbortSignal): Promise<RegionCatalog>
  loadGeometry(
    catalog: RegionCatalog,
    selection: RegionCatalogSelection,
    signal?: AbortSignal
  ): Promise<RegionCatalogGeometry>
}

export interface RegionCatalogSourceOptions {
  fetch?: typeof globalThis.fetch
  baseUrl?: string
}

async function checkedResponse(response: Response, label: string): Promise<Response> {
  if (!response.ok) throw new Error(`${label}请求失败（HTTP ${response.status}）`)
  return response
}

export function createRegionCatalogSource(options: RegionCatalogSourceOptions = {}): RegionCatalogSource {
  const request = options.fetch ?? globalThis.fetch
  const baseUrl = options.baseUrl ?? DEFAULT_REGION_CATALOG_BASE_URL
  const fetchResponse = async (url: string, label: string, signal?: AbortSignal): Promise<Response> => {
    try {
      return await checkedResponse(await request(url, { signal }), label)
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
      if (cause instanceof Error && cause.message.includes('HTTP ')) throw cause
      const message = cause instanceof Error && cause.message ? cause.message : String(cause)
      throw new Error(`${label}请求失败：${message}`)
    }
  }
  return {
    async loadCatalog(signal) {
      const response = await fetchResponse(
        regionCatalogAssetUrl(baseUrl, 'catalog.json'), '区域库目录', signal
      )
      let value: unknown
      try {
        value = await response.json()
      } catch {
        throw new Error('区域库目录不是有效 JSON')
      }
      return parseRegionCatalog(value)
    },

    async loadGeometry(catalog, selection, signal) {
      const entry = resolveRegionCatalogSelection(catalog, selection)
      if (!entry) throw new Error('所选区域不存在')
      if (!entry.available || !entry.assetPath) throw new Error(`${entry.label}暂无可用区域边界`)
      const response = await fetchResponse(
        regionCatalogAssetUrl(baseUrl, entry.assetPath), entry.label, signal
      )
      return {
        text: await response.text(),
        displayLabel: entry.label,
        regionKeyProperty: catalog.regionKeyProperty,
        displayNameProperty: catalog.displayNameProperty,
        entry
      }
    }
  }
}
