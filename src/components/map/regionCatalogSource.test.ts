import { describe, expect, it, vi } from 'vitest'
import catalogFixture from '../../../public/region-catalog/tianditu-2025-09/catalog.json'
import { parseRegionCatalog } from './regionCatalog'
import { createRegionCatalogSource } from './regionCatalogSource'

describe('region catalog source', () => {
  it('loads only catalog first and exactly one resolved asset on explicit geometry load', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(catalogFixture)))
      .mockResolvedValueOnce(new Response('{"type":"FeatureCollection","features":[]}'))
    const source = createRegionCatalogSource({ fetch: request, baseUrl: '/catalog/' })
    const catalog = await source.loadCatalog()
    expect(request).toHaveBeenCalledTimes(1)
    const geometry = await source.loadGeometry(catalog, {
      kind: 'province-counties', provinceGb: '156130000'
    })
    expect(request).toHaveBeenCalledTimes(2)
    expect(request.mock.calls[1][0]).toBe('/catalog/maps/provinces/130000/counties.geojson')
    expect(geometry).toMatchObject({
      displayLabel: '河北省 → 区县',
      regionKeyProperty: 'gb',
      displayNameProperty: 'name'
    })
  })

  it('does not request unavailable entries and reports HTTP, malformed catalog and aborts', async () => {
    const request = vi.fn()
    const source = createRegionCatalogSource({ fetch: request, baseUrl: '/catalog/' })
    const catalog = parseRegionCatalog(catalogFixture)
    await expect(source.loadGeometry(catalog, {
      kind: 'prefecture-counties', provinceGb: '156620000', prefectureGb: '156620200'
    })).rejects.toThrow('暂无可用')
    expect(request).not.toHaveBeenCalled()

    request.mockResolvedValueOnce(new Response('missing', { status: 404 }))
    await expect(source.loadCatalog()).rejects.toThrow('HTTP 404')
    request.mockResolvedValueOnce(new Response('{'))
    await expect(source.loadCatalog()).rejects.toThrow('不是有效 JSON')

    const controller = new AbortController()
    request.mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })
    }))
    const pending = source.loadCatalog(controller.signal)
    controller.abort(new DOMException('cancelled', 'AbortError'))
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })
})
