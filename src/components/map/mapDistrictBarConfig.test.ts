import { describe, expect, it } from 'vitest'
import {
  MAP_DISTRICT_BAR_DEFAULTS,
  normalizeDistrictBarConfig
} from './mapDistrictBarConfig'

describe('mapDistrictBarConfig', () => {
  it('exports the exact defaults', () => {
    expect(MAP_DISTRICT_BAR_DEFAULTS).toEqual({
      enabled: true, color: '#39c9ff', opacity: 0.72, width: 2.8,
      minHeight: 3, maxHeight: 20, sqrtExponent: 0.5, glowStrength: 0.8,
      baseRingRadius: 1.65, baseRingOpacity: 0.38,
      enterMs: 760, staggerMs: 90,
      hoverEmissiveIntensity: 1.35, hoverLift: 1.1
    })
  })

  it('normalizes colors, finite numbers, bounds, and height ordering', () => {
    expect(normalizeDistrictBarConfig({
      color: '#ABCDEF', opacity: 9, width: -1, minHeight: 30,
      maxHeight: -2, sqrtExponent: Infinity, enterMs: -1
    })).toMatchObject({
      color: '#abcdef', opacity: 1, width: 0.25,
      minHeight: 24, maxHeight: 24, sqrtExponent: 0.5, enterMs: 0
    })
  })

  it('clamps every numeric field to its documented range', () => {
    expect(normalizeDistrictBarConfig({
      opacity: -1, width: 99, minHeight: -1, maxHeight: 99,
      sqrtExponent: 0, glowStrength: 9, baseRingRadius: -1,
      baseRingOpacity: 9, enterMs: 9999, staggerMs: -1,
      hoverEmissiveIntensity: 9, hoverLift: -1
    })).toMatchObject({
      opacity: 0, width: 8, minHeight: 0, maxHeight: 24,
      sqrtExponent: 0.25, glowStrength: 2, baseRingRadius: 0,
      baseRingOpacity: 1, enterMs: 3000, staggerMs: 0,
      hoverEmissiveIntensity: 3, hoverLift: 0
    })
  })
})
