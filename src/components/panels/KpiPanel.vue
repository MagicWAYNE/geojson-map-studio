<script setup lang="ts">
import { onMounted, ref } from 'vue'
import NumberFlop from '@/components/common/NumberFlop.vue'
import { getDashboardData } from '@/api'
import type { DashboardData } from '@/types'

interface KpiItem {
  key: keyof DashboardData
  title: string
  suffix: string
}

const KPI_ITEMS: KpiItem[] = [
  { key: 'tj_year_tj', title: '累计扶持企业', suffix: '万家' },
  { key: 'tj_year_kl', title: '活跃服务企业', suffix: '万家' },
  { key: 'tj_year_tc', title: '成功孵化企业', suffix: '万家' },
  { key: 'tj_month_tj', title: '当月新增企业', suffix: '万家' },
  { key: 'tj_year_yx', title: '累计服务资源', suffix: '万项' },
  { key: 'tj_month_yx', title: '当月对接资源', suffix: '项' }
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
      <div class="grid">
        <div v-for="it in KPI_ITEMS" :key="it.key" class="item">
          <div class="title">{{ it.title }}</div>
          <div class="value">
            <NumberFlop :value="num(data?.[it.key])" :decimals="2" :font-size="28" />
            <span class="suffix">{{ it.suffix }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.kpi-panel { position: relative; width: 492px; height: 178px; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; height: 100%; }
.item {
  min-width: 0; padding: 14px 12px 10px;
  border: 1px solid rgba(36, 131, 255, 0.28);
  background: linear-gradient(135deg, rgba(16, 54, 113, 0.66), rgba(5, 20, 50, 0.35));
  box-shadow: inset 0 0 18px rgba(36, 131, 255, 0.08);
}
.title { font-family: 'OPPOSans-R'; font-size: 14px; color: #a5bde5; margin-bottom: 8px; white-space: nowrap; }
.value { display: flex; align-items: baseline; gap: 6px; }
.suffix { font-family: 'OPPOSans-R'; font-size: 14px; color: #90a3c8; }
.err { color: #ff7d57; font-size: 14px; padding-top: 30px; }
</style>
