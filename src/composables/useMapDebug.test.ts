import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('useMapDebug effects', () => {
  it('restores only effect defaults without changing the saved layout state', async () => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    })

    const { MAP_EFFECT_DEFAULTS } = await import('@/components/map/mapEffectConfig')
    const { useMapDebug } = await import('./useMapDebug')
    const debug = useMapDebug()

    debug.layout.left = 480
    debug.effect.base.outerGlowWidth = 22
    debug.effect.hover.lift = 2
    debug.resetEffect()

    expect(debug.layout.left).toBe(480)
    expect(debug.effect).toEqual(MAP_EFFECT_DEFAULTS)
  })
})
