import { describe, expect, it } from 'vitest'
import {
  BASE_INWARD_GLOW_DEFAULTS,
  HOVER_INWARD_GLOW_DEFAULTS
} from './mapInwardGlowConfig'
import {
  B3_GLOW_PROFILE_DEFAULTS,
  MAP_EFFECT_DEFAULTS,
  MAP_EFFECT_STORAGE_KEY,
  MAP_EFFECT_STORAGE_KEY_V1,
  MAP_EFFECT_STORAGE_KEY_V2,
  assignMapEffectConfig,
  cloneMapEffectConfig,
  formatMapEffectConfig,
  loadMapEffectConfig,
  normalizeMapEffectConfig,
  saveMapEffectConfig
} from './mapEffectConfig'

const V3_DEFAULTS = {
  version: 3,
  base: {
    innerColor: '#ffffff', innerWidth: 1.5, innerOpacity: 0.55,
    outerColor: '#cad6fc', outerCoreWidth: 2, outerGlowEnabled: true,
    outerGlowColor: '#8ab7ff', outerGlowWidth: 100, outerGlowStrength: 0.35,
    outerGlowNearRadiusRatio: 0.5, outerGlowNearOpacityRatio: 1.2,
    outerGlowFarRadiusRatio: 0.6, outerGlowFarOpacityRatio: 0.75,
    outerGlowFalloff: 0.9, outerGlowEdgeSoftness: 0.9,
    outerGlowNearPasses: 4, outerGlowFarPasses: 4,
    inwardGlow: BASE_INWARD_GLOW_DEFAULTS
  },
  hover: {
    surfaceColor: '#7fcbff', emissiveColor: '#4894db', emissiveIntensity: 0.5,
    outlineColor: '#d8f5ff', outlineWidth: 2.4, glowEnabled: true,
    glowColor: '#ffffff', glowWidth: 64, glowStrength: 0.12,
    glowNearRadiusRatio: 0.46, glowNearOpacityRatio: 0.83,
    glowFarRadiusRatio: 1, glowFarOpacityRatio: 1, glowFalloff: 1,
    glowEdgeSoftness: 0.96, glowNearPasses: 2, glowFarPasses: 4,
    lift: 2, enterMs: 400, leaveMs: 300,
    inwardGlow: HOVER_INWARD_GLOW_DEFAULTS
  },
  quality: { renderScale: 0.5, maxAlpha: 1 }
} as const

const V2_DEFAULTS = {
  version: 2,
  base: {
    innerColor: '#ffffff', innerWidth: 1.5, innerOpacity: 0.55,
    outerColor: '#ffffff', outerCoreWidth: 2, outerGlowEnabled: true,
    outerGlowColor: '#8ab7ff', outerGlowWidth: 72, outerGlowStrength: 0.48,
    outerGlowNearRadiusRatio: 0.35, outerGlowNearOpacityRatio: 1.25,
    outerGlowFarRadiusRatio: 0.7, outerGlowFarOpacityRatio: 0.75,
    outerGlowFalloff: 0.9, outerGlowEdgeSoftness: 0.96,
    outerGlowNearPasses: 4, outerGlowFarPasses: 4
  },
  hover: {
    surfaceColor: '#7fcbff', emissiveColor: '#22b4d8', emissiveIntensity: 0.5,
    outlineColor: '#d8f5ff', outlineWidth: 2.4, glowEnabled: false,
    glowColor: '#ffffff', glowWidth: 110, glowStrength: 0.15,
    glowNearRadiusRatio: 0.35, glowNearOpacityRatio: 0.83,
    glowFarRadiusRatio: 1, glowFarOpacityRatio: 1, glowFalloff: 1,
    glowEdgeSoftness: 0.96, glowNearPasses: 2, glowFarPasses: 4,
    lift: 2, enterMs: 400, leaveMs: 300
  },
  quality: { renderScale: 0.5, maxAlpha: 1 }
} as const

const APPROVED_V1_DEFAULTS = {
  version: 1,
  base: {
    innerColor: '#ffffff', innerWidth: 1.5, innerOpacity: 0.55,
    outerColor: '#ffffff', outerCoreWidth: 2, outerGlowWidth: 0, outerGlowStrength: 0
  },
  hover: {
    surfaceColor: '#7fcbff', emissiveColor: '#22b4d8', emissiveIntensity: 0.5,
    outlineColor: '#d8f5ff', outlineWidth: 2.4, glowColor: '#27a7ff',
    glowWidth: 0, glowStrength: 0, lift: 2, enterMs: 400, leaveMs: 300
  }
} as const

const INITIAL_V1_DEFAULTS = {
  version: 1,
  base: {
    innerColor: '#4da3ff', innerWidth: 1, innerOpacity: 0.55,
    outerColor: '#7fcbff', outerCoreWidth: 1.8, outerGlowWidth: 10, outerGlowStrength: 0.3
  },
  hover: {
    surfaceColor: '#7fcbff', emissiveColor: '#168dff', emissiveIntensity: 0.8,
    outlineColor: '#d8f5ff', outlineWidth: 2.4, glowColor: '#27a7ff',
    glowWidth: 7, glowStrength: 0.35, lift: 1, enterMs: 180, leaveMs: 220
  }
} as const

const APPROVED_V1_CUSTOM_0 = {
  ...APPROVED_V1_DEFAULTS,
  base: { ...APPROVED_V1_DEFAULTS.base, innerWidth: 1.75, outerGlowWidth: 0 },
  hover: { ...APPROVED_V1_DEFAULTS.hover, enterMs: 360 }
} as const

describe('mapEffectConfig', () => {
  it('exports the exact v3 defaults and storage constants', () => {
    expect(B3_GLOW_PROFILE_DEFAULTS).toEqual({
      nearRadiusRatio: 0.35, nearOpacityRatio: 0.83, farRadiusRatio: 1,
      farOpacityRatio: 1, falloff: 1, edgeSoftness: 0.96, nearPasses: 2, farPasses: 4
    })
    expect(MAP_EFFECT_STORAGE_KEY).toBe('cq-map-effect-config-v3')
    expect(MAP_EFFECT_STORAGE_KEY_V2).toBe('cq-map-effect-config-v2')
    expect(MAP_EFFECT_STORAGE_KEY_V1).toBe('cq-map-effect-config-v1')
    expect(MAP_EFFECT_DEFAULTS).toEqual(V3_DEFAULTS)
  })

  it('returns a deep-cloned default config without poisoning exported defaults', () => {
    const a = normalizeMapEffectConfig(undefined)
    const b = normalizeMapEffectConfig(undefined)

    expect(a).toEqual(V3_DEFAULTS)
    expect(b).toEqual(V3_DEFAULTS)
    expect(a).not.toBe(b)
    expect(a.base).not.toBe(b.base)
    expect(a.hover).not.toBe(b.hover)
    expect(a.quality).not.toBe(b.quality)
    expect(a.base.inwardGlow).not.toBe(b.base.inwardGlow)
    expect(a.base.inwardGlow.wave).not.toBe(b.base.inwardGlow.wave)
    expect(a.hover.inwardGlow).not.toBe(b.hover.inwardGlow)
    expect(a.hover.inwardGlow.wave).not.toBe(b.hover.inwardGlow.wave)

    a.base.inwardGlow.wave.periodMs = 999
    a.hover.inwardGlow.width = 1
    expect(MAP_EFFECT_DEFAULTS).toEqual(V3_DEFAULTS)
  })

  it('keeps exported defaults and inward nested objects frozen', () => {
    expect(Object.isFrozen(MAP_EFFECT_DEFAULTS)).toBe(true)
    expect(Object.isFrozen(MAP_EFFECT_DEFAULTS.base)).toBe(true)
    expect(Object.isFrozen(MAP_EFFECT_DEFAULTS.base.inwardGlow)).toBe(true)
    expect(Object.isFrozen(MAP_EFFECT_DEFAULTS.base.inwardGlow.wave)).toBe(true)
    expect(Object.isFrozen(MAP_EFFECT_DEFAULTS.hover.inwardGlow)).toBe(true)
    expect(Object.isFrozen(MAP_EFFECT_DEFAULTS.hover.inwardGlow.wave)).toBe(true)
  })

  it('migrates both known v1 defaults to v3 defaults', () => {
    for (const value of [APPROVED_V1_DEFAULTS, INITIAL_V1_DEFAULTS]) {
      expect(loadMapEffectConfig({ getItem: (key) => key === MAP_EFFECT_STORAGE_KEY_V1 ? JSON.stringify(value) : null }))
        .toEqual(V3_DEFAULTS)
    }
  })

  it('preserves custom v1 values and explicit zeroes while filling v3 defaults', () => {
    expect(loadMapEffectConfig({ getItem: (key) => key === MAP_EFFECT_STORAGE_KEY_V1 ? JSON.stringify(APPROVED_V1_CUSTOM_0) : null }))
      .toEqual({
        ...V3_DEFAULTS,
        base: {
          ...V3_DEFAULTS.base, outerColor: '#ffffff',
          innerWidth: 1.75, outerGlowWidth: 0, outerGlowStrength: 0
        },
        hover: {
          ...V3_DEFAULTS.hover, emissiveColor: '#22b4d8', glowColor: '#27a7ff', glowWidth: 0,
          glowStrength: 0, enterMs: 360
        }
      })
  })

  it('treats a near-match of the initial blue v1 defaults as custom, not as defaults', () => {
    const initialNearMatch = {
      ...INITIAL_V1_DEFAULTS,
      base: { ...INITIAL_V1_DEFAULTS.base, outerGlowStrength: 0.31 }
    } as const

    expect(loadMapEffectConfig({
      getItem: (key) => key === MAP_EFFECT_STORAGE_KEY_V1 ? JSON.stringify(initialNearMatch) : null
    })).toEqual({
      ...V3_DEFAULTS,
      base: {
        ...V3_DEFAULTS.base,
        innerColor: '#4da3ff', innerWidth: 1, innerOpacity: 0.55,
        outerColor: '#7fcbff', outerCoreWidth: 1.8,
        outerGlowWidth: 10, outerGlowStrength: 0.31
      },
      hover: {
        ...V3_DEFAULTS.hover,
        surfaceColor: '#7fcbff', emissiveColor: '#168dff', emissiveIntensity: 0.8,
        outlineColor: '#d8f5ff', outlineWidth: 2.4, glowColor: '#27a7ff',
        glowWidth: 7, glowStrength: 0.35, lift: 1, enterMs: 180, leaveMs: 220
      }
    })
  })

  it('preserves custom v2 fields and fills v3 inward defaults', () => {
    const customV2 = { ...V2_DEFAULTS, base: { ...V2_DEFAULTS.base, outerGlowWidth: 91 } }
    expect(loadMapEffectConfig({
      getItem: (key) => key === MAP_EFFECT_STORAGE_KEY_V2 ? JSON.stringify(customV2) : null
    })).toEqual({
      version: 3,
      base: { ...customV2.base, inwardGlow: BASE_INWARD_GLOW_DEFAULTS },
      hover: { ...customV2.hover, inwardGlow: HOVER_INWARD_GLOW_DEFAULTS },
      quality: customV2.quality
    })
  })

  it('does not fall back to v2 or v1 when v3 exists but is broken', () => {
    expect(loadMapEffectConfig({
      getItem: (key) => key === MAP_EFFECT_STORAGE_KEY
        ? '{broken-v3'
        : key === MAP_EFFECT_STORAGE_KEY_V2
          ? JSON.stringify(V2_DEFAULTS)
          : JSON.stringify(APPROVED_V1_CUSTOM_0)
    })).toEqual(V3_DEFAULTS)
  })

  it('does not fall back to older storage when a syntactically valid v3 payload has the wrong schema', () => {
    expect(loadMapEffectConfig({
      getItem: (key) => key === MAP_EFFECT_STORAGE_KEY
        ? JSON.stringify({ version: 2 })
        : key === MAP_EFFECT_STORAGE_KEY_V2
          ? JSON.stringify(V2_DEFAULTS)
          : JSON.stringify(APPROVED_V1_CUSTOM_0)
    })).toEqual(V3_DEFAULTS)
  })

  it('normalizes v3 outer and inward fields while keeping all tuned outer fallbacks', () => {
    const normalized = normalizeMapEffectConfig({
      version: 3,
      base: {
        innerColor: '#ABCDEF', innerWidth: 9, outerGlowWidth: 300,
        outerGlowNearPasses: 2.6,
        inwardGlow: { color: '#FEDCBA', width: 300, wave: { periodMs: 1, easing: 'bounce' } }
      },
      hover: {
        glowEnabled: true, glowFalloff: -1,
        inwardGlow: { maxAlpha: 9, wave: { widthRatio: 2 } }
      },
      quality: { renderScale: 0.6, maxAlpha: Infinity }
    })

    expect(normalized).toMatchObject({
      version: 3,
      base: {
        innerColor: '#abcdef', innerWidth: 4, outerGlowWidth: 200, outerGlowNearPasses: 3,
        inwardGlow: { color: '#fedcba', width: 200, wave: { periodMs: 250, easing: 'ease-out' } }
      },
      hover: {
        glowEnabled: true, glowFalloff: 0.25,
        inwardGlow: { maxAlpha: 1, wave: { widthRatio: 1 } }
      },
      quality: { renderScale: 0.5, maxAlpha: 1 }
    })
    expect(normalized.base.outerGlowColor).toBe(V3_DEFAULTS.base.outerGlowColor)
    expect(normalized.hover.glowWidth).toBe(V3_DEFAULTS.hover.glowWidth)
    expect(normalizeMapEffectConfig({ version: 2, base: {}, hover: {}, quality: {} })).toEqual(V3_DEFAULTS)
  })

  it('clones and assigns deeply while preserving every target identity', () => {
    const source = cloneMapEffectConfig(MAP_EFFECT_DEFAULTS)
    source.base.inwardGlow.wave.periodMs = 4200
    source.hover.inwardGlow.wave.strength = 0.9
    const target = cloneMapEffectConfig(MAP_EFFECT_DEFAULTS)
    const base = target.base
    const hover = target.hover
    const quality = target.quality
    const baseInward = target.base.inwardGlow
    const hoverInward = target.hover.inwardGlow
    const baseWave = target.base.inwardGlow.wave
    const hoverWave = target.hover.inwardGlow.wave

    assignMapEffectConfig(target, source)

    expect(target).toEqual(source)
    expect(target.base).toBe(base)
    expect(target.hover).toBe(hover)
    expect(target.quality).toBe(quality)
    expect(target.base.inwardGlow).toBe(baseInward)
    expect(target.hover.inwardGlow).toBe(hoverInward)
    expect(target.base.inwardGlow.wave).toBe(baseWave)
    expect(target.hover.inwardGlow.wave).toBe(hoverWave)
  })

  it('writes and formats normalized v3 storage payloads', () => {
    const writes: Array<[string, string]> = []
    saveMapEffectConfig({ setItem: (key, value) => writes.push([key, value]) }, V3_DEFAULTS)

    expect(writes).toEqual([[MAP_EFFECT_STORAGE_KEY, JSON.stringify(V3_DEFAULTS)]])
    const text = formatMapEffectConfig(V3_DEFAULTS)
    expect(text).toContain('"version": 3')
    expect(normalizeMapEffectConfig(JSON.parse(text))).toEqual(V3_DEFAULTS)
  })

  it('swallows storage write failures', () => {
    expect(() => saveMapEffectConfig({ setItem: () => { throw new Error('denied') } }, V3_DEFAULTS)).not.toThrow()
  })
})
