<script setup lang="ts">
import { onMounted, ref } from 'vue'
import NumberFlop from '@/components/common/NumberFlop.vue'
import { getDashboardData } from '@/api'
import type { DashboardData } from '@/types'
import iconCase from '@/assets/images/icon-kpi-case.png'
import iconMoney from '@/assets/images/icon-kpi-money.png'

interface KpiItem {
  key: keyof DashboardData
  title: string
  suffix: string
  x: number
}

const ROW1: KpiItem[] = [
  { key: 'tj_year_tj', title: '累计调解案件', suffix: '万件', x: 82 },
  { key: 'tj_year_kl', title: '当事人可联案件', suffix: '万件', x: 255 },
  { key: 'tj_year_tc', title: '实际调成案件', suffix: '万件', x: 429 },
  { key: 'tj_month_tj', title: '当月调解案件', suffix: '万件', x: 602 }
]
const ROW2: KpiItem[] = [
  { key: 'tj_year_yx', title: '累计履行金额', suffix: '万元', x: 82 },
  { key: 'tj_month_yx', title: '及时履行金额', suffix: '万元', x: 308 }
]

const data = ref<DashboardData | null>(null)
const error = ref('')
onMounted(async () => {
  try {
    data.value = await getDashboardData()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
})

const num = (v: string | undefined) => (v ? parseFloat(v) : 0)
</script>

<template>
  <div class="kpi-panel">
    <div v-if="error" class="err">{{ error }}</div>
    <template v-else>
      <div class="row" style="top: 0">
        <img class="icon" :src="iconCase" alt="" />
        <div v-for="it in ROW1" :key="it.key" class="item" :style="{ left: it.x + 'px' }">
          <div class="title">{{ it.title }}</div>
          <div class="value">
            <NumberFlop :value="num(data?.[it.key])" :decimals="2" />
            <span class="suffix">{{ it.suffix }}</span>
          </div>
        </div>
      </div>
      <div class="row" style="top: 101px">
        <img class="icon" :src="iconMoney" alt="" />
        <div v-for="it in ROW2" :key="it.key" class="item" :style="{ left: it.x + 'px' }">
          <div class="title">{{ it.title }}</div>
          <div class="value">
            <NumberFlop :value="num(data?.[it.key])" :decimals="2" />
            <span class="suffix">{{ it.suffix }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.kpi-panel { position: relative; width: 748px; height: 178px; }
.row { position: absolute; left: 0; width: 748px; height: 77px; }
.icon { position: absolute; left: 4px; top: 4px; width: 68px; height: 68px; }
.item { position: absolute; top: 2px; }
.title { font-family: 'OPPOSans-R'; font-size: 14px; color: #90a3c8; margin-bottom: 8px; }
.value { display: flex; align-items: baseline; gap: 6px; }
.suffix { font-family: 'OPPOSans-R'; font-size: 14px; color: #90a3c8; }
.err { color: #ff7d57; font-size: 14px; padding-top: 30px; }
</style>
