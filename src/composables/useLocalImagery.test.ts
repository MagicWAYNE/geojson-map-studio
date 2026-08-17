import { describe, expect, it } from 'vitest'
import type { LocalImageryLibrary, LocalImageryResolution } from '@/components/map/localImageryLibrary'
import type { MapDocument } from '@/components/map/mapDocument'
import { createLocalImageryRuntime } from './useLocalImagery'

function document(targetId?: string): MapDocument {
  return {
    version: 1,
    source: { kind: 'geojson', displayName: 'test', identity: 'geojson-v1:test', ...(targetId ? { imageryTargetId: targetId } : {}) },
    geometry: { regions: [], scale: 1, center: [0, 0] }, metrics: new Map(), metricLabels: null,
    appearance: { kind: 'tech-blue' }, drilldown: false
  }
}

const resolution = (id: string): LocalImageryResolution => ({
  entry: {
    id, status: 'available', assetPath: `images/${id}.jpg`, width: 10, height: 10,
    bytes: 1024, sha256: 'a'.repeat(64),
    projectedBounds: [0, 0, 10, 10], projection: 'EPSG:3857', sourceQuarter: '2025-Q2',
    fallbackUsed: false, noDataRatio: 0, attribution: 'Contains modified Copernicus Sentinel data 2025'
  },
  appearance: {
    kind: 'local-imagery', textureUrl: `/images/${id}.jpg`, projectedBounds: [0, 0, 10, 10],
    datasetId: 'sentinel2-quarterly-2025q2-v1', sourceQuarter: '2025-Q2',
    attribution: 'Contains modified Copernicus Sentinel data 2025',
    legalNoticeUrl: 'https://sentinels.copernicus.eu/legal-notice'
  },
  release() {}
})

describe('local imagery runtime', () => {
  it('is opt-in and discards stale target resolution', async () => {
    const resolvers = new Map<string, (value: LocalImageryResolution) => void>()
    const library: LocalImageryLibrary = {
      resolve: (id) => new Promise((resolve) => resolvers.set(id, resolve))
    }
    const runtime = createLocalImageryRuntime(library)
    runtime.setDocument(document('province:130000'))
    expect(runtime.state.value).toBe('idle')
    runtime.enabled.value = true
    await Promise.resolve()
    runtime.setDocument(document('prefecture:130100'))
    await Promise.resolve()
    resolvers.get('province:130000')?.(resolution('province:130000'))
    await Promise.resolve()
    expect(runtime.appearance.value).toBeNull()
    resolvers.get('prefecture:130100')?.(resolution('prefecture:130100'))
    await Promise.resolve()
    expect(runtime.appearance.value?.textureUrl).toBe('/images/prefecture:130100.jpg')
    expect(runtime.state.value).toBe('ready')
  })

  it('disables itself for arbitrary uploaded GeoJSON', async () => {
    const runtime = createLocalImageryRuntime({ resolve: async (id) => resolution(id) })
    runtime.setDocument(document('province:130000'))
    runtime.enabled.value = true
    await runtime.refresh()
    runtime.setDocument(document())
    expect(runtime.enabled.value).toBe(false)
    expect(runtime.appearance.value).toBeNull()
  })
})
