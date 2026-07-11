import { describe, expect, it } from 'vitest'
import {
  computeGlowTargetMetrics,
  deriveB3GlowProfile,
  isGlowEnabled
} from './mapOutwardGlowProfile'

describe('mapOutwardGlowProfile', () => {
  it('uses DPR and half resolution while preserving CSS pixel scale', () => {
    expect(computeGlowTargetMetrics(680, 480, 2)).toEqual({
      width: 680,
      height: 480,
      pixelsPerCssPx: 1
    })
    expect(computeGlowTargetMetrics(680, 480, 1.25, 0.5)).toEqual({
      width: 425,
      height: 300,
      pixelsPerCssPx: 0.625
    })
  })

  it('derives B3 near-soft and far-long-tail layers', () => {
    const metrics = computeGlowTargetMetrics(680, 680, 2)
    expect(deriveB3GlowProfile(54, 0.23, metrics)).toEqual({
      nearRadiusTexels: 18.9,
      farRadiusTexels: 54,
      nearOpacity: 0.1909,
      farOpacity: 0.23
    })
  })

  it('skips zero radius, zero opacity, or invisible hover progress', () => {
    expect(isGlowEnabled(54, 0.23, 1)).toBe(true)
    expect(isGlowEnabled(0, 0.23, 1)).toBe(false)
    expect(isGlowEnabled(54, 0, 1)).toBe(false)
    expect(isGlowEnabled(54, 0.23, 0)).toBe(false)
  })
})
