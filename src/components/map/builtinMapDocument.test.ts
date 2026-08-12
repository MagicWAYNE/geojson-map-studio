// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiMocks = vi.hoisted(() => ({ getDistrictMapData: vi.fn() }))

vi.mock('@/api', () => ({ getDistrictMapData: apiMocks.getDistrictMapData }))

import { loadBuiltinMapDocument } from './builtinMapDocument'

describe('builtinMapDocument', () => {
  beforeEach(() => {
    const svgText = readFileSync(resolve(
      process.cwd(),
      'public/maps/chongqing-selected-districts-tianditu-imagery-z12.svg'
    ), 'utf8')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(svgText)
    }))
    apiMocks.getDistrictMapData.mockResolvedValue([
      { name: '渝中区', aj: 10, ztje: 1, zzs: 1 },
      { name: '江北区', aj: 20, ztje: 2, zzs: 3 },
      { name: '渝北区', aj: 50, ztje: 5, zzs: 7 }
    ])
  })

  it('把当前重庆 SVG、业务数据和纹理准备为内置地图文档', async () => {
    const document = await loadBuiltinMapDocument()

    expect(document.source).toEqual({ kind: 'builtin', displayName: '内置重庆地图' })
    expect(document.geometry.regions.map((region) => region.name)).toEqual([
      '渝中区',
      '两江新区',
      '南岸区',
      '九龙坡区',
      '沙坪坝区',
      '大渡口区',
      '北碚区',
      '巴南区'
    ])
    expect(document.metrics.get('两江新区')).toEqual({
      name: '两江新区',
      primary: 70,
      secondary: 7
    })
    expect(document.metricLabels).toEqual({
      primary: { label: '扶持企业', unit: '家' },
      secondary: { label: '服务资源', unit: '项' }
    })
    expect(document.appearance).toEqual({
      kind: 'terrain-texture',
      textureUrl: '/maps/tianditu-imagery-z12.png'
    })
    expect(document.drilldown).toBe(true)
    expect(Math.max(...document.geometry.regions.flatMap((region) =>
      region.outers.flatMap((outer) => outer.ring.map(([x]) => Math.abs(x)))
    ))).toBeLessThanOrEqual(55)
  })
})
