import { getDistrictMapData } from '@/api'
import { parseSvgRegions, projectRegions } from './mapGeometry'
import {
  MAP_PLANE_MAX,
  type MapDocument,
  type MapRegionMetrics
} from './mapDocument'

const BUILTIN_SVG_URL = `${import.meta.env.BASE_URL}maps/chongqing-selected-districts-tianditu-imagery-z12.svg`
const BUILTIN_TEXTURE_URL = `${import.meta.env.BASE_URL}maps/tianditu-imagery-z12.png`

function toMetrics(
  data: Awaited<ReturnType<typeof getDistrictMapData>>
): Map<string, MapRegionMetrics> {
  const metrics = new Map(data.map((item) => [item.name, {
    name: item.name,
    primary: item.aj,
    secondary: item.ztje
  }]))
  const jiangbei = metrics.get('江北区')
  const yubei = metrics.get('渝北区')
  if (jiangbei && yubei) {
    metrics.set('两江新区', {
      name: '两江新区',
      primary: jiangbei.primary + yubei.primary,
      secondary: jiangbei.secondary + yubei.secondary
    })
  }
  return metrics
}

export async function loadBuiltinMapDocument(): Promise<MapDocument> {
  const [response, data] = await Promise.all([
    fetch(BUILTIN_SVG_URL),
    getDistrictMapData()
  ])
  if (!response.ok) throw new Error(`地图加载失败: HTTP ${response.status}`)
  const svgText = await response.text()
  const regions = parseSvgRegions(svgText)
  if (!regions.length) throw new Error('内置地图轮廓为空')

  return {
    version: 1,
    source: { kind: 'builtin', displayName: '内置重庆地图' },
    geometry: projectRegions(regions, MAP_PLANE_MAX),
    metrics: toMetrics(data),
    metricLabels: {
      primary: { label: '扶持企业', unit: '家' },
      secondary: { label: '服务资源', unit: '项' }
    },
    appearance: { kind: 'terrain-texture', textureUrl: BUILTIN_TEXTURE_URL },
    drilldown: true
  }
}
