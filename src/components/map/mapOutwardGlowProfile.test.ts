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

  it('normalizes non-finite target inputs to finite safe metrics', () => {
    expect(computeGlowTargetMetrics(Number.NaN, Number.POSITIVE_INFINITY, Number.NaN, Number.NEGATIVE_INFINITY)).toEqual({
      width: 1,
      height: 1,
      pixelsPerCssPx: 0.5
    })
  })

  it('normalizes non-finite profile inputs to finite safe layers', () => {
    expect(deriveB3GlowProfile(Number.POSITIVE_INFINITY, Number.NaN, {
      width: 680,
      height: 680,
      pixelsPerCssPx: Number.POSITIVE_INFINITY
    })).toEqual({
      nearRadiusTexels: 0,
      farRadiusTexels: 0,
      nearOpacity: 0,
      farOpacity: 0
    })
  })

  it('keeps overflowing finite metric products finite and safe', () => {
    expect(computeGlowTargetMetrics(Number.MAX_VALUE, Number.MAX_VALUE, 2, 1)).toEqual({
      width: 1,
      height: 1,
      pixelsPerCssPx: 2
    })
    expect(deriveB3GlowProfile(Number.MAX_VALUE, 0.23, {
      width: 680,
      height: 680,
      pixelsPerCssPx: 2
    })).toEqual({
      nearRadiusTexels: 0,
      farRadiusTexels: 0,
      nearOpacity: 0.1909,
      farOpacity: 0.23
    })
  })

  it('disables glow for non-finite radius, opacity, or progress', () => {
    expect(isGlowEnabled(Number.NaN, 0.23, 1)).toBe(false)
    expect(isGlowEnabled(Number.POSITIVE_INFINITY, 0.23, 1)).toBe(false)
    expect(isGlowEnabled(54, Number.NaN, 1)).toBe(false)
    expect(isGlowEnabled(54, Number.POSITIVE_INFINITY, 1)).toBe(false)
    expect(isGlowEnabled(54, 0.23, Number.NaN)).toBe(false)
    expect(isGlowEnabled(54, 0.23, Number.POSITIVE_INFINITY)).toBe(false)
  })
})
