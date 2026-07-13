import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import {
  HOVER_MOSAIC_PARTICLE_DEFAULTS,
  cloneMosaicParticleConfig
} from './mapMosaicParticleConfig'
import {
  deriveMosaicActivationSeed,
  mosaicBurstEnvelope
} from './mapMosaicDynamics'
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
    expect(topMaterial.fragmentShader).toContain('uAccentColor')
    expect(topMaterial.fragmentShader).toContain('uClusterChance')
    expect(topMaterial.fragmentShader).toContain('clusterInfluence')
    expect(topMaterial.fragmentShader).toContain('1.0 + clusterField * max(uClusterStrength, 0.0)')
    expect(topMaterial.fragmentShader).toContain('max(1.0, uBurstStrength)')
    expect(topMaterial.fragmentShader).not.toMatch(/wave|travel/i)
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
    config.accentColor = '#654321'
    config.accentRatio = 0.3
    config.clusterChance = 0.24
    config.clusterRadius = 3
    config.clusterStrength = 1.8
    config.accentClusterBias = 0.72
    config.flickerHz = 4.2
    config.dutyCycle = 0.4
    config.pulseSharpness = 1.8
    config.clusterFlickerScale = 0.5
    config.burstDurationMs = 320
    config.burstStrength = 1.9
    config.burstDensityBoost = 0.22

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
    expect(uniforms.uAccentColor.value.getHexString()).toBe('654321')
    expect(uniforms.uAccentRatio.value).toBe(0.3)
    expect(uniforms.uClusterChance.value).toBe(0.24)
    expect(uniforms.uClusterRadius.value).toBe(3)
    expect(uniforms.uClusterStrength.value).toBe(1.8)
    expect(uniforms.uAccentClusterBias.value).toBe(0.72)
    expect(uniforms.uFlickerHz.value).toBe(4.2)
    expect(uniforms.uDutyCycle.value).toBe(0.4)
    expect(uniforms.uPulseSharpness.value).toBe(1.8)
    expect(uniforms.uClusterFlickerScale.value).toBe(0.5)
    expect(uniforms.uBurstStrength.value).toBe(1.9)
    expect(uniforms.uBurstDensityBoost.value).toBe(0.22)
    expect(source.material).toBe(sourceMaterials)

    particles.setConfig({ ...config, enabled: false })
    expect(overlayOf(source).visible).toBe(false)
    particles.dispose()
  })

  it('restarts the entry burst and reseeds only when a region re-enters', () => {
    const source = createRegion('测试区')
    const { metrics } = createDisplayMetrics()
    const particles = createMapMosaicParticles(metrics, [source])
    const material = topMaterialOf(source)

    particles.setRegionProgress(source, 0.2)
    const firstSeed = material.uniforms.uActivationSeed.value
    expect(firstSeed).toBe(deriveMosaicActivationSeed(17, '测试区', 0))
    expect(material.uniforms.uBurstEnvelope.value).toBe(1)
    particles.advanceTime(130)
    expect(material.uniforms.uBurstEnvelope.value).toBe(0.5)

    particles.setRegionProgress(source, 0.1)
    particles.advanceTime(65)
    expect(material.uniforms.uActivationSeed.value).toBe(firstSeed)
    expect(material.uniforms.uBurstEnvelope.value).toBeLessThan(0.5)

    particles.setRegionProgress(source, 0)
    particles.setRegionProgress(source, 0.2)
    const secondSeed = material.uniforms.uActivationSeed.value
    expect(secondSeed).toBe(deriveMosaicActivationSeed(17, '测试区', 1))
    expect(secondSeed).not.toBe(firstSeed)
    expect(material.uniforms.uBurstEnvelope.value).toBe(1)

    particles.setConfig({ ...HOVER_MOSAIC_PARTICLE_DEFAULTS, reseedOnEnter: false })
    particles.setRegionProgress(source, 0)
    particles.setRegionProgress(source, 0.2)
    const fixedSeed = material.uniforms.uActivationSeed.value
    expect(material.uniforms.uTime.value).toBe(0)
    particles.advanceTime(100)
    expect(material.uniforms.uTime.value).toBe(0.1)
    particles.setRegionProgress(source, 0)
    particles.setRegionProgress(source, 0.2)
    expect(material.uniforms.uTime.value).toBe(0)
    expect(material.uniforms.uActivationSeed.value).toBe(fixedSeed)
    expect(fixedSeed).toBe(deriveMosaicActivationSeed(17, '测试区', 0))
    particles.dispose()
  })

  it('keeps the hover lifecycle advancing while particle rendering is disabled', () => {
    const source = createRegion('测试区')
    const { metrics } = createDisplayMetrics()
    const particles = createMapMosaicParticles(metrics, [source])
    const material = topMaterialOf(source)

    particles.setRegionProgress(source, 1)
    particles.setConfig({ ...HOVER_MOSAIC_PARTICLE_DEFAULTS, enabled: false })
    expect(overlayOf(source).visible).toBe(false)
    particles.advanceTime(130)
    expect(material.uniforms.uTime.value).toBe(0.13)
    expect(material.uniforms.uBurstEnvelope.value).toBe(0.5)

    particles.setConfig({ ...HOVER_MOSAIC_PARTICLE_DEFAULTS, enabled: true })
    expect(overlayOf(source).visible).toBe(true)
    expect(material.uniforms.uBurstEnvelope.value).toBe(0.5)
    particles.dispose()
  })

  it('updates the configured base seed without replaying an active entry', () => {
    const source = createRegion('测试区')
    const { metrics } = createDisplayMetrics()
    const particles = createMapMosaicParticles(metrics, [source])
    const material = topMaterialOf(source)

    particles.setRegionProgress(source, 1)
    particles.advanceTime(130)
    particles.setConfig({ ...HOVER_MOSAIC_PARTICLE_DEFAULTS, seed: 99 })

    expect(material.uniforms.uActivationSeed.value)
      .toBe(deriveMosaicActivationSeed(99, '测试区', 0))
    expect(material.uniforms.uTime.value).toBe(0.13)
    expect(material.uniforms.uBurstEnvelope.value).toBe(0.5)
    particles.dispose()
  })

  it('keeps rapid region switches on independent burst ages and supports zero duration', () => {
    const first = createRegion('甲区')
    const second = createRegion('乙区')
    const { metrics } = createDisplayMetrics()
    const particles = createMapMosaicParticles(metrics, [first, second])
    const firstMaterial = topMaterialOf(first)
    const secondMaterial = topMaterialOf(second)

    particles.setRegionProgress(first, 1)
    particles.advanceTime(100)
    particles.setRegionProgress(first, 0.8)
    particles.setRegionProgress(second, 0.2)
    particles.advanceTime(30)

    expect(firstMaterial.uniforms.uBurstEnvelope.value)
      .toBe(mosaicBurstEnvelope(130, 260))
    expect(secondMaterial.uniforms.uBurstEnvelope.value)
      .toBe(mosaicBurstEnvelope(30, 260))
    expect(firstMaterial.uniforms.uActivationSeed.value)
      .not.toBe(secondMaterial.uniforms.uActivationSeed.value)

    particles.setConfig({ ...HOVER_MOSAIC_PARTICLE_DEFAULTS, burstDurationMs: 0 })
    particles.setRegionProgress(second, 0)
    particles.setRegionProgress(second, 1)
    expect(secondMaterial.uniforms.uBurstEnvelope.value).toBe(0)
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

  it('atomically cleans up and throws when any region overlay fails to initialize', () => {
    const valid = createRegion('正常区')
    const broken = createRegion('坏区')
    vi.spyOn(broken, 'add').mockImplementation(() => {
      throw new Error('overlay failed')
    })
    const shaderDispose = vi.spyOn(THREE.ShaderMaterial.prototype, 'dispose')
    const hiddenSideDispose = vi.spyOn(THREE.MeshBasicMaterial.prototype, 'dispose')
    const { metrics } = createDisplayMetrics()

    expect(() => createMapMosaicParticles(metrics, [valid, broken]))
      .toThrow('区块 坏区 的马赛克粒子初始化失败')

    expect(valid.children).toHaveLength(0)
    expect(broken.children).toHaveLength(0)
    expect(shaderDispose).toHaveBeenCalledTimes(2)
    expect(hiddenSideDispose).toHaveBeenCalledTimes(1)
  })
})
