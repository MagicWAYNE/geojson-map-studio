// @vitest-environment happy-dom
import { createApp, nextTick, reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { MAP_EFFECT_DEFAULTS, type MapEffectConfig } from './mapEffectConfig'

const apiMocks = vi.hoisted(() => ({ getDistrictMapData: vi.fn() }))
const geometryMocks = vi.hoisted(() => ({ parseSvgRegions: vi.fn() }))
const sceneSetupMocks = vi.hoisted(() => ({
  controlsDispose: vi.fn(),
  controlListeners: new Map<string, () => void>()
}))
const threeMocks = vi.hoisted(() => ({ createRenderer: vi.fn() }))
const mapDebugMocks = vi.hoisted(() => ({ effect: null as MapEffectConfig | null }))
const pipelineMocks = vi.hoisted(() => ({
  create: vi.fn(),
  instance: {
    setSize: vi.fn(),
    setConfig: vi.fn(),
    setRegionProgress: vi.fn(),
    markCameraDirty: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn()
  }
}))

const stopEffectWatch = vi.fn()
const watchMapEffectConfig = vi.fn<(effect: MapEffectConfig, apply: () => void) => () => void>(
  () => stopEffectWatch
)
const applyMapEffectConfig = vi.fn()

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>()
  return {
    ...actual,
    WebGLRenderer: class {
      constructor(...args: unknown[]) {
        return threeMocks.createRenderer(...args)
      }
    }
  }
})
vi.mock('./mapEffectWatcher', () => ({ watchMapEffectConfig }))
vi.mock('./mapEffectRuntime', () => ({ applyMapEffectConfig }))
vi.mock('./mapOutwardGlowPipeline', () => ({
  createMapOutwardGlowPipeline: pipelineMocks.create
}))
vi.mock('@/api', () => ({ getDistrictMapData: apiMocks.getDistrictMapData }))
vi.mock('three/examples/jsm/controls/OrbitControls.js', () => ({
  OrbitControls: class {
    target = { x: 0, y: 0, z: 0, set: vi.fn() }
    addEventListener = vi.fn((type: string, callback: () => void) => {
      sceneSetupMocks.controlListeners.set(type, callback)
    })
    update = vi.fn()
    dispose = sceneSetupMocks.controlsDispose
  }
}))
vi.mock('./mapGeometry', async (importOriginal) => ({
  ...await importOriginal<typeof import('./mapGeometry')>(),
  parseSvgRegions: geometryMocks.parseSvgRegions
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/composables/useMapDebug', () => ({
  useMapDebug: () => {
    const effect = reactive<MapEffectConfig>({
      ...MAP_EFFECT_DEFAULTS,
      base: { ...MAP_EFFECT_DEFAULTS.base },
      hover: { ...MAP_EFFECT_DEFAULTS.hover }
    })
    mapDebugMocks.effect = effect
    return { cameraView: { value: '' }, effect }
  }
}))

afterEach(() => {
  watchMapEffectConfig.mockClear()
  stopEffectWatch.mockClear()
  applyMapEffectConfig.mockClear()
  sceneSetupMocks.controlsDispose.mockClear()
  sceneSetupMocks.controlListeners.clear()
  threeMocks.createRenderer.mockClear()
  pipelineMocks.create.mockReset()
  Object.values(pipelineMocks.instance).forEach((mock) => mock.mockReset())
  mapDebugMocks.effect = null
  document.body.replaceChildren()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  pipelineMocks.create.mockReturnValue(pipelineMocks.instance)
  apiMocks.getDistrictMapData.mockImplementation(() => new Promise(() => {}))
  geometryMocks.parseSvgRegions.mockReturnValue([])
  vi.spyOn(THREE.TextureLoader.prototype, 'loadAsync').mockImplementation(() => new Promise(() => {}))
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

async function mountInitializedMap() {
  let resizeCallback: ResizeObserverCallback = () => undefined
  let frameCallback: FrameRequestCallback = () => undefined
  let pixelRatio = 2
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(680)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(680)
  vi.stubGlobal('devicePixelRatio', 2)
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: ResizeObserverCallback) { resizeCallback = callback }
    observe = vi.fn()
    disconnect = vi.fn()
  })
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    frameCallback = callback
    return 1
  }))
  const renderer = {
    domElement: document.createElement('canvas'),
    setSize: vi.fn(),
    setPixelRatio: vi.fn((next: number) => { pixelRatio = next }),
    getPixelRatio: vi.fn(() => pixelRatio),
    render: vi.fn(),
    dispose: vi.fn()
  }
  threeMocks.createRenderer.mockReturnValue(renderer)
  pipelineMocks.create.mockReturnValue(pipelineMocks.instance)
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    status: 200,
    text: vi.fn().mockResolvedValue('<svg/>')
  } as unknown as Response)
  apiMocks.getDistrictMapData.mockResolvedValue([])
  geometryMocks.parseSvgRegions.mockReturnValue([{
    name: '渝中区',
    outers: [{ ring: [[0, 0], [100, 0], [0, 100]], holes: [] }]
  }])
  const texture = new THREE.Texture(document.createElement('img'))
  texture.image.width = 100
  texture.image.height = 100
  vi.mocked(THREE.TextureLoader.prototype.loadAsync).mockResolvedValue(texture)

  const { default: ChongqingMap3D } = await import('./ChongqingMap3D.vue')
  const root = document.createElement('div')
  const app = createApp(ChongqingMap3D)
  app.mount(root)
  await vi.waitFor(() => expect(requestAnimationFrame).toHaveBeenCalled())
  return {
    app,
    root,
    renderer,
    runFrame: (now = 16) => frameCallback(now),
    runResize: () => resizeCallback([], {} as ResizeObserver)
  }
}

describe('ChongqingMap3D effect wiring', () => {
  it('publishes the lifted region world matrix with its eased hover progress', async () => {
    const mounted = await mountInitializedMap()
    const [, meshes] = pipelineMocks.create.mock.calls[0]
    const mesh = meshes[0]
    const initialMatrix = mesh.matrixWorld.clone()
    let matrixAtProgress: THREE.Matrix4 | null = null
    let forwardedProgress = 0
    pipelineMocks.instance.setRegionProgress.mockImplementation((source, eased) => {
      if (eased <= 0) return
      matrixAtProgress = source.matrixWorld.clone()
      forwardedProgress = eased
    })
    mapDebugMocks.effect!.hover.lift = 12
    vi.spyOn(THREE.Raycaster.prototype, 'intersectObjects').mockReturnValue([
      { object: mesh } as THREE.Intersection
    ])

    mounted.root.querySelector('.cq-map3d')!.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 10,
      clientY: 10
    }))
    mounted.runFrame(16)
    mounted.runFrame(32)

    expect(forwardedProgress).toBeGreaterThan(0)
    expect(mesh.parent!.position.z).toBeGreaterThan(0)
    mesh.parent!.updateMatrixWorld(true)
    expect(matrixAtProgress!.equals(initialMatrix)).toBe(false)
    expect(matrixAtProgress!.equals(mesh.matrixWorld)).toBe(true)

    mounted.app.unmount()
  })

  it('wires config, camera, resize, render, and dispose to the pipeline', async () => {
    const mounted = await mountInitializedMap()
    expect(pipelineMocks.create).toHaveBeenCalledWith(
      mounted.renderer,
      expect.arrayContaining([expect.any(THREE.Mesh)])
    )
    const [, meshes] = pipelineMocks.create.mock.calls[0]
    expect(meshes[0].matrixWorld.equals(new THREE.Matrix4())).toBe(false)
    expect(mounted.renderer.setPixelRatio.mock.invocationCallOrder[0])
      .toBeLessThan(pipelineMocks.create.mock.invocationCallOrder[0])

    pipelineMocks.instance.setConfig.mockClear()
    const [, apply] = watchMapEffectConfig.mock.calls[0]
    apply()
    expect(pipelineMocks.instance.setConfig).toHaveBeenCalledWith(expect.any(Object))

    pipelineMocks.instance.markCameraDirty.mockClear()
    sceneSetupMocks.controlListeners.get('change')?.()
    expect(pipelineMocks.instance.markCameraDirty).toHaveBeenCalled()

    pipelineMocks.instance.setSize.mockClear()
    mounted.runResize()
    expect(pipelineMocks.instance.setSize).toHaveBeenLastCalledWith(680, 680, 2)
    const lastPixelRatioOrder = mounted.renderer.setPixelRatio.mock.invocationCallOrder.at(-1)!
    const lastPipelineSizeOrder = pipelineMocks.instance.setSize.mock.invocationCallOrder.at(-1)!
    expect(lastPixelRatioOrder).toBeLessThan(lastPipelineSizeOrder)

    mounted.runFrame()
    expect(pipelineMocks.instance.render)
      .toHaveBeenCalledWith(expect.any(THREE.Scene), expect.any(THREE.Camera))
    expect(mounted.renderer.render).not.toHaveBeenCalled()

    mounted.app.unmount()
    expect(pipelineMocks.instance.dispose).toHaveBeenCalledTimes(1)
    expect(pipelineMocks.instance.dispose.mock.invocationCallOrder[0])
      .toBeLessThan(mounted.renderer.dispose.mock.invocationCallOrder[0])
  })

  it('resizes pipeline targets on a window-only DPR change', async () => {
    const addResizeListener = vi.spyOn(window, 'addEventListener')
    const removeResizeListener = vi.spyOn(window, 'removeEventListener')
    const mounted = await mountInitializedMap()
    const resizeHandler = addResizeListener.mock.calls.find(([type]) => type === 'resize')?.[1]
    expect(resizeHandler).toEqual(expect.any(Function))
    mounted.renderer.setPixelRatio.mockClear()
    pipelineMocks.instance.setSize.mockClear()
    vi.stubGlobal('devicePixelRatio', 1.25)

    ;(resizeHandler as EventListener)(new Event('resize'))

    expect(mounted.renderer.setPixelRatio).toHaveBeenCalledWith(1.25)
    expect(pipelineMocks.instance.setSize).toHaveBeenCalledWith(680, 680, 1.25)
    expect(mounted.renderer.setPixelRatio.mock.invocationCallOrder[0])
      .toBeLessThan(pipelineMocks.instance.setSize.mock.invocationCallOrder[0])

    mounted.app.unmount()
    expect(removeResizeListener).toHaveBeenCalledWith('resize', resizeHandler)
  })

  it('forwards each region eased progress to the outward glow pipeline', async () => {
    const mounted = await mountInitializedMap()
    pipelineMocks.instance.setRegionProgress.mockClear()
    const [, apply] = watchMapEffectConfig.mock.calls[0]
    apply()

    expect(pipelineMocks.instance.setRegionProgress)
      .toHaveBeenCalledWith(expect.any(THREE.Mesh), expect.any(Number))

    mounted.app.unmount()
  })

  it('keeps direct scene rendering when the glow pipeline cannot initialize', async () => {
    pipelineMocks.create.mockImplementationOnce(() => { throw new Error('shader unavailable') })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const mounted = await mountInitializedMap()

    mounted.runFrame()

    expect(warn).toHaveBeenCalledWith(
      '外扩柔光初始化失败，保留清晰边界',
      expect.any(Error)
    )
    expect(mounted.renderer.render)
      .toHaveBeenCalledWith(expect.any(THREE.Scene), expect.any(THREE.Camera))
    expect(warn).toHaveBeenCalledTimes(1)
    mounted.app.unmount()
  })

  it('disposes an unpublished pipeline once when its setup fails', async () => {
    pipelineMocks.instance.setConfig.mockImplementationOnce(() => {
      throw new Error('pipeline setup failed')
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const mounted = await mountInitializedMap()

    mounted.runFrame()

    expect(warn).toHaveBeenCalledWith(
      '外扩柔光初始化失败，保留清晰边界',
      expect.any(Error)
    )
    expect(pipelineMocks.instance.dispose).toHaveBeenCalledTimes(1)
    expect(mounted.renderer.render)
      .toHaveBeenCalledWith(expect.any(THREE.Scene), expect.any(THREE.Camera))

    mounted.app.unmount()
    expect(pipelineMocks.instance.dispose).toHaveBeenCalledTimes(1)
  })

  it('detaches a pipeline that fails at runtime and keeps current and later frames rendering', async () => {
    pipelineMocks.instance.render.mockImplementationOnce(() => {
      throw new Error('runtime glow failed')
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const mounted = await mountInitializedMap()

    expect(() => mounted.runFrame(16)).not.toThrow()

    expect(pipelineMocks.instance.render).toHaveBeenCalledTimes(1)
    expect(pipelineMocks.instance.dispose).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(
      '外扩柔光运行失败，已关闭柔光并保留清晰边界',
      expect.any(Error)
    )
    expect(warn).toHaveBeenCalledTimes(1)
    expect(mounted.renderer.render)
      .toHaveBeenCalledWith(expect.any(THREE.Scene), expect.any(THREE.Camera))

    mounted.runFrame(32)

    expect(pipelineMocks.instance.render).toHaveBeenCalledTimes(1)
    expect(pipelineMocks.instance.dispose).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(mounted.renderer.render).toHaveBeenCalledTimes(2)

    mounted.app.unmount()
    expect(pipelineMocks.instance.dispose).toHaveBeenCalledTimes(1)
  })

  it('routes watcher callbacks to the effect runtime and stops the watcher on unmount', async () => {
    const { default: ChongqingMap3D } = await import('./ChongqingMap3D.vue')
    const root = document.createElement('div')
    const app = createApp(ChongqingMap3D)

    app.mount(root)
    await nextTick()

    expect(watchMapEffectConfig).toHaveBeenCalledTimes(1)
    expect(watchMapEffectConfig).toHaveBeenCalledWith(
      expect.objectContaining({ base: expect.any(Object), hover: expect.any(Object) }),
      expect.any(Function)
    )

    const [, apply] = watchMapEffectConfig.mock.calls[0]
    apply()

    expect(applyMapEffectConfig).toHaveBeenCalledTimes(1)

    app.unmount()

    expect(stopEffectWatch).toHaveBeenCalledTimes(1)
  })

  it('does not continue async initialization and disposes a texture resolved after unmount', async () => {
    const fetchResult = deferred<Response>()
    const dataResult = deferred<Awaited<ReturnType<typeof apiMocks.getDistrictMapData>>>()
    const textureResult = deferred<THREE.Texture<HTMLImageElement>>()
    const response = {
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue('<svg xmlns="http://www.w3.org/2000/svg"/>')
    } as unknown as Response
    const texture = new THREE.Texture(document.createElement('img'))
    const disposeTexture = vi.spyOn(texture, 'dispose')
    vi.mocked(fetch).mockReturnValue(fetchResult.promise)
    apiMocks.getDistrictMapData.mockReturnValue(dataResult.promise)
    vi.mocked(THREE.TextureLoader.prototype.loadAsync).mockReturnValue(textureResult.promise)

    const { default: ChongqingMap3D } = await import('./ChongqingMap3D.vue')
    const root = document.createElement('div')
    const app = createApp(ChongqingMap3D)
    app.mount(root)
    await nextTick()
    app.unmount()

    fetchResult.resolve(response)
    dataResult.resolve([])
    textureResult.resolve(texture)
    await Promise.resolve()
    await Promise.resolve()
    await nextTick()

    expect(response.text).not.toHaveBeenCalled()
    expect(geometryMocks.parseSvgRegions).not.toHaveBeenCalled()
    expect(requestAnimationFrame).not.toHaveBeenCalled()
    expect(disposeTexture).toHaveBeenCalledTimes(1)
  })

  it('disposes a texture that resolves before another initialization request rejects', async () => {
    const fetchResult = deferred<Response>()
    const dataResult = deferred<Awaited<ReturnType<typeof apiMocks.getDistrictMapData>>>()
    const textureResult = deferred<THREE.Texture<HTMLImageElement>>()
    const texture = new THREE.Texture(document.createElement('img'))
    const disposeTexture = vi.spyOn(texture, 'dispose')
    vi.mocked(fetch).mockReturnValue(fetchResult.promise)
    apiMocks.getDistrictMapData.mockReturnValue(dataResult.promise)
    vi.mocked(THREE.TextureLoader.prototype.loadAsync).mockReturnValue(textureResult.promise)

    const { default: ChongqingMap3D } = await import('./ChongqingMap3D.vue')
    const root = document.createElement('div')
    const app = createApp(ChongqingMap3D)
    app.mount(root)
    await nextTick()

    textureResult.resolve(texture)
    await Promise.resolve()
    dataResult.reject(new Error('district data failed'))
    await Promise.resolve()
    await Promise.resolve()

    expect(geometryMocks.parseSvgRegions).not.toHaveBeenCalled()
    expect(requestAnimationFrame).not.toHaveBeenCalled()
    expect(disposeTexture).toHaveBeenCalledTimes(1)

    app.unmount()
    expect(disposeTexture).toHaveBeenCalledTimes(1)
  })

  it('disposes a texture that resolves after another initialization request rejects', async () => {
    const fetchResult = deferred<Response>()
    const dataResult = deferred<Awaited<ReturnType<typeof apiMocks.getDistrictMapData>>>()
    const textureResult = deferred<THREE.Texture<HTMLImageElement>>()
    const texture = new THREE.Texture(document.createElement('img'))
    const disposeTexture = vi.spyOn(texture, 'dispose')
    vi.mocked(fetch).mockReturnValue(fetchResult.promise)
    apiMocks.getDistrictMapData.mockReturnValue(dataResult.promise)
    vi.mocked(THREE.TextureLoader.prototype.loadAsync).mockReturnValue(textureResult.promise)

    const { default: ChongqingMap3D } = await import('./ChongqingMap3D.vue')
    const root = document.createElement('div')
    const app = createApp(ChongqingMap3D)
    app.mount(root)
    await nextTick()

    fetchResult.reject(new Error('map request failed'))
    await Promise.resolve()
    await Promise.resolve()
    textureResult.resolve(texture)
    await Promise.resolve()
    await Promise.resolve()

    expect(geometryMocks.parseSvgRegions).not.toHaveBeenCalled()
    expect(requestAnimationFrame).not.toHaveBeenCalled()
    expect(disposeTexture).toHaveBeenCalledTimes(1)

    app.unmount()
    expect(disposeTexture).toHaveBeenCalledTimes(1)
  })

  it('disposes a resolved texture immediately when initialization siblings are still pending on unmount', async () => {
    const fetchResult = deferred<Response>()
    const dataResult = deferred<Awaited<ReturnType<typeof apiMocks.getDistrictMapData>>>()
    const textureResult = deferred<THREE.Texture<HTMLImageElement>>()
    const texture = new THREE.Texture(document.createElement('img'))
    const disposeTexture = vi.spyOn(texture, 'dispose')
    vi.mocked(fetch).mockReturnValue(fetchResult.promise)
    apiMocks.getDistrictMapData.mockReturnValue(dataResult.promise)
    vi.mocked(THREE.TextureLoader.prototype.loadAsync).mockReturnValue(textureResult.promise)

    const { default: ChongqingMap3D } = await import('./ChongqingMap3D.vue')
    const root = document.createElement('div')
    const app = createApp(ChongqingMap3D)
    app.mount(root)
    await nextTick()

    textureResult.resolve(texture)
    await Promise.resolve()
    app.unmount()

    expect(geometryMocks.parseSvgRegions).not.toHaveBeenCalled()
    expect(requestAnimationFrame).not.toHaveBeenCalled()
    expect(disposeTexture).toHaveBeenCalledTimes(1)
  })

  it('cleans up a partially published scene when ResizeObserver setup fails', async () => {
    const texture = new THREE.Texture(document.createElement('img'))
    texture.image.width = 100
    texture.image.height = 100
    const disposeTexture = vi.spyOn(texture, 'dispose')
    const rendererDispose = vi.fn()
    const observe = vi.fn(() => { throw new Error('resize observer failed') })
    const disconnect = vi.fn()
    const removeResizeListener = vi.spyOn(window, 'removeEventListener')
    vi.stubGlobal('ResizeObserver', class {
      observe = observe
      disconnect = disconnect
    })
    threeMocks.createRenderer.mockReturnValue({
      domElement: document.createElement('canvas'),
      setSize: vi.fn(),
      setPixelRatio: vi.fn(),
      getPixelRatio: vi.fn(() => 1),
      render: vi.fn(),
      dispose: rendererDispose
    })
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue('<svg xmlns="http://www.w3.org/2000/svg"/>')
    } as unknown as Response)
    apiMocks.getDistrictMapData.mockResolvedValue([])
    vi.mocked(THREE.TextureLoader.prototype.loadAsync).mockResolvedValue(texture)
    geometryMocks.parseSvgRegions.mockReturnValue([{
      name: '渝中区',
      outers: [{ ring: [[0, 0], [100, 0], [0, 100]], holes: [] }]
    }])

    const { default: ChongqingMap3D } = await import('./ChongqingMap3D.vue')
    const root = document.createElement('div')
    const app = createApp(ChongqingMap3D)
    app.mount(root)

    await vi.waitFor(() => expect(root.textContent).toContain('resize observer failed'))

    expect(disposeTexture).toHaveBeenCalledTimes(1)
    expect(rendererDispose).toHaveBeenCalledTimes(1)
    expect(pipelineMocks.instance.dispose).toHaveBeenCalledTimes(1)
    expect(sceneSetupMocks.controlsDispose).toHaveBeenCalledTimes(1)
    expect(disconnect).toHaveBeenCalledTimes(1)
    expect(removeResizeListener).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(requestAnimationFrame).not.toHaveBeenCalled()

    app.unmount()

    expect(disposeTexture).toHaveBeenCalledTimes(1)
    expect(rendererDispose).toHaveBeenCalledTimes(1)
    expect(pipelineMocks.instance.dispose).toHaveBeenCalledTimes(1)
    expect(sceneSetupMocks.controlsDispose).toHaveBeenCalledTimes(1)
    expect(requestAnimationFrame).not.toHaveBeenCalled()
  })
})
