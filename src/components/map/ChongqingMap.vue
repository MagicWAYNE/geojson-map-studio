<script setup lang="ts">
import { ref, watch } from 'vue'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import { useRouter } from 'vue-router'
import { useECharts } from '@/composables/useECharts'
import { getDistrictMapData } from '@/api'
import centroidsRaw from '@/mocks/district_centroids.json'
import type { DistrictMapItem } from '@/types'

const props = withDefaults(defineProps<{ focus?: string; showLines?: boolean }>(), {
  focus: '',
  showLines: true
})

const CENTER = '南岸区'
const centroids = centroidsRaw as unknown as Record<string, [number, number]>

const el = ref<HTMLElement | null>(null)
const { chart, setOption } = useECharts(el)
const router = useRouter()
const error = ref('')
const mapData = ref<DistrictMapItem[]>([])

const LAYOUT: { layoutCenter: (string | number)[]; layoutSize: string } = {
  layoutCenter: ['50%', '50%'],
  layoutSize: '96%'
}

function areaGradient(c1: string, c2: string) {
  return {
    type: 'linear' as const,
    x: 0, y: 0, x2: 0, y2: 1,
    colorStops: [
      { offset: 0, color: c1 },
      { offset: 1, color: c2 }
    ]
  }
}

function buildOption(data: DistrictMapItem[]): EChartsOption {
  const lines = props.showLines
    ? Object.keys(centroids)
        .filter((n) => n !== CENTER)
        .map((n) => ({ coords: [centroids[CENTER], centroids[n]] }))
    : []

  const seriesData = data.map((d) => ({
    name: d.name,
    value: d.aj,
    ztje: d.ztje,
    zzs: d.zzs,
    selected: !!props.focus && d.name === props.focus,
    itemStyle:
      props.focus && d.name !== props.focus
        ? { areaColor: 'rgba(8,24,52,0.55)', borderColor: 'rgba(36,131,255,0.25)' }
        : undefined
  }))

  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(6,18,40,0.92)',
      borderColor: '#2483FF',
      padding: [10, 14],
      textStyle: { color: '#fff', fontSize: 13, fontFamily: 'OPPOSans-R' },
      formatter: (p: unknown) => {
        const q = p as { name: string; data?: { value: number; ztje: number; zzs: number } }
        if (!q.data) return q.name
        return [
          `<b style="font-size:15px">${q.name}</b>`,
          `扶持企业：<span style="color:#00DEFF;font-family:Bebas">${q.data.value.toLocaleString()}</span> 家`,
          `服务资源：<span style="color:#edd892;font-family:Bebas">${q.data.ztje.toLocaleString()}</span> 项`,
          `服务机构：<span style="color:#44ffa2;font-family:Bebas">${q.data.zzs}</span> 家`
        ].join('<br/>')
      }
    },
    geo: {
      map: 'chongqing',
      ...LAYOUT,
      silent: true,
      itemStyle: { areaColor: 'transparent', borderColor: 'transparent', borderWidth: 0 },
      emphasis: { disabled: true },
      zlevel: 0
    },
    series: [
      {
        type: 'map',
        map: 'chongqing',
        ...LAYOUT,
        selectedMode: props.focus ? 'single' : false,
        data: seriesData,
        itemStyle: {
          areaColor: areaGradient('rgba(12,60,140,0.82)', 'rgba(5,24,58,0.9)'),
          borderColor: '#2483FF',
          borderWidth: 1.2,
          shadowColor: 'rgba(0,165,255,0.45)',
          shadowBlur: 10
        },
        label: { show: false, color: '#a5bde5', fontSize: 11, fontFamily: 'OPPOSans-R' },
        emphasis: {
          label: { show: true, color: '#fff', fontSize: 13, fontWeight: 'bold' },
          itemStyle: {
            areaColor: areaGradient('rgba(36,131,255,0.95)', 'rgba(0,222,255,0.75)'),
            borderColor: '#00DEFF',
            borderWidth: 2,
            shadowColor: '#00a5ff',
            shadowBlur: 20
          }
        },
        select: {
          label: { show: true, color: '#fff', fontSize: 13, fontWeight: 'bold' },
          itemStyle: {
            areaColor: areaGradient('rgba(10,115,255,0.95)', 'rgba(0,222,255,0.8)'),
            borderColor: '#00DEFF',
            borderWidth: 2
          }
        },
        zlevel: 1
      },
      {
        type: 'lines',
        coordinateSystem: 'geo',
        zlevel: 2,
        silent: true,
        effect: { show: true, period: 4, trailLength: 0.3, symbol: 'arrow', symbolSize: 5, color: '#00DEFF' },
        lineStyle: { color: '#2483FF', width: 1, opacity: 0.3, curveness: 0.3 },
        data: lines
      },
      {
        type: 'effectScatter',
        coordinateSystem: 'geo',
        zlevel: 2,
        silent: true,
        symbolSize: 7,
        rippleEffect: { brushType: 'stroke', scale: 3.5 },
        itemStyle: { color: '#00DEFF' },
        data: [{ name: CENTER, value: [...centroids[CENTER], 1] }]
      }
    ]
  }
}

async function init() {
  try {
    const [svgRes, data] = await Promise.all([
      fetch(`${import.meta.env.BASE_URL}maps/chongqing.svg`),
      getDistrictMapData()
    ])
    if (!svgRes.ok) throw new Error(`地图加载失败: HTTP ${svgRes.status}`)
    echarts.registerMap('chongqing', { svg: await svgRes.text() })
    mapData.value = data
    setOption(buildOption(data), true)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
init()

watch(chart, (c) => {
  c?.on('click', (p) => {
    const q = p as { seriesType?: string; name?: string }
    if (q.seriesType === 'map' && q.name) {
      router.push(`/district/${encodeURIComponent(q.name)}`)
    }
  })
})

watch(
  () => props.focus,
  () => {
    if (mapData.value.length) setOption(buildOption(mapData.value), true)
  }
)
</script>

<template>
  <div class="cq-map">
    <div ref="el" class="chart" />
    <div v-if="error" class="err">{{ error }}</div>
  </div>
</template>

<style scoped>
.cq-map { position: relative; }
.chart { width: 100%; height: 100%; }
.err {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  color: #ff7d57; font-size: 16px; font-family: 'OPPOSans-R';
  background: rgba(6, 18, 40, 0.6);
}
</style>
