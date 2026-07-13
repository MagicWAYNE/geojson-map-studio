import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import type { DistrictMapItem } from '@/types'
import type { Region } from './mapGeometry'
import { MAP_DISTRICT_BAR_DEFAULTS } from './mapDistrictBarConfig'
import {
  applyDistrictBarConfig,
  createDistrictBarLayer,
  disposeDistrictBarLayer,
  mapDistrictBarHeight,
  setDistrictBarHoverProgress,
  updateDistrictBarLayer
} from './mapDistrictBarLayer'

const threeFaults = vi.hoisted(() => ({
  failRingGeometryAt: null as number | null,
  ringGeometryCalls: 0,
  cylinderGeometries: [] as THREE.CylinderGeometry[],
  columnMaterials: [] as THREE.MeshStandardMaterial[],
  disposalCounts: new Map<object, number>()
}))

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>()

  class CylinderGeometry extends actual.CylinderGeometry {
    constructor(...args: any[]) {
      super(...args)
      threeFaults.cylinderGeometries.push(this)
    }

    dispose(): void {
      threeFaults.disposalCounts.set(this, (threeFaults.disposalCounts.get(this) ?? 0) + 1)
      super.dispose()
    }
  }

  class MeshStandardMaterial extends actual.MeshStandardMaterial {
    constructor(...args: any[]) {
      super(...args)
      threeFaults.columnMaterials.push(this)
    }

    dispose(): void {
      threeFaults.disposalCounts.set(this, (threeFaults.disposalCounts.get(this) ?? 0) + 1)
      super.dispose()
    }
  }

  class RingGeometry extends actual.RingGeometry {
    constructor(...args: any[]) {
      threeFaults.ringGeometryCalls += 1
      if (threeFaults.failRingGeometryAt === threeFaults.ringGeometryCalls) {
        throw new Error('injected ring construction failure')
      }
      super(...args)
    }
  }

  return { ...actual, CylinderGeometry, MeshStandardMaterial, RingGeometry }
})

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
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const layer = createDistrictBarLayer(regions, new Map([
      ['A', { name: 'A', aj: 100, ztje: 0, zzs: 0 }],
      ['B', { name: 'B', aj: Number.NaN, ztje: 0, zzs: 0 }]
    ]), MAP_DISTRICT_BAR_DEFAULTS, 4)

    expect(layer.group.children).toHaveLength(2)
    expect(layer.byName.has('A')).toBe(true)
    expect(layer.byName.has('B')).toBe(false)
    expect(layer.range).toEqual({ min: 100, max: 100 })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('无效或缺失 aj'))
    warn.mockRestore()
  })

  it('初始禁用时保留隐藏资源，并可在不重建或重置动画的情况下启用', () => {
    const disabledConfig = {
      ...MAP_DISTRICT_BAR_DEFAULTS,
      enabled: false,
      enterMs: 100
    }
    const layer = createDistrictBarLayer(regions, items([['A', 100]]), disabledConfig, 4)

    expect(layer.group.children).toHaveLength(2)
    expect(layer.byName).toHaveLength(1)
    expect(layer.range).toEqual({ min: 100, max: 100 })

    const visual = layer.byName.get('A')!
    const group = layer.group
    const column = visual.column
    const ring = visual.ring
    const columnGeometry = column.geometry
    const columnMaterial = column.material
    const ringGeometry = ring.geometry
    const ringMaterial = ring.material

    expect(group.visible).toBe(false)
    expect(column.visible).toBe(false)
    expect(ring.visible).toBe(false)

    updateDistrictBarLayer(layer, disabledConfig, 50)
    const animatedHeight = column.scale.y
    applyDistrictBarConfig(layer, { ...disabledConfig, enabled: true })

    expect(group.visible).toBe(true)
    expect(column.visible).toBe(true)
    expect(ring.visible).toBe(true)
    expect(column.scale.y).toBe(animatedHeight)
    expect(visual.column).toBe(column)
    expect(visual.ring).toBe(ring)
    expect(column.geometry).toBe(columnGeometry)
    expect(column.material).toBe(columnMaterial)
    expect(ring.geometry).toBe(ringGeometry)
    expect(ring.material).toBe(ringMaterial)
  })

  it('隔离后续区县构造失败，释放局部资源并保留其余有效柱体', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    threeFaults.ringGeometryCalls = 0
    threeFaults.cylinderGeometries = []
    threeFaults.columnMaterials = []
    threeFaults.disposalCounts.clear()
    threeFaults.failRingGeometryAt = 2
    const config = { ...MAP_DISTRICT_BAR_DEFAULTS, enterMs: 0 }
    const laterRegions: Region[] = [
      ...regions,
      { name: 'C', outers: [{ ring: [[10, 0], [14, 0], [14, 4], [10, 4]], holes: [] }] }
    ]

    const layer = createDistrictBarLayer(
      laterRegions,
      items([['A', 100], ['B', 50], ['C', 25]]),
      config,
      4
    )
    updateDistrictBarLayer(layer, config, 1_000)

    expect(layer.byName.has('A')).toBe(true)
    expect(layer.byName.has('B')).toBe(false)
    expect(layer.byName.has('C')).toBe(true)
    expect(layer.group.children).toHaveLength(4)
    expect(layer.byName.get('C')!.column.visible).toBe(true)
    expect(threeFaults.disposalCounts.get(threeFaults.cylinderGeometries[1])).toBe(1)
    expect(threeFaults.disposalCounts.get(threeFaults.columnMaterials[1])).toBe(1)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('B（资源构造失败：injected ring construction failure）'),
      expect.objectContaining({ message: 'injected ring construction failure' })
    )
    warn.mockRestore()
  })

  it('对无效或缺失 aj 发出一次包含区县和原因的诊断，并继续渲染其他区县', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const invalidRegions: Region[] = [
      regions[0],
      { name: 'InvalidAJ', outers: regions[1].outers },
      { name: 'MissingAJ', outers: regions[0].outers }
    ]
    const data = items([['A', 100], ['InvalidAJ', Number.NaN]])

    const first = createDistrictBarLayer(invalidRegions, data, MAP_DISTRICT_BAR_DEFAULTS, 4)
    const second = createDistrictBarLayer(invalidRegions, data, MAP_DISTRICT_BAR_DEFAULTS, 4)

    expect(first.byName.has('A')).toBe(true)
    expect(second.byName.has('A')).toBe(true)
    expect(warn).toHaveBeenCalledTimes(2)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('InvalidAJ（无效或缺失 aj）'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('MissingAJ（无效或缺失 aj）'))
    warn.mockRestore()
  })

  it('对缺少安全锚点发出一次包含区县和原因的诊断，并继续渲染其他区县', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const anchorless: Region = { name: 'NoAnchor', outers: [] }
    const invalidRegions: Region[] = [...regions, anchorless]
    const data = items([['A', 100], ['B', 50], ['NoAnchor', 25]])

    const first = createDistrictBarLayer(invalidRegions, data, MAP_DISTRICT_BAR_DEFAULTS, 4)
    const second = createDistrictBarLayer(invalidRegions, data, MAP_DISTRICT_BAR_DEFAULTS, 4)

    expect(first.byName.has('A')).toBe(true)
    expect(first.byName.has('NoAnchor')).toBe(false)
    expect(second.byName.has('B')).toBe(true)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('NoAnchor（缺少安全锚点）'))
    warn.mockRestore()
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

  it('应用高度映射配置时保留资源并重新计算可见柱体高度', () => {
    const config = { ...MAP_DISTRICT_BAR_DEFAULTS, enterMs: 0 }
    const layer = createDistrictBarLayer(regions, items([['A', 25], ['B', 100]]), config, 4)
    updateDistrictBarLayer(layer, config, 0)
    const visual = layer.byName.get('A')!
    const geometry = visual.column.geometry
    const material = visual.column.material
    const previousHeight = visual.column.scale.y
    const previousZ = visual.column.position.z

    applyDistrictBarConfig(layer, {
      ...config,
      minHeight: 2,
      maxHeight: 42,
      sqrtExponent: 1
    })

    expect(visual.baseHeight).toBe(12)
    expect(visual.column.scale.y).toBe(12)
    expect(visual.column.position.z).toBeCloseTo(10.08)
    expect(visual.column.scale.y).not.toBe(previousHeight)
    expect(visual.column.position.z).not.toBe(previousZ)
    expect(visual.column.geometry).toBe(geometry)
    expect(visual.column.material).toBe(material)
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
