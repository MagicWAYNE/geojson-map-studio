import { describe, expect, it, vi } from 'vitest'
import {
  createActiveMapSource,
  type MapPackageStore
} from './activeMapSource'
import {
  createMapVisualizationDraft,
  prepareGeoJsonMapPackage,
  type MapDocument,
  type PersistedMapPackage
} from './mapDocument'
import { createMemoryMapVisualizationSession } from './mapVisualizationSession'

class MemoryMapPackageStore implements MapPackageStore {
  active: unknown = null
  failRead = false
  failWrite = false
  writeCount = 0

  async readActive(): Promise<unknown> {
    if (this.failRead) throw new Error('read failed')
    return this.active
  }

  async writeActive(value: PersistedMapPackage, signal?: AbortSignal): Promise<void> {
    signal?.throwIfAborted()
    if (this.failWrite) throw new Error('write failed')
    this.writeCount += 1
    this.active = structuredClone(value)
  }

  async deleteActive(): Promise<void> {
    this.active = null
  }
}

function geometryText(name: string): string {
  return JSON.stringify({
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { name },
      geometry: {
        type: 'Polygon',
        coordinates: [[[106, 29], [107, 29], [107, 30], [106, 29]]]
      }
    }]
  })
}

function prepared(name: string) {
  return prepareGeoJsonMapPackage({
    geometryText: geometryText(name),
    geometryFileName: `${name}.geojson`,
    nameProperty: 'name'
  })
}

function builtinDocument(): MapDocument {
  return {
    ...prepared('内置').document,
    source: { kind: 'builtin', displayName: '内置地图' },
    appearance: { kind: 'terrain-texture', textureUrl: '/builtin.png' },
    drilldown: true
  }
}

function visualizationFor(name: string, displayName: string) {
  const draft = createMapVisualizationDraft(prepared(name).document)
  draft.labels = {
    primary: { label: '企业数', unit: '家', format: 'integer' },
    secondary: { label: '服务包', unit: '份', format: 'decimal' }
  }
  draft.regions[0] = {
    regionKey: name,
    displayName,
    enabled: true,
    primary: 88,
    secondary: 12
  }
  return draft
}

describe('activeMapSource', () => {
  it('激活写入被新上传中止时不替换持久记录、会话或当前地图', async () => {
    const store = new MemoryMapPackageStore()
    const session = createMemoryMapVisualizationSession()
    const source = createActiveMapSource({ store, session, loadBuiltin: async () => builtinDocument() })
    const current = prepared('当前地图')
    await source.activate(current, visualizationFor('当前地图', '当前展示名'))

    const writeActive = vi.spyOn(store, 'writeActive').mockImplementationOnce(async (_value, signal) => {
      await new Promise<void>((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(signal.reason), { once: true })
      })
    })
    const controller = new AbortController()
    const staleActivation = source.activate(prepared('过期地图'), undefined, {
      signal: controller.signal
    })
    controller.abort(new DOMException('stale geometry activation', 'AbortError'))

    await expect(staleActivation).rejects.toMatchObject({ name: 'AbortError' })
    expect(writeActive).toHaveBeenCalledTimes(1)
    expect(store.active).toEqual(current.persisted)
    expect(session.read(current.document.source)?.regions[0].displayName).toBe('当前展示名')
    await expect(source.load()).resolves.toMatchObject({
      document: { source: { displayName: '当前地图.geojson' } }
    })
  })

  it('同一几何的业务更新只替换页面内存会话，不重写 geometry-only 记录', async () => {
    const store = new MemoryMapPackageStore()
    const session = createMemoryMapVisualizationSession()
    const source = createActiveMapSource({ store, session, loadBuiltin: async () => builtinDocument() })
    const current = prepared('区域 A')
    await source.activate(current)
    expect(store.writeCount).toBe(1)

    const visualization = visualizationFor('区域 A', '创新一区')
    const document = source.updateVisualization(current, visualization)

    expect(document.metrics.get('区域 A')?.displayName).toBe('创新一区')
    expect(session.read(current.document.source)?.regions[0].primary).toBe(88)
    expect(store.writeCount).toBe(1)
    expect(store.active).toEqual(current.persisted)
    expect(() => source.updateVisualization(prepared('其他区域'), visualization))
      .toThrow('当前激活地图')
    expect(store.writeCount).toBe(1)
  })

  it('空存储加载内置地图，激活后由新实例恢复最后成功的自定义地图', async () => {
    const store = new MemoryMapPackageStore()
    const loadBuiltin = vi.fn(async () => builtinDocument())
    const session = createMemoryMapVisualizationSession()
    const firstSource = createActiveMapSource({ store, session, loadBuiltin })

    await expect(firstSource.load()).resolves.toMatchObject({
      document: { source: { kind: 'builtin' } },
      warnings: []
    })
    await expect(firstSource.activate(
      prepared('区域 A'),
      visualizationFor('区域 A', '创业园 Alpha')
    )).resolves.toMatchObject({
      source: { kind: 'geojson', displayName: '区域 A.geojson' },
      metricLabels: { primary: { label: '企业数', unit: '家' } }
    })
    expect(store.active).toEqual({
      version: 2,
      geometryText: geometryText('区域 A'),
      geometryFileName: '区域 A.geojson',
      nameProperty: 'name'
    })

    const samePageSource = createActiveMapSource({ store, session, loadBuiltin })
    const samePage = await samePageSource.load()
    expect(samePage.document.metrics.get('区域 A')).toMatchObject({
      displayName: '创业园 Alpha',
      primary: 88,
      secondary: 12
    })

    const refreshedSource = createActiveMapSource({
      store,
      session: createMemoryMapVisualizationSession(),
      loadBuiltin
    })
    const refreshed = await refreshedSource.load()
    expect(refreshed.document.geometry.regions.map((region) => region.name)).toEqual(['区域 A'])
    expect(refreshed.document.metrics.size).toBe(0)
    expect(refreshed.document.metricLabels).toBeNull()
    expect(refreshed.custom?.visualization.regions[0]).toMatchObject({
      regionKey: '区域 A',
      displayName: '区域 A',
      enabled: false,
      primary: null,
      secondary: null
    })
    expect(refreshed.warnings).toEqual([])
    expect(loadBuiltin).toHaveBeenCalledTimes(1)
  })

  it('写入失败或后续读取异常时保留当前有效地图，新实例才回退内置地图', async () => {
    const store = new MemoryMapPackageStore()
    const loadBuiltin = vi.fn(async () => builtinDocument())
    const session = createMemoryMapVisualizationSession()
    const source = createActiveMapSource({ store, session, loadBuiltin })
    await source.activate(prepared('旧地图'), visualizationFor('旧地图', '旧展示名'))

    store.failWrite = true
    await expect(source.activate(prepared('新地图'))).rejects.toThrow('write failed')
    store.failWrite = false
    await expect(source.load()).resolves.toMatchObject({
      document: { source: { displayName: '旧地图.geojson' } },
      warnings: []
    })
    expect((await source.load()).document.metrics.get('旧地图')?.displayName).toBe('旧展示名')

    store.active = { version: 99 }
    await expect(source.load()).resolves.toMatchObject({
      document: { source: { displayName: '旧地图.geojson' } },
      custom: { visualization: { regions: [expect.objectContaining({ displayName: '旧展示名' })] } },
      warnings: [{ code: 'unsupported-record', message: expect.any(String) }]
    })

    const refreshedSource = createActiveMapSource({
      store,
      session: createMemoryMapVisualizationSession(),
      loadBuiltin
    })
    await expect(refreshedSource.load()).resolves.toMatchObject({
      document: { source: { kind: 'builtin' } },
      warnings: [{ code: 'unsupported-record', message: expect.any(String) }]
    })

    store.failRead = true
    await expect(source.load()).resolves.toMatchObject({
      document: { source: { displayName: '旧地图.geojson' } },
      custom: { visualization: { regions: [expect.objectContaining({ displayName: '旧展示名' })] } },
      warnings: [{ code: 'storage-read-failed', message: expect.stringContaining('read failed') }]
    })
  })

  it('恢复内置地图删除 active record，后续刷新仍加载内置地图', async () => {
    const store = new MemoryMapPackageStore()
    const loadBuiltin = vi.fn(async () => builtinDocument())
    const session = createMemoryMapVisualizationSession()
    const source = createActiveMapSource({ store, session, loadBuiltin })
    const draft = visualizationFor('自定义', '临时展示名')
    await source.activate(prepared('自定义'), draft)

    await expect(source.resetToBuiltin()).resolves.toMatchObject({ source: { kind: 'builtin' } })
    expect(store.active).toBeNull()
    expect(session.read(prepared('自定义').document.source)).toBeNull()
    await expect(source.load()).resolves.toMatchObject({
      document: { source: { kind: 'builtin' } },
      warnings: []
    })
  })

  it('加载内置地图失败时 reset 不删除当前几何或会话', async () => {
    const store = new MemoryMapPackageStore()
    const session = createMemoryMapVisualizationSession()
    const loadBuiltin = vi.fn(async () => builtinDocument())
    const source = createActiveMapSource({ store, session, loadBuiltin })
    const current = prepared('当前区域')
    const draft = visualizationFor('当前区域', '当前展示名')
    await source.activate(current, draft)
    loadBuiltin.mockRejectedValueOnce(new Error('builtin failed'))

    await expect(source.resetToBuiltin()).rejects.toThrow('builtin failed')
    expect(store.active).toEqual(current.persisted)
    expect(session.read(current.document.source)?.regions[0].displayName).toBe('当前展示名')
  })

  it('忽略 V1 持久化业务数据并把旧记录迁移为 geometry-only', async () => {
    const store = new MemoryMapPackageStore()
    store.active = {
      version: 1,
      geometryText: geometryText('旧区域'),
      geometryFileName: 'legacy.geojson',
      nameProperty: 'name',
      metricsText: JSON.stringify({
        version: 1,
        primaryMetric: { label: '旧指标', unit: '家' },
        secondaryMetric: { label: '旧资源', unit: '项' },
        regions: [{ name: '旧区域', primary: 999, secondary: 888 }]
      })
    }
    const source = createActiveMapSource({
      store,
      session: createMemoryMapVisualizationSession(),
      loadBuiltin: async () => builtinDocument()
    })

    const loaded = await source.load()

    expect(loaded.document.geometry.regions.map((region) => region.name)).toEqual(['旧区域'])
    expect(loaded.document.metrics.size).toBe(0)
    expect(loaded.document.metricLabels).toBeNull()
    expect(store.active).toEqual({
      version: 2,
      geometryText: geometryText('旧区域'),
      geometryFileName: 'legacy.geojson',
      nameProperty: 'name'
    })
    expect(loaded.warnings).toEqual([])
  })

  it('legacy rewrite 失败时仍只返回几何和诊断，不复活旧业务数据', async () => {
    const store = new MemoryMapPackageStore()
    store.active = {
      version: 1,
      geometryText: geometryText('旧区域'),
      geometryFileName: 'legacy.geojson',
      nameProperty: 'name',
      metricsText: '{}'
    }
    store.failWrite = true
    const source = createActiveMapSource({
      store,
      session: createMemoryMapVisualizationSession(),
      loadBuiltin: async () => builtinDocument()
    })

    const loaded = await source.load()

    expect(loaded.document.source.kind).toBe('geojson')
    expect(loaded.document.metrics.size).toBe(0)
    expect(loaded.warnings).toEqual([{
      code: 'legacy-migration-failed',
      message: expect.stringContaining('write failed')
    }])
  })
})
