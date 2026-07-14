<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ScrollTable from '@/components/common/ScrollTable.vue'
import type { ScrollColumn } from '@/types'
import SubTitle from '@/components/layout/SubTitle.vue'
import { getJeFenbuList } from '@/api'

const columns: ScrollColumn[] = [
  { key: 'city', title: '省份', width: '21%' },
  { key: 'aj', title: '案件（件）', width: '21%', align: 'center', numeric: true },
  { key: 'ztje', title: '在调金额（万元）', width: '38%', align: 'right', color: '#edd892', numeric: true }
]

const rows = ref<Record<string, unknown>[]>([])
const error = ref('')
onMounted(async () => {
  try {
    rows.value = (await getJeFenbuList()) as unknown as Record<string, unknown>[]
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
})
</script>

<template>
  <div class="amount-panel">
    <SubTitle title="案件 / 在调金额分布" :width="360" />
    <div v-if="error" class="err">{{ error }}</div>
    <ScrollTable v-else class="table" :columns="columns" :rows="rows" :height="192" :row-height="38" />
  </div>
</template>

<style scoped>
.amount-panel { position: relative; width: 360px; height: 215px; }
.table { margin-top: 3px; }
.err { color: #ff7d57; font-size: 14px; padding-top: 30px; }
</style>
