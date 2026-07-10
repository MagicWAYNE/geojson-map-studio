// @vitest-environment happy-dom
import { createApp, nextTick, reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { MAP_EFFECT_DEFAULTS, type MapEffectConfig } from './mapEffectConfig'

const apiMocks = vi.hoisted(() => ({ getDistrictMapData: vi.fn() }))
const geometryMocks = vi.hoisted(() => ({ parseSvgRegions: vi.fn() }))

const stopEffectWatch = vi.fn()
const watchMapEffectConfig = vi.fn<(effect: MapEffectConfig, apply: () => void) => () => void>(
  () => stopEffectWatch
)
const applyMapEffectConfig = vi.fn()

vi.mock('./mapEffectWatcher', () => ({ watchMapEffectConfig }))
vi.mock('./mapEffectRuntime', () => ({ applyMapEffectConfig }))
vi.mock('@/api', () => ({ getDistrictMapData: apiMocks.getDistrictMapData }))
vi.mock('./mapGeometry', async (importOriginal) => ({
  ...await importOriginal<typeof import('./mapGeometry')>(),
  parseSvgRegions: geometryMocks.parseSvgRegions
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/composables/useMapDebug', () => ({
  useMapDebug: () => ({
    cameraView: { value: '' },
    effect: reactive<MapEffectConfig>({
      ...MAP_EFFECT_DEFAULTS,
      base: { ...MAP_EFFECT_DEFAULTS.base },
      hover: { ...MAP_EFFECT_DEFAULTS.hover }
    })
  })
}))

afterEach(() => {
  watchMapEffectConfig.mockClear()
  stopEffectWatch.mockClear()
  applyMapEffectConfig.mockClear()
  document.body.replaceChildren()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})))
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1))
  apiMocks.getDistrictMapData.mockImplementation(() => new Promise(() => {}))
  geometryMocks.parseSvgRegions.mockReturnValue([])
  vi.spyOn(THREE.TextureLoader.prototype, 'loadAsync').mockImplementation(() => new Promise(() => {}))
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

describe('ChongqingMap3D effect wiring', () => {
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
})
