// @vitest-environment happy-dom
import { createApp, nextTick, reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { cloneMapEffectConfig, MAP_EFFECT_DEFAULTS, type MapEffectConfig } from './mapEffectConfig'
import { MAP_HUD_DEFAULTS, type MapHudConfig } from './mapHudConfig'
import type { MapDocument } from './mapDocument'

const routerMocks = vi.hoisted(() => ({ push: vi.fn() }))
const sceneSetupMocks = vi.hoisted(() => ({
  controlsDispose: vi.fn(),
  controlsUpdate: vi.fn(),
  controlsTargetSet: vi.fn(),
  controlListeners: new Map<string, () => void>()
}))
const threeMocks = vi.hoisted(() => ({ createRenderer: vi.fn() }))
const runtimeStatusDefault = vi.hoisted(() => ({
  targetWidth: 1,
  targetHeight: 1,
  renderScale: 0.5 as const,
  baseState: 'enabled' as const,
  hoverState: 'disabled' as const,
  baseInwardState: 'active' as const,
  hoverInwardState: 'ready' as const,
  mosaicState: 'ready' as const,
  degraded: false
}))
const districtBarRuntimeStatusDefault = vi.hoisted(() => ({
  renderedCount: 0,
  dataMin: null,
  dataMax: null,
  degraded: false
}))
const mapDebugMocks = vi.hoisted(() => ({
  effect: null as MapEffectConfig | null,
  hud: null as MapHudConfig | null,
  effectRuntimeStatus: null as typeof runtimeStatusDefault | null,
  updateEffectRuntimeStatus: vi.fn(),
  updateDistrictBarRuntimeStatus: vi.fn()
}))
const carouselMocks = vi.hoisted(() => ({
  enabled: null as import('vue').Ref<boolean> | null,
  toggle: vi.fn()
}))
const districtBarMocks = vi.hoisted(() => ({
  create: vi.fn(),
  applyConfig: vi.fn(),
  update: vi.fn(),
  getSnapshots: vi.fn(),
  setFocus: vi.fn(),
  setHoverProgress: vi.fn(),
  dispose: vi.fn(),
  layer: null as {
    group: THREE.Group
    byName: Map<string, unknown>
    range: { min: number; max: number } | null
  } | null
}))
const overlayLayoutMocks = vi.hoisted(() => ({ calculate: vi.fn() }))
const overlayComponentMocks = vi.hoisted(() => ({
  props: null as null | { layout: unknown, config: unknown, metricLabels: unknown },
  emitSizes: null as null | ((sizes: unknown) => void),
  layoutOnUnmount: null as unknown
}))
const pipelineMocks = vi.hoisted(() => ({
  create: vi.fn(),
  instance: {
    setSize: vi.fn(),
    setConfig: vi.fn(),
    setRegionProgress: vi.fn(),
    markCameraDirty: vi.fn(),
    getStatus: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn()
  }
}))
const mosaicMocks = vi.hoisted(() => ({
  create: vi.fn(),
  instance: {
    setConfig: vi.fn(),
    setRegionProgress: vi.fn(),
    advanceTime: vi.fn(),
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
vi.mock('./mapDistrictBarLayer', () => ({
  createDistrictBarLayer: districtBarMocks.create,
  applyDistrictBarConfig: districtBarMocks.applyConfig,
  updateDistrictBarLayer: districtBarMocks.update,
  getDistrictBarTopSnapshots: districtBarMocks.getSnapshots,
  setDistrictBarFocus: districtBarMocks.setFocus,
  setDistrictBarHoverProgress: districtBarMocks.setHoverProgress,
  disposeDistrictBarLayer: districtBarMocks.dispose
}))
vi.mock('./mapDistrictBarOverlayLayout', () => ({
  calculateDistrictBarOverlayLayout: overlayLayoutMocks.calculate
}))
vi.mock('./MapDistrictBarOverlay.vue', async () => {
  const { defineComponent, getCurrentInstance, h, onBeforeUnmount } = await import('vue')
  return {
    default: defineComponent({
      name: 'MapDistrictBarOverlayStub',
      props: ['layout', 'config', 'metricLabels'],
      emits: ['sizes-change'],
      setup(props, { emit }) {
        const parentSetupState = (
          getCurrentInstance()?.parent as unknown as
            { setupState?: Record<string, unknown> } | undefined
        )?.setupState
        overlayComponentMocks.props = props
        overlayComponentMocks.emitSizes = (sizes) => emit('sizes-change', sizes)
        onBeforeUnmount(() => {
          overlayComponentMocks.layoutOnUnmount = parentSetupState?.districtBarOverlayLayout
        })
        return () => h('div', { class: 'map-district-bar-overlay-stub' })
      }
    })
  }
})
vi.mock('./mapMosaicParticles', () => ({
  createMapMosaicParticles: mosaicMocks.create
}))
vi.mock('three/examples/jsm/controls/OrbitControls.js', () => ({
  OrbitControls: class {
    target = { x: 0, y: 0, z: 0, set: sceneSetupMocks.controlsTargetSet }
    addEventListener = vi.fn((type: string, callback: () => void) => {
      sceneSetupMocks.controlListeners.set(type, callback)
    })
    update = sceneSetupMocks.controlsUpdate
    dispose = sceneSetupMocks.controlsDispose
  }
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: routerMocks.push }) }))
vi.mock('@/composables/useMapDebug', () => ({
  DEFAULT_MAP_EFFECT_RUNTIME_STATUS: runtimeStatusDefault,
  DEFAULT_MAP_DISTRICT_BAR_RUNTIME_STATUS: districtBarRuntimeStatusDefault,
  useMapDebug: () => {
    const effect = reactive<MapEffectConfig>(cloneMapEffectConfig(MAP_EFFECT_DEFAULTS))
    mapDebugMocks.effect = effect
    const hud = reactive<MapHudConfig>({
      ...MAP_HUD_DEFAULTS,
      anchor: { ...MAP_HUD_DEFAULTS.anchor },
      static: { ...MAP_HUD_DEFAULTS.static },
      rotating: { ...MAP_HUD_DEFAULTS.rotating }
    })
    mapDebugMocks.hud = hud
    const effectRuntimeStatus = reactive({ ...runtimeStatusDefault })
    mapDebugMocks.effectRuntimeStatus = effectRuntimeStatus
    mapDebugMocks.updateEffectRuntimeStatus.mockImplementation((next) => {
      Object.assign(effectRuntimeStatus, next)
      return true
    })
    return {
      cameraView: { value: '' },
      effect,
      hud,
      effectRuntimeStatus,
      updateEffectRuntimeStatus: mapDebugMocks.updateEffectRuntimeStatus,
      districtBarRuntimeStatus: { renderedCount: 0, dataMin: null, dataMax: null, degraded: false },
      updateDistrictBarRuntimeStatus: mapDebugMocks.updateDistrictBarRuntimeStatus
    }
  }
}))
vi.mock('@/composables/useMapDistrictCarousel', async () => {
  const { ref } = await import('vue')
  const enabled = ref(false)
  carouselMocks.enabled = enabled
  return {
    useMapDistrictCarousel: () => ({ enabled, toggle: carouselMocks.toggle })
  }
})

afterEach(() => {
  watchMapEffectConfig.mockClear()
  stopEffectWatch.mockClear()
  applyMapEffectConfig.mockClear()
  sceneSetupMocks.controlsDispose.mockClear()
  sceneSetupMocks.controlsUpdate.mockClear()
  sceneSetupMocks.controlsTargetSet.mockClear()
  sceneSetupMocks.controlListeners.clear()
  threeMocks.createRenderer.mockClear()
  pipelineMocks.create.mockReset()
  Object.values(pipelineMocks.instance).forEach((mock) => mock.mockReset())
  mosaicMocks.create.mockReset()
  Object.values(mosaicMocks.instance).forEach((mock) => mock.mockReset())
  mapDebugMocks.updateEffectRuntimeStatus.mockReset()
  mapDebugMocks.updateDistrictBarRuntimeStatus.mockReset()
  Object.values(districtBarMocks).forEach((value) => {
    if (typeof value === 'function' && 'mockReset' in value) value.mockReset()
  })
  districtBarMocks.layer = null
  overlayLayoutMocks.calculate.mockReset()
  overlayComponentMocks.props = null
  overlayComponentMocks.emitSizes = null
  overlayComponentMocks.layoutOnUnmount = null
  mapDebugMocks.effect = null
  mapDebugMocks.hud = null
  mapDebugMocks.effectRuntimeStatus = null
  if (carouselMocks.enabled) carouselMocks.enabled.value = false
  carouselMocks.toggle.mockReset()
  routerMocks.push.mockReset()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  pipelineMocks.create.mockReturnValue(pipelineMocks.instance)
  mosaicMocks.create.mockReturnValue(mosaicMocks.instance)
  pipelineMocks.instance.setRegionProgress.mockReturnValue(false)
  pipelineMocks.instance.getStatus.mockReturnValue({
    targetWidth: 680,
    targetHeight: 680,
    renderScale: 0.5,
    baseState: 'enabled',
    hoverState: 'ready',
    baseInwardState: 'active',
    hoverInwardState: 'ready'
  })
  vi.spyOn(THREE.TextureLoader.prototype, 'loadAsync').mockImplementation(() => new Promise(() => {}))
  const group = new THREE.Group()
  group.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()))
  districtBarMocks.layer = {
    group,
    byName: new Map([['测试区0', {}], ['两江新区', {}]]),
    range: { min: 20, max: 70 }
  }
  districtBarMocks.create.mockReturnValue(districtBarMocks.layer)
  districtBarMocks.getSnapshots.mockReturnValue([])
  overlayLayoutMocks.calculate.mockReturnValue({ badges: [], panel: null })
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

function createTestMapDocument(
  regionCount = 1,
  overrides: Partial<MapDocument> = {}
): MapDocument {
  const regions = Array.from({ length: regionCount }, (_, index) => ({
    name: `测试区${index}`,
    outers: [{
      ring: [
        [index * 120, 0],
        [index * 120 + 100, 0],
        [index * 120, 100]
      ] as [number, number][],
      holes: []
    }]
  }))
  return {
    version: 1,
    source: { kind: 'builtin', displayName: '测试地图' },
    geometry: { regions, scale: 1, center: [0, 0] },
    metrics: new Map(regions.map((region, index) => [region.name, {
      name: region.name,
      displayName: region.name,
      primary: 20 + index,
      secondary: 2 + index
    }])),
    metricLabels: {
      primary: { label: '扶持企业', unit: '家' },
      secondary: { label: '服务资源', unit: '项' }
    },
    appearance: { kind: 'terrain-texture', textureUrl: '/maps/test-terrain.png' },
    drilldown: true,
    ...overrides
  }
}

function districtBarSnapshots() {
  return Array.from({ length: 8 }, (_, order) => ({
    name: `测试区${order}`,
    displayName: `测试区${order}`,
    primary: 10 + order,
    secondary: 1 + order,
    order,
    visible: true,
    hoverProgress: 0,
    worldPosition: [order, order + 1, order + 2] as const
  }))
}

function nonEmptyOverlayLayout(name = '测试区0') {
  return {
    badges: [{ name, visible: true }],
    panel: null
  }
}

async function mountInitializedMap(
  regionCount = 1,
  afterMount?: (root: HTMLElement) => void,
  mapDocument = createTestMapDocument(regionCount)
) {
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
  const texture = new THREE.Texture(document.createElement('img'))
  texture.image.width = 100
  texture.image.height = 100
  vi.mocked(THREE.TextureLoader.prototype.loadAsync).mockResolvedValue(texture)

  const { default: ChongqingMap3D } = await import('./ChongqingMap3D.vue')
  const root = document.createElement('div')
  const app = createApp(ChongqingMap3D, { document: mapDocument })
  app.mount(root)
  afterMount?.(root)
  await vi.waitFor(() => expect(requestAnimationFrame).toHaveBeenCalled())
  return {
    app,
    root,
    renderer,
    runFrame: (now = 16) => frameCallback(now),
    runResize: () => resizeCallback([], {} as ResizeObserver)
  }
}

function expectDegradedGlowFallback(
  mounted: Awaited<ReturnType<typeof mountInitializedMap>>,
  warn: ReturnType<typeof vi.spyOn>,
  mosaicState: 'ready' | 'active' = 'ready'
): void {
  expect(pipelineMocks.instance.dispose).toHaveBeenCalledTimes(1)
  expect(warn).toHaveBeenCalledWith(
    '外扩柔光运行失败，已关闭柔光并保留清晰边界',
    expect.any(Error)
  )
  expect(warn).toHaveBeenCalledTimes(1)
  expect(mapDebugMocks.updateEffectRuntimeStatus).toHaveBeenCalledWith({
    ...runtimeStatusDefault,
    mosaicState,
    degraded: true
  })
  expect(mounted.renderer.render)
    .toHaveBeenCalledWith(expect.any(THREE.Scene), expect.any(THREE.Camera))
}

describe('ChongqingMap3D effect wiring', () => {
  it('wires district bars through setup, config, animation, hover, and teardown without picking them', async () => {
    const mounted = await mountInitializedMap()
    const layer = districtBarMocks.layer!
    const barMesh = layer.group.children[0]

    expect(districtBarMocks.create).toHaveBeenCalledWith(
      expect.any(Array),
      expect.any(Map),
      mapDebugMocks.effect!.bars,
      4
    )
    const [, dataByName] = districtBarMocks.create.mock.calls[0]
    expect(dataByName.get('测试区0')).toEqual({
      name: '测试区0',
      displayName: '测试区0',
      primary: 20,
      secondary: 2
    })
    expect(mapDebugMocks.updateDistrictBarRuntimeStatus).toHaveBeenCalledWith({
      renderedCount: 2,
      dataMin: 20,
      dataMax: 70,
      degraded: false
    })

    const [, regionMeshes] = pipelineMocks.create.mock.calls[0]
    const intersectObjects = vi.spyOn(THREE.Raycaster.prototype, 'intersectObjects').mockReturnValue([
      { object: regionMeshes[0] } as THREE.Intersection
    ])
    mounted.root.querySelector('.cq-map3d')!.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 10,
      clientY: 10
    }))
    mounted.runFrame(16)
    mounted.runFrame(32)

    expect(districtBarMocks.update).toHaveBeenCalledWith(
      layer,
      mapDebugMocks.effect!.bars,
      expect.any(Number)
    )
    expect(districtBarMocks.setHoverProgress).toHaveBeenCalledWith(
      layer,
      '测试区0',
      expect.any(Number),
      mapDebugMocks.effect!.hover.lift
    )
    expect(intersectObjects).toHaveBeenLastCalledWith(regionMeshes, false)
    expect(intersectObjects.mock.calls.at(-1)![0]).not.toContain(barMesh)

    const elapsedBeforeConfig = districtBarMocks.update.mock.calls.at(-1)![2] as number
    districtBarMocks.applyConfig.mockClear()
    const [, apply] = watchMapEffectConfig.mock.calls[0]
    apply()
    expect(districtBarMocks.applyConfig).toHaveBeenCalledWith(layer, mapDebugMocks.effect!.bars)
    mounted.runFrame(48)
    const elapsedAfterConfig = districtBarMocks.update.mock.calls.at(-1)![2] as number
    expect(elapsedAfterConfig).toBeGreaterThan(elapsedBeforeConfig)

    mounted.app.unmount()
    expect(districtBarMocks.dispose).toHaveBeenCalledWith(layer)
    expect(mapDebugMocks.updateDistrictBarRuntimeStatus).toHaveBeenLastCalledWith({
      renderedCount: 0,
      dataMin: null,
      dataMax: null,
      degraded: false
    })
  })

  it('isolates a district bar creation failure and keeps direct base rendering available', async () => {
    districtBarMocks.create.mockImplementationOnce(() => {
      throw new Error('bar creation failed')
    })
    pipelineMocks.instance.setConfig.mockImplementationOnce(() => {
      throw new Error('disable glow for direct rendering')
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const mounted = await mountInitializedMap()

    expect(warn).toHaveBeenCalledWith('区县柱体初始化失败，保留地图底图', expect.any(Error))
    expect(warn.mock.calls.filter(([message]) => message === '区县柱体初始化失败，保留地图底图'))
      .toHaveLength(1)
    expect(mapDebugMocks.updateDistrictBarRuntimeStatus).toHaveBeenCalledWith({
      renderedCount: 0,
      dataMin: null,
      dataMax: null,
      degraded: true
    })
    expect(districtBarMocks.dispose).not.toHaveBeenCalled()

    expect(() => mounted.runFrame(16)).not.toThrow()
    expect(districtBarMocks.update).not.toHaveBeenCalled()
    expect(mounted.renderer.render)
      .toHaveBeenCalledWith(expect.any(THREE.Scene), expect.any(THREE.Camera))

    mounted.app.unmount()
  })

  it('isolates a district bar config failure, disposes it once, and keeps later frames rendering', async () => {
    const mounted = await mountInitializedMap()
    const layer = districtBarMocks.layer!
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    districtBarMocks.applyConfig.mockImplementationOnce(() => {
      throw new Error('bar config failed')
    })
    districtBarMocks.update.mockClear()
    pipelineMocks.instance.render.mockClear()
    const [, apply] = watchMapEffectConfig.mock.calls[0]

    expect(() => apply()).not.toThrow()
    expect(districtBarMocks.dispose).toHaveBeenCalledTimes(1)
    expect(districtBarMocks.dispose).toHaveBeenCalledWith(layer)
    expect(warn).toHaveBeenCalledWith('区县柱体更新失败，保留地图底图', expect.any(Error))
    expect(warn.mock.calls.filter(([message]) => message === '区县柱体更新失败，保留地图底图'))
      .toHaveLength(1)
    expect(mapDebugMocks.updateDistrictBarRuntimeStatus).toHaveBeenCalledWith({
      renderedCount: 0,
      dataMin: null,
      dataMax: null,
      degraded: true
    })

    mounted.runFrame(16)
    mounted.runFrame(32)
    expect(districtBarMocks.update).not.toHaveBeenCalled()
    expect(districtBarMocks.dispose).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls.filter(([message]) => message === '区县柱体更新失败，保留地图底图'))
      .toHaveLength(1)
    expect(pipelineMocks.instance.render).toHaveBeenCalledTimes(2)

    mounted.app.unmount()
    expect(districtBarMocks.dispose).toHaveBeenCalledTimes(1)
  })

  it('isolates a district bar animation failure and keeps current and later frames rendering', async () => {
    const mounted = await mountInitializedMap()
    const layer = districtBarMocks.layer!
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    districtBarMocks.update.mockImplementationOnce(() => {
      throw new Error('bar update failed')
    })
    pipelineMocks.instance.render.mockClear()

    expect(() => mounted.runFrame(16)).not.toThrow()
    expect(districtBarMocks.update).toHaveBeenCalledTimes(1)
    expect(districtBarMocks.dispose).toHaveBeenCalledTimes(1)
    expect(districtBarMocks.dispose).toHaveBeenCalledWith(layer)
    expect(warn).toHaveBeenCalledWith('区县柱体更新失败，保留地图底图', expect.any(Error))
    expect(warn.mock.calls.filter(([message]) => message === '区县柱体更新失败，保留地图底图'))
      .toHaveLength(1)
    expect(mapDebugMocks.updateDistrictBarRuntimeStatus).toHaveBeenCalledWith({
      renderedCount: 0,
      dataMin: null,
      dataMax: null,
      degraded: true
    })
    expect(pipelineMocks.instance.render).toHaveBeenCalledTimes(1)

    mounted.runFrame(32)
    mounted.runFrame(48)
    expect(districtBarMocks.update).toHaveBeenCalledTimes(1)
    expect(districtBarMocks.dispose).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls.filter(([message]) => message === '区县柱体更新失败，保留地图底图'))
      .toHaveLength(1)
    expect(pipelineMocks.instance.render).toHaveBeenCalledTimes(3)

    mounted.app.unmount()
    expect(districtBarMocks.dispose).toHaveBeenCalledTimes(1)
  })

  it('wires mosaic config, shared hover progress, frame time, and disposal', async () => {
    const mounted = await mountInitializedMap(2)
    const [displayMetrics, mosaicSources] = mosaicMocks.create.mock.calls[0]
    expect(displayMetrics.getRenderPixelsPerScreenPixel()).toBe(2)
    expect(mosaicSources).toEqual(expect.arrayContaining([
      expect.any(THREE.Mesh),
      expect.any(THREE.Mesh)
    ]))
    expect(mosaicMocks.instance.setConfig).toHaveBeenCalledWith(
      mapDebugMocks.effect!.hover.mosaicParticles
    )

    const [, meshes] = pipelineMocks.create.mock.calls[0]
    vi.spyOn(THREE.Raycaster.prototype, 'intersectObjects').mockReturnValue([
      { object: meshes[0] } as THREE.Intersection
    ])
    mounted.root.querySelector('.cq-map3d')!.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 10,
      clientY: 10
    }))
    mounted.runFrame(16)
    mounted.runFrame(32)

    const mosaicProgress = mosaicMocks.instance.setRegionProgress.mock.calls
      .filter(([source]) => source === meshes[0])
      .at(-1)?.[1]
    const glowProgress = pipelineMocks.instance.setRegionProgress.mock.calls
      .filter(([source]) => source === meshes[0])
      .at(-1)?.[1]
    expect(mosaicProgress).toBeGreaterThan(0)
    expect(mosaicProgress).toBe(glowProgress)
    expect(mosaicMocks.instance.advanceTime).toHaveBeenLastCalledWith(16)

    const [, apply] = watchMapEffectConfig.mock.calls[0]
    mosaicMocks.instance.setConfig.mockClear()
    apply()
    expect(mosaicMocks.instance.setConfig).toHaveBeenCalledWith(
      mapDebugMocks.effect!.hover.mosaicParticles
    )

    mounted.app.unmount()
    expect(mosaicMocks.instance.dispose).toHaveBeenCalledTimes(1)
  })

  it('keeps the map rendering when mosaic initialization fails', async () => {
    mosaicMocks.create.mockImplementationOnce(() => {
      throw new Error('mosaic unavailable')
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const mounted = await mountInitializedMap()

    expect(() => mounted.runFrame(16)).not.toThrow()
    expect(warn).toHaveBeenCalledWith(
      '马赛克粒子初始化失败，已跳过粒子层',
      expect.any(Error)
    )
    expect(mapDebugMocks.updateEffectRuntimeStatus).toHaveBeenCalledWith(expect.objectContaining({
      mosaicState: 'degraded',
      degraded: false
    }))
    expect(pipelineMocks.instance.render).toHaveBeenCalled()
    mounted.app.unmount()
  })

  it('isolates a mosaic runtime failure while keeping the map and outward glow alive', async () => {
    const mounted = await mountInitializedMap()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const [, apply] = watchMapEffectConfig.mock.calls[0]
    mosaicMocks.instance.setConfig.mockClear()
    mosaicMocks.instance.setConfig.mockImplementationOnce(() => {
      throw new Error('mosaic config failed')
    })
    pipelineMocks.instance.render.mockClear()
    mapDebugMocks.updateEffectRuntimeStatus.mockClear()

    expect(() => apply()).not.toThrow()

    expect(mosaicMocks.instance.dispose).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(
      '马赛克粒子运行失败，已关闭粒子层',
      expect.any(Error)
    )
    expect(mapDebugMocks.updateEffectRuntimeStatus).toHaveBeenCalledWith(expect.objectContaining({
      mosaicState: 'degraded',
      degraded: false
    }))

    expect(() => mounted.runFrame(16)).not.toThrow()
    expect(pipelineMocks.instance.render).toHaveBeenCalledTimes(1)
    expect(mounted.renderer.render).not.toHaveBeenCalled()

    mapDebugMocks.effect!.hover.mosaicParticles.enabled = false
    mapDebugMocks.updateEffectRuntimeStatus.mockClear()
    apply()
    expect(mosaicMocks.instance.setConfig).toHaveBeenCalledTimes(1)
    expect(mosaicMocks.instance.dispose).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(mapDebugMocks.updateEffectRuntimeStatus).toHaveBeenCalledWith(expect.objectContaining({
      mosaicState: 'disabled',
      degraded: false
    }))
    mounted.app.unmount()
  })

  it('publishes ready, active, and disabled mosaic states', async () => {
    const mounted = await mountInitializedMap()
    expect(mapDebugMocks.updateEffectRuntimeStatus).toHaveBeenCalledWith(expect.objectContaining({
      mosaicState: 'ready'
    }))

    const [, meshes] = pipelineMocks.create.mock.calls[0]
    vi.spyOn(THREE.Raycaster.prototype, 'intersectObjects').mockReturnValue([
      { object: meshes[0] } as THREE.Intersection
    ])
    mapDebugMocks.updateEffectRuntimeStatus.mockClear()
    mounted.root.querySelector('.cq-map3d')!.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 10,
      clientY: 10
    }))
    mounted.runFrame(16)
    mounted.runFrame(32)
    expect(mapDebugMocks.updateEffectRuntimeStatus).toHaveBeenCalledWith(expect.objectContaining({
      mosaicState: 'active'
    }))

    mapDebugMocks.effect!.hover.mosaicParticles.enabled = false
    const [, apply] = watchMapEffectConfig.mock.calls[0]
    mapDebugMocks.updateEffectRuntimeStatus.mockClear()
    apply()
    expect(mapDebugMocks.updateEffectRuntimeStatus).toHaveBeenCalledWith(expect.objectContaining({
      mosaicState: 'disabled'
    }))
    mounted.app.unmount()
  })

  it('publishes pipeline status after setup, config, resize, render, and hover threshold crossings', async () => {
    const mounted = await mountInitializedMap()
    expect(mapDebugMocks.updateEffectRuntimeStatus).toHaveBeenCalledWith({
      targetWidth: 680,
      targetHeight: 680,
      renderScale: 0.5,
      baseState: 'enabled',
      hoverState: 'ready',
      baseInwardState: 'active',
      hoverInwardState: 'ready',
      mosaicState: 'ready',
      degraded: false
    })

    mapDebugMocks.updateEffectRuntimeStatus.mockClear()
    pipelineMocks.instance.getStatus.mockClear()
    const [, apply] = watchMapEffectConfig.mock.calls[0]
    apply()
    expect(pipelineMocks.instance.getStatus).toHaveBeenCalledTimes(1)
    expect(mapDebugMocks.updateEffectRuntimeStatus).toHaveBeenCalledTimes(1)

    mapDebugMocks.updateEffectRuntimeStatus.mockClear()
    pipelineMocks.instance.getStatus.mockClear()
    mounted.runResize()
    expect(pipelineMocks.instance.getStatus).toHaveBeenCalledTimes(1)
    expect(mapDebugMocks.updateEffectRuntimeStatus).toHaveBeenCalledTimes(1)

    mapDebugMocks.updateEffectRuntimeStatus.mockClear()
    pipelineMocks.instance.getStatus.mockClear()
    mounted.runFrame(16)
    mounted.runFrame(32)
    expect(pipelineMocks.instance.getStatus).toHaveBeenCalledTimes(2)
    expect(mapDebugMocks.updateEffectRuntimeStatus).toHaveBeenCalledTimes(2)

    const [, meshes] = pipelineMocks.create.mock.calls[0]
    vi.spyOn(THREE.Raycaster.prototype, 'intersectObjects').mockReturnValue([
      { object: meshes[0] } as THREE.Intersection
    ])
    pipelineMocks.instance.setRegionProgress.mockReturnValueOnce(true)
    mapDebugMocks.updateEffectRuntimeStatus.mockClear()
    pipelineMocks.instance.getStatus.mockClear()
    mounted.root.querySelector('.cq-map3d')!.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 10,
      clientY: 10
    }))
    mounted.runFrame(48)
    expect(pipelineMocks.instance.setRegionProgress).toHaveBeenCalled()
    expect(pipelineMocks.instance.getStatus).toHaveBeenCalledTimes(2)
    expect(mapDebugMocks.updateEffectRuntimeStatus).toHaveBeenCalledTimes(2)

    mapDebugMocks.updateEffectRuntimeStatus.mockClear()
    pipelineMocks.instance.getStatus.mockClear()
    mounted.runFrame(64)
    expect(pipelineMocks.instance.render).toHaveBeenCalled()
    expect(pipelineMocks.instance.getStatus).toHaveBeenCalledTimes(1)
    expect(mapDebugMocks.updateEffectRuntimeStatus).toHaveBeenCalledTimes(1)

    pipelineMocks.instance.setRegionProgress.mockReturnValueOnce(true)
    mounted.root.querySelector('.cq-map3d')!.dispatchEvent(new PointerEvent('pointerleave'))
    mounted.runFrame(80)
    expect(pipelineMocks.instance.getStatus).toHaveBeenCalledTimes(3)
    expect(mapDebugMocks.updateEffectRuntimeStatus).toHaveBeenCalledTimes(3)
    mounted.app.unmount()
  })

  it('renders the wave-free pipeline without a frame-time argument', async () => {
    const mounted = await mountInitializedMap()
    mapDebugMocks.updateEffectRuntimeStatus.mockClear()
    pipelineMocks.instance.getStatus.mockClear()

    mounted.runFrame(1250)

    expect(pipelineMocks.instance.render)
      .toHaveBeenCalledWith(expect.any(THREE.Scene), expect.any(THREE.Camera))
    expect(pipelineMocks.instance.getStatus).toHaveBeenCalledTimes(1)
    expect(mapDebugMocks.updateEffectRuntimeStatus).toHaveBeenCalledWith(expect.objectContaining({
      baseInwardState: 'active',
      hoverInwardState: 'ready',
      degraded: false
    }))

    mounted.app.unmount()
  })

  it('aggregates forced multi-region config synchronization into one status publication', async () => {
    const mounted = await mountInitializedMap(3)
    pipelineMocks.instance.setRegionProgress.mockClear()
    pipelineMocks.instance.getStatus.mockClear()
    mapDebugMocks.updateEffectRuntimeStatus.mockClear()
    const [, apply] = watchMapEffectConfig.mock.calls[0]

    apply()

    expect(pipelineMocks.instance.setRegionProgress).toHaveBeenCalledTimes(3)
    expect(pipelineMocks.instance.getStatus).toHaveBeenCalledTimes(1)
    expect(mapDebugMocks.updateEffectRuntimeStatus).toHaveBeenCalledTimes(1)
    mounted.app.unmount()
  })

  it('supports a synchronous initial effect watcher callback before scene setup', async () => {
    watchMapEffectConfig.mockImplementationOnce((_effect, apply) => {
      apply()
      return stopEffectWatch
    })

    const mounted = await mountInitializedMap()

    expect(applyMapEffectConfig).toHaveBeenCalled()
    mounted.app.unmount()
  })

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
    expect(pipelineMocks.instance.setConfig).toHaveBeenCalledWith(expect.objectContaining({
      version: 6,
      base: expect.objectContaining({ outerGlowFarPasses: expect.any(Number) }),
      hover: expect.objectContaining({ glowNearPasses: expect.any(Number) }),
      quality: expect.objectContaining({ renderScale: 0.5, maxAlpha: expect.any(Number) }),
      bars: expect.objectContaining({ enabled: expect.any(Boolean) })
    }))

    pipelineMocks.instance.markCameraDirty.mockClear()
    sceneSetupMocks.controlListeners.get('change')?.()
    expect(pipelineMocks.instance.markCameraDirty).toHaveBeenCalled()

    pipelineMocks.instance.setSize.mockClear()
    mounted.runResize()
    expect(pipelineMocks.instance.setSize).toHaveBeenLastCalledWith(680, 680, 2)
    const lastPixelRatioOrder = mounted.renderer.setPixelRatio.mock.invocationCallOrder.at(-1)!
    const lastPipelineSizeOrder = pipelineMocks.instance.setSize.mock.invocationCallOrder.at(-1)!
    expect(lastPixelRatioOrder).toBeLessThan(lastPipelineSizeOrder)

    mounted.runFrame(1234)
    expect(pipelineMocks.instance.render)
      .toHaveBeenCalledWith(expect.any(THREE.Scene), expect.any(THREE.Camera))
    expect(mounted.renderer.render).not.toHaveBeenCalled()

    mounted.app.unmount()
    expect(pipelineMocks.instance.dispose).toHaveBeenCalledTimes(1)
    expect(pipelineMocks.instance.dispose.mock.invocationCallOrder[0])
      .toBeLessThan(mounted.renderer.dispose.mock.invocationCallOrder[0])
  })

  it('passes real extrude source meshes with both top and side material groups to the pipeline', async () => {
    const mounted = await mountInitializedMap()
    const [, meshes] = pipelineMocks.create.mock.calls[0]
    const source = meshes[0] as THREE.Mesh<THREE.ExtrudeGeometry, THREE.Material[]>

    expect(source.geometry).toBeInstanceOf(THREE.ExtrudeGeometry)
    expect(source.geometry.groups.map(({ materialIndex }) => materialIndex)).toEqual(
      expect.arrayContaining([0, 1])
    )
    expect(source.material).toHaveLength(2)

    mounted.app.unmount()
  })

  it('starts from the fixed camera position and controls target', async () => {
    const mounted = await mountInitializedMap()
    mounted.runFrame()
    const camera = pipelineMocks.instance.render.mock.calls.at(-1)![1] as THREE.PerspectiveCamera

    expect(camera.position.toArray()).toEqual([-89.4, 117.0, 56.4])
    expect(sceneSetupMocks.controlsTargetSet).toHaveBeenCalledWith(2.7, -2.9, 7.0)

    mounted.app.unmount()
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

  it('reports backing pixels per visible screen pixel when ScaleScreen hits the render cap', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 1020,
      height: 1020,
      top: 0,
      right: 1020,
      bottom: 1020,
      left: 0,
      x: 0,
      y: 0,
      toJSON: () => ({})
    })
    vi.stubGlobal('devicePixelRatio', 2)
    const mounted = await mountInitializedMap()
    const [displayMetrics] = mosaicMocks.create.mock.calls[0]

    expect(mounted.renderer.getPixelRatio()).toBe(2)
    expect(displayMetrics.getRenderPixelsPerScreenPixel()).toBeCloseTo(2 / 1.5)
    mounted.app.unmount()
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

  it('forwards decreasing and restarted hover progress across pointer move, leave, and switch', async () => {
    const mounted = await mountInitializedMap(2)
    const [, meshes] = pipelineMocks.create.mock.calls[0]
    const map = mounted.root.querySelector('.cq-map3d')!
    const progressFor = (source: THREE.Mesh) => pipelineMocks.instance.setRegionProgress.mock.calls
      .filter(([candidate]) => candidate === source)
      .map(([, progress]) => progress as number)
    vi.spyOn(THREE.Raycaster.prototype, 'intersectObjects')
      .mockReturnValueOnce([{ object: meshes[0] } as THREE.Intersection])
      .mockReturnValueOnce([{ object: meshes[1] } as THREE.Intersection])
    pipelineMocks.instance.setRegionProgress.mockClear()

    map.dispatchEvent(new PointerEvent('pointermove', { clientX: 10, clientY: 10 }))
    mounted.runFrame(100)
    mounted.runFrame(200)
    const establishedProgress = progressFor(meshes[0]).at(-1)!

    map.dispatchEvent(new PointerEvent('pointerleave'))
    mounted.runFrame(216)
    const leavingProgress = progressFor(meshes[0]).at(-1)!
    const callsBeforeSwitch = pipelineMocks.instance.setRegionProgress.mock.calls.length

    map.dispatchEvent(new PointerEvent('pointermove', { clientX: 20, clientY: 20 }))
    mounted.runFrame(232)
    mounted.runFrame(248)
    const switchCalls = pipelineMocks.instance.setRegionProgress.mock.calls.slice(callsBeforeSwitch)
    const outgoingAfterSwitch = switchCalls
      .filter(([source]) => source === meshes[0])
      .map(([, progress]) => progress as number)
    const incomingAfterSwitch = switchCalls
      .filter(([source]) => source === meshes[1])
      .map(([, progress]) => progress as number)
    const firstIncomingPositiveProgress = incomingAfterSwitch.find((progress) => progress > 0)

    expect(establishedProgress).toBeGreaterThan(0)
    expect(leavingProgress).toBeLessThan(establishedProgress)
    expect(outgoingAfterSwitch).toHaveLength(2)
    expect(outgoingAfterSwitch[0]).toBeLessThan(leavingProgress)
    expect(outgoingAfterSwitch[1]).toBeLessThan(outgoingAfterSwitch[0])
    expect(firstIncomingPositiveProgress).toBeGreaterThan(0)
    expect(firstIncomingPositiveProgress).toBeLessThan(1)
    expect(firstIncomingPositiveProgress).toBeLessThan(establishedProgress)
    mounted.app.unmount()
  })

  it.each([
    {
      operation: 'setConfig' as const,
      trigger: (mounted: Awaited<ReturnType<typeof mountInitializedMap>>) => {
        const [, apply] = watchMapEffectConfig.mock.calls[0]
        apply()
      }
    },
    {
      operation: 'setSize' as const,
      trigger: (mounted: Awaited<ReturnType<typeof mountInitializedMap>>) => mounted.runResize()
    },
    {
      operation: 'markCameraDirty' as const,
      trigger: () => sceneSetupMocks.controlListeners.get('change')?.()
    },
    {
      operation: 'getStatus' as const,
      trigger: (mounted: Awaited<ReturnType<typeof mountInitializedMap>>) => {
        const [, apply] = watchMapEffectConfig.mock.calls[0]
        apply()
      }
    }
  ])('degrades once when post-setup $operation fails and keeps later events on direct rendering', async ({
    operation,
    trigger
  }) => {
    const mounted = await mountInitializedMap()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const operationMock = pipelineMocks.instance[operation]
    operationMock.mockClear()
    pipelineMocks.instance.render.mockClear()
    mounted.renderer.render.mockClear()
    operationMock.mockImplementationOnce(() => {
      throw new Error(`${operation} failed`)
    })

    expect(() => trigger(mounted)).not.toThrow()
    mounted.runFrame(16)
    expectDegradedGlowFallback(mounted, warn)
    expect(operationMock).toHaveBeenCalledTimes(1)
    expect(pipelineMocks.instance.render).not.toHaveBeenCalled()

    expect(() => trigger(mounted)).not.toThrow()
    mounted.runFrame(32)
    expect(operationMock).toHaveBeenCalledTimes(1)
    expect(pipelineMocks.instance.dispose).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(mounted.renderer.render).toHaveBeenCalledTimes(2)
    mounted.app.unmount()
    expect(pipelineMocks.instance.dispose).toHaveBeenCalledTimes(1)
  })

  it('degrades on setRegionProgress before render and directly renders the current and next frame', async () => {
    const mounted = await mountInitializedMap()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const [, meshes] = pipelineMocks.create.mock.calls[0]
    vi.spyOn(THREE.Raycaster.prototype, 'intersectObjects').mockReturnValue([
      { object: meshes[0] } as THREE.Intersection
    ])
    mounted.root.querySelector('.cq-map3d')!.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 10,
      clientY: 10
    }))
    mounted.runFrame(16)
    pipelineMocks.instance.setRegionProgress.mockClear()
    pipelineMocks.instance.render.mockClear()
    mounted.renderer.render.mockClear()
    pipelineMocks.instance.setRegionProgress.mockImplementationOnce(() => {
      throw new Error('setRegionProgress failed')
    })

    expect(() => mounted.runFrame(32)).not.toThrow()
    expectDegradedGlowFallback(mounted, warn, 'active')
    expect(pipelineMocks.instance.setRegionProgress).toHaveBeenCalledTimes(1)
    expect(pipelineMocks.instance.render).not.toHaveBeenCalled()

    mounted.runFrame(48)
    expect(pipelineMocks.instance.setRegionProgress).toHaveBeenCalledTimes(1)
    expect(pipelineMocks.instance.dispose).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(mounted.renderer.render).toHaveBeenCalledTimes(2)
    mounted.app.unmount()
    expect(pipelineMocks.instance.dispose).toHaveBeenCalledTimes(1)
  })

  it('does not classify a direct main renderer exception as another glow failure', async () => {
    const mounted = await mountInitializedMap()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    pipelineMocks.instance.setConfig.mockImplementationOnce(() => {
      throw new Error('setConfig failed')
    })
    const [, apply] = watchMapEffectConfig.mock.calls[0]
    expect(() => apply()).not.toThrow()
    mounted.renderer.render.mockImplementationOnce(() => {
      throw new Error('main renderer failed')
    })

    expect(() => mounted.runFrame(16)).toThrow('main renderer failed')
    expect(pipelineMocks.instance.dispose).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledTimes(1)
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
    expect(mapDebugMocks.updateEffectRuntimeStatus).toHaveBeenCalledWith({
      ...runtimeStatusDefault,
      degraded: true
    })
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
    expect(mapDebugMocks.updateEffectRuntimeStatus).toHaveBeenCalledWith({
      ...runtimeStatusDefault,
      degraded: true
    })

    mounted.runFrame(32)

    expect(pipelineMocks.instance.render).toHaveBeenCalledTimes(1)
    expect(pipelineMocks.instance.dispose).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(mounted.renderer.render).toHaveBeenCalledTimes(2)

    mapDebugMocks.updateEffectRuntimeStatus.mockClear()
    mounted.app.unmount()
    const remounted = await mountInitializedMap()
    expect(mapDebugMocks.updateEffectRuntimeStatus).toHaveBeenCalledWith(expect.objectContaining({
      degraded: false
    }))

    remounted.app.unmount()
    expect(pipelineMocks.instance.dispose).toHaveBeenCalledTimes(2)
  })

  it('routes watcher callbacks to the effect runtime and stops the watcher on unmount', async () => {
    const { default: ChongqingMap3D } = await import('./ChongqingMap3D.vue')
    const root = document.createElement('div')
    const app = createApp(ChongqingMap3D, { document: createTestMapDocument() })

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
    const textureResult = deferred<THREE.Texture<HTMLImageElement>>()
    const texture = new THREE.Texture(document.createElement('img'))
    const disposeTexture = vi.spyOn(texture, 'dispose')
    vi.mocked(THREE.TextureLoader.prototype.loadAsync).mockReturnValue(textureResult.promise)

    const { default: ChongqingMap3D } = await import('./ChongqingMap3D.vue')
    const root = document.createElement('div')
    const app = createApp(ChongqingMap3D, { document: createTestMapDocument() })
    app.mount(root)
    await nextTick()
    app.unmount()

    textureResult.resolve(texture)
    await Promise.resolve()
    await Promise.resolve()
    await nextTick()

    expect(requestAnimationFrame).not.toHaveBeenCalled()
    expect(disposeTexture).toHaveBeenCalledTimes(1)
  })

  it('reports terrain texture load failure without starting the render loop', async () => {
    const textureResult = deferred<THREE.Texture<HTMLImageElement>>()
    vi.mocked(THREE.TextureLoader.prototype.loadAsync).mockReturnValue(textureResult.promise)

    const { default: ChongqingMap3D } = await import('./ChongqingMap3D.vue')
    const root = document.createElement('div')
    const app = createApp(ChongqingMap3D, { document: createTestMapDocument() })
    app.mount(root)
    await nextTick()

    textureResult.reject(new Error('terrain texture failed'))
    await vi.waitFor(() => expect(root.textContent).toContain('terrain texture failed'))

    expect(requestAnimationFrame).not.toHaveBeenCalled()
    app.unmount()
  })

  it('uses tech-blue materials without loading the terrain texture', async () => {
    const mapDocument = createTestMapDocument(1, {
      source: { kind: 'geojson', displayName: 'custom.geojson', identity: 'custom-geometry' },
      appearance: { kind: 'tech-blue' },
      drilldown: false
    })
    const mounted = await mountInitializedMap(1, undefined, mapDocument)
    const terrainCalls = vi.mocked(THREE.TextureLoader.prototype.loadAsync).mock.calls
      .filter(([url]) => url === '/maps/test-terrain.png')
    const [, regionMeshes] = pipelineMocks.create.mock.calls[0]
    const topMaterial = (regionMeshes[0] as THREE.Mesh).material as THREE.MeshStandardMaterial[]

    expect(terrainCalls).toHaveLength(0)
    expect(topMaterial[0].map).toBeNull()
    expect(topMaterial[0].color.getHex()).toBe(0x173f78)
    expect(topMaterial[1].color.getHex()).toBe(0x05173a)
    mounted.app.unmount()
  })

  it('keeps effects but omits bars and overlay when a custom map has no business data', async () => {
    const mapDocument = createTestMapDocument(3, {
      source: {
        kind: 'geojson',
        displayName: 'geometry-only.geojson',
        identity: 'geometry-only'
      },
      metrics: new Map(),
      metricLabels: null,
      appearance: { kind: 'tech-blue' },
      drilldown: false
    })

    const mounted = await mountInitializedMap(3, undefined, mapDocument)

    expect(pipelineMocks.create).toHaveBeenCalledWith(expect.anything(), expect.any(Array))
    expect(mosaicMocks.create).toHaveBeenCalledWith(expect.anything(), expect.any(Array))
    expect(districtBarMocks.create).not.toHaveBeenCalled()
    expect(mounted.root.querySelector('.map-district-bar-overlay-stub')).toBeNull()
    expect(mapDebugMocks.updateDistrictBarRuntimeStatus).toHaveBeenCalledWith({
      renderedCount: 0,
      dataMin: null,
      dataMax: null,
      degraded: false
    })
    mounted.app.unmount()
  })

  it('only allows built-in documents to navigate to district details', async () => {
    const customDocument = createTestMapDocument(1, {
      source: { kind: 'geojson', displayName: 'custom.geojson', identity: 'custom-geometry' },
      appearance: { kind: 'tech-blue' },
      drilldown: false
    })
    const custom = await mountInitializedMap(1, undefined, customDocument)
    let [, regionMeshes] = pipelineMocks.create.mock.calls.at(-1)!
    vi.spyOn(THREE.Raycaster.prototype, 'intersectObjects').mockReturnValue([
      { object: regionMeshes[0] } as THREE.Intersection
    ])
    const customElement = custom.root.querySelector('.cq-map3d')!
    customElement.dispatchEvent(new PointerEvent('pointerdown', { clientX: 10, clientY: 10 }))
    customElement.dispatchEvent(new PointerEvent('click', { clientX: 10, clientY: 10 }))
    expect(routerMocks.push).not.toHaveBeenCalled()
    custom.app.unmount()

    const builtin = await mountInitializedMap()
    ;[, regionMeshes] = pipelineMocks.create.mock.calls.at(-1)!
    vi.spyOn(THREE.Raycaster.prototype, 'intersectObjects').mockReturnValue([
      { object: regionMeshes[0] } as THREE.Intersection
    ])
    const builtinElement = builtin.root.querySelector('.cq-map3d')!
    builtinElement.dispatchEvent(new PointerEvent('pointerdown', { clientX: 10, clientY: 10 }))
    builtinElement.dispatchEvent(new PointerEvent('click', { clientX: 10, clientY: 10 }))
    expect(routerMocks.push).toHaveBeenCalledWith('/district/%E6%B5%8B%E8%AF%95%E5%8C%BA0')
    builtin.app.unmount()
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
    vi.mocked(THREE.TextureLoader.prototype.loadAsync).mockResolvedValue(texture)

    const { default: ChongqingMap3D } = await import('./ChongqingMap3D.vue')
    const root = document.createElement('div')
    const app = createApp(ChongqingMap3D, { document: createTestMapDocument() })
    app.mount(root)

    await vi.waitFor(() => expect(root.textContent).toContain('resize observer failed'))

    expect(disposeTexture).toHaveBeenCalledTimes(1)
    expect(rendererDispose).toHaveBeenCalledTimes(1)
    expect(pipelineMocks.instance.dispose).toHaveBeenCalledTimes(1)
    expect(sceneSetupMocks.controlsDispose).toHaveBeenCalledTimes(1)
    expect(disconnect).toHaveBeenCalledTimes(1)
    expect(removeResizeListener).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(requestAnimationFrame).not.toHaveBeenCalled()
    expect(districtBarMocks.getSnapshots).not.toHaveBeenCalled()
    expect(overlayLayoutMocks.calculate).not.toHaveBeenCalled()

    app.unmount()

    expect(disposeTexture).toHaveBeenCalledTimes(1)
    expect(rendererDispose).toHaveBeenCalledTimes(1)
    expect(pipelineMocks.instance.dispose).toHaveBeenCalledTimes(1)
    expect(sceneSetupMocks.controlsDispose).toHaveBeenCalledTimes(1)
    expect(requestAnimationFrame).not.toHaveBeenCalled()
    expect(overlayComponentMocks.layoutOnUnmount).toEqual({ badges: [], panel: null })
  })
})

describe('ChongqingMap3D district bar DOM overlay wiring', () => {
  it('keeps automatic hover paused when the pointer entered before async map setup completed', async () => {
    const { useMapDistrictCarousel } = await import('@/composables/useMapDistrictCarousel')
    useMapDistrictCarousel().enabled.value = true
    districtBarMocks.getSnapshots.mockReturnValue(districtBarSnapshots())
    vi.spyOn(performance, 'now').mockReturnValue(0)

    const mounted = await mountInitializedMap(2, (root) => {
      root.querySelector('.cq-map3d')!.dispatchEvent(new PointerEvent('pointerenter'))
    })
    mounted.runFrame(0)

    expect(overlayLayoutMocks.calculate.mock.calls.at(-1)![0].hoveredName).toBeNull()
    mounted.app.unmount()
  })

  it('cycles automatic hover, suspends inside the map, and resumes ten seconds after leaving', async () => {
    const { useMapDistrictCarousel } = await import('@/composables/useMapDistrictCarousel')
    useMapDistrictCarousel().enabled.value = true
    districtBarMocks.getSnapshots.mockReturnValue(districtBarSnapshots())
    let currentNow = 0
    vi.spyOn(performance, 'now').mockImplementation(() => currentNow)
    const mounted = await mountInitializedMap(3)
    const [, regionMeshes] = pipelineMocks.create.mock.calls[0]
    const map = mounted.root.querySelector('.cq-map3d')!

    mounted.runFrame(0)
    expect(overlayLayoutMocks.calculate.mock.calls.at(-1)![0].hoveredName).toBe('测试区0')
    expect(districtBarMocks.setFocus).toHaveBeenLastCalledWith(districtBarMocks.layer, '测试区0')
    mounted.runFrame(4_999)
    expect(overlayLayoutMocks.calculate.mock.calls.at(-1)![0].hoveredName).toBe('测试区0')
    mounted.runFrame(5_000)
    expect(overlayLayoutMocks.calculate.mock.calls.at(-1)![0].hoveredName).toBe('测试区1')
    expect(districtBarMocks.setFocus).toHaveBeenLastCalledWith(districtBarMocks.layer, '测试区1')

    vi.spyOn(THREE.Raycaster.prototype, 'intersectObjects')
      .mockReturnValueOnce([])
      .mockReturnValueOnce([{ object: regionMeshes[2] } as THREE.Intersection])
    currentNow = 5_100
    map.dispatchEvent(new PointerEvent('pointerenter'))
    map.dispatchEvent(new PointerEvent('pointermove', { clientX: 10, clientY: 10 }))
    mounted.runFrame(5_100)
    expect(overlayLayoutMocks.calculate.mock.calls.at(-1)![0].hoveredName).toBeNull()
    expect(districtBarMocks.setFocus).toHaveBeenLastCalledWith(districtBarMocks.layer, null)

    currentNow = 5_200
    map.dispatchEvent(new PointerEvent('pointermove', { clientX: 20, clientY: 20 }))
    mounted.runFrame(5_200)
    expect(overlayLayoutMocks.calculate.mock.calls.at(-1)![0].hoveredName).toBe('测试区2')
    expect(districtBarMocks.setFocus).toHaveBeenLastCalledWith(districtBarMocks.layer, '测试区2')

    currentNow = 6_000
    map.dispatchEvent(new PointerEvent('pointerleave'))
    mounted.runFrame(15_999)
    expect(overlayLayoutMocks.calculate.mock.calls.at(-1)![0].hoveredName).toBeNull()
    mounted.runFrame(16_000)
    expect(overlayLayoutMocks.calculate.mock.calls.at(-1)![0].hoveredName).toBe('测试区0')

    mounted.app.unmount()
  })

  it('turns off only automatic hover while keeping real pointer hover available', async () => {
    const { useMapDistrictCarousel } = await import('@/composables/useMapDistrictCarousel')
    const carouselState = useMapDistrictCarousel()
    carouselState.enabled.value = true
    districtBarMocks.getSnapshots.mockReturnValue(districtBarSnapshots())
    vi.spyOn(performance, 'now').mockReturnValue(0)
    const mounted = await mountInitializedMap(2)
    const [, regionMeshes] = pipelineMocks.create.mock.calls[0]
    const map = mounted.root.querySelector('.cq-map3d')!

    mounted.runFrame(0)
    expect(overlayLayoutMocks.calculate.mock.calls.at(-1)![0].hoveredName).toBe('测试区0')

    carouselState.enabled.value = false
    await nextTick()
    mounted.runFrame(16)
    expect(overlayLayoutMocks.calculate.mock.calls.at(-1)![0].hoveredName).toBeNull()

    vi.spyOn(THREE.Raycaster.prototype, 'intersectObjects').mockReturnValue([
      { object: regionMeshes[1] } as THREE.Intersection
    ])
    map.dispatchEvent(new PointerEvent('pointermove', { clientX: 20, clientY: 20 }))
    mounted.runFrame(32)
    expect(overlayLayoutMocks.calculate.mock.calls.at(-1)![0].hoveredName).toBe('测试区1')

    carouselState.enabled.value = true
    await nextTick()
    mounted.runFrame(48)
    expect(overlayLayoutMocks.calculate.mock.calls.at(-1)![0].hoveredName).toBe('测试区1')
    mounted.app.unmount()
  })

  it('projects the same eight bar snapshots after controls and bar animation but before rendering', async () => {
    const snapshots = districtBarSnapshots()
    const mounted = await mountInitializedMap()
    const [, regionMeshes] = pipelineMocks.create.mock.calls[0]
    vi.spyOn(THREE.Raycaster.prototype, 'intersectObjects').mockReturnValue([
      { object: regionMeshes[0] } as THREE.Intersection
    ])
    mounted.root.querySelector('.cq-map3d')!.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 10,
      clientY: 10
    }))
    mounted.runFrame(16)

    districtBarMocks.setHoverProgress.mockClear()
    sceneSetupMocks.controlsUpdate.mockClear()
    districtBarMocks.update.mockClear()
    districtBarMocks.getSnapshots.mockReset().mockReturnValue(snapshots)
    overlayLayoutMocks.calculate.mockClear()
    pipelineMocks.instance.render.mockClear()

    mounted.runFrame(32)

    expect(overlayLayoutMocks.calculate).toHaveBeenCalledTimes(1)
    expect(overlayLayoutMocks.calculate.mock.calls[0][0].snapshots).toBe(snapshots)
    const calls = [
      districtBarMocks.setHoverProgress,
      sceneSetupMocks.controlsUpdate,
      districtBarMocks.update,
      districtBarMocks.getSnapshots,
      overlayLayoutMocks.calculate,
      pipelineMocks.instance.render
    ]
    for (let index = 1; index < calls.length; index++) {
      expect(calls[index - 1].mock.invocationCallOrder[0])
        .toBeLessThan(calls[index].mock.invocationCallOrder[0])
    }

    mounted.app.unmount()
  })

  it('derives hover from the picked region and removes the legacy pointer tooltip', async () => {
    districtBarMocks.getSnapshots.mockReturnValue(districtBarSnapshots())
    const mounted = await mountInitializedMap()
    const [, regionMeshes] = pipelineMocks.create.mock.calls[0]
    vi.spyOn(THREE.Raycaster.prototype, 'intersectObjects').mockReturnValue([
      { object: regionMeshes[0] } as THREE.Intersection
    ])

    mounted.root.querySelector('.cq-map3d')!.dispatchEvent(new PointerEvent('pointermove', {
      clientX: 10,
      clientY: 10
    }))
    mounted.runFrame(16)
    expect(overlayLayoutMocks.calculate.mock.calls.at(-1)![0].hoveredName).toBe('测试区0')

    mounted.root.querySelector('.cq-map3d')!.dispatchEvent(new PointerEvent('pointerleave'))
    mounted.runFrame(32)
    expect(overlayLayoutMocks.calculate.mock.calls.at(-1)![0].hoveredName).toBeNull()
    expect(mounted.root.querySelector('.tip')).toBeNull()
    expect(mounted.root.textContent).not.toContain('调解组织')

    mounted.app.unmount()
  })

  it('clears an existing overlay when bar animation fails and never projects detached bars', async () => {
    const layout = nonEmptyOverlayLayout()
    districtBarMocks.getSnapshots.mockReturnValue(districtBarSnapshots())
    overlayLayoutMocks.calculate.mockReturnValue(layout)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const mounted = await mountInitializedMap()
    const stableEmptyLayout = overlayComponentMocks.props!.layout

    mounted.runFrame(16)
    await nextTick()
    expect(overlayComponentMocks.props!.layout).toBe(layout)

    districtBarMocks.getSnapshots.mockClear()
    overlayLayoutMocks.calculate.mockClear()
    pipelineMocks.instance.render.mockClear()
    districtBarMocks.update.mockImplementationOnce(() => {
      throw new Error('bar animation failed')
    })

    mounted.runFrame(32)
    await nextTick()
    expect(overlayComponentMocks.props!.layout).toBe(stableEmptyLayout)
    expect(districtBarMocks.getSnapshots).not.toHaveBeenCalled()
    expect(overlayLayoutMocks.calculate).not.toHaveBeenCalled()
    expect(pipelineMocks.instance.render).toHaveBeenCalledTimes(1)

    mounted.runFrame(48)
    expect(districtBarMocks.update).toHaveBeenCalledTimes(2)
    expect(districtBarMocks.getSnapshots).not.toHaveBeenCalled()
    expect(overlayLayoutMocks.calculate).not.toHaveBeenCalled()
    expect(pipelineMocks.instance.render).toHaveBeenCalledTimes(2)
    expect(mapDebugMocks.updateDistrictBarRuntimeStatus).toHaveBeenCalledWith(
      expect.objectContaining({ degraded: true })
    )
    expect(warn).toHaveBeenCalledWith('区县柱体更新失败，保留地图底图', expect.any(Error))

    mounted.app.unmount()
  })

  it.each(['snapshot', 'calculator'] as const)(
    'renders through a %s overlay failure and retries on the next frame without degrading bars',
    async (failureSource) => {
      const firstLayout = nonEmptyOverlayLayout('首次布局')
      const recoveredLayout = nonEmptyOverlayLayout('恢复布局')
      districtBarMocks.getSnapshots.mockReturnValue(districtBarSnapshots())
      overlayLayoutMocks.calculate.mockReturnValueOnce(firstLayout)
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
      const mounted = await mountInitializedMap()

      mounted.runFrame(16)
      await nextTick()
      expect(overlayComponentMocks.props!.layout).toBe(firstLayout)
      pipelineMocks.instance.render.mockClear()

      if (failureSource === 'snapshot') {
        districtBarMocks.getSnapshots
          .mockImplementationOnce(() => { throw new Error('snapshot failed') })
          .mockImplementationOnce(() => { throw new Error('snapshot failed again') })
      } else {
        overlayLayoutMocks.calculate
          .mockImplementationOnce(() => { throw new Error('calculator failed') })
          .mockImplementationOnce(() => { throw new Error('calculator failed again') })
      }
      overlayLayoutMocks.calculate.mockReturnValue(recoveredLayout)

      expect(() => mounted.runFrame(32)).not.toThrow()
      await nextTick()
      expect(overlayComponentMocks.props!.layout).toEqual({ badges: [], panel: null })
      expect(pipelineMocks.instance.render).toHaveBeenCalledTimes(1)
      expect(districtBarMocks.dispose).not.toHaveBeenCalled()
      expect(mapDebugMocks.updateDistrictBarRuntimeStatus).not.toHaveBeenCalledWith(
        expect.objectContaining({ degraded: true })
      )
      expect(warn).toHaveBeenCalledWith(
        '区县柱体 DOM overlay 更新失败，已清空并将在下一帧重试',
        expect.any(Error)
      )

      mounted.runFrame(48)
      await nextTick()
      expect(overlayComponentMocks.props!.layout).toEqual({ badges: [], panel: null })
      expect(pipelineMocks.instance.render).toHaveBeenCalledTimes(2)
      expect(warn.mock.calls.filter(([message]) => (
        message === '区县柱体 DOM overlay 更新失败，已清空并将在下一帧重试'
      ))).toHaveLength(1)

      mounted.runFrame(64)
      await nextTick()
      expect(overlayComponentMocks.props!.layout).toBe(recoveredLayout)
      expect(districtBarMocks.update).toHaveBeenCalledTimes(4)
      expect(pipelineMocks.instance.render).toHaveBeenCalledTimes(3)

      mounted.app.unmount()
    }
  )

  it('keeps overlay empty and skips projection when district bar creation fails', async () => {
    districtBarMocks.create.mockImplementationOnce(() => {
      throw new Error('bar creation failed')
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const mounted = await mountInitializedMap()

    mounted.runFrame(16)
    expect(overlayComponentMocks.props!.layout).toEqual({ badges: [], panel: null })
    expect(districtBarMocks.getSnapshots).not.toHaveBeenCalled()
    expect(overlayLayoutMocks.calculate).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith('区县柱体初始化失败，保留地图底图', expect.any(Error))

    mounted.app.unmount()
  })

  it('defers measured size changes until the next frame and preserves object identity', async () => {
    districtBarMocks.getSnapshots.mockReturnValue(districtBarSnapshots())
    const mounted = await mountInitializedMap()
    mounted.runFrame(16)
    overlayLayoutMocks.calculate.mockClear()
    const sizes = {
      badgeByName: new Map([['测试区0', { width: 88, height: 36 }]]),
      panel: { width: 320, height: 140 }
    }

    overlayComponentMocks.emitSizes!(sizes)
    await nextTick()
    expect(overlayLayoutMocks.calculate).not.toHaveBeenCalled()

    mounted.runFrame(32)
    expect(overlayLayoutMocks.calculate).toHaveBeenCalledTimes(1)
    expect(overlayLayoutMocks.calculate.mock.calls[0][0].sizes).toBe(sizes)

    mounted.app.unmount()
  })

  it('uses ScaleScreen client dimensions rather than the transformed bounding rect', async () => {
    districtBarMocks.getSnapshots.mockReturnValue(districtBarSnapshots())
    const mounted = await mountInitializedMap()
    vi.spyOn(mounted.root.querySelector('.cq-map3d')!, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 1020,
      bottom: 1020,
      width: 1020,
      height: 1020,
      toJSON: () => ({})
    })

    mounted.runFrame(16)

    expect(overlayLayoutMocks.calculate.mock.calls[0][0].viewport).toEqual({
      clientWidth: 680,
      clientHeight: 680
    })

    mounted.app.unmount()
  })

  it('replaces a non-empty shallow overlay layout with the stable empty layout during unmount', async () => {
    const layout = nonEmptyOverlayLayout()
    districtBarMocks.getSnapshots.mockReturnValue(districtBarSnapshots())
    overlayLayoutMocks.calculate.mockReturnValue(layout)
    const mounted = await mountInitializedMap()
    const stableEmptyLayout = overlayComponentMocks.props!.layout
    mounted.runFrame(16)
    await nextTick()
    expect(overlayComponentMocks.props!.layout).toBe(layout)
    districtBarMocks.getSnapshots.mockClear()
    overlayLayoutMocks.calculate.mockClear()

    mounted.app.unmount()

    expect(districtBarMocks.getSnapshots).not.toHaveBeenCalled()
    expect(overlayLayoutMocks.calculate).not.toHaveBeenCalled()
    expect(districtBarMocks.dispose).toHaveBeenCalledTimes(1)
    expect(overlayComponentMocks.layoutOnUnmount).toBe(stableEmptyLayout)
    expect(mounted.root.querySelector('.map-district-bar-overlay-stub')).toBeNull()
  })
})
