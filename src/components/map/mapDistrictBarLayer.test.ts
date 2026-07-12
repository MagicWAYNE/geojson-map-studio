import { describe, expect, it, vi } from 'vitest'
import type { DistrictMapItem } from '@/types'
import type { Region } from './mapGeometry'
import { MAP_DISTRICT_BAR_DEFAULTS } from './mapDistrictBarConfig'
import {
  createDistrictBarLayer,
  disposeDistrictBarLayer,
  mapDistrictBarHeight,
  setDistrictBarHoverProgress,
  updateDistrictBarLayer
} from './mapDistrictBarLayer'

const regions: Region[] = [
  { name: 'A', outers: [{ ring: [[0, 0], [4, 0], [4, 4], [0, 4]], holes: [] }] },
  { name: 'B', outers: [{ ring: [[5, 0], [9, 0], [9, 4], [5, 4]], holes: [] }] }
]

function items(entries: [string, number][]): ReadonlyMap<string, DistrictMapItem> {
  return new Map(entries.map(([name, aj]) => [name, { name, aj, ztje: 0, zzs: 0 }]))
}

describe('mapDistrictBarLayer', () => {
  it('按平方根范围映射案件量高度', () => {
    expect(mapDistrictBarHeight(0, 3, 20, 0.5, 100)).toBe(3)
    expect(mapDistrictBarHeight(25, 3, 20, 0.5, 100)).toBeCloseTo(11.5)
    expect(mapDistrictBarHeight(100, 3, 20, 0.5, 100)).toBe(20)
  })

  it('只为有有效案件量且存在锚点的区块创建柱体与光环', () => {
    const layer = createDistrictBarLayer(regions, new Map([
      ['A', { name: 'A', aj: 100, ztje: 0, zzs: 0 }],
      ['B', { name: 'B', aj: Number.NaN, ztje: 0, zzs: 0 }]
    ]), MAP_DISTRICT_BAR_DEFAULTS, 4)

    expect(layer.group.children).toHaveLength(2)
    expect(layer.byName.has('A')).toBe(true)
    expect(layer.byName.has('B')).toBe(false)
    expect(layer.range).toEqual({ min: 100, max: 100 })
  })

  it('禁用时保持空组，更新也不分配子对象', () => {
    const layer = createDistrictBarLayer(regions, items([['A', 100]]), {
      ...MAP_DISTRICT_BAR_DEFAULTS,
      enabled: false
    }, 4)

    updateDistrictBarLayer(layer, MAP_DISTRICT_BAR_DEFAULTS, 1000)

    expect(layer.group.children).toHaveLength(0)
    expect(layer.byName).toHaveLength(0)
    expect(layer.range).toBeNull()
  })

  it('hover 进度只抬升并增强指定区块', () => {
    const config = { ...MAP_DISTRICT_BAR_DEFAULTS, enterMs: 0 }
    const layer = createDistrictBarLayer(regions, items([['A', 100], ['B', 25]]), config, 4)
    updateDistrictBarLayer(layer, config, 0)
    const a = layer.byName.get('A')!
    const b = layer.byName.get('B')!
    const aZ = a.column.position.z
    const bZ = b.column.position.z
    const bIntensity = b.column.material.emissiveIntensity

    setDistrictBarHoverProgress(layer, 'A', 1)
    updateDistrictBarLayer(layer, config, 0)

    expect(a.column.position.z).toBeCloseTo(aZ + config.hoverLift)
    expect(a.ring.position.z).toBeCloseTo(4.09 + config.hoverLift)
    expect(a.column.material.emissiveIntensity).toBe(config.hoverEmissiveIntensity)
    expect(b.column.position.z).toBe(bZ)
    expect(b.column.material.emissiveIntensity).toBe(bIntensity)
  })

  it('释放每个唯一几何体和材质一次，即使重复 teardown', () => {
    const layer = createDistrictBarLayer(regions, items([['A', 100]]), MAP_DISTRICT_BAR_DEFAULTS, 4)
    const visual = layer.byName.get('A')!
    const resources = [
      visual.column.geometry,
      visual.column.material,
      visual.ring.geometry,
      visual.ring.material
    ]
    const disposals = resources.map((resource) => vi.spyOn(resource, 'dispose'))

    disposeDistrictBarLayer(layer)
    disposeDistrictBarLayer(layer)

    for (const dispose of disposals) expect(dispose).toHaveBeenCalledTimes(1)
  })
})
