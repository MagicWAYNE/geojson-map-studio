<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import SectionTitle from '@/components/layout/SectionTitle.vue'
import ScrollTable from '@/components/common/ScrollTable.vue'
import type { ScrollColumn } from '@/types'
import { getHgpxList } from '@/api'

const columns: ScrollColumn[] = [
  { key: 'idx', title: '序号', width: '10%', align: 'center' },
  { key: 'zt', title: '培训主题', width: '55%' },
  { key: 'rs', title: '参与人数', width: '15%', align: 'center', color: '#edd892' },
  { key: 'rq', title: '时间', width: '20%', align: 'center' }
]

const raw = ref<{ zt: string; rs: number; rq: string }[]>([])
const error = ref('')
onMounted(async () => {
  try {
    raw.value = await getHgpxList()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
})

const rows = computed(() =>
  raw.value.map((r, i) => ({ idx: i + 1, zt: r.zt, rs: r.rs, rq: r.rq.slice(0, 10) }))
)
</script>

<template>
  <div class="training-panel">
    <SectionTitle title="合规培训&走访抽查" />
    <div v-if="error" class="err">{{ error }}</div>
    <ScrollTable v-else class="table" :columns="columns" :rows="rows" :height="98" :row-height="32" />
  </div>
</template>

<style scoped>
.training-panel { position: relative; width: 492px; height: 171px; }
.table { margin-top: 13px; }
.err { color: #ff7d57; font-size: 14px; padding-top: 30px; }
</style>
