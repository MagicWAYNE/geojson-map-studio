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

export const LOCAL_IMAGERY_RUNTIME_TARGET_COUNT = 35

export function isLocalImageryTargetSupported(targetId: string | null): boolean {
  return targetId !== null && /^(?:country|province):\d{6}$/.test(targetId)
}

export function parseLocalImageryManifest(
  value: unknown,
  expectedTargetCount = LOCAL_IMAGERY_RUNTIME_TARGET_COUNT
): LocalImageryManifest {
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

const SHA256_ROUND_CONSTANTS = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
])

function rotateRight(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits))
}

export function sha256Hex(bytes: Uint8Array): string {
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64
  const padded = new Uint8Array(paddedLength)
  padded.set(bytes)
  padded[bytes.length] = 0x80
  const bitLength = bytes.length * 8
  const view = new DataView(padded.buffer)
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x1_0000_0000), false)
  view.setUint32(paddedLength - 4, bitLength >>> 0, false)

  const state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ])
  const words = new Uint32Array(64)
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, false)
    for (let index = 16; index < 64; index += 1) {
      const previous15 = words[index - 15]
      const previous2 = words[index - 2]
      const sigma0 = rotateRight(previous15, 7) ^ rotateRight(previous15, 18) ^ (previous15 >>> 3)
      const sigma1 = rotateRight(previous2, 17) ^ rotateRight(previous2, 19) ^ (previous2 >>> 10)
      words[index] = (words[index - 16] + sigma0 + words[index - 7] + sigma1) >>> 0
    }
    let [a, b, c, d, e, f, g, h] = state
    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)
      const choice = (e & f) ^ (~e & g)
      const temporary1 = (h + sum1 + choice + SHA256_ROUND_CONSTANTS[index] + words[index]) >>> 0
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)
      const majority = (a & b) ^ (a & c) ^ (b & c)
      const temporary2 = (sum0 + majority) >>> 0
      h = g
      g = f
      f = e
      e = (d + temporary1) >>> 0
      d = c
      c = b
      b = a
      a = (temporary1 + temporary2) >>> 0
    }
    state[0] = (state[0] + a) >>> 0
    state[1] = (state[1] + b) >>> 0
    state[2] = (state[2] + c) >>> 0
    state[3] = (state[3] + d) >>> 0
    state[4] = (state[4] + e) >>> 0
    state[5] = (state[5] + f) >>> 0
    state[6] = (state[6] + g) >>> 0
    state[7] = (state[7] + h) >>> 0
  }
  return [...state].map((value) => value.toString(16).padStart(8, '0')).join('')
}

export async function digestSha256(
  bytes: ArrayBuffer,
  subtle: Pick<SubtleCrypto, 'digest'> | null | undefined = globalThis.crypto?.subtle
): Promise<string> {
  if (!subtle) return sha256Hex(new Uint8Array(bytes))
  const digest = await subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
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
  const resolveDigestSha256 = options.digestSha256 ?? digestSha256
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
      assert(await resolveDigestSha256(bytes) === entry.sha256, '本地影像 SHA-256 与清单不一致')
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
