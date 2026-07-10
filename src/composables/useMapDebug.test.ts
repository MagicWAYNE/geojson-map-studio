import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { MAP_EFFECT_DEFAULTS } from '@/components/map/mapEffectConfig'
import {
  applyHoverGlowConfig,
  applyStaticGlowConfig,
  createHoverGlowLayers,
  createStaticGlowLayers
} from '@/components/map/mapGlow'
import type { BoundarySegments, Segment } from '@/components/map/mapGeometry'

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

  it('persists the versioned effect payload and restores it after a module reload', async () => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    })

    const { MAP_EFFECT_STORAGE_KEY } = await import('@/components/map/mapEffectConfig')
    const { useMapDebug } = await import('./useMapDebug')
    const debug = useMapDebug()
    debug.effect.base.outerGlowWidth = 17.4
    debug.effect.hover.enterMs = 350
    await nextTick()

    expect(JSON.parse(values.get(MAP_EFFECT_STORAGE_KEY)!)).toMatchObject({
      version: 1,
      base: { outerGlowWidth: 17.4 },
      hover: { enterMs: 350 }
    })

    vi.resetModules()
    const { useMapDebug: reloadedUseMapDebug } = await import('./useMapDebug')
    const reloaded = reloadedUseMapDebug()
    expect(reloaded.effect.base.outerGlowWidth).toBe(17.4)
    expect(reloaded.effect.hover.enterMs).toBe(350)
  })

  it('applies changed configuration to existing static and hover glow materials', () => {
    const config = {
      ...MAP_EFFECT_DEFAULTS,
      base: { ...MAP_EFFECT_DEFAULTS.base, innerColor: '#123456', outerGlowWidth: 18 },
      hover: { ...MAP_EFFECT_DEFAULTS.hover, glowColor: '#abcdef', glowWidth: 11, outlineWidth: 5 }
    }
    const segments: Segment[] = [[[0, 0], [1, 0]]]
    const boundaries: BoundarySegments = {
      inner: segments,
      outer: segments,
      byRegion: new Map([['test', segments]])
    }
    const staticGlow = createStaticGlowLayers(boundaries, MAP_EFFECT_DEFAULTS, 0)
    const hoverGlow = createHoverGlowLayers(boundaries.byRegion.get('test')!, MAP_EFFECT_DEFAULTS, 0)

    applyStaticGlowConfig(staticGlow, config)
    applyHoverGlowConfig(hoverGlow, config)

    expect(staticGlow.inner.material.color.getHexString()).toBe('123456')
    expect(staticGlow.outerFar.material.linewidth).toBe(18)
    expect(hoverGlow.glow.material.color.getHexString()).toBe('abcdef')
    expect(hoverGlow.glow.material.linewidth).toBe(11)
    expect(hoverGlow.core.material.linewidth).toBe(5)
  })
})
