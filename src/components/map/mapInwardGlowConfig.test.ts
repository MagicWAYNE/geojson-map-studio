import { describe, expect, it } from 'vitest'
import {
  BASE_INWARD_GLOW_DEFAULTS,
  HOVER_INWARD_GLOW_DEFAULTS,
  assignInwardGlowConfig,
  cloneInwardGlowConfig,
  normalizeInwardGlowConfig
} from './mapInwardGlowConfig'

describe('mapInwardGlowConfig', () => {
  it('exports the exact B1 base and hover defaults', () => {
    expect(BASE_INWARD_GLOW_DEFAULTS).toEqual({
      enabled: true, color: '#ffffff', width: 48, strength: 0.18, maxAlpha: 0.5,
      nearRadiusRatio: 0.35, nearOpacityRatio: 0.83,
      farRadiusRatio: 1, farOpacityRatio: 1,
      falloff: 1, edgeSoftness: 0.96, nearPasses: 2, farPasses: 4,
      baseRatio: 0.7,
      wave: {
        enabled: true, widthRatio: 0.24, strength: 0.45,
        periodMs: 3600, delayMs: 0, travelRatio: 1,
        decay: 0.65, easing: 'ease-out'
      }
    })
    expect(HOVER_INWARD_GLOW_DEFAULTS).toMatchObject({
      enabled: true, color: '#d8f5ff', width: 64, strength: 0.22,
      maxAlpha: 0.6, baseRatio: 0.6,
      wave: { widthRatio: 0.22, strength: 0.65, periodMs: 1400, decay: 0.55 }
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
