import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAP_EFFECT_DEFAULTS, type MapEffectConfig } from './mapEffectConfig'
import { createMapOutwardGlowPipeline } from './mapOutwardGlowPipeline'

const shaderMocks = vi.hoisted(() => ({
  renderBlur: vi.fn(),
  renderComposite: vi.fn(),
  dispose: vi.fn()
}))

vi.mock('./mapOutwardGlowShaders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./mapOutwardGlowShaders')>()
  return {
    ...actual,
    renderSeparableBlur: shaderMocks.renderBlur,
    renderOutwardComposite: shaderMocks.renderComposite,
    disposeGlowShaderResources: shaderMocks.dispose
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
  hoverColor = '#27a7ff'
}: {
  baseRadius?: number
  baseOpacity?: number
  hoverRadius?: number
  hoverOpacity?: number
  baseColor?: string
  hoverColor?: string
} = {}): MapEffectConfig {
  return {
    ...MAP_EFFECT_DEFAULTS,
    base: {
      ...MAP_EFFECT_DEFAULTS.base,
      outerColor: baseColor,
      outerGlowWidth: baseRadius,
      outerGlowStrength: baseOpacity
    },
    hover: {
      ...MAP_EFFECT_DEFAULTS.hover,
      glowColor: hoverColor,
      glowWidth: hoverRadius,
      glowStrength: hoverOpacity
    }
  }
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
  shaderMocks.renderBlur.mockReset()
  shaderMocks.renderComposite.mockReset()
  shaderMocks.dispose.mockReset()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('mapOutwardGlowPipeline', () => {
  it('skips both glow channels when approved defaults keep radius and opacity at zero', () => {
    const { pipeline, renderer, scene, camera } = fixture()
    pipeline.setConfig(MAP_EFFECT_DEFAULTS)

    pipeline.render(scene, camera)

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

    pipeline.render(scene, camera)

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

    pipeline.render(scene, camera)

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

  it('reuses blur results for color and opacity changes and invalidates only the matching radius', () => {
    const { pipeline, renderer, scene, camera } = enabledFixture()
    pipeline.render(scene, camera)
    const firstBlurCount = shaderMocks.renderBlur.mock.calls.length
    const firstMaskRenderCount = renderedMaskScenes(renderer, scene).length

    pipeline.setConfig(configWith({ baseOpacity: 0.4, baseColor: '#112233' }))
    pipeline.render(scene, camera)
    expect(shaderMocks.renderBlur).toHaveBeenCalledTimes(firstBlurCount)
    expect(renderedMaskScenes(renderer, scene)).toHaveLength(firstMaskRenderCount)
    expect(shaderMocks.renderComposite).toHaveBeenLastCalledWith(
      renderer,
      expect.any(Object),
      expect.objectContaining({ color: '#112233', nearOpacity: 0.332, farOpacity: 0.4 })
    )

    pipeline.setConfig(configWith({ baseRadius: 80, baseOpacity: 0.4, baseColor: '#112233' }))
    pipeline.render(scene, camera)
    expect(shaderMocks.renderBlur).toHaveBeenCalledTimes(firstBlurCount + 2)
    expect(renderedMaskScenes(renderer, scene)).toHaveLength(firstMaskRenderCount)
  })

  it('invalidates both mask and blur caches on camera changes but not on unchanged sizes', () => {
    const { pipeline, renderer, scene, camera } = enabledFixture()
    pipeline.render(scene, camera)
    renderer.render.mockClear()
    shaderMocks.renderBlur.mockClear()

    pipeline.setSize(680, 680, 2)
    pipeline.render(scene, camera)
    expect(renderedMaskScenes(renderer, scene)).toHaveLength(0)
    expect(shaderMocks.renderBlur).not.toHaveBeenCalled()

    renderer.render.mockClear()
    pipeline.markCameraDirty()
    pipeline.render(scene, camera)
    expect(renderedMaskScenes(renderer, scene)).toHaveLength(1)
    expect(shaderMocks.renderBlur).toHaveBeenCalledTimes(2)
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
    pipeline.render(scene, camera)
    renderer.render.mockClear()
    shaderMocks.renderBlur.mockClear()

    pipeline.setRegionProgress(meshes[0], 0.5)
    pipeline.render(scene, camera)
    expect(renderedMaskScenes(renderer, scene)).toHaveLength(0)
    expect(shaderMocks.renderBlur).not.toHaveBeenCalled()

    renderer.render.mockClear()
    pipeline.setRegionProgress(meshes[0], 0.75)
    pipeline.render(scene, camera)
    expect(renderedMaskScenes(renderer, scene)).toHaveLength(1)
    expect(shaderMocks.renderBlur).toHaveBeenCalledTimes(2)

    renderer.render.mockClear()
    shaderMocks.renderBlur.mockClear()
    meshes[0].position.y = 2
    meshes[0].updateMatrixWorld(true)
    pipeline.setRegionProgress(meshes[0], 0.75)
    pipeline.render(scene, camera)
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

    pipeline.render(scene, camera)

    expect(renderer.render).toHaveBeenCalledTimes(1)
    expect(shaderMocks.renderBlur).not.toHaveBeenCalled()
    expect(shaderMocks.renderComposite).not.toHaveBeenCalled()
  })

  it('resizes all targets in physical half-resolution pixels only when safe dimensions change', () => {
    const setSize = vi.spyOn(THREE.WebGLRenderTarget.prototype, 'setSize')
    const { pipeline } = fixture()

    pipeline.setSize(680, 480, 1.25)
    expect(setSize).toHaveBeenCalledTimes(7)
    expect(setSize).toHaveBeenCalledWith(425, 300)
    setSize.mockClear()
    pipeline.setSize(680, 480, 1.25)
    expect(setSize).not.toHaveBeenCalled()

    pipeline.setSize(Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY)
    expect(setSize).toHaveBeenCalledTimes(7)
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

    pipeline.render(scene, camera)

    expect(renderer.render).toHaveBeenCalledTimes(1)
    expect(shaderMocks.renderBlur).not.toHaveBeenCalled()
    expect(shaderMocks.renderComposite).not.toHaveBeenCalled()
  })

  it('freezes static clone matrices and refreshes hover clone matrices after lift', () => {
    const { pipeline, meshes, renderer, scene, camera } = fixture()
    pipeline.setSize(680, 680, 2)
    pipeline.setConfig(configWith({ hoverRadius: 54, hoverOpacity: 0.23 }))
    pipeline.setRegionProgress(meshes[0], 0.5)
    pipeline.render(scene, camera)
    const [staticMaskScene] = renderedMaskScenes(renderer, scene)
    const initialStaticMatrix = staticMaskScene.children[0].matrix.clone()

    meshes[0].position.y = 2
    meshes[0].updateMatrixWorld(true)
    pipeline.setRegionProgress(meshes[0], 0.75)
    renderer.render.mockClear()
    pipeline.render(scene, camera)
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

    pipeline.render(scene, camera)

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
    renderer.autoClear = false
    renderer.render.mockImplementationOnce(() => {
      throw new Error('mask failed')
    })

    expect(() => pipeline.render(scene, camera)).toThrowError('mask failed')
    expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(previousTarget)
    expect(renderer.autoClear).toBe(false)
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
    expect(targetsAfterFirstDispose).toBe(7)
    expect(materialsAfterFirstDispose).toBe(3)
    expect(shaderMocks.dispose).toHaveBeenCalledOnce()
    expect(sourceGeometryDisposals.every((spy) => spy.mock.calls.length === 0)).toBe(true)

    pipeline.dispose()
    expect(disposeTarget).toHaveBeenCalledTimes(targetsAfterFirstDispose)
    expect(disposeMaterial).toHaveBeenCalledTimes(materialsAfterFirstDispose)
    expect(shaderMocks.dispose).toHaveBeenCalledOnce()
  })
})
