import { describe, expect, it } from 'vitest'
import {
  geometryMaskedQuality,
  projectedPolygonsFromGeoJson,
  rasterizeProjectedCoverage
} from './geometry-mask.mjs'

function featureCollection(coordinates: number[][][][]) {
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: {},
      geometry: { type: 'Polygon', coordinates }
    }]
  }
}

describe('geometry-aware no-data coverage', () => {
  it('rasterizes polygons, holes and islands with north-up image rows', () => {
    const withHole = featureCollection([
      [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]],
      [[1, 1], [1, 3], [3, 3], [3, 1], [1, 1]]
    ])
    const island = featureCollection([
      [[5, 0], [6, 0], [6, 1], [5, 1], [5, 0]]
    ])
    const polygons = [
      ...projectedPolygonsFromGeoJson(withHole),
      ...projectedPolygonsFromGeoJson(island)
    ]
    const projected = polygons.flat(2)
    const xs = projected.map((point) => point[0])
    const ys = projected.map((point) => point[1])
    const bounds = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
    const coverage = rasterizeProjectedCoverage(polygons, bounds, 6, 4)
    expect([...coverage]).toEqual([
      1, 1, 1, 1, 0, 0,
      1, 0, 0, 1, 0, 0,
      1, 0, 0, 1, 0, 0,
      1, 1, 1, 1, 0, 1
    ])
  })

  it('excludes pixels outside geometry from the no-data ratio', () => {
    const samples = new Uint8Array([255, 0, 0, 0])
    const coverage = new Uint8Array([1, 1, 0, 0])
    expect(geometryMaskedQuality(samples, coverage)).toEqual({
      coveredPixels: 2,
      noDataPixels: 1,
      noDataRatio: 0.5
    })
    expect(() => geometryMaskedQuality(samples, new Uint8Array(3))).toThrow(/lengths differ/)
  })
})
