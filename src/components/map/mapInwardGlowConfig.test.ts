import { describe, expect, it } from 'vitest'
import {
  BASE_INWARD_GLOW_DEFAULTS,
  HOVER_INWARD_GLOW_DEFAULTS,
  assignInwardGlowConfig,
  cloneInwardGlowConfig,
  normalizeInwardGlowConfig
} from './mapInwardGlowConfig'

describe('mapInwardGlowConfig', () => {
  it('exports the exact v3 base and hover inward glow defaults', () => {
    expect(BASE_INWARD_GLOW_DEFAULTS).toEqual({
      enabled: true, color: '#3c69eb', width: 36, strength: 0.75, maxAlpha: 0.5,
      nearRadiusRatio: 0.4, nearOpacityRatio: 0.8,
      farRadiusRatio: 0.6, farOpacityRatio: 1,
      falloff: 1.2, edgeSoftness: 1, nearPasses: 1, farPasses: 4,
      baseRatio: 0.7,
      wave: {
        enabled: false, widthRatio: 0.24, strength: 0.45,
        periodMs: 3600, delayMs: 0, travelRatio: 1,
        decay: 0.65, easing: 'ease-out'
      }
    })
    expect(HOVER_INWARD_GLOW_DEFAULTS).toEqual({
      enabled: true, color: '#d8f5ff', width: 64, strength: 0.22, maxAlpha: 0.6,
      nearRadiusRatio: 0.35, nearOpacityRatio: 0.83,
      farRadiusRatio: 1, farOpacityRatio: 1,
      falloff: 1, edgeSoftness: 0.96, nearPasses: 2, farPasses: 4,
      baseRatio: 0.6,
      wave: {
        enabled: false, widthRatio: 0.22, strength: 0.65,
        periodMs: 1400, delayMs: 0, travelRatio: 1,
        decay: 0.55, easing: 'ease-out'
      }
    })
  })

  it('deep-clones inward glow and wave objects', () => {
    const a = cloneInwardGlowConfig(BASE_INWARD_GLOW_DEFAULTS)
    const b = cloneInwardGlowConfig(BASE_INWARD_GLOW_DEFAULTS)
    expect(a).not.toBe(b)
    expect(a.wave).not.toBe(b.wave)
    a.wave.periodMs = 999
    expect(b.wave.periodMs).toBe(3600)
  })

  it('assigns values in place while preserving the target wave identity', () => {
    const target = cloneInwardGlowConfig(BASE_INWARD_GLOW_DEFAULTS)
    const wave = target.wave
    const source = cloneInwardGlowConfig(HOVER_INWARD_GLOW_DEFAULTS)

    assignInwardGlowConfig(target, source)

    expect(target).toEqual(source)
    expect(target.wave).toBe(wave)
    expect(target).not.toBe(source)
  })

  it('freezes default objects and their nested wave objects', () => {
    expect(Object.isFrozen(BASE_INWARD_GLOW_DEFAULTS)).toBe(true)
    expect(Object.isFrozen(BASE_INWARD_GLOW_DEFAULTS.wave)).toBe(true)
    expect(Object.isFrozen(HOVER_INWARD_GLOW_DEFAULTS)).toBe(true)
    expect(Object.isFrozen(HOVER_INWARD_GLOW_DEFAULTS.wave)).toBe(true)
  })

  it('normalizes every numeric range and invalid easing', () => {
    const value = normalizeInwardGlowConfig({
      color: '#ABCDEF', width: 999, strength: -1, maxAlpha: 2,
      nearRadiusRatio: 9, nearOpacityRatio: 9,
      farRadiusRatio: 0, farOpacityRatio: -1,
      falloff: 9, edgeSoftness: -1,
      nearPasses: 2.6, farPasses: 99, baseRatio: 2,
      wave: {
        enabled: true, widthRatio: 2, strength: 3,
        periodMs: 1, delayMs: 99999, travelRatio: 0,
        decay: 9, easing: 'bounce'
      }
    }, BASE_INWARD_GLOW_DEFAULTS)
    expect(value).toMatchObject({
      color: '#abcdef', width: 200, strength: 0, maxAlpha: 1,
      nearRadiusRatio: 1.5, nearOpacityRatio: 2,
      farRadiusRatio: 0.25, farOpacityRatio: 0,
      falloff: 4, edgeSoftness: 0,
      nearPasses: 3, farPasses: 8, baseRatio: 1,
      wave: {
        widthRatio: 1, strength: 2, periodMs: 250,
        delayMs: 5000, travelRatio: 0.25,
        decay: 4, easing: 'ease-out'
      }
    })
  })
})
