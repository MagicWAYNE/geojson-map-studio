import { describe, expect, it } from 'vitest'
import catalogFixture from '../../../public/region-catalog/tianditu-2025-09/catalog.json'
import {
  parseRegionCatalog,
  resolveRegionCatalogSelection
} from './regionCatalog'

describe('region catalog', () => {
  it('parses the fixed hierarchy and resolves all four explicit selection kinds', () => {
    const catalog = parseRegionCatalog(catalogFixture)
    expect(catalog.provinces).toHaveLength(34)
    expect(resolveRegionCatalogSelection(catalog, { kind: 'country-provinces' })).toMatchObject({ featureCount: 34 })
    expect(resolveRegionCatalogSelection(catalog, {
      kind: 'province-children', provinceGb: '156130000'
    })).toMatchObject({ featureCount: 11, assetPath: 'maps/provinces/130000/children.geojson' })
    expect(resolveRegionCatalogSelection(catalog, {
      kind: 'province-counties', provinceGb: '156130000'
    })).toMatchObject({ featureCount: 167 })
    expect(resolveRegionCatalogSelection(catalog, {
      kind: 'prefecture-counties', provinceGb: '156130000', prefectureGb: '156130100'
    })).toMatchObject({ featureCount: 22 })
  })

  it('keeps empty entries unavailable and rejects unsafe or mismatched manifests', () => {
    const catalog = parseRegionCatalog(catalogFixture)
    expect(resolveRegionCatalogSelection(catalog, {
      kind: 'prefecture-counties', provinceGb: '156620000', prefectureGb: '156620200'
    })).toMatchObject({ available: false, assetPath: null })
    const unsafe = structuredClone(catalogFixture)
    unsafe.country.assetPath = 'https://cloudcenter.tianditu.gov.cn/runtime.geojson'
    expect(() => parseRegionCatalog(unsafe)).toThrow('安全的相对路径')
  })
})
