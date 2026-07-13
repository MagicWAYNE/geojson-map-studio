import { describe, expect, it } from 'vitest'
import {
  BLUE_PURPLE_MOSAIC_PARTICLE_PRESET,
  HOVER_MOSAIC_PARTICLE_DEFAULTS,
  MOSAIC_MIN_LOD_RANGE_RATIO,
  assignMosaicParticleConfig,
  cloneMosaicParticleConfig,
  normalizeMosaicParticleConfig
} from './mapMosaicParticleConfig'

describe('mapMosaicParticleConfig', () => {
  it('exports the confirmed hover mosaic defaults', () => {
    expect(HOVER_MOSAIC_PARTICLE_DEFAULTS).toEqual({
      enabled: true,
      primaryColor: '#4fc3ff',
      accentColor: '#ffffff',
      accentRatio: 0.2,
      density: 0.99,
      clusterChance: 0.15,
      clusterRadius: 1,
      clusterStrength: 0.7,
      accentClusterBias: 0.65,
      targetCellPx: 4,
      minCellPx: 4,
      maxCellPx: 5,
      gapRatio: 0.2,
      gapColor: '#ffffff',
      gapOpacity: 0,
      opacity: 0.24,
      brightness: 1.15,
      flickerHz: 0.3,
      dutyCycle: 0.35,
      pulseSharpness: 1.4,
      clusterFlickerScale: 0.65,
      burstDurationMs: 260,
      burstStrength: 1.6,
      burstDensityBoost: 0.18,
      surfaceOffset: 0.12,
      seed: 6768,
      reseedOnEnter: true
    })
    expect(Object.isFrozen(HOVER_MOSAIC_PARTICLE_DEFAULTS)).toBe(true)
  })

  it('keeps the blue-purple reference preset independent from tuned defaults', () => {
    expect(BLUE_PURPLE_MOSAIC_PARTICLE_PRESET).toMatchObject({
      primaryColor: '#4fc3ff',
      accentColor: '#a56dff',
      density: 0.12,
      targetCellPx: 8,
      seed: 17
    })
    expect(BLUE_PURPLE_MOSAIC_PARTICLE_PRESET).not.toEqual(
      HOVER_MOSAIC_PARTICLE_DEFAULTS
    )
    expect(Object.isFrozen(BLUE_PURPLE_MOSAIC_PARTICLE_PRESET)).toBe(true)
  })

  it('clones values and assigns in place', () => {
    const source = cloneMosaicParticleConfig(HOVER_MOSAIC_PARTICLE_DEFAULTS)
    source.seed = 42
    source.primaryColor = '#abcdef'
    const target = cloneMosaicParticleConfig(HOVER_MOSAIC_PARTICLE_DEFAULTS)

    assignMosaicParticleConfig(target, source)

    expect(target).toEqual(source)
    expect(target).not.toBe(source)
    expect(HOVER_MOSAIC_PARTICLE_DEFAULTS.seed).toBe(6768)
  })

  it('normalizes colors, finite ranges, integers, booleans, and cell-size ordering', () => {
    expect(normalizeMosaicParticleConfig({
      enabled: false,
      primaryColor: '#ABCDEF',
      accentColor: 'violet',
      accentRatio: 2,
      density: -1,
      clusterChance: Number.NaN,
      clusterRadius: 4.6,
      clusterStrength: 9,
      accentClusterBias: -1,
      targetCellPx: 30,
      minCellPx: 15,
      maxCellPx: 5,
      gapRatio: 2,
      gapColor: 'cyan',
      gapOpacity: 2,
      opacity: -1,
      brightness: 9,
      flickerHz: 0,
      dutyCycle: 2,
      pulseSharpness: 0,
      clusterFlickerScale: 9,
      burstDurationMs: 9999,
      burstStrength: -1,
      burstDensityBoost: 2,
      surfaceOffset: -1,
      seed: 10000.7,
      reseedOnEnter: false
    })).toEqual({
      enabled: false,
      primaryColor: '#abcdef',
      accentColor: '#ffffff',
      accentRatio: 1,
      density: 0,
      clusterChance: 0.15,
      clusterRadius: 5,
      clusterStrength: 3,
      accentClusterBias: 0,
      targetCellPx: 15,
      minCellPx: 5,
      maxCellPx: 15,
      gapRatio: 0.8,
      gapColor: '#ffffff',
      gapOpacity: 1,
      opacity: 0,
      brightness: 3,
      flickerHz: 0.1,
      dutyCycle: 1,
      pulseSharpness: 0.25,
      clusterFlickerScale: 3,
      burstDurationMs: 1500,
      burstStrength: 0,
      burstDensityBoost: 1,
      surfaceOffset: 0,
      seed: 9999,
      reseedOnEnter: false
    })
  })

  it('widens an equal pixel range enough to contain a fixed LOD level', () => {
    const normalized = normalizeMosaicParticleConfig({
      targetCellPx: 8,
      minCellPx: 8,
      maxCellPx: 8
    })

    expect(normalized.minCellPx).toBe(8)
    expect(normalized.maxCellPx).toBeCloseTo(8 * MOSAIC_MIN_LOD_RANGE_RATIO, 10)
    expect(normalized.targetCellPx).toBe(8)
  })
})
