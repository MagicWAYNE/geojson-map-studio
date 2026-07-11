import { describe, expect, it } from 'vitest'
import {
  computeGlowTargetMetrics,
  deriveGlowProfile,
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

  it('derives a configurable glow profile from CSS pixels and ratios', () => {
    expect(deriveGlowProfile({
      radiusCssPx: 54,
      opacity: 0.23,
      nearRadiusRatio: 0.35,
      nearOpacityRatio: 0.83,
      farRadiusRatio: 1,
      farOpacityRatio: 1
    }, { width: 680, height: 680, pixelsPerCssPx: 1 })).toEqual({
      nearRadiusTexels: 18.9,
      farRadiusTexels: 54,
      nearOpacity: 0.1909,
      farOpacity: 0.23
    })
  })

  it('scales the profile with pixelsPerCssPx and custom ratios', () => {
    expect(deriveGlowProfile({
      radiusCssPx: 40,
      opacity: 0.4,
      nearRadiusRatio: 0.5,
      nearOpacityRatio: 1.5,
      farRadiusRatio: 1.25,
      farOpacityRatio: 2
    }, { width: 320, height: 240, pixelsPerCssPx: 0.625 })).toEqual({
      nearRadiusTexels: 12.5,
      farRadiusTexels: 31.25,
      nearOpacity: 0.6,
      farOpacity: 0.8
    })
  })

  it('normalizes non-finite target inputs to finite safe metrics', () => {
    expect(computeGlowTargetMetrics(Number.NaN, Number.POSITIVE_INFINITY, Number.NaN, Number.NEGATIVE_INFINITY)).toEqual({
      width: 1,
      height: 1,
      pixelsPerCssPx: 0.5
    })
  })

  it('normalizes non-finite profile inputs to finite safe layers', () => {
    const profile = deriveGlowProfile({
      radiusCssPx: Number.POSITIVE_INFINITY,
      opacity: Number.NaN,
      nearRadiusRatio: Number.NEGATIVE_INFINITY,
      nearOpacityRatio: Number.POSITIVE_INFINITY,
      farRadiusRatio: Number.NaN,
      farOpacityRatio: Number.NEGATIVE_INFINITY
    }, {
      width: 680,
      height: 680,
      pixelsPerCssPx: Number.POSITIVE_INFINITY
    })

    expect(profile).toEqual({
      nearRadiusTexels: 0,
      farRadiusTexels: 0,
      nearOpacity: 0,
      farOpacity: 0
    })
    expect(Number.isFinite(profile.nearRadiusTexels)).toBe(true)
    expect(Number.isFinite(profile.farRadiusTexels)).toBe(true)
    expect(Number.isFinite(profile.nearOpacity)).toBe(true)
    expect(Number.isFinite(profile.farOpacity)).toBe(true)
  })

  it('preserves opacity ratios above 1 without clamping the result to 1', () => {
    expect(deriveGlowProfile({
      radiusCssPx: 20,
      opacity: 0.9,
      nearRadiusRatio: 0.25,
      nearOpacityRatio: 1.5,
      farRadiusRatio: 1,
      farOpacityRatio: 2
    }, { width: 680, height: 680, pixelsPerCssPx: 1 })).toEqual({
      nearRadiusTexels: 5,
      farRadiusTexels: 20,
      nearOpacity: 1.35,
      farOpacity: 1.8
    })
  })

  it('short-circuits disabled glow before checking numeric inputs', () => {
    expect(isGlowEnabled(false, 54, 0.23, 1)).toBe(false)
    expect(isGlowEnabled(true, 54, 0.23, 1)).toBe(true)
    expect(isGlowEnabled(true, 0, 0.23, 1)).toBe(false)
    expect(isGlowEnabled(true, 54, 0, 1)).toBe(false)
    expect(isGlowEnabled(true, 54, 0.23, 0)).toBe(false)
    expect(isGlowEnabled(true, Number.NaN, 0.23, 1)).toBe(false)
    expect(isGlowEnabled(true, 54, Number.POSITIVE_INFINITY, 1)).toBe(false)
    expect(isGlowEnabled(true, 54, 0.23, Number.NEGATIVE_INFINITY)).toBe(false)
  })
})
