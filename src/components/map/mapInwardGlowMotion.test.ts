import { describe, expect, it } from 'vitest'
import {
  BASE_INWARD_GLOW_DEFAULTS,
  type InwardWaveEasing
} from './mapInwardGlowConfig'
import {
  computeInwardWavePhase,
  easeInwardWave
} from './mapInwardGlowMotion'

describe('mapInwardGlowMotion', () => {
  it.each([
    ['linear', 0.5, 0.5],
    ['ease-in', 0.5, 0.25],
    ['ease-out', 0.5, 0.75],
    ['ease-in-out', 0.25, 0.125]
  ])('applies %s easing', (easing, input, expected) => {
    expect(easeInwardWave(input, easing as InwardWaveEasing)).toBeCloseTo(expected)
  })

  it('waits for delay, loops by period, and reports an eased phase', () => {
    const wave = { ...BASE_INWARD_GLOW_DEFAULTS.wave, delayMs: 200, periodMs: 1000 }

    expect(computeInwardWavePhase(1199, 1000, wave)).toEqual({ active: false, phase: 0 })
    expect(computeInwardWavePhase(1700, 1000, wave)).toEqual({ active: true, phase: 0.75 })
    expect(computeInwardWavePhase(2200, 1000, wave)).toEqual({ active: true, phase: 0 })
  })

  it('returns an inactive phase for disabled waves and non-finite times', () => {
    const wave = { ...BASE_INWARD_GLOW_DEFAULTS.wave }
    const inactive = { active: false, phase: 0 }

    expect(computeInwardWavePhase(1500, 1000, { ...wave, enabled: false })).toEqual(inactive)
    expect(computeInwardWavePhase(Number.NaN, 1000, wave)).toEqual(inactive)
    expect(computeInwardWavePhase(1500, Number.POSITIVE_INFINITY, wave)).toEqual(inactive)
    expect(computeInwardWavePhase(Number.NEGATIVE_INFINITY, 1000, wave)).toEqual(inactive)
  })
})
