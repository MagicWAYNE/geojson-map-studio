import { describe, expect, it } from 'vitest'
import {
  GEOJSON_MAX_BYTES,
  GEOJSON_MAX_FEATURES,
  GEOJSON_MAX_POSITIONS,
  MapImportError,
  inspectGeoJsonMap,
  prepareGeoJsonMapPackage
} from './mapDocument'

const validMixedGeoJson = JSON.stringify({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: '区域 A', code: 101 },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [[106, 29], [107, 29], [107, 30], [106, 30], [106, 29]],
          [[106.2, 29.2], [106.4, 29.2], [106.4, 29.4], [106.2, 29.4], [106.2, 29.2]]
        ]
      }
    },
    {
      type: 'Feature',
      properties: { name: '区域 B', code: 102 },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [[[108, 29], [108.4, 29], [108.4, 29.4], [108, 29.4], [108, 29]]],
          [[[108.6, 29.6], [109, 29.6], [109, 30], [108.6, 30], [108.6, 29.6]]]
        ]
      }
    }
  ]
})

describe('mapDocument', () => {
  it('将 Polygon、孔洞和 MultiPolygon 准备为居中的规范地图文档', () => {
    expect(inspectGeoJsonMap(validMixedGeoJson)).toEqual({
      featureCount: 2,
      totalPositionCount: 20,
      polygonCount: 1,
      multiPolygonCount: 1,
      usableNameProperties: ['name', 'code'],
      namePropertyConflicts: []
    })

    const prepared = prepareGeoJsonMapPackage({
      geometryText: validMixedGeoJson,
      geometryFileName: 'mixed.geojson',
      nameProperty: 'name'
    })

    expect(prepared.document.source).toEqual({ kind: 'geojson', displayName: 'mixed.geojson' })
    expect(prepared.document.appearance).toEqual({ kind: 'tech-blue' })
    expect(prepared.document.drilldown).toBe(false)
    expect(prepared.document.metrics.size).toBe(0)
    expect(prepared.document.metricLabels).toBeNull()
    expect(prepared.document.geometry.regions.map((region) => ({
      name: region.name,
      outerCount: region.outers.length,
      holeCount: region.outers.reduce((count, outer) => count + outer.holes.length, 0)
    }))).toEqual([
      { name: '区域 A', outerCount: 1, holeCount: 1 },
      { name: '区域 B', outerCount: 2, holeCount: 0 }
    ])

    const projectedPoints = prepared.document.geometry.regions.flatMap((region) =>
      region.outers.flatMap((outer) => [outer.ring, ...outer.holes].flat())
    )
    const xs = projectedPoints.map(([x]) => x)
    const ys = projectedPoints.map(([, y]) => y)
    expect(Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)))
      .toBeCloseTo(110)
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(0)
    expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo(0)

    expect(prepared.summary).toEqual({
      geometryFileName: 'mixed.geojson',
      featureCount: 2,
      totalPositionCount: 20,
      polygonCount: 1,
      multiPolygonCount: 1,
      nameProperty: 'name',
      metrics: null
    })
    expect(prepared.persisted).toEqual({
      version: 1,
      geometryText: validMixedGeoJson,
      geometryFileName: 'mixed.geojson',
      nameProperty: 'name'
    })
  })

  it('把可选业务数据按区域名称匹配并报告缺失与多余项', () => {
    const metricsText = JSON.stringify({
      version: 1,
      primaryMetric: { label: '扶持企业', unit: '家' },
      secondaryMetric: { label: '服务资源', unit: '项' },
      regions: [
        { name: '区域 A', primary: 120, secondary: 45.6 },
        { name: '区域 C', primary: 8, secondary: 3 }
      ]
    })

    const prepared = prepareGeoJsonMapPackage({
      geometryText: validMixedGeoJson,
      geometryFileName: 'mixed.geojson',
      nameProperty: 'name',
      metricsText
    })

    expect(prepared.document.metricLabels).toEqual({
      primary: { label: '扶持企业', unit: '家' },
      secondary: { label: '服务资源', unit: '项' }
    })
    expect([...prepared.document.metrics]).toEqual([
      ['区域 A', { name: '区域 A', primary: 120, secondary: 45.6 }]
    ])
    expect(prepared.summary.metrics).toEqual({
      matchedNames: ['区域 A'],
      missingNames: ['区域 B'],
      extraNames: ['区域 C']
    })
    expect(prepared.persisted.metricsText).toBe(metricsText)
  })

  it('业务数据名称与 GeoJSON 区域名称使用未经修剪的精确匹配', () => {
    const geometryText = validMixedGeoJson.replace('区域 A', '区域 A ')
    const metricsText = JSON.stringify({
      version: 1,
      primaryMetric: { label: '企业', unit: '家' },
      secondaryMetric: { label: '资源', unit: '项' },
      regions: [{ name: '区域 A', primary: 1, secondary: 2 }]
    })

    const prepared = prepareGeoJsonMapPackage({
      geometryText,
      geometryFileName: 'exact.geojson',
      nameProperty: 'name',
      metricsText
    })

    expect(prepared.document.geometry.regions[0].name).toBe('区域 A ')
    expect(prepared.document.metrics.size).toBe(0)
    expect(prepared.summary.metrics).toEqual({
      matchedNames: [],
      missingNames: ['区域 A ', '区域 B'],
      extraNames: ['区域 A']
    })
  })

  it.each([
    {
      name: '非 FeatureCollection',
      geometry: { type: 'Feature', properties: {}, geometry: null },
      code: 'invalid-root',
      path: '$'
    },
    {
      name: '不支持的 geometry',
      geometry: {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { name: '点' },
          geometry: { type: 'Point', coordinates: [106, 29] }
        }]
      },
      code: 'unsupported-geometry',
      path: 'features[0].geometry.type'
    },
    {
      name: '非法坐标',
      geometry: {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { name: '越界' },
          geometry: {
            type: 'Polygon',
            coordinates: [[[106, 29], [181, 29], [107, 30], [106, 29]]]
          }
        }]
      },
      code: 'invalid-coordinate',
      path: 'features[0].geometry.coordinates[0][1]'
    },
    {
      name: '跨国际日期变更线',
      geometry: {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: { name: '跨线' },
          geometry: {
            type: 'Polygon',
            coordinates: [[[179, 10], [-179, 10], [-179, 11], [179, 10]]]
          }
        }]
      },
      code: 'dateline-crossing',
      path: 'features[0].geometry.coordinates[0][1]'
    }
  ])('拒绝$name并返回稳定错误定位', ({ geometry, code, path }) => {
    try {
      inspectGeoJsonMap(JSON.stringify(geometry))
      throw new Error('expected MapImportError')
    } catch (error) {
      expect(error).toBeInstanceOf(MapImportError)
      expect(error).toMatchObject({ code, path })
    }
  })

  it('拒绝重复区域名称且不修改原始 GeoJSON 文本', () => {
    const geometryText = validMixedGeoJson.replace('区域 B', '区域 A')
    const before = geometryText.slice()

    expect(() => prepareGeoJsonMapPackage({
      geometryText,
      geometryFileName: 'duplicate.geojson',
      nameProperty: 'name'
    })).toThrowError(expect.objectContaining({
      code: 'duplicate-name',
      path: 'features[1].properties.name'
    }))
    expect(geometryText).toBe(before)
  })

  it('探测名称字段时报告精确的重复值，供上传页解释冲突', () => {
    const geometryText = validMixedGeoJson.replace('区域 B', '区域 A')

    expect(inspectGeoJsonMap(geometryText)).toMatchObject({
      usableNameProperties: ['code'],
      namePropertyConflicts: [{ property: 'name', duplicateValues: ['区域 A'] }]
    })
  })

  it.each([
    {
      name: '错误版本',
      metrics: {
        version: 2,
        primaryMetric: { label: '企业', unit: '家' },
        secondaryMetric: { label: '资源', unit: '项' },
        regions: []
      },
      path: '$'
    },
    {
      name: '重复业务名称',
      metrics: {
        version: 1,
        primaryMetric: { label: '企业', unit: '家' },
        secondaryMetric: { label: '资源', unit: '项' },
        regions: [
          { name: '区域 A', primary: 1, secondary: 2 },
          { name: '区域 A', primary: 3, secondary: 4 }
        ]
      },
      path: 'regions[1].name'
    },
    {
      name: '负数业务值',
      metrics: {
        version: 1,
        primaryMetric: { label: '企业', unit: '家' },
        secondaryMetric: { label: '资源', unit: '项' },
        regions: [{ name: '区域 A', primary: -1, secondary: 2 }]
      },
      path: 'regions[0].primary'
    }
  ])('拒绝$name且不生成可激活地图包', ({ metrics, path }) => {
    expect(() => prepareGeoJsonMapPackage({
      geometryText: validMixedGeoJson,
      geometryFileName: 'mixed.geojson',
      nameProperty: 'name',
      metricsText: JSON.stringify(metrics)
    })).toThrowError(expect.objectContaining({ code: 'invalid-metrics', path }))
  })

  it('在解析前拒绝超限文件和区域数', () => {
    expect(() => inspectGeoJsonMap(' '.repeat(GEOJSON_MAX_BYTES + 1))).toThrowError(
      expect.objectContaining({ code: 'file-too-large', path: '$' })
    )

    const feature = {
      type: 'Feature',
      properties: { name: '区域' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[106, 29], [107, 29], [107, 30], [106, 29]]]
      }
    }
    const tooManyFeatures = JSON.stringify({
      type: 'FeatureCollection',
      features: Array.from({ length: GEOJSON_MAX_FEATURES + 1 }, (_, index) => ({
        ...feature,
        properties: { name: `区域 ${index}` }
      }))
    })
    expect(() => inspectGeoJsonMap(tooManyFeatures)).toThrowError(
      expect.objectContaining({ code: 'too-many-features', path: 'features' })
    )
  })

  it('超过总位置数上限时停止解析并返回稳定错误', () => {
    const positions = Array.from({ length: GEOJSON_MAX_POSITIONS + 1 }, () => [106, 29])
    const tooManyPositions = JSON.stringify({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { name: '超限区域' },
        geometry: { type: 'Polygon', coordinates: [positions] }
      }]
    })

    expect(() => inspectGeoJsonMap(tooManyPositions)).toThrowError(
      expect.objectContaining({ code: 'too-many-positions', path: 'features' })
    )
  })

  it('在总位置数恰好达到上限时仍完成投影而不触发引擎参数上限', () => {
    const positions = [
      [106, 29],
      [107, 29],
      ...Array.from({ length: GEOJSON_MAX_POSITIONS - 4 }, () => [107, 30]),
      [106, 30],
      [106, 29]
    ]
    const geometryText = JSON.stringify({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { name: '上限区域' },
        geometry: { type: 'Polygon', coordinates: [positions] }
      }]
    })

    const prepared = prepareGeoJsonMapPackage({
      geometryText,
      geometryFileName: 'limit.geojson',
      nameProperty: 'name'
    })

    expect(prepared.summary.totalPositionCount).toBe(GEOJSON_MAX_POSITIONS)
    expect(prepared.document.geometry.scale).toBeGreaterThan(0)
  })
})
