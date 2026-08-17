import { describe, expect, it } from 'vitest'
import { planProcessTiles } from './process-tiles.mjs'

describe('Process API deterministic tiling', () => {
  it('keeps ordinary targets in one tile', () => {
    const plan = planProcessTiles({
      width: 2000,
      height: 1000,
      projectedBounds: [0, 0, 2_000_000, 1_000_000]
    })
    expect(plan).toMatchObject({ sourceWidth: 2000, sourceHeight: 1000 })
    expect(plan.tiles).toHaveLength(1)
    expect(plan.tiles[0]).toMatchObject({ left: 0, top: 0, width: 2000, height: 1000 })
  })

  it('splits a coarse nationwide request, covers the exact bounds and stays under 2500', () => {
    const plan = planProcessTiles({
      width: 2000,
      height: 1200,
      projectedBounds: [10, 20, 6_000_010, 3_600_020]
    })
    expect(plan.sourceWidth).toBeGreaterThan(2500)
    expect(plan.tiles.length).toBeGreaterThan(1)
    expect(plan.tiles.every((tile) => tile.width <= 2500 && tile.height <= 2500)).toBe(true)
    expect(plan.tiles[0].projectedBounds[0]).toBe(10)
    expect(Math.max(...plan.tiles.map((tile) => tile.projectedBounds[2]))).toBe(6_000_010)
    expect(Math.min(...plan.tiles.map((tile) => tile.projectedBounds[1]))).toBe(20)
    expect(Math.max(...plan.tiles.map((tile) => tile.projectedBounds[3]))).toBe(3_600_020)
    expect(plan.sourcePixelWidthMeters).toBeLessThanOrEqual(1590)
    expect(plan.sourcePixelHeightMeters).toBeLessThanOrEqual(1590)
  })
})
