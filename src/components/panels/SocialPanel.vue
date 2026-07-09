<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ScrollTable from '@/components/common/ScrollTable.vue'
import type { ScrollColumn } from '@/types'
import SubTitle from '@/components/layout/SubTitle.vue'
import { getZuzhizhixiaoList } from '@/api'

const columns: ScrollColumn[] = [
  { key: 'lx', title: '组织单位', width: '34%' },
  { key: 'rs', title: '调解人员', width: '15%', align: 'center', numeric: true },
  { key: 'dx', title: '电询数量', width: '15%', align: 'center', color: '#edd892', numeric: true },
  { key: 'bwt', title: '被委托案', width: '18%', align: 'center', numeric: true },
  { key: 'bl', title: '被询比率', width: '18%', align: 'center', color: '#00DEFF', numeric: true }
]

const rows = ref<Record<string, unknown>[]>([])
const error = ref('')
onMounted(async () => {
  try {
    rows.value = (await getZuzhizhixiaoList()) as unknown as Record<string, unknown>[]
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
})
</script>

<template>
  <div class="social-panel">
    <SubTitle title="社会效果" />
    <div v-if="error" class="err">{{ error }}</div>
    <ScrollTable v-else class="table" :columns="columns" :rows="rows" :height="230" :row-height="38" :scroll="false" />
  </div>
</template>

<style scoped>
.social-panel { position: relative; width: 492px; height: 266px; }
.table { margin-top: 10px; }
.err { color: #ff7d57; font-size: 14px; padding-top: 30px; }
</style>
