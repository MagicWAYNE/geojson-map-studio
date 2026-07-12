import { describe, expect, it } from 'vitest'
import {
  B3_GLOW_PROFILE_DEFAULTS,
  MAP_EFFECT_DEFAULTS,
  MAP_EFFECT_STORAGE_KEY,
  MAP_EFFECT_STORAGE_KEY_V1,
  formatMapEffectConfig,
  loadMapEffectConfig,
  normalizeMapEffectConfig,
  saveMapEffectConfig
} from './mapEffectConfig'

const V2_DEFAULTS = {
  version: 2,
  base: {
    innerColor: '#ffffff',
    innerWidth: 1.5,
    innerOpacity: 0.55,
    outerColor: '#ffffff',
    outerCoreWidth: 2,
    outerGlowEnabled: true,
    outerGlowColor: '#8ab7ff',
    outerGlowWidth: 72,
    outerGlowStrength: 0.48,
    outerGlowNearRadiusRatio: 0.35,
    outerGlowNearOpacityRatio: 0.83,
    outerGlowFarRadiusRatio: 1,
    outerGlowFarOpacityRatio: 1,
    outerGlowFalloff: 1,
    outerGlowEdgeSoftness: 0.96,
    outerGlowNearPasses: 2,
    outerGlowFarPasses: 4
  },
  hover: {
    surfaceColor: '#7fcbff',
    emissiveColor: '#22b4d8',
    emissiveIntensity: 0.5,
    outlineColor: '#d8f5ff',
    outlineWidth: 2.4,
    glowEnabled: false,
    glowColor: '#ffffff',
    glowWidth: 110,
    glowStrength: 0.15,
    glowNearRadiusRatio: 0.35,
    glowNearOpacityRatio: 0.83,
    glowFarRadiusRatio: 1,
    glowFarOpacityRatio: 1,
    glowFalloff: 1,
    glowEdgeSoftness: 0.96,
    glowNearPasses: 2,
    glowFarPasses: 4,
    lift: 2,
    enterMs: 400,
    leaveMs: 300
  },
  quality: {
    renderScale: 0.5,
    maxAlpha: 1
  }
} as const

const APPROVED_V1_DEFAULTS = {
  version: 1,
  base: {
    innerColor: '#ffffff',
    innerWidth: 1.5,
    innerOpacity: 0.55,
    outerColor: '#ffffff',
    outerCoreWidth: 2,
    outerGlowWidth: 0,
    outerGlowStrength: 0
  },
  hover: {
    surfaceColor: '#7fcbff',
    emissiveColor: '#22b4d8',
    emissiveIntensity: 0.5,
    outlineColor: '#d8f5ff',
    outlineWidth: 2.4,
    glowColor: '#27a7ff',
    glowWidth: 0,
    glowStrength: 0,
    lift: 2,
    enterMs: 400,
    leaveMs: 300
  }
} as const

const INITIAL_V1_DEFAULTS = {
  version: 1,
  base: {
    innerColor: '#4da3ff',
    innerWidth: 1,
    innerOpacity: 0.55,
    outerColor: '#7fcbff',
    outerCoreWidth: 1.8,
    outerGlowWidth: 10,
    outerGlowStrength: 0.3
  },
  hover: {
    surfaceColor: '#7fcbff',
    emissiveColor: '#168dff',
    emissiveIntensity: 0.8,
    outlineColor: '#d8f5ff',
    outlineWidth: 2.4,
    glowColor: '#27a7ff',
    glowWidth: 7,
    glowStrength: 0.35,
    lift: 1,
    enterMs: 180,
    leaveMs: 220
  }
} as const

const APPROVED_V1_CUSTOM_0 = {
  version: 1,
  base: {
    ...APPROVED_V1_DEFAULTS.base,
    innerWidth: 1.75,
    outerGlowWidth: 0
  },
  hover: {
    ...APPROVED_V1_DEFAULTS.hover,
    enterMs: 360
  }
} as const

describe('mapEffectConfig', () => {
  it('exports the exact v2 defaults and storage constants', () => {
    expect(B3_GLOW_PROFILE_DEFAULTS).toEqual({
      nearRadiusRatio: 0.35,
      nearOpacityRatio: 0.83,
      farRadiusRatio: 1,
      farOpacityRatio: 1,
      falloff: 1,
      edgeSoftness: 0.96,
      nearPasses: 2,
      farPasses: 4
    })
    expect(MAP_EFFECT_STORAGE_KEY).toBe('cq-map-effect-config-v2')
    expect(MAP_EFFECT_STORAGE_KEY_V1).toBe('cq-map-effect-config-v1')
    expect(MAP_EFFECT_DEFAULTS).toEqual(V2_DEFAULTS)
  })

  it('returns a deep-cloned default config', () => {
    const a = normalizeMapEffectConfig(undefined)
    const b = normalizeMapEffectConfig(undefined)

    expect(a).toEqual(V2_DEFAULTS)
    expect(b).toEqual(V2_DEFAULTS)
    expect(a).not.toBe(b)
    expect(a.base).not.toBe(b.base)
    expect(a.hover).not.toBe(b.hover)
    expect(a.quality!).not.toBe(b.quality!)

    a.base.innerWidth = 999
    a.hover.enterMs = 1
    a.quality!.renderScale = 1

    expect(MAP_EFFECT_DEFAULTS).toEqual(V2_DEFAULTS)
  })

  it('keeps exported defaults immutable enough that future loads are not poisoned', () => {
    const original = MAP_EFFECT_DEFAULTS.base.innerWidth
    const originalHover = MAP_EFFECT_DEFAULTS.hover.enterMs

    expect(() => {
      ;(MAP_EFFECT_DEFAULTS.base as { innerWidth: number }).innerWidth = 999
    }).toThrow()
    expect(() => {
      ;(MAP_EFFECT_DEFAULTS.hover as { enterMs: number }).enterMs = 1
    }).toThrow()

    expect(loadMapEffectConfig(null)).toEqual(V2_DEFAULTS)
    expect(MAP_EFFECT_DEFAULTS.base.innerWidth).toBe(original)
    expect(MAP_EFFECT_DEFAULTS.hover.enterMs).toBe(originalHover)
  })

  it('migrates approved v1 defaults to the new v2 defaults', () => {
    expect(loadMapEffectConfig({ getItem: (key) => key === MAP_EFFECT_STORAGE_KEY_V1 ? JSON.stringify(APPROVED_V1_DEFAULTS) : null }))
      .toEqual(V2_DEFAULTS)
  })

  it('migrates the initial blue v1 defaults to the new v2 defaults', () => {
    expect(loadMapEffectConfig({
      getItem: (key) => key === MAP_EFFECT_STORAGE_KEY_V1 ? JSON.stringify(INITIAL_V1_DEFAULTS) : null
    })).toEqual(V2_DEFAULTS)
  })

  it('preserves custom v1 values and explicit zeroes while filling v2 defaults', () => {
    expect(loadMapEffectConfig({ getItem: (key) => key === MAP_EFFECT_STORAGE_KEY_V1 ? JSON.stringify(APPROVED_V1_CUSTOM_0) : null }))
      .toEqual({
        ...V2_DEFAULTS,
        base: {
          ...V2_DEFAULTS.base,
          innerWidth: 1.75,
          outerGlowWidth: 0,
          outerGlowStrength: 0
        },
        hover: {
          ...V2_DEFAULTS.hover,
          glowColor: '#27a7ff',
          glowWidth: 0,
          glowStrength: 0,
          enterMs: 360
        }
      })
  })

  it('treats a near-match of the initial blue v1 defaults as custom, not as defaults', () => {
    const initialNearMatch = {
      ...INITIAL_V1_DEFAULTS,
      base: {
        ...INITIAL_V1_DEFAULTS.base,
        outerGlowStrength: 0.31
      }
    } as const

    expect(loadMapEffectConfig({
      getItem: (key) => key === MAP_EFFECT_STORAGE_KEY_V1 ? JSON.stringify(initialNearMatch) : null
    })).toEqual({
      ...V2_DEFAULTS,
      base: {
        ...V2_DEFAULTS.base,
        innerColor: '#4da3ff',
        innerWidth: 1,
        innerOpacity: 0.55,
        outerColor: '#7fcbff',
        outerCoreWidth: 1.8,
        outerGlowWidth: 10,
        outerGlowStrength: 0.31
      },
      hover: {
        ...V2_DEFAULTS.hover,
        surfaceColor: '#7fcbff',
        emissiveColor: '#168dff',
        emissiveIntensity: 0.8,
        outlineColor: '#d8f5ff',
        outlineWidth: 2.4,
        glowColor: '#27a7ff',
        glowWidth: 7,
        glowStrength: 0.35,
        lift: 1,
        enterMs: 180,
        leaveMs: 220
      }
    })
  })

  it('prefers valid v2 over v1, but does not fall back to v1 when v2 is broken', () => {
    const v1Reader = {
      getItem: (key: string) => {
        if (key === MAP_EFFECT_STORAGE_KEY) return '{broken-v2'
        if (key === MAP_EFFECT_STORAGE_KEY_V1) return JSON.stringify(APPROVED_V1_DEFAULTS)
        return null
      }
    }

    expect(loadMapEffectConfig(v1Reader)).toEqual(V2_DEFAULTS)
  })

  it('preserves a valid custom v2 cache instead of replacing it with tuned defaults', () => {
    const custom = {
      ...V2_DEFAULTS,
      base: { ...V2_DEFAULTS.base, outerGlowWidth: 91 },
      hover: { ...V2_DEFAULTS.hover, glowEnabled: true }
    }
    expect(loadMapEffectConfig({
      getItem: (key) => key === MAP_EFFECT_STORAGE_KEY ? JSON.stringify(custom) : null
    })).toEqual(custom)
  })

  it('normalizes legal v2 configs and rejects invalid v2 payloads', () => {
    expect(normalizeMapEffectConfig({
      version: 2,
      base: {
        innerColor: '#ABCDEF',
        innerWidth: 9,
        innerOpacity: -1,
        outerColor: '#123456',
        outerCoreWidth: 99,
        outerGlowEnabled: false,
        outerGlowColor: '#fedcba',
        outerGlowWidth: 200,
        outerGlowStrength: 9,
        outerGlowNearRadiusRatio: 0.21,
        outerGlowNearOpacityRatio: 0.77,
        outerGlowFarRadiusRatio: 2,
        outerGlowFarOpacityRatio: 2,
        outerGlowFalloff: 2,
        outerGlowEdgeSoftness: 1.2,
        outerGlowNearPasses: 2.6,
        outerGlowFarPasses: 7.4
      },
      hover: {
        surfaceColor: '#AA11CC',
        emissiveColor: '#BB22DD',
        emissiveIntensity: 9,
        outlineColor: '#CC33EE',
        outlineWidth: -5,
        glowEnabled: true,
        glowColor: '#DD44FF',
        glowWidth: -2,
        glowStrength: Infinity,
        glowNearRadiusRatio: 0.21,
        glowNearOpacityRatio: 0.77,
        glowFarRadiusRatio: 2,
        glowFarOpacityRatio: 2,
        glowFalloff: 2,
        glowEdgeSoftness: 1.2,
        glowNearPasses: 1.6,
        glowFarPasses: 7.4,
        lift: 99,
        enterMs: NaN,
        leaveMs: 160.4
      },
      quality: {
        renderScale: 0.6,
        maxAlpha: Infinity
      }
    })).toEqual({
      version: 2,
      base: {
        innerColor: '#abcdef',
        innerWidth: 4,
        innerOpacity: 0,
        outerColor: '#123456',
        outerCoreWidth: 6,
        outerGlowEnabled: false,
        outerGlowColor: '#fedcba',
        outerGlowWidth: 200,
        outerGlowStrength: 1,
        outerGlowNearRadiusRatio: 0.21,
        outerGlowNearOpacityRatio: 0.77,
        outerGlowFarRadiusRatio: 2,
        outerGlowFarOpacityRatio: 2,
        outerGlowFalloff: 2,
        outerGlowEdgeSoftness: 1,
        outerGlowNearPasses: 3,
        outerGlowFarPasses: 7
      },
      hover: {
        surfaceColor: '#aa11cc',
        emissiveColor: '#bb22dd',
        emissiveIntensity: 2,
        outlineColor: '#cc33ee',
        outlineWidth: 0,
        glowEnabled: true,
        glowColor: '#dd44ff',
        glowWidth: 0,
        glowStrength: 0.15,
        glowNearRadiusRatio: 0.21,
        glowNearOpacityRatio: 0.77,
        glowFarRadiusRatio: 2,
        glowFarOpacityRatio: 2,
        glowFalloff: 2,
        glowEdgeSoftness: 1,
        glowNearPasses: 2,
        glowFarPasses: 7,
        lift: 3,
        enterMs: 400,
        leaveMs: 160.4
      },
      quality: {
        renderScale: 0.5,
        maxAlpha: 1
      }
    })

    expect(normalizeMapEffectConfig({ version: 2, base: null, hover: null, quality: null }))
      .toEqual(V2_DEFAULTS)
    expect(normalizeMapEffectConfig({ version: 3, base: {}, hover: {}, quality: {} }))
      .toEqual(V2_DEFAULTS)
    expect(normalizeMapEffectConfig('nope')).toEqual(V2_DEFAULTS)
    expect(normalizeMapEffectConfig({})).toEqual(V2_DEFAULTS)
  })

  it('normalizes the expanded v2 glow and alpha limits for both channels', () => {
    const high = normalizeMapEffectConfig({
      version: 2,
      base: {
        outerGlowWidth: 300,
        outerGlowNearRadiusRatio: 3,
        outerGlowNearOpacityRatio: 3,
        outerGlowFarRadiusRatio: 3,
        outerGlowFarOpacityRatio: 3,
        outerGlowFalloff: 5,
        outerGlowEdgeSoftness: 2,
        outerGlowNearPasses: 8.6,
        outerGlowFarPasses: 7.6
      },
      hover: {
        glowWidth: 300,
        glowNearRadiusRatio: 3,
        glowNearOpacityRatio: 3,
        glowFarRadiusRatio: 3,
        glowFarOpacityRatio: 3,
        glowFalloff: 5,
        glowEdgeSoftness: 2,
        glowNearPasses: 8.6,
        glowFarPasses: 7.6
      },
      quality: { maxAlpha: 2 }
    })
    const low = normalizeMapEffectConfig({
      version: 2,
      base: {
        outerGlowWidth: -1,
        outerGlowNearRadiusRatio: -1,
        outerGlowNearOpacityRatio: -1,
        outerGlowFarRadiusRatio: -1,
        outerGlowFarOpacityRatio: -1,
        outerGlowFalloff: 0,
        outerGlowEdgeSoftness: -1,
        outerGlowNearPasses: 0.4,
        outerGlowFarPasses: 0.6
      },
      hover: {
        glowWidth: -1,
        glowNearRadiusRatio: -1,
        glowNearOpacityRatio: -1,
        glowFarRadiusRatio: -1,
        glowFarOpacityRatio: -1,
        glowFalloff: 0,
        glowEdgeSoftness: -1,
        glowNearPasses: 0.4,
        glowFarPasses: 0.6
      },
      quality: { maxAlpha: 0 }
    })

    expect(high.base).toMatchObject({
      outerGlowWidth: 200,
      outerGlowNearRadiusRatio: 1.5,
      outerGlowNearOpacityRatio: 2,
      outerGlowFarRadiusRatio: 2,
      outerGlowFarOpacityRatio: 2,
      outerGlowFalloff: 4,
      outerGlowEdgeSoftness: 1,
      outerGlowNearPasses: 8,
      outerGlowFarPasses: 8
    })
    expect(high.hover).toMatchObject({
      glowWidth: 200,
      glowNearRadiusRatio: 1.5,
      glowNearOpacityRatio: 2,
      glowFarRadiusRatio: 2,
      glowFarOpacityRatio: 2,
      glowFalloff: 4,
      glowEdgeSoftness: 1,
      glowNearPasses: 8,
      glowFarPasses: 8
    })
    expect(high.quality.maxAlpha).toBe(1)

    expect(low.base).toMatchObject({
      outerGlowWidth: 0,
      outerGlowNearRadiusRatio: 0,
      outerGlowNearOpacityRatio: 0,
      outerGlowFarRadiusRatio: 0.25,
      outerGlowFarOpacityRatio: 0,
      outerGlowFalloff: 0.25,
      outerGlowEdgeSoftness: 0,
      outerGlowNearPasses: 1,
      outerGlowFarPasses: 1
    })
    expect(low.hover).toMatchObject({
      glowWidth: 0,
      glowNearRadiusRatio: 0,
      glowNearOpacityRatio: 0,
      glowFarRadiusRatio: 0.25,
      glowFarOpacityRatio: 0,
      glowFalloff: 0.25,
      glowEdgeSoftness: 0,
      glowNearPasses: 1,
      glowFarPasses: 1
    })
    expect(low.quality.maxAlpha).toBe(0.1)
  })

  it('rounds passes after clamping and only accepts enumerated render scales', () => {
    const normalized = normalizeMapEffectConfig({
      version: 2,
      base: {
        outerGlowNearPasses: 2.4,
        outerGlowFarPasses: 7.6
      },
      hover: {
        glowNearPasses: 1.4,
        glowFarPasses: 7.6
      },
      quality: {
        renderScale: 0.6
      }
    })

    expect(normalized.base.outerGlowNearPasses).toBe(2)
    expect(normalized.base.outerGlowFarPasses).toBe(8)
    expect(normalized.hover.glowNearPasses).toBe(1)
    expect(normalized.hover.glowFarPasses).toBe(8)
    expect(normalized.quality!.renderScale).toBe(0.5)
  })

  it('writes v2 storage payloads with the new key', () => {
    const writes: Array<[string, string]> = []
    saveMapEffectConfig({
      setItem: (key, value) => writes.push([key, value])
    }, V2_DEFAULTS)

    expect(writes).toEqual([
      [MAP_EFFECT_STORAGE_KEY, JSON.stringify(V2_DEFAULTS)]
    ])
  })

  it('swallows storage write failures', () => {
    expect(() => saveMapEffectConfig({
      setItem: () => {
        throw new Error('denied')
      }
    }, V2_DEFAULTS)).not.toThrow()
  })

  it('formats and parses the v2 config without mutation', () => {
    const text = formatMapEffectConfig(V2_DEFAULTS)
    expect(text).toContain('"version": 2')
    expect(normalizeMapEffectConfig(JSON.parse(text))).toEqual(V2_DEFAULTS)
  })
})
