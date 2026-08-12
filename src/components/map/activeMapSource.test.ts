import { describe, expect, it, vi } from 'vitest'
import {
  createActiveMapSource,
  type MapPackageStore
} from './activeMapSource'
import {
  prepareGeoJsonMapPackage,
  type MapDocument,
  type PersistedMapPackage
} from './mapDocument'

class MemoryMapPackageStore implements MapPackageStore {
  active: unknown = null
  failRead = false
  failWrite = false

  async readActive(): Promise<unknown> {
    if (this.failRead) throw new Error('read failed')
    return this.active
  }

  async writeActive(value: PersistedMapPackage): Promise<void> {
    if (this.failWrite) throw new Error('write failed')
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

describe('activeMapSource', () => {
  it('空存储加载内置地图，激活后由新实例恢复最后成功的自定义地图', async () => {
    const store = new MemoryMapPackageStore()
    const loadBuiltin = vi.fn(async () => builtinDocument())
    const firstSource = createActiveMapSource({ store, loadBuiltin })

    await expect(firstSource.load()).resolves.toMatchObject({
      document: { source: { kind: 'builtin' } },
      warnings: []
    })
    await expect(firstSource.activate(prepared('区域 A'))).resolves.toMatchObject({
      source: { kind: 'geojson', displayName: '区域 A.geojson' }
    })

    const refreshedSource = createActiveMapSource({ store, loadBuiltin })
    const restored = await refreshedSource.load()
    expect(restored.document.geometry.regions.map((region) => region.name)).toEqual(['区域 A'])
    expect(restored.warnings).toEqual([])
    expect(loadBuiltin).toHaveBeenCalledTimes(1)
  })

  it('写入失败保留旧 active record，损坏记录和读取失败都回退内置地图并给出 warning', async () => {
    const store = new MemoryMapPackageStore()
    const loadBuiltin = vi.fn(async () => builtinDocument())
    const source = createActiveMapSource({ store, loadBuiltin })
    await source.activate(prepared('旧地图'))

    store.failWrite = true
    await expect(source.activate(prepared('新地图'))).rejects.toThrow('write failed')
    store.failWrite = false
    await expect(source.load()).resolves.toMatchObject({
      document: { source: { displayName: '旧地图.geojson' } },
      warnings: []
    })

    store.active = { version: 99 }
    await expect(source.load()).resolves.toMatchObject({
      document: { source: { kind: 'builtin' } },
      warnings: [{ code: 'unsupported-record', message: expect.any(String) }]
    })

    store.failRead = true
    await expect(source.load()).resolves.toMatchObject({
      document: { source: { kind: 'builtin' } },
      warnings: [{ code: 'storage-read-failed', message: expect.stringContaining('read failed') }]
    })
  })

  it('恢复内置地图删除 active record，后续刷新仍加载内置地图', async () => {
    const store = new MemoryMapPackageStore()
    const loadBuiltin = vi.fn(async () => builtinDocument())
    const source = createActiveMapSource({ store, loadBuiltin })
    await source.activate(prepared('自定义'))

    await expect(source.resetToBuiltin()).resolves.toMatchObject({ source: { kind: 'builtin' } })
    expect(store.active).toBeNull()
    await expect(source.load()).resolves.toMatchObject({
      document: { source: { kind: 'builtin' } },
      warnings: []
    })
  })
})
