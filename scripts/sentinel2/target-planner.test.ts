import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  boundsFromGeoJson,
  buildImageryJobManifest,
  planProjectedExtent,
  serializeImageryJobManifest,
  verifyImageryJobManifest
} from './target-planner.mjs'

const projectRoot = path.resolve(import.meta.dirname, '../..')
const catalogRoot = path.join(projectRoot, 'public/region-catalog/tianditu-2025-09')

function rectangle(minX: number, minY: number, maxX: number, maxY: number) {
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      properties: { gb: 'fixture', name: 'fixture' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY], [minX, minY]
        ]]
      }
    }]
  }
}

describe('Sentinel-2 deterministic target planner', () => {
  it('rejects empty, malformed and non-finite geometry', () => {
    expect(() => boundsFromGeoJson({ type: 'FeatureCollection', features: [] }, 'empty'))
      .toThrow(/empty/i)
    expect(() => boundsFromGeoJson({ type: 'Point', coordinates: [1, 2] }, 'point'))
      .toThrow(/FeatureCollection/)
    const invalid = rectangle(100, 20, 101, 21)
    invalid.features[0].geometry.coordinates[0][1][0] = Number.NaN
    expect(() => boundsFromGeoJson(invalid, 'invalid')).toThrow(/coordinate/i)
  })

  it.each([
    ['compact-coastal', rectangle(118.0, 24.3, 118.3, 24.7)],
    ['typical-inland', rectangle(102.9, 30.1, 104.9, 31.5)],
    ['very-large', rectangle(115.5, 47.0, 121.0, 53.3)],
    ['island-heavy', {
      type: 'FeatureCollection',
      features: [
        rectangle(112.0, 15.0, 112.1, 15.1).features[0],
        rectangle(115.0, 9.0, 115.1, 9.1).features[0]
      ]
    }]
  ])('preserves square Web-Mercator pixels for %s', (_caseName, geometry) => {
    const geographicBounds = boundsFromGeoJson(geometry, String(_caseName))
    const plan = planProjectedExtent(geographicBounds, {
      paddingPerSide: 0.08,
      maxDimension: 2000
    })
    const [minX, minY, maxX, maxY] = plan.projectedBounds
    const pixelWidth = (maxX - minX) / plan.width
    const pixelHeight = (maxY - minY) / plan.height
    expect(Math.max(plan.width, plan.height)).toBe(2000)
    expect(Math.min(plan.width, plan.height)).toBeGreaterThan(0)
    expect(Math.max(plan.width, plan.height)).toBeLessThanOrEqual(2500)
    expect(pixelWidth).toBeCloseTo(pixelHeight, 5)
    expect(plan.outputPixels).toBe(plan.width * plan.height)
  })

  it('builds a byte-deterministic 1/34/342 inventory with explicit fallbacks', async () => {
    const first = await buildImageryJobManifest({ catalogRoot })
    const second = await buildImageryJobManifest({ catalogRoot })
    const firstText = serializeImageryJobManifest(first)
    const secondText = serializeImageryJobManifest(second)

    expect(firstText).toBe(secondText)
    expect(firstText).not.toContain('generatedAt')
    expect(firstText).not.toMatch(/client[_-]?secret|access[_-]?token|authorization/i)
    expect(first.summary).toMatchObject({
      targetCount: 377,
      countryCount: 1,
      provinceCount: 34,
      prefectureCount: 342,
      requestCount: 377
    })
    expect(new Set(first.targets.map((target) => target.id)).size).toBe(377)
    expect(first.targets.every((target) => Math.max(target.width, target.height) === 2000)).toBe(true)
    expect(first.targets.every((target) => target.width <= 2500 && target.height <= 2500)).toBe(true)
    expect(first.summary.estimatedProcessingUnits.threeBand).toBeGreaterThan(4500)
    expect(first.summary.estimatedProcessingUnits.threeBand).toBeLessThan(4700)

    const municipality = first.targets.find((target) => target.gb === '500000')
    expect(municipality).toMatchObject({
      targetKind: 'province',
      label: '重庆市'
    })
    const municipalityPrefecture = first.targets.find(
      (target) => target.gb === '500000' && target.targetKind === 'prefecture'
    )
    expect(municipalityPrefecture?.geometrySource.fallbackReason).toBe('province-equivalent')
    expect(first.targets.find((target) => target.gb === '441900')?.geometrySource.fallbackReason)
      .toBe('empty-child-geometry')

    expect(() => verifyImageryJobManifest(first)).not.toThrow()
  }, 30_000)
})
