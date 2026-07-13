import { describe, expect, it } from 'vitest'
import {
  HOVER_MOSAIC_PARTICLE_DEFAULTS,
  assignMosaicParticleConfig,
  cloneMosaicParticleConfig,
  normalizeMosaicParticleConfig
} from './mapMosaicParticleConfig'

describe('mapMosaicParticleConfig', () => {
  it('exports the confirmed blue-purple hover defaults', () => {
    expect(HOVER_MOSAIC_PARTICLE_DEFAULTS).toEqual({
      enabled: true,
      primaryColor: '#4fc3ff',
      accentColor: '#a56dff',
      accentRatio: 0.2,
      density: 0.12,
      clusterChance: 0.16,
      clusterRadius: 2,
      clusterStrength: 1.35,
      accentClusterBias: 0.65,
      targetCellPx: 8,
      minCellPx: 4,
      maxCellPx: 14,
      gapRatio: 0.2,
      opacity: 0.5,
      brightness: 1.15,
      flickerHz: 3.2,
      dutyCycle: 0.35,
      pulseSharpness: 1.4,
      clusterFlickerScale: 0.65,
      burstDurationMs: 260,
      burstStrength: 1.6,
      burstDensityBoost: 0.18,
      surfaceOffset: 0.12,
      seed: 17,
      reseedOnEnter: true
    })
    expect(Object.isFrozen(HOVER_MOSAIC_PARTICLE_DEFAULTS)).toBe(true)
  })

  it('clones values and assigns in place', () => {
    const source = cloneMosaicParticleConfig(HOVER_MOSAIC_PARTICLE_DEFAULTS)
    source.seed = 42
    source.primaryColor = '#abcdef'
    const target = cloneMosaicParticleConfig(HOVER_MOSAIC_PARTICLE_DEFAULTS)

    assignMosaicParticleConfig(target, source)

    expect(target).toEqual(source)
    expect(target).not.toBe(source)
    expect(HOVER_MOSAIC_PARTICLE_DEFAULTS.seed).toBe(17)
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
      accentColor: '#a56dff',
      accentRatio: 1,
      density: 0,
      clusterChance: 0.16,
      clusterRadius: 5,
      clusterStrength: 3,
      accentClusterBias: 0,
      targetCellPx: 15,
      minCellPx: 5,
      maxCellPx: 15,
      gapRatio: 0.8,
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
})
