import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { nextTick } from 'vue'
import {
  MAP_EFFECT_DEFAULTS,
  MAP_EFFECT_STORAGE_KEY,
  MAP_EFFECT_STORAGE_KEY_V1
} from '@/components/map/mapEffectConfig'
import type { MapOutwardGlowPipelineStatus } from '@/components/map/mapOutwardGlowPipeline'
import {
  applyHoverGlowConfig,
  applyStaticGlowConfig,
  createHoverGlowLayers,
  createStaticGlowLayers
} from '@/components/map/mapGlow'
import type { BoundarySegments, Segment } from '@/components/map/mapGeometry'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('useMapDebug effects', () => {
  it('restores v2 defaults with stable root and nested identities without changing the saved layout state', async () => {
    const values = new Map<string, string>()
    values.set(MAP_EFFECT_STORAGE_KEY_V1, JSON.stringify({
      version: 1,
      base: {
        innerColor: '#112233',
        innerWidth: 1.25,
        innerOpacity: 0.45,
        outerColor: '#445566',
        outerCoreWidth: 2.25,
        outerGlowWidth: 13,
        outerGlowStrength: 0.21
      },
      hover: {
        surfaceColor: '#778899',
        emissiveColor: '#abcdef',
        emissiveIntensity: 0.7,
        outlineColor: '#fedcba',
        outlineWidth: 3.5,
        glowColor: '#123456',
        glowWidth: 22,
        glowStrength: 0.3,
        lift: 2.5,
        enterMs: 260,
        leaveMs: 180
      }
    }))
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    })

    const { useMapDebug } = await import('./useMapDebug')
    const debug = useMapDebug()
    const effect = debug.effect
    const base = debug.effect.base
    const hover = debug.effect.hover
    const quality = debug.effect.quality

    debug.layout.left = 480
    debug.effect.base.outerGlowWidth = 22
    debug.effect.hover.lift = 2
    debug.effect.quality.maxAlpha = 0.25
    debug.resetEffect()
    await nextTick()

    expect(debug.layout.left).toBe(480)
    expect(debug.effect).toEqual(MAP_EFFECT_DEFAULTS)
    expect(debug.effect).toBe(effect)
    expect(debug.effect.base).toBe(base)
    expect(debug.effect.hover).toBe(hover)
    expect(debug.effect.quality).toBe(quality)
    expect(debug.effect.quality).toEqual(MAP_EFFECT_DEFAULTS.quality)
    expect(JSON.parse(values.get(MAP_EFFECT_STORAGE_KEY)!)).toMatchObject({
      version: 2,
      quality: { maxAlpha: 1 }
    })
    expect(values.has(MAP_EFFECT_STORAGE_KEY_V1)).toBe(true)
  })

  it('persists deep v2 changes only to the v2 key and restores them after a module reload', async () => {
    const values = new Map<string, string>()
    const writes: Array<[string, string]> = []
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        writes.push([key, value])
        values.set(key, value)
      }
    })

    const { useMapDebug } = await import('./useMapDebug')
    const debug = useMapDebug()
    debug.effect.base.outerGlowNearRadiusRatio = 0.42
    debug.effect.hover.glowFarOpacityRatio = 0.63
    debug.effect.quality.maxAlpha = 0.25
    await nextTick()

    expect(values.has(MAP_EFFECT_STORAGE_KEY_V1)).toBe(false)
    expect(writes.every(([key]) => key === MAP_EFFECT_STORAGE_KEY)).toBe(true)
    expect(JSON.parse(values.get(MAP_EFFECT_STORAGE_KEY)!)).toMatchObject({
      version: 2,
      base: { outerGlowNearRadiusRatio: 0.42 },
      hover: { glowFarOpacityRatio: 0.63 },
      quality: { maxAlpha: 0.25 }
    })
    expect(writes.length).toBeGreaterThan(0)

    vi.resetModules()
    const { useMapDebug: reloadedUseMapDebug } = await import('./useMapDebug')
    const reloaded = reloadedUseMapDebug()
    expect(reloaded.effect.base.outerGlowNearRadiusRatio).toBe(0.42)
    expect(reloaded.effect.hover.glowFarOpacityRatio).toBe(0.63)
    expect(reloaded.effect.quality.maxAlpha).toBe(0.25)
  })

  it('converges watcher normalization and stops writing after the normalized state settles', async () => {
    const values = new Map<string, string>()
    const writes: Array<[string, string]> = []
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        writes.push([key, value])
        values.set(key, value)
      }
    })

    const { useMapDebug } = await import('./useMapDebug')
    const debug = useMapDebug()

    debug.effect.base.outerGlowColor = '#ABCDEF'
    debug.effect.base.outerGlowFalloff = 9
    debug.effect.hover.glowFalloff = -2
    debug.effect.hover.glowFarOpacityRatio = 3.1
    debug.effect.quality.maxAlpha = 1.5

    await nextTick()
    await nextTick()

    expect(debug.effect.base.outerGlowColor).toBe('#abcdef')
    expect(debug.effect.base.outerGlowFalloff).toBe(4)
    expect(debug.effect.hover.glowFalloff).toBe(0.25)
    expect(debug.effect.hover.glowFarOpacityRatio).toBe(2)
    expect(debug.effect.quality.maxAlpha).toBe(1)

    const persisted = JSON.parse(values.get(MAP_EFFECT_STORAGE_KEY)!)
    expect(persisted).toMatchObject({
      version: 2,
      base: {
        outerGlowColor: '#abcdef',
        outerGlowFalloff: 4
      },
      hover: {
        glowFalloff: 0.25,
        glowFarOpacityRatio: 2
      },
      quality: {
        maxAlpha: 1
      }
    })

    const writesAfterSettle = writes.length
    expect(writesAfterSettle).toBeGreaterThan(0)
    await nextTick()
    expect(writes.length).toBe(writesAfterSettle)
    expect(writes.every(([key]) => key === MAP_EFFECT_STORAGE_KEY)).toBe(true)
  })

  it('deduplicates runtime status updates without mutating when unchanged', async () => {
    const { DEFAULT_MAP_EFFECT_RUNTIME_STATUS, useMapDebug } = await import('./useMapDebug')
    const debug = useMapDebug()
    const assignSpy = vi.spyOn(Object, 'assign')
    const initial = debug.effectRuntimeStatus

    expect(debug.updateEffectRuntimeStatus({ ...DEFAULT_MAP_EFFECT_RUNTIME_STATUS })).toBe(false)
    expect(assignSpy).not.toHaveBeenCalled()
    expect(debug.effectRuntimeStatus).toBe(initial)
    expect(debug.effectRuntimeStatus).toEqual(DEFAULT_MAP_EFFECT_RUNTIME_STATUS)

    expect(debug.updateEffectRuntimeStatus({
      ...DEFAULT_MAP_EFFECT_RUNTIME_STATUS,
      targetWidth: 2,
      hoverState: 'active'
    })).toBe(true)
    expect(assignSpy).toHaveBeenCalledTimes(1)
    expect(debug.effectRuntimeStatus).toBe(initial)
    expect(debug.effectRuntimeStatus.targetWidth).toBe(2)
    expect(debug.effectRuntimeStatus.hoverState).toBe('active')
  })

  it('exposes the runtime status default with exact pipeline-compatible fields', async () => {
    const { DEFAULT_MAP_EFFECT_RUNTIME_STATUS } = await import('./useMapDebug')
    expect(DEFAULT_MAP_EFFECT_RUNTIME_STATUS).toEqual({
      targetWidth: 1,
      targetHeight: 1,
      renderScale: 0.5,
      baseState: 'enabled',
      hoverState: 'zero',
      degraded: false
    })
    expectTypeOf<MapOutwardGlowPipelineStatus['baseState']>()
      .toEqualTypeOf<'enabled' | 'zero' | 'disabled'>()
    expectTypeOf<MapOutwardGlowPipelineStatus['hoverState']>()
      .toEqualTypeOf<'ready' | 'active' | 'zero' | 'disabled'>()
  })

  it('applies changed configuration to existing static and hover glow materials', () => {
    const config = {
      ...MAP_EFFECT_DEFAULTS,
      base: {
        ...MAP_EFFECT_DEFAULTS.base,
        innerColor: '#123456',
        outerColor: '#789abc',
        outerCoreWidth: 3.5
      },
      hover: { ...MAP_EFFECT_DEFAULTS.hover, outlineColor: '#abcdef', outlineWidth: 5 }
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
    expect(staticGlow.outerCore.material.color.getHexString()).toBe('789abc')
    expect(staticGlow.outerCore.material.linewidth).toBe(3.5)
    expect(hoverGlow.core.material.color.getHexString()).toBe('abcdef')
    expect(hoverGlow.core.material.linewidth).toBe(5)
  })
})
