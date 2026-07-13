import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'
import { nextTick } from 'vue'
import {
  MAP_EFFECT_DEFAULTS,
  MAP_EFFECT_STORAGE_KEY,
  MAP_EFFECT_STORAGE_KEY_V1,
  MAP_EFFECT_STORAGE_KEY_V2,
  cloneMapEffectConfig
} from '@/components/map/mapEffectConfig'
import { MAP_HUD_DEFAULTS } from '@/components/map/mapHudConfig'
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

describe('useMapDebug layout defaults', () => {
  it('uses the tuned layout when storage is empty and resetLayout restores it', async () => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    })
    const { MAP_LAYOUT_DEFAULT, useMapDebug } = await import('./useMapDebug')
    const expected = { left: 40, top: 230, width: 1000, height: 680 }
    const debug = useMapDebug()

    expect(MAP_LAYOUT_DEFAULT).toEqual(expected)
    expect(debug.layout).toEqual(expected)
    debug.layout.left = 480
    debug.layout.width = 720
    debug.resetLayout()
    expect(debug.layout).toEqual(expected)
  })

  it('keeps a valid saved layout ahead of tuned source defaults', async () => {
    const saved = { left: 88, top: 99, width: 777, height: 666 }
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => key === 'cq-map-debug-layout' ? JSON.stringify(saved) : null,
      setItem: vi.fn()
    })
    const { useMapDebug } = await import('./useMapDebug')
    expect(useMapDebug().layout).toEqual(saved)
  })
})

describe('useMapDebug effects', () => {
  it('keeps HUD tuning in the current session without using localStorage', async () => {
    const writes = vi.fn()
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: writes
    })

    const { useMapDebug } = await import('./useMapDebug')
    const debug = useMapDebug()
    debug.hud.anchor.x = 24
    debug.hud.rotating.speedDegPerSecond = -8
    await nextTick()

    expect(writes).not.toHaveBeenCalled()
    expect(debug.hud).toMatchObject({
      anchor: { x: 24 },
      rotating: { speedDegPerSecond: -8 }
    })

    vi.resetModules()
    const { useMapDebug: reloadedUseMapDebug } = await import('./useMapDebug')
    expect(reloadedUseMapDebug().hud).toEqual(MAP_HUD_DEFAULTS)
  })

  it('ignores v1, v2, and v3 effect caches while preserving the layout cache', async () => {
    const values = new Map<string, string>()
    const savedLayout = { left: 88, top: 99, width: 777, height: 666 }
    const cachedV3 = cloneMapEffectConfig(MAP_EFFECT_DEFAULTS)
    cachedV3.base.outerGlowWidth = 17
    const getItem = vi.fn((key: string) => values.get(key) ?? null)
    const setItem = vi.fn((key: string, value: string) => values.set(key, value))
    const removeItem = vi.fn((key: string) => values.delete(key))

    values.set('cq-map-debug-layout', JSON.stringify(savedLayout))
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
    values.set(MAP_EFFECT_STORAGE_KEY_V2, JSON.stringify({
      version: 2,
      base: { outerGlowWidth: 31 },
      hover: { glowWidth: 37 },
      quality: { renderScale: 1, maxAlpha: 0.25 }
    }))
    values.set(MAP_EFFECT_STORAGE_KEY, JSON.stringify(cachedV3))
    vi.stubGlobal('localStorage', {
      getItem,
      setItem,
      removeItem
    })

    const { useMapDebug } = await import('./useMapDebug')
    const debug = useMapDebug()

    expect(debug.effect).toEqual(MAP_EFFECT_DEFAULTS)
    expect(debug.layout).toEqual(savedLayout)
    for (const key of [MAP_EFFECT_STORAGE_KEY_V1, MAP_EFFECT_STORAGE_KEY_V2, MAP_EFFECT_STORAGE_KEY]) {
      expect(getItem).not.toHaveBeenCalledWith(key)
      expect(removeItem).not.toHaveBeenCalledWith(key)
      expect(values.has(key)).toBe(true)
    }
    expect(getItem).toHaveBeenCalledWith('cq-map-debug-layout')

    debug.layout.left = 480
    await nextTick()
    expect(setItem).toHaveBeenCalledWith(
      'cq-map-debug-layout',
      JSON.stringify({ ...savedLayout, left: 480 })
    )
  })

  it('keeps deep changes only for the current module session and reloads source defaults', async () => {
    const values = new Map<string, string>()
    const writes: Array<[string, string]> = []
    const getItem = vi.fn((key: string) => values.get(key) ?? null)
    const setItem = vi.fn((key: string, value: string) => {
      writes.push([key, value])
      values.set(key, value)
    })
    const removeItem = vi.fn((key: string) => values.delete(key))
    vi.stubGlobal('localStorage', {
      getItem,
      setItem,
      removeItem
    })

    const { useMapDebug } = await import('./useMapDebug')
    const debug = useMapDebug()
    debug.effect.base.outerGlowWidth = 42
    debug.effect.base.inwardGlow.wave.periodMs = 4200
    debug.effect.hover.inwardGlow.wave.strength = 0.9
    debug.effect.hover.glowFarOpacityRatio = 0.63
    await nextTick()

    expect(debug.effect.base.outerGlowWidth).toBe(42)
    expect(debug.effect.base.inwardGlow.wave.periodMs).toBe(4200)
    expect(debug.effect.hover.inwardGlow.wave.strength).toBe(0.9)
    expect(debug.effect.hover.glowFarOpacityRatio).toBe(0.63)
    expect(writes.filter(([key]) => key !== 'cq-map-debug-layout')).toEqual([])
    for (const key of [MAP_EFFECT_STORAGE_KEY_V1, MAP_EFFECT_STORAGE_KEY_V2, MAP_EFFECT_STORAGE_KEY]) {
      expect(getItem).not.toHaveBeenCalledWith(key)
      expect(removeItem).not.toHaveBeenCalledWith(key)
    }

    await nextTick()
    vi.resetModules()
    const { useMapDebug: reloadedUseMapDebug } = await import('./useMapDebug')
    const reloaded = reloadedUseMapDebug()
    expect(reloaded.effect).toEqual(MAP_EFFECT_DEFAULTS)
  })

  it('normalizes invalid deep values in place without writing an effect cache', async () => {
    const values = new Map<string, string>()
    const writes: Array<[string, string]> = []
    const getItem = vi.fn((key: string) => values.get(key) ?? null)
    const setItem = vi.fn((key: string, value: string) => {
      writes.push([key, value])
      values.set(key, value)
    })
    const removeItem = vi.fn((key: string) => values.delete(key))
    vi.stubGlobal('localStorage', {
      getItem,
      setItem,
      removeItem
    })

    const { useMapDebug } = await import('./useMapDebug')
    const debug = useMapDebug()

    debug.effect.base.outerGlowColor = '#ABCDEF'
    debug.effect.base.outerGlowFalloff = 9
    debug.effect.hover.glowFalloff = -2
    debug.effect.hover.glowFarOpacityRatio = 3.1
    debug.effect.quality.maxAlpha = 1.5
    debug.effect.base.inwardGlow.wave.periodMs = 99
    debug.effect.hover.inwardGlow.maxAlpha = 9

    await nextTick()
    await nextTick()

    expect(debug.effect.base.outerGlowColor).toBe('#abcdef')
    expect(debug.effect.base.outerGlowFalloff).toBe(4)
    expect(debug.effect.hover.glowFalloff).toBe(0.25)
    expect(debug.effect.hover.glowFarOpacityRatio).toBe(2)
    expect(debug.effect.quality.maxAlpha).toBe(1)
    expect(debug.effect.base.inwardGlow.wave.periodMs).toBe(250)
    expect(debug.effect.hover.inwardGlow.maxAlpha).toBe(1)
    await nextTick()
    expect(writes.filter(([key]) => key !== 'cq-map-debug-layout')).toEqual([])
    for (const key of [MAP_EFFECT_STORAGE_KEY_V1, MAP_EFFECT_STORAGE_KEY_V2, MAP_EFFECT_STORAGE_KEY]) {
      expect(getItem).not.toHaveBeenCalledWith(key)
      expect(removeItem).not.toHaveBeenCalledWith(key)
    }
  })

  it('resetEffect restores defaults without replacing any nested reactive object', async () => {
    const values = new Map<string, string>()
    const setItem = vi.fn((key: string, value: string) => values.set(key, value))
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem,
      removeItem: vi.fn((key: string) => values.delete(key))
    })
    const { useMapDebug } = await import('./useMapDebug')
    const debug = useMapDebug()
    const effect = debug.effect
    const base = effect.base
    const hover = effect.hover
    const quality = effect.quality
    const baseInward = base.inwardGlow
    const hoverInward = hover.inwardGlow
    const baseWave = baseInward.wave
    const hoverWave = hoverInward.wave

    effect.base.outerGlowWidth = 22
    effect.base.inwardGlow.wave.periodMs = 4200
    effect.hover.inwardGlow.wave.strength = 0.9
    effect.quality.maxAlpha = 0.25
    debug.resetEffect()
    await nextTick()

    expect(effect).toEqual(MAP_EFFECT_DEFAULTS)
    expect(debug.effect).toBe(effect)
    expect(debug.effect.base).toBe(base)
    expect(debug.effect.hover).toBe(hover)
    expect(debug.effect.quality).toBe(quality)
    expect(debug.effect.base.inwardGlow).toBe(baseInward)
    expect(debug.effect.hover.inwardGlow).toBe(hoverInward)
    expect(debug.effect.base.inwardGlow.wave).toBe(baseWave)
    expect(debug.effect.hover.inwardGlow.wave).toBe(hoverWave)
    expect(setItem).not.toHaveBeenCalledWith(MAP_EFFECT_STORAGE_KEY, expect.any(String))
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

    const inwardStatuses = [
      { ...DEFAULT_MAP_EFFECT_RUNTIME_STATUS, baseInwardState: 'zero' as const },
      { ...DEFAULT_MAP_EFFECT_RUNTIME_STATUS, hoverInwardState: 'active' as const },
      { ...DEFAULT_MAP_EFFECT_RUNTIME_STATUS, baseWaveActive: true },
      { ...DEFAULT_MAP_EFFECT_RUNTIME_STATUS, hoverWaveActive: true }
    ]
    expect(debug.updateEffectRuntimeStatus({ ...DEFAULT_MAP_EFFECT_RUNTIME_STATUS })).toBe(true)
    for (const status of inwardStatuses) {
      expect(debug.updateEffectRuntimeStatus(status)).toBe(true)
      expect(debug.updateEffectRuntimeStatus({ ...status })).toBe(false)
      expect(debug.updateEffectRuntimeStatus({ ...DEFAULT_MAP_EFFECT_RUNTIME_STATUS })).toBe(true)
    }
  })

  it('aligns the runtime status default with enabled effect defaults', async () => {
    const { DEFAULT_MAP_EFFECT_RUNTIME_STATUS } = await import('./useMapDebug')

    expect(MAP_EFFECT_DEFAULTS.base.outerGlowEnabled).toBe(true)
    expect(DEFAULT_MAP_EFFECT_RUNTIME_STATUS.baseState).toBe('enabled')

    expect(MAP_EFFECT_DEFAULTS.hover.glowEnabled).toBe(true)
    expect(DEFAULT_MAP_EFFECT_RUNTIME_STATUS.hoverState).toBe('ready')

    expect(MAP_EFFECT_DEFAULTS.base.inwardGlow.enabled).toBe(true)
    expect(MAP_EFFECT_DEFAULTS.base.inwardGlow.wave.enabled).toBe(false)
    expect(DEFAULT_MAP_EFFECT_RUNTIME_STATUS.baseInwardState).toBe('active')
    expect(DEFAULT_MAP_EFFECT_RUNTIME_STATUS.baseWaveActive).toBe(false)

    expect(MAP_EFFECT_DEFAULTS.hover.inwardGlow.enabled).toBe(true)
    expect(MAP_EFFECT_DEFAULTS.hover.inwardGlow.wave.enabled).toBe(false)
    expect(DEFAULT_MAP_EFFECT_RUNTIME_STATUS.hoverInwardState).toBe('ready')
    expect(DEFAULT_MAP_EFFECT_RUNTIME_STATUS.hoverWaveActive).toBe(false)
  })

  it('exposes the runtime status default with exact pipeline-compatible fields', async () => {
    const { DEFAULT_MAP_EFFECT_RUNTIME_STATUS } = await import('./useMapDebug')
    expect(DEFAULT_MAP_EFFECT_RUNTIME_STATUS).toEqual({
      targetWidth: 1,
      targetHeight: 1,
      renderScale: 0.5,
      baseState: 'enabled',
      hoverState: 'ready',
      baseInwardState: 'active',
      hoverInwardState: 'ready',
      baseWaveActive: false,
      hoverWaveActive: false,
      degraded: false
    })
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
