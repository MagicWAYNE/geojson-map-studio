<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ScrollTable from '@/components/common/ScrollTable.vue'
import type { ScrollColumn } from '@/types'
import SubTitle from '@/components/layout/SubTitle.vue'
import { getServiceOrganizationPerformance } from '@/api'

const columns: ScrollColumn[] = [
  { key: 'lx', title: '服务机构', width: '34%' },
  { key: 'rs', title: '服务人员', width: '15%', align: 'center', numeric: true },
  { key: 'dx', title: '咨询数量', width: '15%', align: 'center', color: '#edd892', numeric: true },
  { key: 'bwt', title: '服务企业', width: '18%', align: 'center', numeric: true },
  { key: 'bl', title: '满意度', width: '18%', align: 'center', color: '#00DEFF', numeric: true }
]

const rows = ref<Record<string, unknown>[]>([])
const error = ref('')
onMounted(async () => {
  try {
    rows.value = (await getServiceOrganizationPerformance()) as unknown as Record<string, unknown>[]
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
})
</script>

<template>
  <div class="social-panel">
    <SubTitle title="服务机构成效" />
    <div v-if="error" class="err">{{ error }}</div>
    <ScrollTable v-else class="table" :columns="columns" :rows="rows" :height="230" :row-height="38" :scroll="false" />
  </div>
</template>

<style scoped>
.social-panel { position: relative; width: 492px; height: 266px; }
.table { margin-top: 10px; }
.err { color: #ff7d57; font-size: 14px; padding-top: 30px; }
</style>
