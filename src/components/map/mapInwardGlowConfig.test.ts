import { describe, expect, it } from 'vitest'
import {
  BASE_INWARD_GLOW_DEFAULTS,
  HOVER_INWARD_GLOW_DEFAULTS,
  assignInwardGlowConfig,
  cloneInwardGlowConfig,
  normalizeInwardGlowConfig
} from './mapInwardGlowConfig'

describe('mapInwardGlowConfig', () => {
  it('exports the exact wave-free base and hover inward glow defaults', () => {
    expect(BASE_INWARD_GLOW_DEFAULTS).toEqual({
      enabled: true, color: '#3c69eb', width: 36, strength: 0.75, maxAlpha: 0.5,
      nearRadiusRatio: 0.4, nearOpacityRatio: 0.8,
      farRadiusRatio: 0.6, farOpacityRatio: 1,
      falloff: 1.2, edgeSoftness: 1, nearPasses: 1, farPasses: 4,
      baseRatio: 0.7
    })
    expect(HOVER_INWARD_GLOW_DEFAULTS).toEqual({
      enabled: true, color: '#d8f5ff', width: 64, strength: 0.22, maxAlpha: 0.6,
      nearRadiusRatio: 0.35, nearOpacityRatio: 0.83,
      farRadiusRatio: 1, farOpacityRatio: 1,
      falloff: 1, edgeSoftness: 0.96, nearPasses: 2, farPasses: 4,
      baseRatio: 0.6
    })
  })

  it('clones values without sharing the source object', () => {
    const a = cloneInwardGlowConfig(BASE_INWARD_GLOW_DEFAULTS)
    const b = cloneInwardGlowConfig(BASE_INWARD_GLOW_DEFAULTS)
    expect(a).not.toBe(b)
    a.width = 99
    expect(b.width).toBe(36)
  })

  it('assigns values in place', () => {
    const target = cloneInwardGlowConfig(BASE_INWARD_GLOW_DEFAULTS)
    const source = cloneInwardGlowConfig(HOVER_INWARD_GLOW_DEFAULTS)

    assignInwardGlowConfig(target, source)

    expect(target).toEqual(source)
    expect(target).not.toBe(source)
  })

  it('freezes the wave-free default objects', () => {
    expect(Object.isFrozen(BASE_INWARD_GLOW_DEFAULTS)).toBe(true)
    expect(Object.isFrozen(HOVER_INWARD_GLOW_DEFAULTS)).toBe(true)
  })

  it('normalizes stable inward fields and ignores retired wave payloads', () => {
    const value = normalizeInwardGlowConfig({
      color: '#ABCDEF', width: 999, strength: -1, maxAlpha: 2,
      nearRadiusRatio: 9, nearOpacityRatio: 9,
      farRadiusRatio: 0, farOpacityRatio: -1,
      falloff: 9, edgeSoftness: -1,
      nearPasses: 2.6, farPasses: 99, baseRatio: 2,
      wave: { enabled: true, periodMs: 250 }
    }, BASE_INWARD_GLOW_DEFAULTS)

    expect(value).toEqual({
      enabled: true,
      color: '#abcdef', width: 200, strength: 0, maxAlpha: 1,
      nearRadiusRatio: 1.5, nearOpacityRatio: 2,
      farRadiusRatio: 0.25, farOpacityRatio: 0,
      falloff: 4, edgeSoftness: 0,
      nearPasses: 3, farPasses: 8, baseRatio: 1
    })
    expect(value).not.toHaveProperty('wave')
  })
})
