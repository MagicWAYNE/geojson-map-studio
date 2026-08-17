import type { MapDocument } from './mapDocument'
import type { RegionCatalogSelection } from './regionCatalog'

export const LOCAL_IMAGERY_DATASET_ID = 'sentinel2-quarterly-2025q2-v1'
export const DEFAULT_LOCAL_IMAGERY_BASE_URL = `${import.meta.env.BASE_URL}imagery-library/${LOCAL_IMAGERY_DATASET_ID}/`

export interface LocalImageryAvailableEntry {
  id: string
  status: 'available'
  assetPath: string
  width: number
  height: number
  bytes: number
  sha256: string
  projectedBounds: [number, number, number, number]
  projection: 'EPSG:3857'
  sourceQuarter: string
  fallbackUsed: boolean
  noDataRatio: number
  attribution: string
}

export interface LocalImageryUnavailableEntry {
  id: string
  status: 'unavailable'
  assetPath: null
  reason: string
  bestQuarter: string | null
  noDataRatio: number
  attribution: string
}

export type LocalImageryEntry = LocalImageryAvailableEntry | LocalImageryUnavailableEntry

export interface LocalImageryManifest {
  schemaVersion: 1
  datasetId: string
  projection: 'EPSG:3857'
  attribution: string
  legalNoticeUrl: string
  entries: LocalImageryEntry[]
}

export type LocalImageryAppearance = Extract<MapDocument['appearance'], { kind: 'local-imagery' }>

export interface LocalImageryResolution {
  entry: LocalImageryEntry
  appearance: LocalImageryAppearance | null
  release(): void
}

export interface LocalImageryLibrary {
  resolve(targetId: string, signal?: AbortSignal): Promise<LocalImageryResolution>
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function safeAssetPath(value: unknown): string {
  assert(typeof value === 'string', '本地影像资源路径无效')
  assert(!value.includes('\\') && !value.startsWith('/') && !value.includes('..') && !/^[a-z]+:/i.test(value), '本地影像资源路径不安全')
  assert(value.startsWith('images/'), '本地影像资源路径无效')
  return value
}

function bounds(value: unknown): [number, number, number, number] {
  assert(Array.isArray(value) && value.length === 4 && value.every(Number.isFinite), '本地影像投影范围无效')
  const result = value as [number, number, number, number]
  assert(result[0] < result[2] && result[1] < result[3], '本地影像投影范围顺序无效')
  return result
}

export function parseLocalImageryManifest(value: unknown, expectedTargetCount = 377): LocalImageryManifest {
  assert(isRecord(value) && value.schemaVersion === 1, '本地影像清单版本不受支持')
  assert(value.datasetId === LOCAL_IMAGERY_DATASET_ID, '本地影像数据集版本不匹配')
  assert(value.projection === 'EPSG:3857', '本地影像投影必须是 EPSG:3857')
  assert(typeof value.attribution === 'string' && value.attribution.length > 0, '本地影像署名缺失')
  assert(typeof value.legalNoticeUrl === 'string' && value.legalNoticeUrl.startsWith('https://'), '本地影像法律声明链接无效')
  assert(Array.isArray(value.entries) && value.entries.length === expectedTargetCount, `本地影像清单应包含 ${expectedTargetCount} 个目标`)
  const ids = new Set<string>()
  const entries = value.entries.map((candidate): LocalImageryEntry => {
    assert(isRecord(candidate) && typeof candidate.id === 'string' && !ids.has(candidate.id), '本地影像目标标识无效或重复')
    ids.add(candidate.id)
    assert(candidate.attribution === value.attribution, `${candidate.id} 的影像署名不一致`)
    assert(typeof candidate.noDataRatio === 'number' && candidate.noDataRatio >= 0 && candidate.noDataRatio <= 1, `${candidate.id} 的无数据比例无效`)
    if (candidate.status === 'unavailable') {
      assert(candidate.assetPath === null && typeof candidate.reason === 'string', `${candidate.id} 的不可用记录无效`)
      assert(candidate.bestQuarter === null || typeof candidate.bestQuarter === 'string', `${candidate.id} 的候选季度无效`)
      return {
        id: candidate.id,
        status: 'unavailable',
        assetPath: null,
        reason: candidate.reason,
        bestQuarter: candidate.bestQuarter,
        noDataRatio: candidate.noDataRatio,
        attribution: value.attribution as string
      }
    }
    assert(candidate.status === 'available', `${candidate.id} 的状态无效`)
    assert(candidate.projection === 'EPSG:3857', `${candidate.id} 的投影无效`)
    assert(Number.isInteger(candidate.width) && Number(candidate.width) > 0, `${candidate.id} 的宽度无效`)
    assert(Number.isInteger(candidate.height) && Number(candidate.height) > 0, `${candidate.id} 的高度无效`)
    assert(Number.isInteger(candidate.bytes) && Number(candidate.bytes) > 0, `${candidate.id} 的字节长度无效`)
    assert(typeof candidate.sha256 === 'string' && /^[a-f0-9]{64}$/.test(candidate.sha256), `${candidate.id} 的 SHA-256 无效`)
    assert(typeof candidate.sourceQuarter === 'string' && /^\d{4}-Q[1-4]$/.test(candidate.sourceQuarter), `${candidate.id} 的来源季度无效`)
    assert(typeof candidate.fallbackUsed === 'boolean', `${candidate.id} 的回退标记无效`)
    return {
      id: candidate.id,
      status: 'available',
      assetPath: safeAssetPath(candidate.assetPath),
      width: Number(candidate.width),
      height: Number(candidate.height),
      bytes: Number(candidate.bytes),
      sha256: candidate.sha256,
      projectedBounds: bounds(candidate.projectedBounds),
      projection: 'EPSG:3857',
      sourceQuarter: candidate.sourceQuarter,
      fallbackUsed: candidate.fallbackUsed,
      noDataRatio: candidate.noDataRatio,
      attribution: value.attribution as string
    }
  })
  return {
    schemaVersion: 1,
    datasetId: value.datasetId,
    projection: 'EPSG:3857',
    attribution: value.attribution,
    legalNoticeUrl: value.legalNoticeUrl,
    entries
  }
}

function assetUrl(baseUrl: string, assetPath: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${assetPath}`
}

export function createLocalImageryLibrary(options: {
  fetch?: typeof globalThis.fetch
  baseUrl?: string
  expectedTargetCount?: number
  digestSha256?: (bytes: ArrayBuffer) => Promise<string>
  createObjectUrl?: (blob: Blob) => string
  revokeObjectUrl?: (url: string) => void
  decodeImage?: (url: string, width: number, height: number) => Promise<void>
} = {}): LocalImageryLibrary {
  const request = options.fetch ?? globalThis.fetch
  const baseUrl = options.baseUrl ?? DEFAULT_LOCAL_IMAGERY_BASE_URL
  const digestSha256 = options.digestSha256 ?? (async (bytes) => {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
    return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
  })
  const createObjectUrl = options.createObjectUrl ?? ((blob) => URL.createObjectURL(blob))
  const revokeObjectUrl = options.revokeObjectUrl ?? ((url) => URL.revokeObjectURL(url))
  const decodeImage = options.decodeImage ?? (async (url, width, height) => {
    const image = new Image()
    image.src = url
    await image.decode()
    assert(image.naturalWidth === width && image.naturalHeight === height, '本地影像解码尺寸与清单不一致')
  })
  let cachedManifest: LocalImageryManifest | null = null
  return {
    async resolve(targetId, signal) {
      if (!cachedManifest) {
        const response = await request(assetUrl(baseUrl, 'manifest.json'), { signal })
        if (!response.ok) throw new Error(`本地影像清单加载失败（HTTP ${response.status}）`)
        let value: unknown
        try {
          value = await response.json()
        } catch {
          throw new Error('本地影像清单不是有效 JSON')
        }
        cachedManifest = parseLocalImageryManifest(value, options.expectedTargetCount)
      }
      const entry = cachedManifest.entries.find((candidate) => candidate.id === targetId)
      if (!entry) throw new Error(`本地影像清单中不存在目标 ${targetId}`)
      if (entry.status === 'unavailable') return { entry, appearance: null, release() {} }
      const imageResponse = await request(assetUrl(baseUrl, entry.assetPath), { signal })
      if (!imageResponse.ok) throw new Error(`本地影像加载失败（HTTP ${imageResponse.status}）`)
      const contentType = imageResponse.headers.get('content-type')?.toLowerCase() ?? ''
      assert(contentType.includes('image/jpeg'), '本地影像响应类型不是 JPEG')
      const bytes = await imageResponse.arrayBuffer()
      assert(bytes.byteLength === entry.bytes, '本地影像字节长度与清单不一致')
      assert(await digestSha256(bytes) === entry.sha256, '本地影像 SHA-256 与清单不一致')
      const objectUrl = createObjectUrl(new Blob([bytes], { type: 'image/jpeg' }))
      let released = false
      const release = () => {
        if (released) return
        released = true
        revokeObjectUrl(objectUrl)
      }
      try {
        await decodeImage(objectUrl, entry.width, entry.height)
      } catch (cause) {
        release()
        throw cause
      }
      return {
        entry,
        appearance: {
          kind: 'local-imagery',
          textureUrl: objectUrl,
          projectedBounds: entry.projectedBounds,
          datasetId: cachedManifest.datasetId,
          sourceQuarter: entry.sourceQuarter,
          attribution: entry.attribution,
          legalNoticeUrl: cachedManifest.legalNoticeUrl
        },
        release
      }
    }
  }
}

function sixDigitGb(value: string): string {
  const match = value.match(/^(?:156)?(\d{6})$/)
  if (!match) throw new Error(`区域库行政区代码无法映射到影像目标：${value}`)
  return match[1]
}

export function localImageryTargetId(selection: RegionCatalogSelection): string {
  if (selection.kind === 'country-provinces') return 'country:100000'
  if (selection.kind === 'prefecture-counties') return `prefecture:${sixDigitGb(selection.prefectureGb)}`
  return `province:${sixDigitGb(selection.provinceGb)}`
}
