import { describe, expect, it } from 'vitest'
import {
  deriveMosaicActivationSeed,
  hashMosaicStableId,
  isMosaicAccent,
  isMosaicCluster,
  mosaicBurstEnvelope,
  mosaicClusterField,
  mosaicClusterInfluence,
  mosaicPulse,
  mosaicRandom
} from './mapMosaicDynamics'

describe('mapMosaicDynamics', () => {
  it('creates deterministic region and activation seeds', () => {
    expect(hashMosaicStableId('hello')).toBe(0x4f9f2cab)
    expect(deriveMosaicActivationSeed(17, '测试区', 0))
      .toBe(deriveMosaicActivationSeed(17, '测试区', 0))
    expect(deriveMosaicActivationSeed(17, '测试区', 1))
      .not.toBe(deriveMosaicActivationSeed(17, '测试区', 0))
    expect(deriveMosaicActivationSeed(17, '另一区', 0))
      .not.toBe(deriveMosaicActivationSeed(17, '测试区', 0))
    expect(deriveMosaicActivationSeed(18, '测试区', 0))
      .not.toBe(deriveMosaicActivationSeed(17, '测试区', 0))
  })

  it('produces stable bounded random values for cells and seeds', () => {
    const first = mosaicRandom(3, 7, 42)
    expect(first).toBeGreaterThanOrEqual(0)
    expect(first).toBeLessThan(1)
    expect(mosaicRandom(3, 7, 42)).toBe(first)
    expect(mosaicRandom(4, 7, 42)).not.toBe(first)
    expect(mosaicRandom(3, 7, 43)).not.toBe(first)
  })

  it('selects sparse clusters and biases accent color inside clusters', () => {
    expect(isMosaicCluster(0.83, 0.16)).toBe(false)
    expect(isMosaicCluster(0.84, 0.16)).toBe(true)
    expect(isMosaicAccent(0.1, 0.2, 0, 0.65)).toBe(true)
    expect(isMosaicAccent(0.3, 0.2, 0, 0.65)).toBe(false)
    expect(isMosaicAccent(0.7, 0.2, 1, 0.65)).toBe(true)
    expect(isMosaicAccent(0.45, 0.2, 0.5, 0.65)).toBe(true)
    expect(mosaicClusterInfluence(0, 2, true)).toBe(1)
    expect(mosaicClusterInfluence(1, 2, true)).toBe(0.6)
    expect(mosaicClusterInfluence(3, 2, true)).toBe(0)
    expect(mosaicClusterInfluence(0, 2, false)).toBe(0)
    expect(mosaicClusterField(1, 1, 42, 1, 1)).toBeGreaterThan(0)
    expect(mosaicClusterField(1, 2, 42, 1, 1))
      .toBe(mosaicClusterField(1, 1, 42, 1, 1))
  })

  it('creates discrete asynchronous pulses with configurable duty and sharpness', () => {
    expect(mosaicPulse(0, 0, 1, 0.25, 1)).toBe(1)
    expect(mosaicPulse(0.125, 0, 1, 0.25, 1)).toBe(0.5)
    expect(mosaicPulse(0.125, 0, 1, 0.25, 2)).toBe(0.25)
    expect(mosaicPulse(0.25, 0, 1, 0.25, 1)).toBe(0)
    expect(mosaicPulse(0, 0.5, 1, 0.25, 1)).toBe(0)
  })

  it('decays the entry burst once without a directional propagation phase', () => {
    expect(mosaicBurstEnvelope(0, 260)).toBe(1)
    expect(mosaicBurstEnvelope(130, 260)).toBe(0.5)
    expect(mosaicBurstEnvelope(260, 260)).toBe(0)
    expect(mosaicBurstEnvelope(999, 260)).toBe(0)
    expect(mosaicBurstEnvelope(Number.POSITIVE_INFINITY, 260)).toBe(0)
    expect(mosaicBurstEnvelope(Number.NaN, 260)).toBe(0)
    expect(mosaicBurstEnvelope(0, 0)).toBe(0)
  })
})
