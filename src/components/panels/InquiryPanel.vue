<script setup lang="ts">
import { onMounted, ref } from 'vue'
import NumberFlop from '@/components/common/NumberFlop.vue'
import { useECharts } from '@/composables/useECharts'
import { buildMultiLineOption } from '@/utils/chartOptions'
import { getDxData, getDxmonthList } from '@/api'
import type { DxData } from '@/types'
import iconInquiry from '@/assets/images/icon-inquiry.png'
import iconSmall1 from '@/assets/images/icon-small-1.png'

const LINE_COLORS: Record<string, string> = { 询问: '#2e82db', 转办: '#edd892', 有责: '#44ffa2' }

interface Mini {
  key: keyof DxData
  title: string
  x: number
  y: number
}
const MINIS: Mini[] = [
  { key: 'dx_zx_xw', title: '普通电询', x: 255, y: 10 },
  { key: 'dx_zx_ts', title: '无责投诉', x: 340, y: 10 },
  { key: 'dx_zx_yz', title: '有效投诉', x: 418, y: 10 },
  { key: 'dx_yn_yz', title: '有效', x: 255, y: 93 },
  { key: 'dx_yn_wz', title: '无责', x: 340, y: 93 }
]

const data = ref<DxData | null>(null)
const error = ref('')
const chartEl = ref<HTMLElement | null>(null)
const { setOption } = useECharts(chartEl)

onMounted(async () => {
  try {
    const [dx, month] = await Promise.all([getDxData(), getDxmonthList()])
    data.value = dx
    setOption(buildMultiLineOption(month, LINE_COLORS, { areaSeries: '询问' }))
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
})

const num = (v: string | undefined) => (v ? parseFloat(v) : 0)
</script>

<template>
  <div class="inquiry-panel">
    <div v-if="error" class="err">{{ error }}</div>
    <template v-else>
      <div class="big" style="top: 10px">
        <img :src="iconInquiry" alt="" />
        <div>
          <div class="title">累计电询数量</div>
          <div class="value">
            <NumberFlop :value="num(data?.dx_zx_year)" :font-size="30" />
            <span class="unit">件</span>
          </div>
        </div>
      </div>
      <div class="big" style="top: 93px">
        <img :src="iconSmall1" alt="" />
        <div>
          <div class="title">累计转办</div>
          <div class="value">
            <NumberFlop :value="num(data?.dx_yn_year)" :font-size="30" />
            <span class="unit">件</span>
          </div>
        </div>
      </div>
      <div v-for="m in MINIS" :key="m.key" class="mini" :style="{ left: m.x + 'px', top: m.y + 'px' }">
        <div class="title">{{ m.title }}</div>
        <div class="value">
          <NumberFlop :value="num(data?.[m.key])" :font-size="22" color="#edd892" />
          <span class="unit">件</span>
        </div>
      </div>
      <div ref="chartEl" class="chart" />
    </template>
  </div>
</template>

<style scoped>
.inquiry-panel { position: relative; width: 492px; height: 360px; }
.big { position: absolute; left: 12px; display: flex; align-items: center; gap: 10px; }
.big img { width: 52px; height: 52px; }
.mini { position: absolute; }
.title { font-family: 'OPPOSans-R'; font-size: 14px; color: #90a3c8; margin-bottom: 5px; }
.value { display: flex; align-items: baseline; gap: 5px; }
.unit { font-family: 'OPPOSans-R'; font-size: 13px; color: #90a3c8; }
.chart { position: absolute; left: 0; top: 170px; width: 492px; height: 190px; }
.err { color: #ff7d57; font-size: 14px; padding-top: 30px; }
</style>
