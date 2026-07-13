import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import {
  HOVER_MOSAIC_PARTICLE_DEFAULTS,
  cloneMosaicParticleConfig
} from './mapMosaicParticleConfig'
import {
  createMapMosaicParticles,
  type MosaicDisplayMetrics
} from './mapMosaicParticles'

function createRegion(name = '测试区'): THREE.Mesh<THREE.BufferGeometry, THREE.Material[]> {
  const geometry = new THREE.BoxGeometry(10, 8, 4)
  geometry.clearGroups()
  geometry.addGroup(0, geometry.index!.count / 2, 0)
  geometry.addGroup(geometry.index!.count / 2, geometry.index!.count / 2, 1)
  const source = new THREE.Mesh(geometry, [
    new THREE.MeshBasicMaterial(),
    new THREE.MeshBasicMaterial()
  ])
  source.userData.name = name
  return source
}

function overlayOf(source: THREE.Mesh): THREE.Mesh<THREE.BufferGeometry, THREE.Material[]> {
  return source.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.Material[]>
}

function topMaterialOf(source: THREE.Mesh): THREE.ShaderMaterial {
  return overlayOf(source).material[0] as THREE.ShaderMaterial
}

function createDisplayMetrics(initialRenderPixelsPerScreenPixel = 1): {
  metrics: MosaicDisplayMetrics
  setRenderPixelsPerScreenPixel(value: number): void
} {
  let renderPixelsPerScreenPixel = initialRenderPixelsPerScreenPixel
  return {
    metrics: { getRenderPixelsPerScreenPixel: () => renderPixelsPerScreenPixel },
    setRenderPixelsPerScreenPixel: (value) => { renderPixelsPerScreenPixel = value }
  }
}

describe('createMapMosaicParticles', () => {
  it('adds a top-only additive overlay that reuses the source geometry', () => {
    const source = createRegion()
    const { metrics } = createDisplayMetrics()
    const particles = createMapMosaicParticles(metrics, [source])
    const overlay = overlayOf(source)
    const [topMaterial, sideMaterial] = overlay.material as [THREE.ShaderMaterial, THREE.Material]

    expect(overlay.geometry).toBe(source.geometry)
    expect(topMaterial).toBeInstanceOf(THREE.ShaderMaterial)
    expect(topMaterial.blending).toBe(THREE.AdditiveBlending)
    expect(topMaterial.depthTest).toBe(true)
    expect(topMaterial.depthWrite).toBe(false)
    expect(topMaterial.transparent).toBe(true)
    expect(topMaterial.vertexShader).toContain('normal.z')
    expect(topMaterial.vertexShader).toContain('position.xy')
    expect(topMaterial.fragmentShader).toContain('dFdx(vModelPosition)')
    expect(topMaterial.fragmentShader).toContain('dFdy(vModelPosition)')
    expect(topMaterial.fragmentShader).toContain('exp2')
    expect(topMaterial.fragmentShader).toContain('8.0')
    expect(topMaterial.fragmentShader).toContain('smoothstep(0.35, 0.65')
    expect(topMaterial.fragmentShader).toContain('discard')
    expect(sideMaterial.visible).toBe(false)

    particles.dispose()
  })

  it('keeps each entering and exiting region independently visible by hover progress', () => {
    const first = createRegion('甲区')
    const second = createRegion('乙区')
    const { metrics } = createDisplayMetrics()
    const particles = createMapMosaicParticles(metrics, [first, second])

    expect(overlayOf(first).visible).toBe(false)
    expect(overlayOf(second).visible).toBe(false)
    expect(particles.setRegionProgress(first, 0.4)).toBe(true)
    expect(particles.setRegionProgress(second, 1.4)).toBe(true)
    expect(topMaterialOf(first).uniforms.uProgress.value).toBe(0.4)
    expect(topMaterialOf(second).uniforms.uProgress.value).toBe(1)
    expect(overlayOf(first).visible).toBe(true)
    expect(overlayOf(second).visible).toBe(true)

    expect(particles.setRegionProgress(first, Number.NaN)).toBe(true)
    expect(overlayOf(first).visible).toBe(false)
    expect(overlayOf(second).visible).toBe(true)
    expect(particles.setRegionProgress(second, 1)).toBe(false)
    particles.dispose()
  })

  it('applies normalized visual config without changing the terrain material', () => {
    const source = createRegion()
    const sourceMaterials = source.material
    const { metrics } = createDisplayMetrics(2)
    const particles = createMapMosaicParticles(metrics, [source])
    const config = cloneMosaicParticleConfig(HOVER_MOSAIC_PARTICLE_DEFAULTS)
    config.primaryColor = '#123456'
    config.density = 0.42
    config.gapRatio = 0.3
    config.opacity = 0.7
    config.brightness = 1.8
    config.surfaceOffset = 0.24
    config.targetCellPx = 10
    config.minCellPx = 6
    config.maxCellPx = 16

    particles.setRegionProgress(source, 0.8)
    particles.setConfig(config)
    const uniforms = topMaterialOf(source).uniforms
    expect(uniforms.uPrimaryColor.value.getHexString()).toBe('123456')
    expect(uniforms.uDensity.value).toBe(0.42)
    expect(uniforms.uGapRatio.value).toBe(0.3)
    expect(uniforms.uOpacity.value).toBe(0.7)
    expect(uniforms.uBrightness.value).toBe(1.8)
    expect(uniforms.uSurfaceOffset.value).toBe(0.24)
    expect(uniforms.uTargetCellPx.value).toBe(10)
    expect(uniforms.uMinCellPx.value).toBe(6)
    expect(uniforms.uMaxCellPx.value).toBe(16)
    expect(uniforms.uRenderPixelsPerScreenPixel.value).toBe(2)
    expect(source.material).toBe(sourceMaterials)

    particles.setConfig({ ...config, enabled: false })
    expect(overlayOf(source).visible).toBe(false)
    particles.dispose()
  })

  it('advances time only for visible overlays', () => {
    const first = createRegion('甲区')
    const second = createRegion('乙区')
    const display = createDisplayMetrics(1)
    const particles = createMapMosaicParticles(display.metrics, [first, second])
    particles.setRegionProgress(first, 1)

    particles.advanceTime(250)
    expect(topMaterialOf(first).uniforms.uTime.value).toBe(0.25)
    expect(topMaterialOf(second).uniforms.uTime.value).toBe(0)

    display.setRenderPixelsPerScreenPixel(2)
    particles.advanceTime(0)
    expect(topMaterialOf(first).uniforms.uRenderPixelsPerScreenPixel.value).toBe(2)
    expect(topMaterialOf(second).uniforms.uRenderPixelsPerScreenPixel.value).toBe(2)

    particles.advanceTime(Number.NaN)
    particles.advanceTime(-100)
    expect(topMaterialOf(first).uniforms.uTime.value).toBe(0.25)
    particles.dispose()
  })

  it('isolates a failed region and disposes overlays idempotently without owning geometry', () => {
    const broken = createRegion('坏区')
    const valid = createRegion('正常区')
    vi.spyOn(broken, 'add').mockImplementation(() => {
      throw new Error('overlay failed')
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const geometryDispose = vi.spyOn(valid.geometry, 'dispose')
    const { metrics } = createDisplayMetrics()
    const particles = createMapMosaicParticles(metrics, [broken, valid])
    const overlay = overlayOf(valid)
    const [topMaterial, sideMaterial] = overlay.material as [THREE.ShaderMaterial, THREE.Material]
    const topDispose = vi.spyOn(topMaterial, 'dispose')
    const sideDispose = vi.spyOn(sideMaterial, 'dispose')

    expect(broken.children).toHaveLength(0)
    expect(valid.children).toHaveLength(1)
    expect(warn).toHaveBeenCalledTimes(1)

    particles.dispose()
    particles.dispose()
    expect(valid.children).toHaveLength(0)
    expect(topDispose).toHaveBeenCalledTimes(1)
    expect(sideDispose).toHaveBeenCalledTimes(1)
    expect(geometryDispose).not.toHaveBeenCalled()
    warn.mockRestore()
  })
})
