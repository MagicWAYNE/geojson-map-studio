// @vitest-environment happy-dom
import { createApp, nextTick, reactive } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAP_EFFECT_DEFAULTS, type MapEffectConfig } from './mapEffectConfig'

const stopEffectWatch = vi.fn()
const watchMapEffectConfig = vi.fn<(effect: MapEffectConfig, apply: () => void) => () => void>(
  () => stopEffectWatch
)
const applyMapEffectConfig = vi.fn()

vi.mock('./mapEffectWatcher', () => ({ watchMapEffectConfig }))
vi.mock('./mapEffectRuntime', () => ({ applyMapEffectConfig }))
vi.mock('@/api', () => ({ getDistrictMapData: () => new Promise(() => {}) }))
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
})

beforeEach(() => {
  vi.stubGlobal('fetch', () => new Promise(() => {}))
})

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
})
