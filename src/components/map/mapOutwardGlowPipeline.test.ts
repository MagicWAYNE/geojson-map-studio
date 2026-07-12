import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import {
  B3_GLOW_PROFILE_DEFAULTS,
  cloneMapEffectConfig,
  MAP_EFFECT_DEFAULTS,
  type MapEffectConfig
} from './mapEffectConfig'
import {
  createMapOutwardGlowPipeline,
  type MapOutwardGlowPipeline,
  type MapOutwardGlowPipelineStatus
} from './mapOutwardGlowPipeline'

const shaderMocks = vi.hoisted(() => ({
  create: vi.fn(),
  actualCreate: undefined as undefined | (() => unknown),
  renderBlur: vi.fn(),
  renderComposite: vi.fn(),
  dispose: vi.fn()
}))

const inwardShaderMocks = vi.hoisted(() => ({
  create: vi.fn(),
  actualCreate: undefined as undefined | (() => unknown),
  renderComposite: vi.fn(),
  dispose: vi.fn()
}))

vi.mock('./mapOutwardGlowShaders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./mapOutwardGlowShaders')>()
  shaderMocks.actualCreate = actual.createGlowShaderResources
  return {
    ...actual,
    createGlowShaderResources: shaderMocks.create,
    renderSeparableBlur: shaderMocks.renderBlur,
    renderOutwardComposite: shaderMocks.renderComposite,
    disposeGlowShaderResources: shaderMocks.dispose
  }
})

vi.mock('./mapInwardGlowShaders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./mapInwardGlowShaders')>()
  inwardShaderMocks.actualCreate = actual.createInwardGlowShaderResources
  return {
    ...actual,
    createInwardGlowShaderResources: inwardShaderMocks.create,
    renderInwardComposite: inwardShaderMocks.renderComposite,
    disposeInwardGlowShaderResources: inwardShaderMocks.dispose
  }
})

interface RecordingRenderer extends THREE.WebGLRenderer {
  getRenderTarget: ReturnType<typeof vi.fn>
  setRenderTarget: ReturnType<typeof vi.fn>
  clear: ReturnType<typeof vi.fn>
  render: ReturnType<typeof vi.fn>
}

function fixture(previousTarget: THREE.WebGLRenderTarget | null = null) {
  const renderer = {
    autoClear: true,
    getRenderTarget: vi.fn(() => previousTarget),
    setRenderTarget: vi.fn(),
    clear: vi.fn(),
    render: vi.fn()
  } as unknown as RecordingRenderer
  const meshes = [0, 20].map((x) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 2))
    mesh.position.x = x
    mesh.updateMatrixWorld(true)
    return mesh
  })
  const scene = new THREE.Scene()
  scene.add(...meshes)
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 1000)
  const pipeline = createMapOutwardGlowPipeline(renderer, meshes)
  return { pipeline, renderer, meshes, scene, camera }
}

function configWith({
  baseRadius = 54,
  baseOpacity = 0.23,
  hoverRadius = 0,
  hoverOpacity = 0,
  baseColor = '#ffffff',
  hoverColor = '#27a7ff',
  baseInwardEnabled = false,
  hoverInwardEnabled = false,
  renderScale = 0.5
}: {
  baseRadius?: number
  baseOpacity?: number
  hoverRadius?: number
  hoverOpacity?: number
  baseColor?: string
  hoverColor?: string
  baseInwardEnabled?: boolean
  hoverInwardEnabled?: boolean
  renderScale?: MapEffectConfig['quality']['renderScale']
} = {}): MapEffectConfig {
  const config = cloneMapEffectConfig(MAP_EFFECT_DEFAULTS)
  Object.assign(config.base, {
    outerColor: baseColor,
    outerGlowEnabled: true,
    outerGlowColor: baseColor,
    outerGlowWidth: baseRadius,
    outerGlowStrength: baseOpacity,
    outerGlowNearRadiusRatio: B3_GLOW_PROFILE_DEFAULTS.nearRadiusRatio,
    outerGlowNearOpacityRatio: B3_GLOW_PROFILE_DEFAULTS.nearOpacityRatio,
    outerGlowFarRadiusRatio: B3_GLOW_PROFILE_DEFAULTS.farRadiusRatio,
    outerGlowFarOpacityRatio: B3_GLOW_PROFILE_DEFAULTS.farOpacityRatio,
    outerGlowFalloff: B3_GLOW_PROFILE_DEFAULTS.falloff,
    outerGlowEdgeSoftness: B3_GLOW_PROFILE_DEFAULTS.edgeSoftness,
    outerGlowNearPasses: B3_GLOW_PROFILE_DEFAULTS.nearPasses,
    outerGlowFarPasses: B3_GLOW_PROFILE_DEFAULTS.farPasses
  })
  Object.assign(config.hover, {
    glowEnabled: true,
    glowColor: hoverColor,
    glowWidth: hoverRadius,
    glowStrength: hoverOpacity,
    glowNearRadiusRatio: B3_GLOW_PROFILE_DEFAULTS.nearRadiusRatio,
    glowNearOpacityRatio: B3_GLOW_PROFILE_DEFAULTS.nearOpacityRatio,
    glowFarRadiusRatio: B3_GLOW_PROFILE_DEFAULTS.farRadiusRatio,
    glowFarOpacityRatio: B3_GLOW_PROFILE_DEFAULTS.farOpacityRatio,
    glowFalloff: B3_GLOW_PROFILE_DEFAULTS.falloff,
    glowEdgeSoftness: B3_GLOW_PROFILE_DEFAULTS.edgeSoftness,
    glowNearPasses: B3_GLOW_PROFILE_DEFAULTS.nearPasses,
    glowFarPasses: B3_GLOW_PROFILE_DEFAULTS.farPasses
  })
  config.base.inwardGlow.enabled = baseInwardEnabled
  config.hover.inwardGlow.enabled = hoverInwardEnabled
  config.quality.renderScale = renderScale
  return config
}

function enabledFixture() {
  const value = fixture()
  value.pipeline.setSize(680, 680, 2)
  value.pipeline.setConfig(configWith())
  return value
}

function renderedMaskScenes(renderer: RecordingRenderer, mainScene: THREE.Scene): THREE.Scene[] {
  return renderer.render.mock.calls
    .map(([scene]) => scene)
    .filter((scene): scene is THREE.Scene => scene instanceof THREE.Scene && scene !== mainScene)
}

beforeEach(() => {
  shaderMocks.create.mockReset()
  shaderMocks.create.mockImplementation(shaderMocks.actualCreate!)
  shaderMocks.renderBlur.mockReset()
  shaderMocks.renderComposite.mockReset()
  shaderMocks.dispose.mockReset()
  inwardShaderMocks.create.mockReset()
  inwardShaderMocks.create.mockImplementation(inwardShaderMocks.actualCreate!)
  inwardShaderMocks.renderComposite.mockReset()
  inwardShaderMocks.dispose.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('mapOutwardGlowPipeline', () => {
  it('reports four-channel status and allocates exactly eleven shared-mask targets', () => {
    const setSize = vi.spyOn(THREE.WebGLRenderTarget.prototype, 'setSize')
    const { pipeline, meshes } = fixture()
    pipeline.setSize(680, 480, 1.25)
    pipeline.setConfig(configWith({
      hoverRadius: 72,
      hoverOpacity: 0.31,
      baseInwardEnabled: true,
      hoverInwardEnabled: true
    }))
    pipeline.setRegionProgress(meshes[0], 1)

    expect(setSize).toHaveBeenCalledTimes(11)
    expect(pipeline.getStatus()).toEqual({
      targetWidth: 425,
      targetHeight: 300,
      renderScale: 0.5,
      baseState: 'enabled',
      hoverState: 'active',
      baseInwardState: 'active',
      hoverInwardState: 'active',
      baseWaveActive: false,
      hoverWaveActive: false
    })
  })

  it('reuses static and hover masks and composites all four channels in exact coexistence order', () => {
    const { pipeline, meshes, renderer, scene, camera } = fixture()
    pipeline.setConfig(configWith({
      hoverRadius: 72,
      hoverOpacity: 0.31,
      baseInwardEnabled: true,
      hoverInwardEnabled: true
    }))
    pipeline.setRegionProgress(meshes[0], 1)

    pipeline.render(scene, camera, 1000)

    expect(renderedMaskScenes(renderer, scene)).toHaveLength(2)
    expect(shaderMocks.renderBlur).toHaveBeenCalledTimes(8)
    expect(shaderMocks.renderComposite).toHaveBeenCalledTimes(2)
    expect(inwardShaderMocks.renderComposite).toHaveBeenCalledTimes(2)
    const compositeCallOrder = [
      shaderMocks.renderComposite.mock.invocationCallOrder[0],
      inwardShaderMocks.renderComposite.mock.invocationCallOrder[0],
      shaderMocks.renderComposite.mock.invocationCallOrder[1],
      inwardShaderMocks.renderComposite.mock.invocationCallOrder[1]
    ]
    expect(compositeCallOrder).toEqual([...compositeCallOrder].sort((a, b) => a - b))
    const [staticMaskRenderOrder, hoverMaskRenderOrder, mainRenderOrder] =
      renderer.render.mock.invocationCallOrder
    expect(staticMaskRenderOrder).toBeLessThan(shaderMocks.renderBlur.mock.invocationCallOrder[0])
    expect(shaderMocks.renderBlur.mock.invocationCallOrder[3]).toBeLessThan(hoverMaskRenderOrder)
    expect(hoverMaskRenderOrder).toBeLessThan(shaderMocks.renderBlur.mock.invocationCallOrder[4])
    expect(shaderMocks.renderBlur.mock.invocationCallOrder[7]).toBeLessThan(mainRenderOrder)
    expect(mainRenderOrder).toBeLessThan(compositeCallOrder[0])
    const blurMaskTextures = shaderMocks.renderBlur.mock.calls.map((call) => call[2])
    expect(new Set(blurMaskTextures)).toHaveLength(2)
    const sharedPingTarget = shaderMocks.renderBlur.mock.calls[0][3]
    expect(shaderMocks.renderBlur.mock.calls.every((call) => call[3] === sharedPingTarget)).toBe(true)
    expect(new Set(shaderMocks.renderBlur.mock.calls.map((call) => call[4]))).toHaveLength(8)
  })

  it('propagates an inward composite error while restoring the renderer target and autoClear', () => {
    const previousTarget = new THREE.WebGLRenderTarget(4, 4)
    const { pipeline, renderer, scene, camera } = fixture(previousTarget)
    const config = configWith({ baseInwardEnabled: true })
    pipeline.setConfig(config)
    renderer.autoClear = false
    inwardShaderMocks.renderComposite.mockImplementationOnce(() => {
      throw new Error('inward composite failed')
    })

    expect(() => pipeline.render(scene, camera, 1000)).toThrow('inward composite failed')

    expect(inwardShaderMocks.renderComposite).toHaveBeenCalledOnce()
    expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(previousTarget)
    expect(renderer.autoClear).toBe(false)
  })

  it('reports inward disabled, zero, ready, and active states independently', () => {
    const { pipeline, meshes } = fixture()
    const config = configWith({ baseInwardEnabled: true, hoverInwardEnabled: true })
    config.base.inwardGlow.width = 0
    pipeline.setConfig(config)

    expect(pipeline.getStatus()).toMatchObject({
      baseInwardState: 'zero',
      hoverInwardState: 'ready',
      baseWaveActive: false,
      hoverWaveActive: false
    })
    pipeline.setRegionProgress(meshes[0], 1)
    expect(pipeline.getStatus().hoverInwardState).toBe('active')

    const disabled = cloneMapEffectConfig(config)
    disabled.base.inwardGlow.enabled = false
    disabled.hover.inwardGlow.enabled = false
    pipeline.setConfig(disabled)
    expect(pipeline.getStatus()).toMatchObject({
      baseInwardState: 'disabled',
      hoverInwardState: 'disabled'
    })
  })

  it('updates only inward wave composite phase as deterministic time advances', () => {
    const { pipeline, renderer, scene, camera } = fixture()
    const config = configWith({
      baseRadius: 0,
      baseOpacity: 0,
      baseInwardEnabled: true
    })
    config.base.inwardGlow.wave.easing = 'linear'
    config.base.inwardGlow.wave.periodMs = 1000
    pipeline.setConfig(config)
    pipeline.render(scene, camera, 1000)
    renderer.render.mockClear()
    shaderMocks.renderBlur.mockClear()
    inwardShaderMocks.renderComposite.mockClear()

    pipeline.render(scene, camera, 1250)

    expect(renderedMaskScenes(renderer, scene)).toHaveLength(0)
    expect(shaderMocks.renderBlur).not.toHaveBeenCalled()
    expect(inwardShaderMocks.renderComposite).toHaveBeenCalledOnce()
    expect(inwardShaderMocks.renderComposite).toHaveBeenCalledWith(
      renderer,
      expect.any(Object),
      expect.objectContaining({ waveActive: true, wavePhase: 0.25 })
    )
    expect(pipeline.getStatus()).toMatchObject({
      baseWaveActive: true,
      hoverWaveActive: false
    })
  })

  it('rebuilds only the matching base or hover inward near/far cache when width changes', () => {
    const { pipeline, meshes, renderer, scene, camera } = fixture()
    const config = configWith({
      baseRadius: 0,
      baseOpacity: 0,
      hoverRadius: 0,
      hoverOpacity: 0,
      baseInwardEnabled: true,
      hoverInwardEnabled: true
    })
    pipeline.setConfig(config)
    pipeline.setRegionProgress(meshes[0], 1)
    pipeline.render(scene, camera, 1000)
    const [baseNear, baseFar, hoverNear, hoverFar] = shaderMocks.renderBlur.mock.calls
      .map((call) => call[4])
    shaderMocks.renderBlur.mockClear()
    renderer.render.mockClear()

    const widerBase = cloneMapEffectConfig(config)
    widerBase.base.inwardGlow.width += 10
    pipeline.setConfig(widerBase)
    pipeline.render(scene, camera, 1100)
    expect(shaderMocks.renderBlur.mock.calls[0][4]).toBe(baseNear)
    expect(shaderMocks.renderBlur.mock.calls[1][4]).toBe(baseFar)
    expect(renderedMaskScenes(renderer, scene)).toHaveLength(0)
    shaderMocks.renderBlur.mockClear()

    const widerHover = cloneMapEffectConfig(widerBase)
    widerHover.hover.inwardGlow.width += 10
    pipeline.setConfig(widerHover)
    pipeline.render(scene, camera, 1200)
    expect(shaderMocks.renderBlur.mock.calls[0][4]).toBe(hoverNear)
    expect(shaderMocks.renderBlur.mock.calls[1][4]).toBe(hoverFar)
  })

  it('keeps inward blur caches for color, base ratio, max alpha, and wave-only changes', () => {
    const { pipeline, renderer, scene, camera } = fixture()
    const config = configWith({
      baseRadius: 0,
      baseOpacity: 0,
      baseInwardEnabled: true
    })
    pipeline.setConfig(config)
    pipeline.render(scene, camera, 1000)
    shaderMocks.renderBlur.mockClear()
    renderer.render.mockClear()
    inwardShaderMocks.renderComposite.mockClear()

    const compositeOnly = cloneMapEffectConfig(config)
    Object.assign(compositeOnly.base.inwardGlow, {
      color: '#102030',
      strength: 0.4,
      maxAlpha: 0.7,
      nearOpacityRatio: 0.5,
      farOpacityRatio: 0.75,
      falloff: 2,
      edgeSoftness: 0.4,
      baseRatio: 0.3
    })
    Object.assign(compositeOnly.base.inwardGlow.wave, {
      enabled: true,
      widthRatio: 0.3,
      strength: 0.8,
      periodMs: 2000,
      delayMs: 100,
      travelRatio: 1.5,
      decay: 1.2,
      easing: 'linear' as const
    })
    pipeline.setConfig(compositeOnly)
    pipeline.render(scene, camera, 1500)

    expect(renderedMaskScenes(renderer, scene)).toHaveLength(0)
    expect(shaderMocks.renderBlur).not.toHaveBeenCalled()
    expect(inwardShaderMocks.renderComposite).toHaveBeenCalledWith(
      renderer,
      expect.any(Object),
      expect.objectContaining({
        color: '#102030',
        nearOpacity: 0.2,
        farOpacity: 0.3,
        maxAlpha: 0.7,
        falloff: 2,
        edgeSoftness: 0.4,
        baseRatio: 0.3,
        waveWidthRatio: 0.3,
        waveStrength: 0.8,
        waveTravelRatio: 1.5,
        waveDecay: 1.2
      })
    )
  })

  it('renders a shared static mask and only inward work when outward is disabled', () => {
    const { pipeline, renderer, scene, camera } = fixture()
    const config = configWith({ baseInwardEnabled: true })
    config.base.outerGlowEnabled = false
    pipeline.setConfig(config)

    pipeline.render(scene, camera, 1000)

    expect(renderedMaskScenes(renderer, scene)).toHaveLength(1)
    expect(shaderMocks.renderBlur).toHaveBeenCalledTimes(2)
    expect(shaderMocks.renderComposite).not.toHaveBeenCalled()
    expect(inwardShaderMocks.renderComposite).toHaveBeenCalledOnce()
  })

  it('renders only outward work when inward is disabled', () => {
    const { pipeline, renderer, scene, camera } = enabledFixture()

    pipeline.render(scene, camera, 1000)

    expect(renderedMaskScenes(renderer, scene)).toHaveLength(1)
    expect(shaderMocks.renderBlur).toHaveBeenCalledTimes(2)
    expect(shaderMocks.renderComposite).toHaveBeenCalledOnce()
    expect(inwardShaderMocks.renderComposite).not.toHaveBeenCalled()
  })

  it('invalidates only hover mask and outward/inward hover blurs for progress and matrix changes', () => {
    const { pipeline, meshes, renderer, scene, camera } = fixture()
    pipeline.setConfig(configWith({
      hoverRadius: 72,
      hoverOpacity: 0.31,
      baseInwardEnabled: true,
      hoverInwardEnabled: true
    }))
    pipeline.setRegionProgress(meshes[0], 0.5)
    pipeline.render(scene, camera, 1000)
    const initialOutputs = shaderMocks.renderBlur.mock.calls.map((call) => call[4])
    renderer.render.mockClear()
    shaderMocks.renderBlur.mockClear()

    pipeline.setRegionProgress(meshes[0], 0.75)
    pipeline.render(scene, camera, 1100)

    expect(renderedMaskScenes(renderer, scene)).toHaveLength(1)
    expect(shaderMocks.renderBlur.mock.calls.map((call) => call[4]))
      .toEqual(initialOutputs.slice(4))
    renderer.render.mockClear()
    shaderMocks.renderBlur.mockClear()
    meshes[0].position.y += 2
    meshes[0].updateMatrixWorld(true)

    pipeline.setRegionProgress(meshes[0], 0.75)
    pipeline.render(scene, camera, 1200)

    expect(renderedMaskScenes(renderer, scene)).toHaveLength(1)
    expect(shaderMocks.renderBlur.mock.calls.map((call) => call[4]))
      .toEqual(initialOutputs.slice(4))
  })

  it('resets hover wave phase on each region rising edge after leave and re-entry', () => {
    const { pipeline, meshes, scene, camera } = fixture()
    const config = configWith({
      baseRadius: 0,
      baseOpacity: 0,
      hoverRadius: 0,
      hoverOpacity: 0,
      hoverInwardEnabled: true
    })
    config.hover.inwardGlow.wave.easing = 'linear'
    config.hover.inwardGlow.wave.periodMs = 1000
    pipeline.setConfig(config)

    pipeline.setRegionProgress(meshes[0], 1)
    pipeline.render(scene, camera, 1000)
    expect(inwardShaderMocks.renderComposite.mock.calls.at(-1)?.[2].wavePhase).toBe(0)
    pipeline.render(scene, camera, 1500)
    expect(inwardShaderMocks.renderComposite.mock.calls.at(-1)?.[2].wavePhase).toBe(0.5)

    pipeline.setRegionProgress(meshes[0], 0)
    pipeline.render(scene, camera, 1600)
    pipeline.setRegionProgress(meshes[1], 1)
    pipeline.render(scene, camera, 2000)

    expect(inwardShaderMocks.renderComposite.mock.calls.at(-1)?.[2].wavePhase).toBe(0)
  })

  it('resets hover wave phase when another region rises while the first remains visible', () => {
    const { pipeline, meshes, scene, camera } = fixture()
    const config = configWith({
      baseRadius: 0,
      baseOpacity: 0,
      hoverRadius: 0,
      hoverOpacity: 0,
      hoverInwardEnabled: true
    })
    config.hover.inwardGlow.wave.easing = 'linear'
    config.hover.inwardGlow.wave.periodMs = 1000
    pipeline.setConfig(config)

    pipeline.setRegionProgress(meshes[0], 1)
    pipeline.render(scene, camera, 1000)
    pipeline.render(scene, camera, 1500)
    expect(inwardShaderMocks.renderComposite.mock.calls.at(-1)?.[2].wavePhase).toBe(0.5)

    pipeline.setRegionProgress(meshes[1], 1)
    pipeline.render(scene, camera, 1600)

    expect(pipeline.getStatus().hoverInwardState).toBe('active')
    expect(inwardShaderMocks.renderComposite.mock.calls.at(-1)?.[2].wavePhase).toBe(0)
  })

  it('deep-snapshots inward and wave config passed to setConfig', () => {
    const { pipeline, renderer, scene, camera } = fixture()
    const config = configWith({
      baseRadius: 0,
      baseOpacity: 0,
      baseInwardEnabled: true
    })
    config.base.inwardGlow.wave.easing = 'linear'
    config.base.inwardGlow.wave.periodMs = 1000
    pipeline.setSize(680, 680, 2)
    pipeline.setConfig(config)
    config.base.inwardGlow.width = 120
    config.base.inwardGlow.wave.periodMs = 4000

    pipeline.render(scene, camera, 1000)
    expect(shaderMocks.renderBlur.mock.calls.map((call) => call[5])).toEqual([16.8, 48])
    pipeline.render(scene, camera, 1500)
    expect(inwardShaderMocks.renderComposite).toHaveBeenLastCalledWith(
      renderer,
      expect.any(Object),
      expect.objectContaining({ wavePhase: 0.5 })
    )
  })

  it('renders the v2 default base channel immediately with its glow color and dynamic passes', () => {
    const setSize = vi.spyOn(THREE.WebGLRenderTarget.prototype, 'setSize')
    const { pipeline, renderer, scene, camera } = fixture()
    const config: MapEffectConfig = {
      ...MAP_EFFECT_DEFAULTS,
      base: {
        ...MAP_EFFECT_DEFAULTS.base,
        inwardGlow: { ...MAP_EFFECT_DEFAULTS.base.inwardGlow, enabled: false }
      },
      hover: {
        ...MAP_EFFECT_DEFAULTS.hover,
        inwardGlow: { ...MAP_EFFECT_DEFAULTS.hover.inwardGlow, enabled: false }
      },
      quality: { ...MAP_EFFECT_DEFAULTS.quality }
    }
    config.base.outerColor = '#d40000'
    config.base.outerGlowColor = '#00d4ff'
    pipeline.setSize(680, 680, 2)
    pipeline.setConfig(config)

    pipeline.render(scene, camera, 0)

    expect(setSize).toHaveBeenCalledWith(680, 680)
    expect(renderedMaskScenes(renderer, scene)).toHaveLength(1)
    expect(shaderMocks.renderBlur).toHaveBeenCalledTimes(2)
    expect(shaderMocks.renderBlur.mock.calls.map((call) => call[6])).toEqual([4, 4])
    expect(shaderMocks.renderComposite).toHaveBeenCalledWith(
      renderer,
      expect.any(Object),
      expect.objectContaining({ color: '#00d4ff' })
    )
    expect(shaderMocks.renderComposite).toHaveBeenCalledTimes(1)
  })

  it('uses independently configured near and far blur pass counts', () => {
    const { pipeline, renderer, scene, camera } = enabledFixture()
    const config = configWith()
    config.base.outerGlowNearPasses = 3
    config.base.outerGlowFarPasses = 7
    pipeline.setConfig(config)

    pipeline.render(scene, camera, 0)

    expect(shaderMocks.renderBlur.mock.calls.map((call) => call[6])).toEqual([3, 7])
  })

  it('reuses composite inputs across clean renders and refreshes cached values after config and metrics changes', () => {
    const { pipeline, renderer, scene, camera } = enabledFixture()
    pipeline.render(scene, camera, 0)
    const initialInputs = shaderMocks.renderComposite.mock.calls[0][2]
    shaderMocks.renderComposite.mockClear()

    pipeline.render(scene, camera, 0)
    expect(shaderMocks.renderComposite.mock.calls[0][2]).toBe(initialInputs)

    const config = configWith({ baseOpacity: 0.4, baseColor: '#102030' })
    config.base.outerGlowNearOpacityRatio = 0.5
    pipeline.setConfig(config)
    pipeline.render(scene, camera, 0)
    const configInputs = shaderMocks.renderComposite.mock.calls[1][2]
    expect(configInputs).toBe(initialInputs)
    expect(configInputs).toMatchObject({
      color: '#102030',
      nearOpacity: 0.2,
      farOpacity: 0.4
    })

    shaderMocks.renderBlur.mockClear()
    pipeline.setSize(680, 680, 1)
    pipeline.render(scene, camera, 0)
    expect(shaderMocks.renderComposite.mock.calls[2][2]).toBe(initialInputs)
    expect(shaderMocks.renderBlur.mock.calls.map((call) => call[5])).toEqual([9.45, 27])
  })

  it.each([
    ['radius', (config: MapEffectConfig) => { config.base.outerGlowWidth = 70 }],
    ['near radius ratio', (config: MapEffectConfig) => { config.base.outerGlowNearRadiusRatio = 0.5 }],
    ['far radius ratio', (config: MapEffectConfig) => { config.base.outerGlowFarRadiusRatio = 0.8 }],
    ['near passes', (config: MapEffectConfig) => { config.base.outerGlowNearPasses = 3 }],
    ['far passes', (config: MapEffectConfig) => { config.base.outerGlowFarPasses = 5 }]
  ])('rebuilds only the base blur cache when its %s changes', (_change, mutate) => {
    const { pipeline, renderer, scene, camera } = enabledFixture()
    pipeline.render(scene, camera, 0)
    shaderMocks.renderBlur.mockClear()
    renderer.render.mockClear()
    const config = configWith()
    mutate(config)
    pipeline.setConfig(config)
    pipeline.render(scene, camera, 0)

    expect(shaderMocks.renderBlur).toHaveBeenCalledTimes(2)
    expect(renderedMaskScenes(renderer, scene)).toHaveLength(0)
  })

  it.each([
    ['base', 'near radius ratio', (config: MapEffectConfig) => { config.base.inwardGlow.nearRadiusRatio = 0.5 }],
    ['base', 'far radius ratio', (config: MapEffectConfig) => { config.base.inwardGlow.farRadiusRatio = 0.8 }],
    ['base', 'near passes', (config: MapEffectConfig) => { config.base.inwardGlow.nearPasses = 3 }],
    ['base', 'far passes', (config: MapEffectConfig) => { config.base.inwardGlow.farPasses = 5 }],
    ['hover', 'near radius ratio', (config: MapEffectConfig) => { config.hover.inwardGlow.nearRadiusRatio = 0.5 }],
    ['hover', 'far radius ratio', (config: MapEffectConfig) => { config.hover.inwardGlow.farRadiusRatio = 0.8 }],
    ['hover', 'near passes', (config: MapEffectConfig) => { config.hover.inwardGlow.nearPasses = 3 }],
    ['hover', 'far passes', (config: MapEffectConfig) => { config.hover.inwardGlow.farPasses = 5 }]
  ] as const)(
    'rebuilds only the %s inward near/far cache when its %s changes',
    (channel, _change, mutate) => {
      const { pipeline, meshes, renderer, scene, camera } = fixture()
      const config = configWith({
        baseRadius: 0,
        baseOpacity: 0,
        hoverRadius: 0,
        hoverOpacity: 0,
        baseInwardEnabled: true,
        hoverInwardEnabled: true
      })
      pipeline.setConfig(config)
      pipeline.setRegionProgress(meshes[0], 1)
      pipeline.render(scene, camera, 1000)
      const initialOutputs = shaderMocks.renderBlur.mock.calls.map((call) => call[4])
      shaderMocks.renderBlur.mockClear()
      renderer.render.mockClear()

      const next = cloneMapEffectConfig(config)
      mutate(next)
      pipeline.setConfig(next)
      pipeline.render(scene, camera, 1100)

      expect(renderedMaskScenes(renderer, scene)).toHaveLength(0)
      expect(shaderMocks.renderBlur).toHaveBeenCalledTimes(2)
      expect(shaderMocks.renderBlur.mock.calls.map((call) => call[4]))
        .toEqual(channel === 'base' ? initialOutputs.slice(0, 2) : initialOutputs.slice(2, 4))
    }
  )

  it('rebuilds only the hover blur cache when its blur signature changes', () => {
    const { pipeline, meshes, renderer, scene, camera } = fixture()
    const config = configWith({ baseRadius: 0, baseOpacity: 0, hoverRadius: 54, hoverOpacity: 0.23 })
    pipeline.setConfig(config)
    pipeline.setRegionProgress(meshes[0], 1)
    pipeline.render(scene, camera, 0)
    shaderMocks.renderBlur.mockClear()
    renderer.render.mockClear()
    config.hover.glowFarPasses = 6
    pipeline.setConfig(config)
    pipeline.render(scene, camera, 0)

    expect(shaderMocks.renderBlur).toHaveBeenCalledTimes(2)
    expect(renderedMaskScenes(renderer, scene)).toHaveLength(0)
  })

  it('applies the dirty-rule matrix without rebuilding blur caches for composite-only changes', () => {
    const { pipeline, meshes, renderer, scene, camera } = enabledFixture()
    let current = configWith()
    const update = (mutate: (config: MapEffectConfig) => void) => {
      const next: MapEffectConfig = {
        ...current,
        base: { ...current.base },
        hover: { ...current.hover },
        quality: { ...current.quality }
      }
      mutate(next)
      current = next
      pipeline.setConfig(next)
      pipeline.render(scene, camera, 0)
    }

    pipeline.render(scene, camera, 0)
    shaderMocks.renderBlur.mockClear()
    renderer.render.mockClear()

    update((config) => { config.base.outerGlowStrength = 0.4 })
    update((config) => { config.base.outerGlowNearOpacityRatio = 0.6 })
    update((config) => { config.base.outerGlowFarOpacityRatio = 0.7 })
    update((config) => { config.base.outerGlowColor = '#102030' })
    update((config) => { config.base.outerGlowFalloff = 2 })
    update((config) => { config.base.outerGlowEdgeSoftness = 0.4 })
    update((config) => { config.quality.maxAlpha = 0.6 })
    expect(shaderMocks.renderBlur).not.toHaveBeenCalled()
    expect(renderedMaskScenes(renderer, scene)).toHaveLength(0)
    expect(shaderMocks.renderComposite).toHaveBeenLastCalledWith(
      renderer,
      expect.any(Object),
      expect.objectContaining({
        color: '#102030',
        nearOpacity: 0.24,
        farOpacity: 0.28,
        falloff: 2,
        edgeSoftness: 0.4,
        maxAlpha: 0.6
      })
    )

    update((config) => {
      config.base.outerGlowEnabled = true
      config.base.outerGlowNearRadiusRatio = 0.5
    })
    expect(shaderMocks.renderBlur).toHaveBeenCalledTimes(2)
    shaderMocks.renderBlur.mockClear()
    shaderMocks.renderComposite.mockClear()

    update((config) => { config.base.outerGlowEnabled = false })
    expect(shaderMocks.renderBlur).not.toHaveBeenCalled()
    expect(shaderMocks.renderComposite).not.toHaveBeenCalled()

    update((config) => {
      config.base.outerGlowEnabled = true
      config.base.outerGlowNearRadiusRatio = 0.5
    })
    expect(shaderMocks.renderBlur).not.toHaveBeenCalled()
    expect(shaderMocks.renderComposite).toHaveBeenCalledTimes(1)

    update((config) => {
      config.hover.glowWidth = 54
      config.hover.glowStrength = 0.23
    })
    renderer.render.mockClear()
    shaderMocks.renderBlur.mockClear()
    pipeline.setRegionProgress(meshes[0], 1)
    pipeline.markCameraDirty()
    pipeline.render(scene, camera, 0)
    expect(renderedMaskScenes(renderer, scene)).toHaveLength(2)
    expect(shaderMocks.renderBlur).toHaveBeenCalledTimes(4)
  })

  it('resizes existing targets and rebuilds enabled channels when renderScale changes', () => {
    const setSize = vi.spyOn(THREE.WebGLRenderTarget.prototype, 'setSize')
    const { pipeline, meshes, renderer, scene, camera } = fixture()
    pipeline.setSize(680, 680, 2)
    pipeline.setConfig(configWith({
      hoverRadius: 54,
      hoverOpacity: 0.23,
      baseInwardEnabled: true,
      hoverInwardEnabled: true
    }))
    pipeline.setRegionProgress(meshes[0], 1)
    pipeline.render(scene, camera, 1000)
    const initialTargets = shaderMocks.renderBlur.mock.calls.map((call) => call[4])
    shaderMocks.renderBlur.mockClear()
    setSize.mockClear()

    const next = configWith({
      hoverRadius: 54,
      hoverOpacity: 0.23,
      baseInwardEnabled: true,
      hoverInwardEnabled: true,
      renderScale: 0.75
    })
    pipeline.setConfig(next)
    pipeline.render(scene, camera, 1100)

    expect(setSize).toHaveBeenCalledTimes(11)
    expect(setSize).toHaveBeenCalledWith(1020, 1020)
    expect(shaderMocks.renderBlur).toHaveBeenCalledTimes(8)
    expect(shaderMocks.renderBlur.mock.calls.map((call) => call[4])).toEqual(initialTargets)
  })

  it('invalidates both channel masks and blurs for CSS size and DPR changes', () => {
    const { pipeline, meshes, renderer, scene, camera } = fixture()
    pipeline.setSize(680, 680, 2)
    pipeline.setConfig(configWith({
      hoverRadius: 54,
      hoverOpacity: 0.23,
      baseInwardEnabled: true,
      hoverInwardEnabled: true
    }))
    pipeline.setRegionProgress(meshes[0], 1)
    pipeline.render(scene, camera, 1000)
    const initialTargets = shaderMocks.renderBlur.mock.calls.map((call) => call[4])
    renderer.render.mockClear()
    shaderMocks.renderBlur.mockClear()

    pipeline.setSize(681, 680, 2)
    pipeline.render(scene, camera, 1100)
    expect(renderedMaskScenes(renderer, scene)).toHaveLength(2)
    expect(shaderMocks.renderBlur.mock.calls.map((call) => call[4])).toEqual(initialTargets)

    renderer.render.mockClear()
    shaderMocks.renderBlur.mockClear()
    pipeline.setSize(681, 680, 1.5)
    pipeline.render(scene, camera, 1200)
    expect(renderedMaskScenes(renderer, scene)).toHaveLength(2)
    expect(shaderMocks.renderBlur.mock.calls.map((call) => call[4])).toEqual(initialTargets)
  })

  it('invalidates both channel caches when raw CSS size changes without a target resize', () => {
    const setSize = vi.spyOn(THREE.WebGLRenderTarget.prototype, 'setSize')
    const { pipeline, meshes, renderer, scene, camera } = fixture()
    pipeline.setSize(100, 100, 1)
    pipeline.setConfig(configWith({
      hoverRadius: 54,
      hoverOpacity: 0.23,
      baseInwardEnabled: true,
      hoverInwardEnabled: true,
      renderScale: 0.25
    }))
    pipeline.setRegionProgress(meshes[0], 1)
    pipeline.render(scene, camera, 1000)
    const initialTargets = shaderMocks.renderBlur.mock.calls.map((call) => call[4])
    renderer.render.mockClear()
    shaderMocks.renderBlur.mockClear()
    setSize.mockClear()

    pipeline.setSize(101, 100, 1)
    pipeline.render(scene, camera, 1100)

    expect(setSize).not.toHaveBeenCalled()
    expect(renderedMaskScenes(renderer, scene)).toHaveLength(2)
    expect(shaderMocks.renderBlur.mock.calls.map((call) => call[4])).toEqual(initialTargets)
  })

  it('tracks hover threshold crossings without iterating hover states during status or render', () => {
    const { pipeline, meshes, renderer, scene, camera } = fixture()
    pipeline.setConfig(configWith({ baseRadius: 0, baseOpacity: 0, hoverRadius: 54, hoverOpacity: 0.23 }))
    expect(pipeline.getStatus().hoverState).toBe('ready')

    expect(pipeline.setRegionProgress(meshes[0], 0.5)).toBe(true)
    expect(pipeline.getStatus().hoverState).toBe('active')
    expect(pipeline.setRegionProgress(meshes[0], 0.5)).toBe(false)
    expect(pipeline.setRegionProgress(meshes[1], 0.75)).toBe(false)
    expect(pipeline.setRegionProgress(meshes[0], 0.001)).toBe(false)
    expect(pipeline.getStatus().hoverState).toBe('active')

    const values = vi.spyOn(Map.prototype, 'values')
    values.mockClear()
    pipeline.getStatus()
    pipeline.render(scene, camera, 0)
    expect(values).not.toHaveBeenCalled()

    expect(pipeline.setRegionProgress(meshes[1], 0)).toBe(true)
    expect(pipeline.getStatus().hoverState).toBe('ready')
    meshes[0].position.y = 2
    meshes[0].updateMatrixWorld(true)
    expect(pipeline.setRegionProgress(meshes[0], 0.001)).toBe(false)
    expect(pipeline.getStatus().hoverState).toBe('ready')
    pipeline.dispose()
    expect(pipeline.getStatus().hoverState).toBe('ready')
  })

  it('skips manually disabled hover GPU work even with visible progress', () => {
    const { pipeline, meshes, renderer, scene, camera } = fixture()
    const config = configWith({ baseRadius: 0, baseOpacity: 0, hoverRadius: 54, hoverOpacity: 0.23 })
    config.hover.glowEnabled = false
    pipeline.setConfig(config)
    pipeline.setRegionProgress(meshes[0], 1)

    pipeline.render(scene, camera, 0)

    expect(renderer.render).toHaveBeenCalledTimes(1)
    expect(shaderMocks.renderBlur).not.toHaveBeenCalled()
    expect(shaderMocks.renderComposite).not.toHaveBeenCalled()
    expect(pipeline.getStatus().hoverState).toBe('disabled')
  })

  it('reports an effective-zero base channel and reuses its existing blur cache when a ratio returns', () => {
    const { pipeline, renderer, scene, camera } = enabledFixture()
    pipeline.render(scene, camera, 0)
    const zero = configWith()
    zero.base.outerGlowNearOpacityRatio = 0
    zero.base.outerGlowFarOpacityRatio = 0
    pipeline.setConfig(zero)
    renderer.render.mockClear()
    shaderMocks.renderBlur.mockClear()
    shaderMocks.renderComposite.mockClear()

    expect(pipeline.getStatus().baseState).toBe('zero')
    pipeline.render(scene, camera, 0)
    expect(renderedMaskScenes(renderer, scene)).toHaveLength(0)
    expect(shaderMocks.renderBlur).not.toHaveBeenCalled()
    expect(shaderMocks.renderComposite).not.toHaveBeenCalled()

    const restored = configWith()
    restored.base.outerGlowNearOpacityRatio = 0.5
    restored.base.outerGlowFarOpacityRatio = 0
    pipeline.setConfig(restored)
    renderer.render.mockClear()
    expect(pipeline.getStatus().baseState).toBe('enabled')
    pipeline.render(scene, camera, 0)
    expect(renderedMaskScenes(renderer, scene)).toHaveLength(0)
    expect(shaderMocks.renderBlur).not.toHaveBeenCalled()
    expect(shaderMocks.renderComposite).toHaveBeenCalledOnce()
    expect(shaderMocks.renderComposite).toHaveBeenCalledWith(
      renderer,
      expect.any(Object),
      expect.objectContaining({ nearOpacity: 0.115, farOpacity: 0 })
    )
  })

  it('builds the base blur cache once when an effective-zero channel has never rendered', () => {
    const { pipeline, renderer, scene, camera } = fixture()
    const zero = configWith()
    zero.base.outerGlowNearOpacityRatio = 0
    zero.base.outerGlowFarOpacityRatio = 0
    pipeline.setConfig(zero)
    pipeline.render(scene, camera, 0)
    renderer.render.mockClear()
    shaderMocks.renderBlur.mockClear()
    shaderMocks.renderComposite.mockClear()

    const restored = configWith()
    restored.base.outerGlowNearOpacityRatio = 0
    restored.base.outerGlowFarOpacityRatio = 0.5
    pipeline.setConfig(restored)
    expect(pipeline.getStatus().baseState).toBe('enabled')
    pipeline.render(scene, camera, 0)

    expect(renderedMaskScenes(renderer, scene)).toHaveLength(1)
    expect(shaderMocks.renderBlur).toHaveBeenCalledTimes(2)
    expect(shaderMocks.renderComposite).toHaveBeenCalledOnce()
  })

  it('reports effective-zero hover and reuses its existing blur cache while progress stays visible', () => {
    const { pipeline, meshes, renderer, scene, camera } = fixture()
    const active = configWith({ baseRadius: 0, baseOpacity: 0, hoverRadius: 54, hoverOpacity: 0.23 })
    pipeline.setConfig(active)
    pipeline.setRegionProgress(meshes[0], 1)
    pipeline.render(scene, camera, 0)
    const zero = configWith({ baseRadius: 0, baseOpacity: 0, hoverRadius: 54, hoverOpacity: 0.23 })
    zero.hover.glowNearOpacityRatio = 0
    zero.hover.glowFarOpacityRatio = 0
    pipeline.setConfig(zero)
    renderer.render.mockClear()
    shaderMocks.renderBlur.mockClear()
    shaderMocks.renderComposite.mockClear()

    expect(pipeline.getStatus().hoverState).toBe('zero')
    pipeline.render(scene, camera, 0)
    expect(renderedMaskScenes(renderer, scene)).toHaveLength(0)
    expect(shaderMocks.renderBlur).not.toHaveBeenCalled()
    expect(shaderMocks.renderComposite).not.toHaveBeenCalled()

    const restored = configWith({ baseRadius: 0, baseOpacity: 0, hoverRadius: 54, hoverOpacity: 0.23 })
    restored.hover.glowNearOpacityRatio = 0
    restored.hover.glowFarOpacityRatio = 0.5
    pipeline.setConfig(restored)
    renderer.render.mockClear()
    expect(pipeline.getStatus().hoverState).toBe('active')
    pipeline.render(scene, camera, 0)
    expect(renderedMaskScenes(renderer, scene)).toHaveLength(0)
    expect(shaderMocks.renderBlur).not.toHaveBeenCalled()
    expect(shaderMocks.renderComposite).toHaveBeenCalledOnce()
    expect(shaderMocks.renderComposite).toHaveBeenCalledWith(
      renderer,
      expect.any(Object),
      expect.objectContaining({ nearOpacity: 0, farOpacity: 0.115 })
    )
  })

  it('builds the hover blur cache once when visible effective-zero hover has never rendered', () => {
    const { pipeline, meshes, renderer, scene, camera } = fixture()
    const zero = configWith({ baseRadius: 0, baseOpacity: 0, hoverRadius: 54, hoverOpacity: 0.23 })
    zero.hover.glowNearOpacityRatio = 0
    zero.hover.glowFarOpacityRatio = 0
    pipeline.setConfig(zero)
    pipeline.setRegionProgress(meshes[0], 1)
    pipeline.render(scene, camera, 0)
    renderer.render.mockClear()
    shaderMocks.renderBlur.mockClear()
    shaderMocks.renderComposite.mockClear()

    const restored = configWith({ baseRadius: 0, baseOpacity: 0, hoverRadius: 54, hoverOpacity: 0.23 })
    restored.hover.glowNearOpacityRatio = 0.5
    restored.hover.glowFarOpacityRatio = 0
    pipeline.setConfig(restored)
    expect(pipeline.getStatus().hoverState).toBe('active')
    pipeline.render(scene, camera, 0)

    expect(renderedMaskScenes(renderer, scene)).toHaveLength(1)
    expect(shaderMocks.renderBlur).toHaveBeenCalledTimes(2)
    expect(shaderMocks.renderComposite).toHaveBeenCalledOnce()
  })

  it('reports immutable read-only channel status snapshots', () => {
    const { pipeline, meshes } = fixture()
    pipeline.setSize(680, 680, 2)
    pipeline.setConfig(configWith())

    const initial = pipeline.getStatus()
    expect(initial).toEqual({
      targetWidth: 680,
      targetHeight: 680,
      renderScale: 0.5,
      baseState: 'enabled',
      hoverState: 'zero',
      baseInwardState: 'disabled',
      hoverInwardState: 'disabled',
      baseWaveActive: false,
      hoverWaveActive: false
    })
    expect(initial).not.toBe(pipeline.getStatus())

    const ready = configWith({ hoverRadius: 54, hoverOpacity: 0.23 })
    pipeline.setConfig(ready)
    expect(pipeline.getStatus().hoverState).toBe('ready')
    pipeline.setRegionProgress(meshes[0], 1)
    expect(pipeline.getStatus().hoverState).toBe('active')
    ready.hover.glowEnabled = false
    pipeline.setConfig(ready)
    expect(pipeline.getStatus().hoverState).toBe('disabled')
    ready.hover.glowEnabled = true
    ready.hover.glowWidth = 0
    pipeline.setConfig(ready)
    expect(pipeline.getStatus().hoverState).toBe('zero')
    ready.base.outerGlowEnabled = false
    pipeline.setConfig(ready)
    expect(pipeline.getStatus().baseState).toBe('disabled')
  })

  it('exposes separate base and hover status unions', () => {
    expectTypeOf<MapOutwardGlowPipelineStatus['baseState']>()
      .toEqualTypeOf<'enabled' | 'zero' | 'disabled'>()
    expectTypeOf<MapOutwardGlowPipelineStatus['hoverState']>()
      .toEqualTypeOf<'ready' | 'active' | 'zero' | 'disabled'>()
    expectTypeOf<MapOutwardGlowPipelineStatus['baseInwardState']>()
      .toEqualTypeOf<'active' | 'zero' | 'disabled'>()
    expectTypeOf<MapOutwardGlowPipelineStatus['hoverInwardState']>()
      .toEqualTypeOf<'ready' | 'active' | 'zero' | 'disabled'>()
    expectTypeOf<MapOutwardGlowPipelineStatus['baseWaveActive']>().toEqualTypeOf<boolean>()
    expectTypeOf<MapOutwardGlowPipelineStatus['hoverWaveActive']>().toEqualTypeOf<boolean>()
    expectTypeOf<MapOutwardGlowPipeline['render']>().toEqualTypeOf<(
      mainScene: THREE.Scene,
      camera: THREE.Camera,
      nowMs: number
    ) => void>()
  })

  it('disposes construction-owned resources when shader allocation throws', () => {
    const renderer = {} as THREE.WebGLRenderer
    const meshes = [0, 20].map((x) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 2))
      mesh.position.x = x
      mesh.updateMatrixWorld(true)
      return mesh
    })
    const sourceGeometryDisposals = meshes.map((mesh) => vi.spyOn(mesh.geometry, 'dispose'))
    const disposeTarget = vi.spyOn(THREE.WebGLRenderTarget.prototype, 'dispose')
    const disposeMaterial = vi.spyOn(THREE.Material.prototype, 'dispose')
    shaderMocks.create.mockImplementationOnce(() => {
      throw new Error('shader allocation failed')
    })

    expect(() => createMapOutwardGlowPipeline(renderer, meshes))
      .toThrowError('shader allocation failed')

    expect(disposeTarget).toHaveBeenCalledTimes(11)
    expect(disposeMaterial).toHaveBeenCalledTimes(3)
    expect(shaderMocks.dispose).not.toHaveBeenCalled()
    expect(sourceGeometryDisposals.every((spy) => spy.mock.calls.length === 0)).toBe(true)
  })

  it('disposes targets, masks, and outward shaders when inward shader allocation throws', () => {
    const renderer = {} as THREE.WebGLRenderer
    const meshes = [0, 20].map((x) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 2))
      mesh.position.x = x
      mesh.updateMatrixWorld(true)
      return mesh
    })
    const sourceGeometryDisposals = meshes.map((mesh) => vi.spyOn(mesh.geometry, 'dispose'))
    const disposeTarget = vi.spyOn(THREE.WebGLRenderTarget.prototype, 'dispose')
    const disposeMaterial = vi.spyOn(THREE.Material.prototype, 'dispose')
    inwardShaderMocks.create.mockImplementationOnce(() => {
      throw new Error('inward shader allocation failed')
    })

    expect(() => createMapOutwardGlowPipeline(renderer, meshes))
      .toThrowError('inward shader allocation failed')

    expect(disposeTarget).toHaveBeenCalledTimes(11)
    expect(disposeMaterial).toHaveBeenCalledTimes(3)
    expect(shaderMocks.dispose).toHaveBeenCalledOnce()
    expect(inwardShaderMocks.dispose).not.toHaveBeenCalled()
    expect(sourceGeometryDisposals.every((spy) => spy.mock.calls.length === 0)).toBe(true)
  })

  it('skips both glow channels when both widths and opacities are zero', () => {
    const { pipeline, renderer, scene, camera } = fixture()
    pipeline.setConfig(configWith({
      baseRadius: 0,
      baseOpacity: 0,
      hoverRadius: 0,
      hoverOpacity: 0
    }))

    pipeline.render(scene, camera, 0)

    expect(renderer.render).toHaveBeenCalledTimes(1)
    expect(renderer.render).toHaveBeenCalledWith(scene, camera)
    expect(shaderMocks.renderBlur).not.toHaveBeenCalled()
    expect(shaderMocks.renderComposite).not.toHaveBeenCalled()
  })

  it('keeps static and hover styles independent and combines fading regions in one grayscale mask', () => {
    const { pipeline, meshes, renderer, scene, camera } = fixture()
    pipeline.setSize(680, 680, 2)
    pipeline.setConfig(configWith({
      baseRadius: 54,
      baseOpacity: 0.23,
      hoverRadius: 72,
      hoverOpacity: 0.31
    }))
    pipeline.setRegionProgress(meshes[0], 0.75)
    pipeline.setRegionProgress(meshes[1], 0.25)

    pipeline.render(scene, camera, 0)

    expect(shaderMocks.renderBlur).toHaveBeenCalledTimes(4)
    expect(shaderMocks.renderComposite).toHaveBeenNthCalledWith(
      1,
      renderer,
      expect.any(Object),
      expect.objectContaining({ color: '#ffffff', nearOpacity: 0.1909, farOpacity: 0.23 })
    )
    expect(shaderMocks.renderComposite).toHaveBeenNthCalledWith(
      2,
      renderer,
      expect.any(Object),
      expect.objectContaining({ color: '#27a7ff', nearOpacity: 0.2573, farOpacity: 0.31 })
    )
    const [, hoverMaskScene] = renderedMaskScenes(renderer, scene)
    const hoverClones = hoverMaskScene.children as THREE.Mesh[]
    expect((hoverClones[0].material as THREE.MeshBasicMaterial).color.r).toBeCloseTo(0.75)
    expect((hoverClones[1].material as THREE.MeshBasicMaterial).color.r).toBeCloseTo(0.25)
    expect(hoverClones.every((clone) => clone.visible)).toBe(true)
  })

  it('uses one shared ping target and exact B3 near two-pass and far four-pass calls', () => {
    const { pipeline, renderer, scene, camera } = enabledFixture()

    pipeline.render(scene, camera, 0)

    expect(shaderMocks.renderBlur).toHaveBeenCalledTimes(2)
    const [nearCall, farCall] = shaderMocks.renderBlur.mock.calls
    expect(nearCall[0]).toBe(renderer)
    expect(nearCall[2]).toBe(farCall[2])
    expect(nearCall[3]).toBe(farCall[3])
    expect(nearCall[4]).not.toBe(farCall[4])
    expect(nearCall[5]).toBe(18.9)
    expect(nearCall[6]).toBe(2)
    expect(farCall[5]).toBe(54)
    expect(farCall[6]).toBe(4)
  })

  it('shares one ping target across both channels while keeping four cached outputs distinct', () => {
    const { pipeline, meshes, renderer, scene, camera } = fixture()
    pipeline.setConfig(configWith({
      baseRadius: 54,
      baseOpacity: 0.23,
      hoverRadius: 72,
      hoverOpacity: 0.31
    }))
    pipeline.setRegionProgress(meshes[0], 0.5)

    pipeline.render(scene, camera, 0)

    expect(shaderMocks.renderBlur).toHaveBeenCalledTimes(4)
    const firstBlurCalls = shaderMocks.renderBlur.mock.calls
    const sharedPingTarget = firstBlurCalls[0][3]
    expect(firstBlurCalls.every((call) => call[3] === sharedPingTarget)).toBe(true)
    const cachedOutputs = firstBlurCalls.map((call) => call[4])
    expect(new Set(cachedOutputs)).toHaveLength(4)

    renderer.render.mockClear()
    shaderMocks.renderBlur.mockClear()
    pipeline.setRegionProgress(meshes[0], 0.75)
    pipeline.render(scene, camera, 0)

    expect(shaderMocks.renderBlur).toHaveBeenCalledTimes(2)
    expect(shaderMocks.renderBlur.mock.calls.every((call) => call[3] === sharedPingTarget)).toBe(true)
    expect(shaderMocks.renderBlur.mock.calls.map((call) => call[4]))
      .toEqual(cachedOutputs.slice(2))
    expect(renderedMaskScenes(renderer, scene)).toHaveLength(1)
  })

  it('reuses blur results for color and opacity changes and invalidates only the matching radius', () => {
    const { pipeline, renderer, scene, camera } = enabledFixture()
    pipeline.render(scene, camera, 0)
    const firstBlurCount = shaderMocks.renderBlur.mock.calls.length
    const firstMaskRenderCount = renderedMaskScenes(renderer, scene).length

    pipeline.setConfig(configWith({ baseOpacity: 0.4, baseColor: '#112233' }))
    pipeline.render(scene, camera, 0)
    expect(shaderMocks.renderBlur).toHaveBeenCalledTimes(firstBlurCount)
    expect(renderedMaskScenes(renderer, scene)).toHaveLength(firstMaskRenderCount)
    expect(shaderMocks.renderComposite).toHaveBeenLastCalledWith(
      renderer,
      expect.any(Object),
      expect.objectContaining({ color: '#112233', nearOpacity: 0.332, farOpacity: 0.4 })
    )

    pipeline.setConfig(configWith({ baseRadius: 80, baseOpacity: 0.4, baseColor: '#112233' }))
    pipeline.render(scene, camera, 0)
    expect(shaderMocks.renderBlur).toHaveBeenCalledTimes(firstBlurCount + 2)
    expect(renderedMaskScenes(renderer, scene)).toHaveLength(firstMaskRenderCount)
  })

  it('invalidates both mask and blur caches on camera changes but not on unchanged sizes', () => {
    const { pipeline, meshes, renderer, scene, camera } = fixture()
    pipeline.setSize(680, 680, 2)
    pipeline.setConfig(configWith({
      hoverRadius: 54,
      hoverOpacity: 0.23,
      baseInwardEnabled: true,
      hoverInwardEnabled: true
    }))
    pipeline.setRegionProgress(meshes[0], 1)
    pipeline.render(scene, camera, 1000)
    const initialTargets = shaderMocks.renderBlur.mock.calls.map((call) => call[4])
    renderer.render.mockClear()
    shaderMocks.renderBlur.mockClear()

    pipeline.setSize(680, 680, 2)
    pipeline.render(scene, camera, 1100)
    expect(renderedMaskScenes(renderer, scene)).toHaveLength(0)
    expect(shaderMocks.renderBlur).not.toHaveBeenCalled()

    renderer.render.mockClear()
    pipeline.markCameraDirty()
    pipeline.render(scene, camera, 1200)
    expect(renderedMaskScenes(renderer, scene)).toHaveLength(2)
    expect(shaderMocks.renderBlur.mock.calls.map((call) => call[4])).toEqual(initialTargets)
  })

  it('does not redraw hover for unchanged progress and does redraw for value or matrix changes', () => {
    const { pipeline, meshes, renderer, scene, camera } = fixture()
    pipeline.setConfig(configWith({
      baseRadius: 0,
      baseOpacity: 0,
      hoverRadius: 54,
      hoverOpacity: 0.23
    }))
    pipeline.setRegionProgress(meshes[0], 0.5)
    pipeline.render(scene, camera, 0)
    renderer.render.mockClear()
    shaderMocks.renderBlur.mockClear()

    pipeline.setRegionProgress(meshes[0], 0.5)
    pipeline.render(scene, camera, 0)
    expect(renderedMaskScenes(renderer, scene)).toHaveLength(0)
    expect(shaderMocks.renderBlur).not.toHaveBeenCalled()

    renderer.render.mockClear()
    pipeline.setRegionProgress(meshes[0], 0.75)
    pipeline.render(scene, camera, 0)
    expect(renderedMaskScenes(renderer, scene)).toHaveLength(1)
    expect(shaderMocks.renderBlur).toHaveBeenCalledTimes(2)

    renderer.render.mockClear()
    shaderMocks.renderBlur.mockClear()
    meshes[0].position.y = 2
    meshes[0].updateMatrixWorld(true)
    pipeline.setRegionProgress(meshes[0], 0.75)
    pipeline.render(scene, camera, 0)
    expect(renderedMaskScenes(renderer, scene)).toHaveLength(1)
    expect(shaderMocks.renderBlur).toHaveBeenCalledTimes(2)
  })

  it('disables hover when all region progress is at or below the visibility threshold', () => {
    const { pipeline, meshes, renderer, scene, camera } = fixture()
    pipeline.setConfig(configWith({
      baseRadius: 0,
      baseOpacity: 0,
      hoverRadius: 54,
      hoverOpacity: 0.23
    }))
    pipeline.setRegionProgress(meshes[0], 0.001)
    pipeline.setRegionProgress(meshes[1], -1)

    pipeline.render(scene, camera, 0)

    expect(renderer.render).toHaveBeenCalledTimes(1)
    expect(shaderMocks.renderBlur).not.toHaveBeenCalled()
    expect(shaderMocks.renderComposite).not.toHaveBeenCalled()
  })

  it('resizes all targets in physical half-resolution pixels only when safe dimensions change', () => {
    const setSize = vi.spyOn(THREE.WebGLRenderTarget.prototype, 'setSize')
    const { pipeline } = fixture()

    pipeline.setSize(680, 480, 1.25)
    expect(setSize).toHaveBeenCalledTimes(11)
    expect(setSize).toHaveBeenCalledWith(425, 300)
    setSize.mockClear()
    pipeline.setSize(680, 480, 1.25)
    expect(setSize).not.toHaveBeenCalled()

    pipeline.setSize(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY)
    expect(setSize).toHaveBeenCalledTimes(11)
    for (const [width, height] of setSize.mock.calls) {
      expect(Number.isFinite(width)).toBe(true)
      expect(Number.isFinite(height)).toBe(true)
      expect(width).toBeGreaterThanOrEqual(1)
      expect(height).toBeGreaterThanOrEqual(1)
    }
  })

  it('does not issue shader calls for invalid configuration values', () => {
    const { pipeline, meshes, renderer, scene, camera } = fixture()
    pipeline.setConfig(configWith({
      baseRadius: Number.POSITIVE_INFINITY,
      baseOpacity: Number.NaN,
      hoverRadius: Number.NaN,
      hoverOpacity: Number.POSITIVE_INFINITY
    }))
    pipeline.setRegionProgress(meshes[0], Number.POSITIVE_INFINITY)

    pipeline.render(scene, camera, 0)

    expect(renderer.render).toHaveBeenCalledTimes(1)
    expect(shaderMocks.renderBlur).not.toHaveBeenCalled()
    expect(shaderMocks.renderComposite).not.toHaveBeenCalled()
  })

  it('freezes static clone matrices and refreshes hover clone matrices after lift', () => {
    const { pipeline, meshes, renderer, scene, camera } = fixture()
    pipeline.setSize(680, 680, 2)
    pipeline.setConfig(configWith({ hoverRadius: 54, hoverOpacity: 0.23 }))
    pipeline.setRegionProgress(meshes[0], 0.5)
    pipeline.render(scene, camera, 0)
    const [staticMaskScene] = renderedMaskScenes(renderer, scene)
    const initialStaticMatrix = staticMaskScene.children[0].matrix.clone()

    meshes[0].position.y = 2
    meshes[0].updateMatrixWorld(true)
    pipeline.setRegionProgress(meshes[0], 0.75)
    renderer.render.mockClear()
    pipeline.render(scene, camera, 0)
    const [hoverMaskScene] = renderedMaskScenes(renderer, scene)

    expect(hoverMaskScene.children[0].matrix.equals(meshes[0].matrixWorld)).toBe(true)
    expect(staticMaskScene.children[0].matrix.equals(initialStaticMatrix)).toBe(true)
    expect(staticMaskScene.children[0].matrixAutoUpdate).toBe(false)
    expect(hoverMaskScene.children[0].matrixAutoUpdate).toBe(false)
  })

  it('renders the main scene once between dirty masks and static-then-hover composites', () => {
    const { pipeline, meshes, renderer, scene, camera } = fixture()
    pipeline.setConfig(configWith({ hoverRadius: 54, hoverOpacity: 0.23 }))
    pipeline.setRegionProgress(meshes[0], 1)

    pipeline.render(scene, camera, 0)

    const mainRender = renderer.render.mock.calls.find(([rendered]) => rendered === scene)
    expect(mainRender).toEqual([scene, camera])
    expect(renderer.render.mock.calls.filter(([rendered]) => rendered === scene)).toHaveLength(1)
    expect(renderer.setRenderTarget).toHaveBeenCalledWith(null)
    expect(renderer.clear).toHaveBeenCalledTimes(3)
    expect(renderer.render.mock.invocationCallOrder.at(-1))
      .toBeLessThan(shaderMocks.renderComposite.mock.invocationCallOrder[0])
    expect(shaderMocks.renderComposite.mock.invocationCallOrder[0])
      .toBeLessThan(shaderMocks.renderComposite.mock.invocationCallOrder[1])
  })

  it('restores the previous render target and autoClear even when rendering throws', () => {
    const previousTarget = new THREE.WebGLRenderTarget(8, 8)
    const { pipeline, renderer, scene, camera } = fixture(previousTarget)
    pipeline.setConfig(configWith())
    renderer.render.mockImplementationOnce(() => {
      expect(renderer.autoClear).toBe(false)
      throw new Error('mask failed')
    })

    expect(() => pipeline.render(scene, camera, 0)).toThrowError('mask failed')
    expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(previousTarget)
    expect(renderer.autoClear).toBe(true)
    previousTarget.dispose()
  })

  it('disposes only owned targets, mask materials, and shared shader resources once', () => {
    const disposeTarget = vi.spyOn(THREE.WebGLRenderTarget.prototype, 'dispose')
    const disposeMaterial = vi.spyOn(THREE.Material.prototype, 'dispose')
    const { pipeline, meshes } = fixture()
    const sourceGeometryDisposals = meshes.map((mesh) => vi.spyOn(mesh.geometry, 'dispose'))

    pipeline.dispose()
    const targetsAfterFirstDispose = disposeTarget.mock.calls.length
    const materialsAfterFirstDispose = disposeMaterial.mock.calls.length
    expect(targetsAfterFirstDispose).toBe(11)
    expect(materialsAfterFirstDispose).toBe(3)
    expect(shaderMocks.dispose).toHaveBeenCalledOnce()
    expect(inwardShaderMocks.dispose).toHaveBeenCalledOnce()
    expect(sourceGeometryDisposals.every((spy) => spy.mock.calls.length === 0)).toBe(true)

    pipeline.dispose()
    expect(disposeTarget).toHaveBeenCalledTimes(targetsAfterFirstDispose)
    expect(disposeMaterial).toHaveBeenCalledTimes(materialsAfterFirstDispose)
    expect(shaderMocks.dispose).toHaveBeenCalledOnce()
    expect(inwardShaderMocks.dispose).toHaveBeenCalledOnce()
  })
})
