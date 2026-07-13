import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import type { DistrictMapItem } from '@/types'
import type { Region } from './mapGeometry'
import { MAP_DISTRICT_BAR_DEFAULTS } from './mapDistrictBarConfig'
import type { DistrictBarLabelAssets } from './mapDistrictBarLabelTexture'
import {
  attachDistrictBarLabels,
  applyDistrictBarConfig,
  createDistrictBarLayer,
  disposeDistrictBarLayer,
  mapDistrictBarHeight,
  setDistrictBarHoverProgress,
  updateDistrictBarLabelLayouts,
  updateDistrictBarLayer
} from './mapDistrictBarLayer'

const labelTextureMocks = vi.hoisted(() => ({
  create: vi.fn()
}))

vi.mock('./mapDistrictBarLabelTexture', async (importOriginal) => ({
  ...await importOriginal<typeof import('./mapDistrictBarLabelTexture')>(),
  createDistrictBarLabelTexture: labelTextureMocks.create
}))

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
  it('creates one pixel-constant right-side label per valid bar and animates hover independently', () => {
    labelTextureMocks.create.mockReset()
    labelTextureMocks.create.mockImplementation(() => new THREE.Texture())
    const assets: DistrictBarLabelAssets = {
      background: {} as CanvasImageSource,
      icon: {} as CanvasImageSource
    }
    const config = {
      ...MAP_DISTRICT_BAR_DEFAULTS,
      enterMs: 0,
      label: {
        ...MAP_DISTRICT_BAR_DEFAULTS.label,
        enterMs: 0,
        staggerMs: 0,
        hoverEnterMs: 180
      }
    }
    const layer = createDistrictBarLayer([regions[0]], items([['A', 100]]), config, 4, assets)
    const visual = layer.byName.get('A')!
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
    camera.position.set(2, 20, 20)
    camera.lookAt(2, 2, 4)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld(true)

    updateDistrictBarLayer(layer, config, 0)
    updateDistrictBarLabelLayouts(layer, config, camera, { width: 1000, height: 1000 })

    expect(visual.label).toBeInstanceOf(THREE.Sprite)
    expect(visual.label?.material.opacity).toBeCloseTo(0.9)
    expect(visual.labelScreenRect).toMatchObject({ width: 236, height: 36 })
    expect(visual.label?.center.x).toBeLessThan(0)

    setDistrictBarHoverProgress(layer, 'A', 1, 2, true)
    updateDistrictBarLayer(layer, config, 180)
    updateDistrictBarLabelLayouts(layer, config, camera, { width: 1000, height: 1000 })

    expect(visual.label?.material.opacity).toBe(1)
    expect(visual.label?.material.color.r).toBeCloseTo(config.label.hoverBrightness)
    expect(visual.labelScreenRect?.width).toBeCloseTo(254.88)
    expect(visual.label?.position.z).toBeCloseTo(4.08 + visual.baseHeight + config.hoverLift)

    const labelTexture = visual.label!.material.map!
    const textureDispose = vi.spyOn(labelTexture, 'dispose')
    const materialDispose = vi.spyOn(visual.label!.material, 'dispose')
    disposeDistrictBarLayer(layer)
    expect(textureDispose).toHaveBeenCalledTimes(1)
    expect(materialDispose).toHaveBeenCalledTimes(1)
  })

  it('attaches optional labels after the core bar layer already exists', () => {
    labelTextureMocks.create.mockReset()
    labelTextureMocks.create.mockImplementation(() => new THREE.Texture())
    const layer = createDistrictBarLayer(
      [regions[0]],
      items([['A', 100]]),
      MAP_DISTRICT_BAR_DEFAULTS,
      4
    )

    expect(layer.byName.get('A')?.label).toBeNull()
    expect(layer.group.children).toHaveLength(3)

    attachDistrictBarLabels(layer, MAP_DISTRICT_BAR_DEFAULTS, {
      background: {} as CanvasImageSource,
      icon: {} as CanvasImageSource
    })

    expect(layer.byName.get('A')?.label).toBeInstanceOf(THREE.Sprite)
    expect(layer.group.children).toHaveLength(4)
    disposeDistrictBarLayer(layer)
  })

  it('keeps the right-side gap when the map rotates the local x radius toward the camera', () => {
    labelTextureMocks.create.mockReset()
    labelTextureMocks.create.mockImplementation(() => new THREE.Texture())
    const config = {
      ...MAP_DISTRICT_BAR_DEFAULTS,
      enterMs: 0,
      label: { ...MAP_DISTRICT_BAR_DEFAULTS.label, enterMs: 0, staggerMs: 0 }
    }
    const layer = createDistrictBarLayer([regions[0]], items([['A', 100]]), config, 4, {
      background: {} as CanvasImageSource,
      icon: {} as CanvasImageSource
    })
    const parent = new THREE.Group()
    parent.rotation.x = -Math.PI / 2
    parent.add(layer.group)
    const visual = layer.byName.get('A')!
    updateDistrictBarLayer(layer, config, 1)
    parent.updateWorldMatrix(true, true)
    const worldPosition = visual.labelPosition.clone()
    layer.group.localToWorld(worldPosition)
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
    camera.position.copy(worldPosition).add(new THREE.Vector3(30, 10, 0))
    camera.lookAt(worldPosition)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld(true)

    updateDistrictBarLabelLayouts(layer, config, camera, { width: 1000, height: 1000 })

    const projected = worldPosition.clone().project(camera)
    const anchorX = (projected.x * 0.5 + 0.5) * 1000
    expect(visual.labelScreenRect!.left).toBeGreaterThan(anchorX + config.label.gapX + 5)
    disposeDistrictBarLayer(layer)
  })

  it('rebuilds only paint-affecting label changes, releases the old texture, and isolates failures', () => {
    labelTextureMocks.create.mockReset()
    const firstTexture = new THREE.Texture()
    const secondTexture = new THREE.Texture()
    labelTextureMocks.create.mockReturnValueOnce(firstTexture).mockReturnValueOnce(secondTexture)
    const assets: DistrictBarLabelAssets = {
      background: {} as CanvasImageSource,
      icon: {} as CanvasImageSource
    }
    const config = { ...MAP_DISTRICT_BAR_DEFAULTS, label: { ...MAP_DISTRICT_BAR_DEFAULTS.label } }
    const layer = createDistrictBarLayer([regions[0]], items([['A', 100]]), config, 4, assets)
    const visual = layer.byName.get('A')!
    const firstDispose = vi.spyOn(firstTexture, 'dispose')

    applyDistrictBarConfig(layer, {
      ...config,
      label: { ...config.label, offsetX: 12 }
    })
    expect(labelTextureMocks.create).toHaveBeenCalledTimes(1)

    applyDistrictBarConfig(layer, {
      ...config,
      label: { ...config.label, valueColor: '#abcdef' }
    })
    expect(labelTextureMocks.create).toHaveBeenCalledTimes(2)
    expect(visual.label?.material.map).toBe(secondTexture)
    expect(firstDispose).toHaveBeenCalledTimes(1)

    labelTextureMocks.create.mockImplementationOnce(() => {
      throw new Error('injected label texture failure')
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(() => applyDistrictBarConfig(layer, {
      ...config,
      label: { ...config.label, valueColor: '#fedcba' }
    })).not.toThrow()
    expect(visual.label?.material.map).toBe(secondTexture)
    expect(visual.column).toBeInstanceOf(THREE.Mesh)
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('标签纹理更新失败'),
      expect.any(Error)
    )
    warn.mockRestore()
    disposeDistrictBarLayer(layer)
  })

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

    expect(layer.group.children).toHaveLength(3)
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

    setDistrictBarHoverProgress(layer, 'A', 1, 2)
    updateDistrictBarLayer(layer, config, 0)

    expect(a.column.position.z).toBeCloseTo(aZ + config.hoverLift)
    expect(a.ring.position.z).toBeCloseTo(4.09 + 2)
    expect(a.pulseRing.position.z).toBeCloseTo(4.095 + 2)
    expect(a.column.material.emissiveIntensity).toBe(config.hoverEmissiveIntensity)
    expect(b.column.position.z).toBe(bZ)
    expect(b.column.material.emissiveIntensity).toBe(bIntensity)
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
