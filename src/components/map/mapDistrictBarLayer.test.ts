import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import type { MapRegionMetrics } from './mapDocument'
import type { Region } from './mapGeometry'
import { MAP_DISTRICT_BAR_DEFAULTS } from './mapDistrictBarConfig'
import {
  applyDistrictBarConfig,
  createDistrictBarLayer,
  disposeDistrictBarLayer,
  getDistrictBarTopSnapshots,
  mapDistrictBarHeight,
  setDistrictBarHoverProgress,
  setDistrictBarFocus,
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

function items(entries: [string, number, number?][]): ReadonlyMap<string, MapRegionMetrics> {
  return new Map(entries.map(([name, primary, secondary = 0]) => [
    name,
    { name, primary, secondary }
  ]))
}

describe('mapDistrictBarLayer', () => {
  it('通过通用 primary 指标创建柱体并公开 primary/secondary 快照', () => {
    const metrics: ReadonlyMap<string, MapRegionMetrics> = new Map([
      ['A', { name: 'A', primary: 25, secondary: 120.5 }]
    ])
    const layer = createDistrictBarLayer(
      [regions[0]],
      metrics,
      { ...MAP_DISTRICT_BAR_DEFAULTS, enterMs: 0 },
      4
    )
    updateDistrictBarLayer(layer, MAP_DISTRICT_BAR_DEFAULTS, 1_000)

    expect(getDistrictBarTopSnapshots(layer).map((snapshot) => ({
      name: snapshot.name,
      primary: snapshot.primary,
      secondary: snapshot.secondary
    }))).toEqual([{ name: 'A', primary: 25, secondary: 120.5 }])
  })

  it('按平方根范围映射案件量高度', () => {
    expect(mapDistrictBarHeight(0, 3, 20, 0.5, 100)).toBe(3)
    expect(mapDistrictBarHeight(25, 3, 20, 0.5, 100)).toBeCloseTo(11.5)
    expect(mapDistrictBarHeight(100, 3, 20, 0.5, 100)).toBe(20)
  })

  it('按 order 公开区县柱顶业务快照', () => {
    const config = { ...MAP_DISTRICT_BAR_DEFAULTS, enterMs: 0 }
    const layer = createDistrictBarLayer(
      [regions[1], regions[0]],
      items([['A', 25, 120.5], ['B', 100, 980.25]]),
      config,
      4
    )
    updateDistrictBarLayer(layer, config, 0)
    const firstVisual = layer.byName.get('B')!
    layer.byName.delete('B')
    layer.byName.set('B', firstVisual)

    expect(getDistrictBarTopSnapshots(layer).map((snapshot) => ({
      name: snapshot.name,
      primary: snapshot.primary,
      secondary: snapshot.secondary,
      order: snapshot.order
    }))).toEqual([
      { name: 'B', primary: 100, secondary: 980.25, order: 0 },
      { name: 'A', primary: 25, secondary: 120.5, order: 1 }
    ])
  })

  it('返回包含入场缩放、hover 抬升和父级变换的世界柱顶坐标', () => {
    const config = {
      ...MAP_DISTRICT_BAR_DEFAULTS,
      minHeight: 4,
      maxHeight: 4,
      enterMs: 1_000,
      staggerMs: 0,
      hoverLift: 3,
      baseOffset: -0.08
    }
    const layer = createDistrictBarLayer([regions[0]], items([['A', 100, 200]]), config, 0)
    const mapGroup = new THREE.Group()
    mapGroup.position.set(10, 20, 30)
    mapGroup.rotation.z = Math.PI / 2
    mapGroup.add(layer.group)

    setDistrictBarHoverProgress(layer, 'A', 0.5)
    updateDistrictBarLayer(layer, config, 500)

    const [snapshot] = getDistrictBarTopSnapshots(layer)
    expect(snapshot.worldPosition[0]).toBeCloseTo(8)
    expect(snapshot.worldPosition[1]).toBeCloseTo(22)
    expect(snapshot.worldPosition[2]).toBeCloseTo(33.5)
  })

  it('按 scene graph 当前状态公开柱体可见性', () => {
    const config = { ...MAP_DISTRICT_BAR_DEFAULTS, enterMs: 100, staggerMs: 0 }
    const layer = createDistrictBarLayer([regions[0]], items([['A', 100]]), config, 0)
    const mapGroup = new THREE.Group()
    mapGroup.add(layer.group)

    updateDistrictBarLayer(layer, config, 0)
    expect(getDistrictBarTopSnapshots(layer)[0].visible).toBe(false)

    updateDistrictBarLayer(layer, config, 100)
    expect(getDistrictBarTopSnapshots(layer)[0].visible).toBe(true)

    applyDistrictBarConfig(layer, { ...config, enabled: false })
    expect(getDistrictBarTopSnapshots(layer)[0].visible).toBe(false)

    applyDistrictBarConfig(layer, { ...config, width: 0 })
    expect(getDistrictBarTopSnapshots(layer)[0].visible).toBe(false)

    applyDistrictBarConfig(layer, config)
    mapGroup.visible = false
    expect(getDistrictBarTopSnapshots(layer)[0].visible).toBe(false)

    mapGroup.visible = true
    expect(getDistrictBarTopSnapshots(layer)[0].visible).toBe(true)
  })

  it('连续读取返回独立的普通快照对象和位置 tuple', () => {
    const config = { ...MAP_DISTRICT_BAR_DEFAULTS, enterMs: 0 }
    const layer = createDistrictBarLayer([regions[0]], items([['A', 100, 200]]), config, 0)
    updateDistrictBarLayer(layer, config, 0)

    const [first] = getDistrictBarTopSnapshots(layer)
    const [second] = getDistrictBarTopSnapshots(layer)

    expect(Object.getPrototypeOf(first)).toBe(Object.prototype)
    expect(Array.isArray(first.worldPosition)).toBe(true)
    expect(first.worldPosition).not.toBeInstanceOf(THREE.Vector3)
    expect(first).not.toBe(second)
    expect(first.worldPosition).not.toBe(second.worldPosition)
    expect(first).toEqual(second)
  })

  it('将公开快照的 hoverProgress 限制在 0 到 1', () => {
    const config = { ...MAP_DISTRICT_BAR_DEFAULTS, enterMs: 0 }
    const layer = createDistrictBarLayer([regions[0]], items([['A', 100]]), config, 0)
    const visual = layer.byName.get('A')!

    visual.hoverProgress = 2
    expect(getDistrictBarTopSnapshots(layer)[0].hoverProgress).toBe(1)

    visual.hoverProgress = -2
    expect(getDistrictBarTopSnapshots(layer)[0].hoverProgress).toBe(0)
  })

  it('释放后返回空的柱顶快照列表', () => {
    const layer = createDistrictBarLayer(
      [regions[0]],
      items([['A', 100]]),
      MAP_DISTRICT_BAR_DEFAULTS,
      0
    )

    disposeDistrictBarLayer(layer)

    expect(getDistrictBarTopSnapshots(layer)).toEqual([])
  })

  it('只为有有效案件量且存在锚点的区块创建柱体与光环', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const layer = createDistrictBarLayer(regions, new Map([
      ['A', { name: 'A', primary: 100, secondary: 0 }],
      ['B', { name: 'B', primary: Number.NaN, secondary: 0 }]
    ]), MAP_DISTRICT_BAR_DEFAULTS, 4)

    expect(layer.group.children).toHaveLength(3)
    expect(layer.byName.has('A')).toBe(true)
    expect(layer.byName.has('B')).toBe(false)
    expect(layer.range).toEqual({ min: 100, max: 100 })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('无效 primary'))
    warn.mockRestore()
  })

  it('初始禁用时保留隐藏资源，并可在不重建或重置动画的情况下启用', () => {
    const disabledConfig = {
      ...MAP_DISTRICT_BAR_DEFAULTS,
      enabled: false,
      enterMs: 100
    }
    const layer = createDistrictBarLayer(regions, items([['A', 100]]), disabledConfig, 4)

    expect(layer.group.children).toHaveLength(3)
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
    threeFaults.failRingGeometryAt = 3
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
    expect(layer.group.children).toHaveLength(6)
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

  it('只对非法 primary 发出一次诊断，缺失数据作为正常状态静默跳过', () => {
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
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('InvalidAJ（无效 primary）'))
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('MissingAJ'))
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

    setDistrictBarHoverProgress(layer, 'A', 1, 2)
    updateDistrictBarLayer(layer, config, 0)

    expect(a.column.position.z).toBeCloseTo(aZ + config.hoverLift)
    expect(a.ring.position.z).toBeCloseTo(4.09 + 2)
    expect(a.pulseRing.position.z).toBeCloseTo(4.095 + 2)
    expect(a.column.material.emissiveIntensity).toBe(config.hoverEmissiveIntensity)
    expect(b.column.position.z).toBe(bZ)
    expect(b.column.material.emissiveIntensity).toBe(bIntensity)
  })

  it('hover 激活时仅降低其他区块柱体与光环的整体透明度，并支持实时调节与恢复', () => {
    const config = {
      ...MAP_DISTRICT_BAR_DEFAULTS,
      enterMs: 0,
      staggerMs: 0,
      pulseStaggerMs: 0
    }
    const layer = createDistrictBarLayer(regions, items([['A', 100], ['B', 25]]), config, 4)
    updateDistrictBarLayer(layer, config, 0)
    const a = layer.byName.get('A')!
    const b = layer.byName.get('B')!

    setDistrictBarFocus(layer, 'A')
    updateDistrictBarLayer(layer, config, 0)

    expect(a.column.material.opacity).toBe(1)
    expect(a.column.material.transparent).toBe(false)
    expect(a.ring.material.opacity).toBeCloseTo(config.baseRingOpacity)
    expect(b.column.material.opacity).toBe(0.5)
    expect(b.column.material.transparent).toBe(true)
    expect(b.column.material.depthWrite).toBe(false)
    expect(b.ring.material.opacity).toBeCloseTo(config.baseRingOpacity * 0.5)
    expect(b.pulseRing.material.opacity).toBeCloseTo(config.pulseOuterOpacity * 0.5)

    const tuned = { ...config, hoverInactiveOpacity: 0.25 }
    applyDistrictBarConfig(layer, tuned)
    expect(b.column.material.opacity).toBe(0.25)
    expect(b.ring.material.opacity).toBeCloseTo(config.baseRingOpacity * 0.25)

    setDistrictBarFocus(layer, null)
    updateDistrictBarLayer(layer, tuned, 0)
    expect(b.column.material.opacity).toBe(1)
    expect(b.column.material.transparent).toBe(false)
    expect(b.column.material.depthWrite).toBe(true)
    expect(b.ring.material.opacity).toBeCloseTo(config.baseRingOpacity)
  })

  it('保留稳定底环，并让窄脉冲环由外向内收缩且逐步增强', () => {
    const config = {
      ...MAP_DISTRICT_BAR_DEFAULTS,
      enterMs: 0,
      pulseDurationMs: 1000,
      pulseStaggerMs: 0
    }
    const layer = createDistrictBarLayer(regions, items([['A', 100]]), config, 4)
    const visual = layer.byName.get('A')!

    updateDistrictBarLayer(layer, config, 0)
    expect(visual.ring.material.opacity).toBeCloseTo(config.baseRingOpacity)
    expect(visual.pulseRing.scale.x).toBeCloseTo(config.baseRingRadius * config.pulseOuterRadiusRatio)
    expect(visual.pulseRing.material.opacity).toBeCloseTo(config.pulseOuterOpacity)

    updateDistrictBarLayer(layer, config, 500)
    expect(visual.ring.material.opacity).toBeCloseTo(config.baseRingOpacity)
    expect(visual.pulseRing.scale.x).toBeCloseTo(
      config.baseRingRadius * (config.pulseOuterRadiusRatio + config.pulseInnerRadiusRatio) / 2
    )
    expect(visual.pulseRing.material.opacity).toBeCloseTo(
      (config.pulseOuterOpacity + config.pulseInnerOpacity) / 2
    )

    updateDistrictBarLayer(layer, config, 1_000)
    expect(visual.pulseRing.scale.x).toBeCloseTo(config.baseRingRadius * config.pulseOuterRadiusRatio)
    expect(visual.pulseRing.material.opacity).toBeCloseTo(config.pulseOuterOpacity)
  })

  it('强制柱体主体不透明，并让统一宽度与吸附偏移同步作用于柱体和光环', () => {
    const config = {
      ...MAP_DISTRICT_BAR_DEFAULTS,
      opacity: 0.1,
      width: 3.6,
      anchorOffsetX: 1.2,
      anchorOffsetY: -0.7,
      baseOffset: 0.4,
      enterMs: 0
    }
    const layer = createDistrictBarLayer(regions, items([['A', 100], ['B', 25]]), config, 4)
    updateDistrictBarLayer(layer, config, 0)
    const a = layer.byName.get('A')!
    const b = layer.byName.get('B')!

    for (const visual of [a, b]) {
      expect(visual.column.material.opacity).toBe(1)
      expect(visual.column.material.transparent).toBe(false)
      expect(visual.column.material.depthWrite).toBe(true)
      expect(visual.column.scale.x).toBeCloseTo(1.8)
      expect(visual.column.scale.z).toBeCloseTo(1.8)
      expect(visual.column.position.x).toBeCloseTo(visual.anchor[0] + 1.2)
      expect(visual.column.position.y).toBeCloseTo(visual.anchor[1] - 0.7)
      expect(visual.ring.position.x).toBeCloseTo(visual.anchor[0] + 1.2)
      expect(visual.ring.position.y).toBeCloseTo(visual.anchor[1] - 0.7)
      expect(visual.ring.position.z).toBeCloseTo(4.49)
      expect(visual.pulseRing.position.x).toBeCloseTo(visual.anchor[0] + 1.2)
      expect(visual.pulseRing.position.y).toBeCloseTo(visual.anchor[1] - 0.7)
    }
    expect(a.column.scale.y).not.toBe(b.column.scale.y)
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
      visual.ring.material,
      visual.pulseRing.geometry,
      visual.pulseRing.material
    ]
    const disposals = resources.map((resource) => vi.spyOn(resource, 'dispose'))

    disposeDistrictBarLayer(layer)
    disposeDistrictBarLayer(layer)

    for (const dispose of disposals) expect(dispose).toHaveBeenCalledTimes(1)
  })
})
