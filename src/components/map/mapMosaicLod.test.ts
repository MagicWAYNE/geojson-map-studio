import { describe, expect, it } from 'vitest'
import { HOVER_MOSAIC_PARTICLE_DEFAULTS } from './mapMosaicParticleConfig'
import { selectMosaicCellLod } from './mapMosaicLod'

describe('selectMosaicCellLod', () => {
  it('keeps the default cell near 8 CSS pixels across zoom and device pixel ratio', () => {
    expect(selectMosaicCellLod(0.25, 2, HOVER_MOSAIC_PARTICLE_DEFAULTS)).toEqual({
      cellWorldSize: 4,
      cellCssPx: 8,
      quantized: true
    })
    expect(selectMosaicCellLod(0.125, 2, HOVER_MOSAIC_PARTICLE_DEFAULTS)).toEqual({
      cellWorldSize: 2,
      cellCssPx: 8,
      quantized: true
    })
    expect(selectMosaicCellLod(0.25, 1, HOVER_MOSAIC_PARTICLE_DEFAULTS)).toEqual({
      cellWorldSize: 2,
      cellCssPx: 8,
      quantized: true
    })
  })

  it('uses discrete eighth-octave levels within the configured pixel range', () => {
    const result = selectMosaicCellLod(0.18, 2, HOVER_MOSAIC_PARTICLE_DEFAULTS)

    expect(result.cellWorldSize).toBeCloseTo(2.828427, 5)
    expect(result.cellCssPx).toBeCloseTo(7.856742, 5)
    expect(result.cellCssPx).toBeGreaterThanOrEqual(4)
    expect(result.cellCssPx).toBeLessThanOrEqual(14)
    expect(result.quantized).toBe(true)
  })

  it('holds one model-space grid level across small zoom changes', () => {
    const first = selectMosaicCellLod(0.18, 2, HOVER_MOSAIC_PARTICLE_DEFAULTS)
    const nearby = selectMosaicCellLod(0.181, 2, HOVER_MOSAIC_PARTICLE_DEFAULTS)
    const nextLevel = selectMosaicCellLod(0.12, 2, HOVER_MOSAIC_PARTICLE_DEFAULTS)

    expect(first.cellWorldSize).toBeCloseTo(2.828427, 5)
    expect(nearby.cellWorldSize).toBe(first.cellWorldSize)
    expect(nextLevel.cellWorldSize).toBe(2)
  })

  it('keeps a narrow pixel range on a fixed quantized model-space level', () => {
    const config = {
      ...HOVER_MOSAIC_PARTICLE_DEFAULTS,
      targetCellPx: 8,
      minCellPx: 7,
      maxCellPx: 9
    }
    const result = selectMosaicCellLod(0.2, 1, config)

    expect(result.cellWorldSize).toBeCloseTo(1.542211, 5)
    expect(result.cellCssPx).toBeCloseTo(7.711054, 5)
    expect(result.cellCssPx).toBeGreaterThanOrEqual(7)
    expect(result.cellCssPx).toBeLessThanOrEqual(9)
    expect(result.quantized).toBe(true)
  })

  it('returns finite bounded values for invalid derivatives and pixel ratios', () => {
    const result = selectMosaicCellLod(Number.NaN, 0, HOVER_MOSAIC_PARTICLE_DEFAULTS)

    expect(Number.isFinite(result.cellWorldSize)).toBe(true)
    expect(result.cellCssPx).toBeGreaterThanOrEqual(4)
    expect(result.cellCssPx).toBeLessThanOrEqual(14)
  })
})
