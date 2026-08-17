import { deflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import {
  assertWithinBudget,
  buildRgbProcessRequest,
  buildQualityProbeRequest,
  estimateProbeBudget,
  qualityFromPng,
  quarterTimeRange,
  validateOfficialCollection,
  validateQuarterlyItems
} from './source-quality.mjs'

function chunk(type: string, data: Buffer) {
  const result = Buffer.alloc(12 + data.length)
  result.writeUInt32BE(data.length, 0)
  result.write(type, 4, 4, 'ascii')
  data.copy(result, 8)
  return result
}

function grayscalePng(width: number, height: number, samples: number[]) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 0
  const rows = Buffer.alloc(height * (width + 1))
  for (let row = 0; row < height; row += 1) {
    rows[row * (width + 1)] = 0
    for (let column = 0; column < width; column += 1) {
      rows[row * (width + 1) + 1 + column] = samples[row * width + column]
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(rows)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

describe('official source and quality policy', () => {
  it('accepts only the pinned official collection and exact band contract', () => {
    const collection = {
      id: 'byoc-5460de54-082e-473a-b6ea-d5cbe3c17cca',
      title: 'Sentinel-2 Quarterly Mosaics',
      summaries: { 'eo:bands': ['B02', 'B03', 'B04', 'B08', 'observations'].map((name) => ({ name })) }
    }
    expect(validateOfficialCollection(collection)).toBe(collection)
    expect(() => validateOfficialCollection({ ...collection, id: 'other' })).toThrow(/collection id/)
    expect(() => validateOfficialCollection({
      ...collection,
      summaries: { 'eo:bands': [{ name: 'B02' }] }
    })).toThrow(/bands changed/)
    expect(() => quarterTimeRange('latest')).toThrow(/explicit pinned/)
    expect(() => quarterTimeRange('2024-Q4')).toThrow(/unknown/)
  })

  it('requires every requested quarterly item and rejects asset changes', () => {
    const feature = (quarter: 2 | 3 | 4) => ({
      id: `Sentinel-2_mosaic_2025_Q${quarter}_48RUV_0_0`,
      properties: {
        start_datetime: quarterTimeRange(`2025-Q${quarter}`).from,
        end_datetime: quarterTimeRange(`2025-Q${quarter}`).to
      },
      assets: Object.fromEntries(['B02', 'B03', 'B04', 'B08', 'Product', 'userdata', 'observations'].map((name) => [name, {}]))
    })
    const response = { features: [feature(2), feature(3), feature(4)] }
    expect(validateQuarterlyItems(response, ['2025-Q2', '2025-Q3', '2025-Q4']).quarters)
      .toEqual(['2025-Q2', '2025-Q3', '2025-Q4'])
    expect(() => validateQuarterlyItems({ features: [feature(2)] }, ['2025-Q3']))
      .toThrow(/did not return 2025-Q3/)
    const changed = feature(2)
    changed.assets.unexpected = {}
    expect(() => validateQuarterlyItems({ features: [changed] }, ['2025-Q2']))
      .toThrow(/unknown band or asset/)
  })

  it('enforces request and PU budgets before building probe requests', () => {
    const estimate = estimateProbeBudget({ targetCount: 5, quarterCount: 3, minimumLongDimension: 128 })
    expect(estimate).toEqual({ requestCount: 15, maximumOutputPixels: 245760, estimatedProcessingUnits: 0.625 })
    expect(assertWithinBudget(estimate, { maximumRequests: 15, maximumProcessingUnits: 1 })).toBe(estimate)
    expect(() => assertWithinBudget(estimate, { maximumRequests: 14, maximumProcessingUnits: 1 }))
      .toThrow(/request budget exceeded/)
    expect(() => assertWithinBudget(estimate, { maximumRequests: 15, maximumProcessingUnits: 0.5 }))
      .toThrow(/PU budget exceeded/)
  })

  it('builds a fixed EPSG:3857 BYOC request and measures no-data from PNG', () => {
    const target = {
      width: 2000,
      height: 1000,
      projectedBounds: [1, 2, 3, 4]
    }
    const probe = buildQualityProbeRequest(target, '2025-Q3', 128)
    expect(probe.dimensions).toEqual({ width: 128, height: 64 })
    expect(probe.request.input.data[0]).toMatchObject({
      type: 'byoc-5460de54-082e-473a-b6ea-d5cbe3c17cca',
      dataFilter: { timeRange: quarterTimeRange('2025-Q3') }
    })
    expect(probe.request.input.bounds.properties.crs).toContain('3857')
    expect(buildRgbProcessRequest(target, '2025-Q3').request.output).toMatchObject({
      width: 2000,
      height: 1000,
      responses: [{ format: { type: 'image/jpeg', quality: 90 } }]
    })
    expect(qualityFromPng(grayscalePng(2, 2, [255, 0, 255, 0]))).toEqual({
      width: 2,
      height: 2,
      pixelCount: 4,
      noDataPixels: 2,
      noDataRatio: 0.5
    })
  })
})
