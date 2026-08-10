<script setup lang="ts">
import { onMounted, ref } from 'vue'
import NumberFlop from '@/components/common/NumberFlop.vue'
import SubTitle from '@/components/layout/SubTitle.vue'
import { useECharts } from '@/composables/useECharts'
import { buildDoubleBarOption } from '@/utils/chartOptions'
import { getSupportModeSeries, getSupportOutcomeData } from '@/api'
import { formatWeeklyMonthLabel } from '@/utils/entrepreneurshipTheme'
import type { TjzxData } from '@/types'
import icon1 from '@/assets/images/icon-quality-1.png'
import icon2 from '@/assets/images/icon-quality-2.png'
import icon3 from '@/assets/images/icon-quality-3.png'
import icon4 from '@/assets/images/icon-quality-4.png'

interface Card {
  key: keyof TjzxData
  title: string
  unit: string
  decimals: number
  icon: string
  x: number
  y: number
}

const CARDS: Card[] = [
  { key: 'tjzx_qe', title: '场地支持', unit: '家', decimals: 0, icon: icon1, x: 29, y: 44 },
  { key: 'tjzx_fq', title: '资源对接', unit: '家', decimals: 0, icon: icon2, x: 255, y: 44 },
  { key: 'tjzx_ss', title: '示范项目', unit: '个', decimals: 0, icon: icon3, x: 29, y: 124 },
  { key: 'tjzx_qr', title: '带动就业', unit: '万人', decimals: 2, icon: icon4, x: 255, y: 124 }
]

const data = ref<TjzxData | null>(null)
const error = ref('')
const chartEl = ref<HTMLElement | null>(null)
const { setOption } = useECharts(chartEl)

onMounted(async () => {
  try {
    const [tjzx, list] = await Promise.all([getSupportOutcomeData(), getSupportModeSeries()])
    data.value = tjzx
    setOption(buildDoubleBarOption(list, {
      xLabelInterval: 0,
      xLabelFormatter: formatWeeklyMonthLabel,
      barWidth: 8
    }))
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
})

const num = (v: string | undefined) => (v ? parseFloat(v) : 0)
</script>

<template>
  <div class="quality-panel">
    <SubTitle title="扶持成效" extra="（累计）" />
    <div v-if="error" class="err">{{ error }}</div>
    <template v-else>
      <div v-for="c in CARDS" :key="c.key" class="card" :style="{ left: c.x + 'px', top: c.y + 'px' }">
        <img :src="c.icon" alt="" />
        <div>
          <div class="title">{{ c.title }}</div>
          <div class="value">
            <NumberFlop :value="num(data?.[c.key])" :decimals="c.decimals" :font-size="28" />
            <span class="unit">{{ c.unit }}</span>
          </div>
        </div>
      </div>
      <div ref="chartEl" class="chart" />
    </template>
  </div>
</template>

<style scoped>
.quality-panel { position: relative; width: 492px; height: 380px; }
.card { position: absolute; display: flex; align-items: center; gap: 10px; width: 208px; height: 60px; }
.card img { width: 48px; height: 48px; }
.title { font-family: 'OPPOSans-R'; font-size: 14px; color: #90a3c8; margin-bottom: 4px; }
.value { display: flex; align-items: baseline; gap: 5px; }
.unit { font-family: 'OPPOSans-R'; font-size: 15px; color: #90a3c8; }
.chart { position: absolute; left: 0; top: 198px; width: 492px; height: 180px; }
.err { color: #ff7d57; font-size: 14px; padding-top: 30px; }
</style>
