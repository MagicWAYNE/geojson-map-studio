import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import {
  createLocalImageryLibrary,
  digestSha256,
  isLocalImageryTargetSupported,
  localImageryTargetId,
  parseLocalImageryManifest,
  sha256Hex
} from './localImageryLibrary'

function manifest(status: 'available' | 'unavailable' = 'available') {
  const common = {
    id: 'province:130000', noDataRatio: status === 'available' ? 0.01 : 0.08,
    attribution: 'Contains modified Copernicus Sentinel data 2025'
  }
  return {
    schemaVersion: 1,
    datasetId: 'sentinel2-quarterly-2025q2-v1',
    projection: 'EPSG:3857',
    attribution: common.attribution,
    legalNoticeUrl: 'https://sentinels.copernicus.eu/legal-notice',
    entries: [status === 'available' ? {
      ...common, status, assetPath: 'images/provinces/130000.jpg', width: 2000, height: 1800,
      bytes: 4, sha256: 'a'.repeat(64), projectedBounds: [1, 2, 3, 4], projection: 'EPSG:3857',
      sourceQuarter: '2025-Q2', fallbackUsed: false
    } : {
      ...common, status, assetPath: null, reason: 'no-data', bestQuarter: '2025-Q4'
    }]
  }
}

describe('local imagery library', () => {
  it('keeps SHA-256 verification available without secure-context Web Crypto', async () => {
    const fixtures = [
      new Uint8Array(),
      new TextEncoder().encode('abc'),
      Uint8Array.from({ length: 257 }, (_, index) => (index * 37) % 256)
    ]
    for (const bytes of fixtures) {
      const expected = createHash('sha256').update(bytes).digest('hex')
      expect(sha256Hex(bytes)).toBe(expected)
      expect(await digestSha256(bytes.buffer as ArrayBuffer, null)).toBe(expected)
    }
  })

  it('maps all catalog selection kinds to stable runtime identities', () => {
    expect(localImageryTargetId({ kind: 'country-provinces' })).toBe('country:100000')
    expect(localImageryTargetId({ kind: 'province-children', provinceGb: '156130000' })).toBe('province:130000')
    expect(localImageryTargetId({ kind: 'province-counties', provinceGb: '156130000' })).toBe('province:130000')
    expect(localImageryTargetId({ kind: 'prefecture-counties', provinceGb: '156130000', prefectureGb: '156130100' })).toBe('prefecture:130100')
  })

  it('limits the deployed imagery tier to country and province targets', () => {
    expect(isLocalImageryTargetSupported('country:100000')).toBe(true)
    expect(isLocalImageryTargetSupported('province:130000')).toBe(true)
    expect(isLocalImageryTargetSupported('prefecture:130100')).toBe(false)
    expect(isLocalImageryTargetSupported(null)).toBe(false)
  })

  it('resolves same-origin paths from the manifest and caches the manifest', async () => {
    const request = vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('manifest.json')
      ? new Response(JSON.stringify(manifest()))
      : new Response(new Uint8Array([1, 2, 3, 4]), { headers: { 'content-type': 'image/jpeg' } }))
    const release = vi.fn()
    const library = createLocalImageryLibrary({
      fetch: request, baseUrl: '/local/', expectedTargetCount: 1,
      digestSha256: async () => 'a'.repeat(64),
      createObjectUrl: () => 'blob:verified-image',
      revokeObjectUrl: release,
      decodeImage: async () => undefined
    })
    const first = await library.resolve('province:130000')
    const second = await library.resolve('province:130000')
    expect(first.appearance).toMatchObject({
      kind: 'local-imagery', textureUrl: 'blob:verified-image', projectedBounds: [1, 2, 3, 4]
    })
    expect(second.entry.status).toBe('available')
    expect(request.mock.calls.filter(([url]) => String(url).endsWith('manifest.json'))).toHaveLength(1)
    expect(request.mock.calls.filter(([url]) => String(url).endsWith('.jpg'))).toHaveLength(2)
    expect(String(request.mock.calls[0][0])).not.toMatch(/^https?:/)
    first.release()
    first.release()
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('returns explicit unavailable state and rejects unsafe paths', async () => {
    const unavailable = createLocalImageryLibrary({
      fetch: vi.fn().mockResolvedValue(new Response(JSON.stringify(manifest('unavailable')))),
      expectedTargetCount: 1
    })
    expect((await unavailable.resolve('province:130000')).appearance).toBeNull()
    const unsafe = manifest()
    unsafe.entries[0].assetPath = '../secret.jpg'
    expect(() => parseLocalImageryManifest(unsafe, 1)).toThrow(/不安全/)
  })

  it('rejects a local image hash mismatch before publishing a blob URL', async () => {
    const createObjectUrl = vi.fn(() => 'blob:must-not-publish')
    const library = createLocalImageryLibrary({
      fetch: vi.fn(async (input: RequestInfo | URL) => String(input).endsWith('manifest.json')
        ? new Response(JSON.stringify(manifest()))
        : new Response(new Uint8Array([1, 2, 3, 4]), { headers: { 'content-type': 'image/jpeg' } })),
      expectedTargetCount: 1,
      digestSha256: async () => 'b'.repeat(64),
      createObjectUrl,
      decodeImage: async () => undefined
    })
    await expect(library.resolve('province:130000')).rejects.toThrow(/SHA-256/)
    expect(createObjectUrl).not.toHaveBeenCalled()
  })
})
