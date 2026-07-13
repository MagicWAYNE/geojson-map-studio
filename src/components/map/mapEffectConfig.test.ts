import { describe, expect, it } from 'vitest'
import {
  BASE_INWARD_GLOW_DEFAULTS,
  HOVER_INWARD_GLOW_DEFAULTS
} from './mapInwardGlowConfig'
import { HOVER_MOSAIC_PARTICLE_DEFAULTS } from './mapMosaicParticleConfig'
import {
  B3_GLOW_PROFILE_DEFAULTS,
  MAP_EFFECT_DEFAULTS,
  MAP_EFFECT_STORAGE_KEY,
  MAP_EFFECT_STORAGE_KEY_V1,
  MAP_EFFECT_STORAGE_KEY_V2,
  MAP_EFFECT_STORAGE_KEY_V3,
  assignMapEffectConfig,
  cloneMapEffectConfig,
  formatMapEffectConfig,
  loadMapEffectConfig,
  normalizeMapEffectConfig,
  saveMapEffectConfig
} from './mapEffectConfig'

const V4_DEFAULTS = {
  version: 4,
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
    surfaceColor: '#000000', emissiveColor: '#5edaf3', emissiveIntensity: 0.25,
    outlineColor: '#d8f5ff', outlineWidth: 2.4, glowEnabled: true,
    glowColor: '#ffffff', glowWidth: 64, glowStrength: 0.12,
    glowNearRadiusRatio: 0.46, glowNearOpacityRatio: 0.83,
    glowFarRadiusRatio: 1, glowFarOpacityRatio: 1, glowFalloff: 1,
    glowEdgeSoftness: 0.96, glowNearPasses: 2, glowFarPasses: 4,
    lift: 2, enterMs: 400, leaveMs: 300,
    inwardGlow: HOVER_INWARD_GLOW_DEFAULTS,
    mosaicParticles: HOVER_MOSAIC_PARTICLE_DEFAULTS
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

const CUSTOM_V3 = {
  version: 3,
  base: {
    ...V4_DEFAULTS.base,
    outerGlowWidth: 91,
    inwardGlow: {
      ...BASE_INWARD_GLOW_DEFAULTS,
      width: 44,
      wave: { enabled: true, periodMs: 700 }
    }
  },
  hover: {
    ...V4_DEFAULTS.hover,
    glowWidth: 77,
    inwardGlow: {
      ...HOVER_INWARD_GLOW_DEFAULTS,
      strength: 0.4,
      wave: { enabled: true, strength: 0.9 }
    }
  },
  quality: { renderScale: 0.75, maxAlpha: 0.8 }
} as const

describe('mapEffectConfig', () => {
  it('exports the exact v4 defaults and storage constants', () => {
    expect(B3_GLOW_PROFILE_DEFAULTS).toEqual({
      nearRadiusRatio: 0.35, nearOpacityRatio: 0.83, farRadiusRatio: 1,
      farOpacityRatio: 1, falloff: 1, edgeSoftness: 0.96, nearPasses: 2, farPasses: 4
    })
    expect(MAP_EFFECT_STORAGE_KEY).toBe('cq-map-effect-config-v4')
    expect(MAP_EFFECT_STORAGE_KEY_V3).toBe('cq-map-effect-config-v3')
    expect(MAP_EFFECT_STORAGE_KEY_V2).toBe('cq-map-effect-config-v2')
    expect(MAP_EFFECT_STORAGE_KEY_V1).toBe('cq-map-effect-config-v1')
    expect(MAP_EFFECT_DEFAULTS).toEqual(V4_DEFAULTS)
  })

  it('returns deep-cloned defaults without poisoning exported objects', () => {
    const a = normalizeMapEffectConfig(undefined)
    const b = normalizeMapEffectConfig(undefined)

    expect(a).toEqual(V4_DEFAULTS)
    expect(a).not.toBe(b)
    expect(a.base.inwardGlow).not.toBe(b.base.inwardGlow)
    expect(a.hover.inwardGlow).not.toBe(b.hover.inwardGlow)
    expect(a.hover.mosaicParticles).not.toBe(b.hover.mosaicParticles)

    a.hover.mosaicParticles.seed = 42
    a.base.inwardGlow.width = 1
    expect(MAP_EFFECT_DEFAULTS).toEqual(V4_DEFAULTS)
  })

  it('freezes exported defaults and nested effect configs', () => {
    expect(Object.isFrozen(MAP_EFFECT_DEFAULTS)).toBe(true)
    expect(Object.isFrozen(MAP_EFFECT_DEFAULTS.base)).toBe(true)
    expect(Object.isFrozen(MAP_EFFECT_DEFAULTS.base.inwardGlow)).toBe(true)
    expect(Object.isFrozen(MAP_EFFECT_DEFAULTS.hover.inwardGlow)).toBe(true)
    expect(Object.isFrozen(MAP_EFFECT_DEFAULTS.hover.mosaicParticles)).toBe(true)
    expect(Object.isFrozen(MAP_EFFECT_DEFAULTS.quality)).toBe(true)
  })

  it('migrates both known v1 defaults to v4 defaults', () => {
    for (const value of [APPROVED_V1_DEFAULTS, INITIAL_V1_DEFAULTS]) {
      expect(loadMapEffectConfig({
        getItem: (key) => key === MAP_EFFECT_STORAGE_KEY_V1 ? JSON.stringify(value) : null
      })).toEqual(V4_DEFAULTS)
    }
  })

  it('preserves custom v1 zeroes while filling v4 defaults', () => {
    const custom = {
      ...APPROVED_V1_DEFAULTS,
      base: { ...APPROVED_V1_DEFAULTS.base, innerWidth: 1.75 },
      hover: { ...APPROVED_V1_DEFAULTS.hover, enterMs: 360 }
    }
    const migrated = loadMapEffectConfig({
      getItem: (key) => key === MAP_EFFECT_STORAGE_KEY_V1 ? JSON.stringify(custom) : null
    })

    expect(migrated).toMatchObject({
      version: 4,
      base: { innerWidth: 1.75, outerGlowWidth: 0, inwardGlow: BASE_INWARD_GLOW_DEFAULTS },
      hover: {
        enterMs: 360,
        glowWidth: 0,
        inwardGlow: HOVER_INWARD_GLOW_DEFAULTS,
        mosaicParticles: HOVER_MOSAIC_PARTICLE_DEFAULTS
      }
    })
  })

  it('migrates v2 and fills stable inward and mosaic defaults', () => {
    const migrated = loadMapEffectConfig({
      getItem: (key) => key === MAP_EFFECT_STORAGE_KEY_V2 ? JSON.stringify(V2_DEFAULTS) : null
    })

    expect(migrated).toEqual({
      version: 4,
      base: { ...V2_DEFAULTS.base, inwardGlow: BASE_INWARD_GLOW_DEFAULTS },
      hover: {
        ...V2_DEFAULTS.hover,
        inwardGlow: HOVER_INWARD_GLOW_DEFAULTS,
        mosaicParticles: HOVER_MOSAIC_PARTICLE_DEFAULTS
      },
      quality: V2_DEFAULTS.quality
    })
  })

  it('migrates v3 custom values, drops waves, and fills mosaic defaults', () => {
    const migrated = loadMapEffectConfig({
      getItem: (key) => key === MAP_EFFECT_STORAGE_KEY_V3 ? JSON.stringify(CUSTOM_V3) : null
    })

    expect(migrated).toMatchObject({
      version: 4,
      base: { outerGlowWidth: 91, inwardGlow: { width: 44 } },
      hover: {
        glowWidth: 77,
        inwardGlow: { strength: 0.4 },
        mosaicParticles: HOVER_MOSAIC_PARTICLE_DEFAULTS
      },
      quality: { renderScale: 0.75, maxAlpha: 0.8 }
    })
    expect(migrated.base.inwardGlow).not.toHaveProperty('wave')
    expect(migrated.hover.inwardGlow).not.toHaveProperty('wave')
  })

  it('normalizes v4 stable inward and mosaic values', () => {
    const normalized = normalizeMapEffectConfig({
      version: 4,
      base: {
        innerColor: '#ABCDEF', innerWidth: 9, outerGlowWidth: 300,
        inwardGlow: { color: '#FEDCBA', width: 300, wave: { enabled: true } }
      },
      hover: {
        glowFalloff: -1,
        inwardGlow: { maxAlpha: 9 },
        mosaicParticles: { primaryColor: '#ABCDEF', density: 2, seed: 42.4 }
      },
      quality: { renderScale: 0.6, maxAlpha: Infinity }
    })

    expect(normalized).toMatchObject({
      version: 4,
      base: {
        innerColor: '#abcdef', innerWidth: 4, outerGlowWidth: 200,
        inwardGlow: { color: '#fedcba', width: 200 }
      },
      hover: {
        glowFalloff: 0.25,
        inwardGlow: { maxAlpha: 1 },
        mosaicParticles: { primaryColor: '#abcdef', density: 1, seed: 42 }
      },
      quality: { renderScale: 0.5, maxAlpha: 1 }
    })
    expect(normalized.base.inwardGlow).not.toHaveProperty('wave')
  })

  it('clones and assigns deeply while preserving target identities', () => {
    const source = cloneMapEffectConfig(MAP_EFFECT_DEFAULTS)
    source.base.inwardGlow.width = 44
    source.hover.inwardGlow.strength = 0.4
    source.hover.mosaicParticles.seed = 42
    const target = cloneMapEffectConfig(MAP_EFFECT_DEFAULTS)
    const base = target.base
    const hover = target.hover
    const quality = target.quality
    const baseInward = target.base.inwardGlow
    const hoverInward = target.hover.inwardGlow
    const mosaic = target.hover.mosaicParticles

    assignMapEffectConfig(target, source)

    expect(target).toEqual(source)
    expect(target.base).toBe(base)
    expect(target.hover).toBe(hover)
    expect(target.quality).toBe(quality)
    expect(target.base.inwardGlow).toBe(baseInward)
    expect(target.hover.inwardGlow).toBe(hoverInward)
    expect(target.hover.mosaicParticles).toBe(mosaic)
  })

  it('does not fall back to older storage when v4 is broken', () => {
    expect(loadMapEffectConfig({
      getItem: (key) => key === MAP_EFFECT_STORAGE_KEY
        ? '{broken-v4'
        : key === MAP_EFFECT_STORAGE_KEY_V3
          ? JSON.stringify(CUSTOM_V3)
          : null
    })).toEqual(V4_DEFAULTS)
  })

  it('writes and formats normalized v4 payloads', () => {
    const writes: Array<[string, string]> = []
    saveMapEffectConfig({ setItem: (key, value) => writes.push([key, value]) }, V4_DEFAULTS)

    expect(writes).toEqual([[MAP_EFFECT_STORAGE_KEY, JSON.stringify(V4_DEFAULTS)]])
    const text = formatMapEffectConfig(V4_DEFAULTS)
    expect(text).toContain('"version": 4')
    expect(text).not.toContain('"wave"')
    expect(normalizeMapEffectConfig(JSON.parse(text))).toEqual(V4_DEFAULTS)
  })

  it('swallows storage write failures', () => {
    expect(() => saveMapEffectConfig(
      { setItem: () => { throw new Error('denied') } },
      V4_DEFAULTS
    )).not.toThrow()
  })
})
