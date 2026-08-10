<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ScrollTable from '@/components/common/ScrollTable.vue'
import type { ScrollColumn } from '@/types'
import SubTitle from '@/components/layout/SubTitle.vue'
import { getEnterpriseResourceDistribution } from '@/api'

const PANEL_WIDTH = 288

const columns: ScrollColumn[] = [
  { key: 'city', title: '省份', width: '26.25%' },
  { key: 'aj', title: '企业（家）', width: '26.25%', align: 'center', numeric: true },
  { key: 'ztje', title: '服务资源（项）', width: '47.5%', align: 'right', color: '#edd892', numeric: true }
]

const rows = ref<Record<string, unknown>[]>([])
const error = ref('')
onMounted(async () => {
  try {
    rows.value = (await getEnterpriseResourceDistribution()) as unknown as Record<string, unknown>[]
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
})
</script>

<template>
  <div class="amount-panel" :style="{ width: PANEL_WIDTH + 'px' }">
    <SubTitle title="企业 / 服务资源分布" :width="PANEL_WIDTH" />
    <div v-if="error" class="err">{{ error }}</div>
    <ScrollTable v-else class="table" :columns="columns" :rows="rows" :height="192" :row-height="38" />
  </div>
</template>

<style scoped>
.amount-panel { position: relative; height: 215px; }
.table { margin-top: 3px; }
.err { color: #ff7d57; font-size: 14px; padding-top: 30px; }
</style>
