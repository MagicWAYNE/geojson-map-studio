// @vitest-environment happy-dom
import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { createIndexedDbMapPackageStore } from './indexedDbMapPackageStore'
import type { PersistedMapPackage } from './mapDocument'

const firstPackage: PersistedMapPackage = {
  version: 2,
  geometryText: '{"type":"FeatureCollection","features":[]}',
  geometryFileName: 'first.geojson',
  nameProperty: 'name'
}

describe('indexedDbMapPackageStore', () => {
  it('跨 store 实例持久化 active record，并让失败写入保留旧记录', async () => {
    const databaseName = `cqbigscreen-map-source-test-${Date.now()}`
    const firstStore = createIndexedDbMapPackageStore({ databaseName })

    await expect(firstStore.readActive()).resolves.toBeNull()
    await firstStore.writeActive(firstPackage)

    const refreshedStore = createIndexedDbMapPackageStore({ databaseName })
    await expect(refreshedStore.readActive()).resolves.toEqual(firstPackage)

    await expect(refreshedStore.writeActive({
      ...firstPackage,
      geometryText: (() => undefined) as unknown as string
    })).rejects.toThrow()
    await expect(firstStore.readActive()).resolves.toEqual(firstPackage)

    await refreshedStore.deleteActive()
    await expect(firstStore.readActive()).resolves.toBeNull()
  })
})
