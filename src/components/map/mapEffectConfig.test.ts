import { describe, expect, it } from 'vitest'
import {
  BASE_INWARD_GLOW_DEFAULTS,
  HOVER_INWARD_GLOW_DEFAULTS
} from './mapInwardGlowConfig'
import { MAP_DISTRICT_BAR_DEFAULTS } from './mapDistrictBarConfig'
import { HOVER_MOSAIC_PARTICLE_DEFAULTS } from './mapMosaicParticleConfig'
import {
  B3_GLOW_PROFILE_DEFAULTS,
  MAP_EFFECT_DEFAULTS,
  MAP_EFFECT_STORAGE_KEY,
  MAP_EFFECT_STORAGE_KEY_V1,
  MAP_EFFECT_STORAGE_KEY_V2,
  MAP_EFFECT_STORAGE_KEY_V3,
  MAP_EFFECT_STORAGE_KEY_V4,
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

const V5_DEFAULTS = {
  ...V4_DEFAULTS,
  version: 5,
  bars: MAP_DISTRICT_BAR_DEFAULTS
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

describe('mapEffectConfig', () => {
  it('exports combined v5 defaults and storage constants', () => {
    expect(B3_GLOW_PROFILE_DEFAULTS).toEqual({
      nearRadiusRatio: 0.35, nearOpacityRatio: 0.83, farRadiusRatio: 1,
      farOpacityRatio: 1, falloff: 1, edgeSoftness: 0.96, nearPasses: 2, farPasses: 4
    })
    expect(MAP_EFFECT_STORAGE_KEY).toBe('cq-map-effect-config-v5')
    expect(MAP_EFFECT_STORAGE_KEY_V4).toBe('cq-map-effect-config-v4')
    expect(MAP_EFFECT_STORAGE_KEY_V3).toBe('cq-map-effect-config-v3')
    expect(MAP_EFFECT_STORAGE_KEY_V2).toBe('cq-map-effect-config-v2')
    expect(MAP_EFFECT_STORAGE_KEY_V1).toBe('cq-map-effect-config-v1')
    expect(MAP_EFFECT_DEFAULTS).toEqual(V5_DEFAULTS)
  })

  it('returns deep clones and freezes all exported nested defaults', () => {
    const a = normalizeMapEffectConfig(undefined)
    const b = normalizeMapEffectConfig(undefined)

    expect(a).toEqual(V5_DEFAULTS)
    expect(a).not.toBe(b)
    expect(a.base.inwardGlow).not.toBe(b.base.inwardGlow)
    expect(a.hover.inwardGlow).not.toBe(b.hover.inwardGlow)
    expect(a.hover.mosaicParticles).not.toBe(b.hover.mosaicParticles)
    expect(a.bars).not.toBe(b.bars)
    a.hover.mosaicParticles.seed = 42
    expect(MAP_EFFECT_DEFAULTS).toEqual(V5_DEFAULTS)

    expect(Object.isFrozen(MAP_EFFECT_DEFAULTS)).toBe(true)
    expect(Object.isFrozen(MAP_EFFECT_DEFAULTS.base.inwardGlow)).toBe(true)
    expect(Object.isFrozen(MAP_EFFECT_DEFAULTS.hover.inwardGlow)).toBe(true)
    expect(Object.isFrozen(MAP_EFFECT_DEFAULTS.hover.mosaicParticles)).toBe(true)
    expect(Object.isFrozen(MAP_EFFECT_DEFAULTS.bars)).toBe(true)
  })

  it('migrates known v1 defaults and preserves custom v1 values in v5', () => {
    expect(loadMapEffectConfig({
      getItem: (key) => key === MAP_EFFECT_STORAGE_KEY_V1
        ? JSON.stringify(APPROVED_V1_DEFAULTS)
        : null
    })).toEqual(V5_DEFAULTS)

    const custom = {
      ...APPROVED_V1_DEFAULTS,
      base: { ...APPROVED_V1_DEFAULTS.base, innerWidth: 1.75 },
      hover: { ...APPROVED_V1_DEFAULTS.hover, enterMs: 360 }
    }
    expect(loadMapEffectConfig({
      getItem: (key) => key === MAP_EFFECT_STORAGE_KEY_V1 ? JSON.stringify(custom) : null
    })).toMatchObject({
      version: 5,
      base: { innerWidth: 1.75, inwardGlow: BASE_INWARD_GLOW_DEFAULTS },
      hover: {
        enterMs: 360,
        inwardGlow: HOVER_INWARD_GLOW_DEFAULTS,
        mosaicParticles: HOVER_MOSAIC_PARTICLE_DEFAULTS
      },
      bars: MAP_DISTRICT_BAR_DEFAULTS
    })
  })

  it('migrates v2 and v3 while adding mosaic and bar defaults and dropping waves', () => {
    expect(loadMapEffectConfig({
      getItem: (key) => key === MAP_EFFECT_STORAGE_KEY_V2 ? JSON.stringify(V2_DEFAULTS) : null
    })).toEqual({
      version: 5,
      base: { ...V2_DEFAULTS.base, inwardGlow: BASE_INWARD_GLOW_DEFAULTS },
      hover: {
        ...V2_DEFAULTS.hover,
        inwardGlow: HOVER_INWARD_GLOW_DEFAULTS,
        mosaicParticles: HOVER_MOSAIC_PARTICLE_DEFAULTS
      },
      quality: V2_DEFAULTS.quality,
      bars: MAP_DISTRICT_BAR_DEFAULTS
    })

    const customV3 = {
      version: 3,
      base: {
        ...V4_DEFAULTS.base,
        outerGlowWidth: 91,
        inwardGlow: { ...BASE_INWARD_GLOW_DEFAULTS, width: 44, wave: { enabled: true } }
      },
      hover: {
        ...V4_DEFAULTS.hover,
        glowWidth: 77,
        inwardGlow: { ...HOVER_INWARD_GLOW_DEFAULTS, strength: 0.4, wave: { enabled: true } }
      },
      quality: { renderScale: 0.75, maxAlpha: 0.8 }
    }
    const migratedV3 = loadMapEffectConfig({
      getItem: (key) => key === MAP_EFFECT_STORAGE_KEY_V3 ? JSON.stringify(customV3) : null
    })
    expect(migratedV3).toMatchObject({
      version: 5,
      base: { outerGlowWidth: 91, inwardGlow: { width: 44 } },
      hover: {
        glowWidth: 77,
        inwardGlow: { strength: 0.4 },
        mosaicParticles: HOVER_MOSAIC_PARTICLE_DEFAULTS
      },
      quality: { renderScale: 0.75, maxAlpha: 0.8 },
      bars: MAP_DISTRICT_BAR_DEFAULTS
    })
    expect(migratedV3.base.inwardGlow).not.toHaveProperty('wave')
    expect(migratedV3.hover.inwardGlow).not.toHaveProperty('wave')
  })

  it('migrates v4 mosaic values into v5 and adds bar defaults', () => {
    const customV4 = {
      ...V4_DEFAULTS,
      hover: {
        ...V4_DEFAULTS.hover,
        mosaicParticles: { ...HOVER_MOSAIC_PARTICLE_DEFAULTS, density: 0.42 }
      }
    }
    expect(loadMapEffectConfig({
      getItem: (key) => key === MAP_EFFECT_STORAGE_KEY_V4 ? JSON.stringify(customV4) : null
    })).toEqual({
      ...customV4,
      version: 5,
      bars: MAP_DISTRICT_BAR_DEFAULTS
    })
  })

  it('normalizes combined v5 fields and drops legacy wave fields', () => {
    const normalized = normalizeMapEffectConfig({
      version: 5,
      base: {
        innerColor: '#ABCDEF', innerWidth: 9, outerGlowWidth: 300,
        inwardGlow: { color: '#FEDCBA', width: 300, wave: { enabled: true } }
      },
      hover: {
        glowFalloff: -1,
        inwardGlow: { maxAlpha: 9 },
        mosaicParticles: { primaryColor: '#ABCDEF', density: 2, seed: 42.4 }
      },
      quality: { renderScale: 0.6, maxAlpha: Infinity },
      bars: { color: '#ABCDEF', width: -1 }
    })

    expect(normalized).toMatchObject({
      version: 5,
      base: {
        innerColor: '#abcdef', innerWidth: 4, outerGlowWidth: 200,
        inwardGlow: { color: '#fedcba', width: 200 }
      },
      hover: {
        glowFalloff: 0.25,
        inwardGlow: { maxAlpha: 1 },
        mosaicParticles: { primaryColor: '#abcdef', density: 1, seed: 42 }
      },
      quality: { renderScale: 0.5, maxAlpha: 1 },
      bars: { color: '#abcdef', width: 0.25 }
    })
    expect(normalized.base.inwardGlow).not.toHaveProperty('wave')
    expect(normalized.hover.inwardGlow).not.toHaveProperty('wave')
  })

  it('resets saved bar tuning on load while retaining effects and mosaic values', () => {
    const saved = {
      ...V5_DEFAULTS,
      base: { ...V5_DEFAULTS.base, outerGlowWidth: 91 },
      hover: {
        ...V5_DEFAULTS.hover,
        mosaicParticles: { ...HOVER_MOSAIC_PARTICLE_DEFAULTS, density: 0.42 }
      },
      bars: { ...MAP_DISTRICT_BAR_DEFAULTS, width: 6.4 }
    }
    expect(loadMapEffectConfig({
      getItem: (key) => key === MAP_EFFECT_STORAGE_KEY ? JSON.stringify(saved) : null
    })).toEqual({
      ...saved,
      bars: MAP_DISTRICT_BAR_DEFAULTS
    })
  })

  it('clones and assigns deeply while preserving target identities', () => {
    const source = cloneMapEffectConfig(MAP_EFFECT_DEFAULTS)
    source.base.inwardGlow.width = 44
    source.hover.inwardGlow.strength = 0.4
    source.hover.mosaicParticles.seed = 42
    source.bars.hoverLift = 2.5
    const target = cloneMapEffectConfig(MAP_EFFECT_DEFAULTS)
    const identities = {
      base: target.base,
      hover: target.hover,
      quality: target.quality,
      bars: target.bars,
      baseInward: target.base.inwardGlow,
      hoverInward: target.hover.inwardGlow,
      mosaic: target.hover.mosaicParticles
    }

    assignMapEffectConfig(target, source)

    expect(target).toEqual(source)
    expect(target.base).toBe(identities.base)
    expect(target.hover).toBe(identities.hover)
    expect(target.quality).toBe(identities.quality)
    expect(target.bars).toBe(identities.bars)
    expect(target.base.inwardGlow).toBe(identities.baseInward)
    expect(target.hover.inwardGlow).toBe(identities.hoverInward)
    expect(target.hover.mosaicParticles).toBe(identities.mosaic)
  })

  it('does not fall back after broken v5 storage and writes normalized v5 payloads', () => {
    expect(loadMapEffectConfig({
      getItem: (key) => key === MAP_EFFECT_STORAGE_KEY
        ? '{broken-v5'
        : key === MAP_EFFECT_STORAGE_KEY_V4
          ? JSON.stringify(V4_DEFAULTS)
          : null
    })).toEqual(V5_DEFAULTS)

    const writes: Array<[string, string]> = []
    saveMapEffectConfig({ setItem: (key, value) => writes.push([key, value]) }, V5_DEFAULTS)
    expect(writes).toEqual([[MAP_EFFECT_STORAGE_KEY, JSON.stringify(V5_DEFAULTS)]])
    const text = formatMapEffectConfig(V5_DEFAULTS)
    expect(text).toContain('"version": 5')
    expect(text).not.toContain('"wave"')
    expect(normalizeMapEffectConfig(JSON.parse(text))).toEqual(V5_DEFAULTS)
    expect(() => saveMapEffectConfig(
      { setItem: () => { throw new Error('denied') } },
      V5_DEFAULTS
    )).not.toThrow()
  })
})
