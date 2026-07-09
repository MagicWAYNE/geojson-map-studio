<script setup lang="ts">
import { computed } from 'vue'
import type { ScrollColumn } from '@/types'

const props = withDefaults(
  defineProps<{
    columns: ScrollColumn[]
    rows: Record<string, unknown>[]
    height: number
    rowHeight?: number
    scroll?: boolean
  }>(),
  { rowHeight: 34, scroll: true }
)

const HEAD_H = 30
const needScroll = computed(
  () => props.scroll && props.rows.length * props.rowHeight > props.height - HEAD_H
)
const renderRows = computed(() => (needScroll.value ? [...props.rows, ...props.rows] : props.rows))
const scrollStyle = computed(() =>
  needScroll.value
    ? {
        animationDuration: `${props.rows.length * 2.4}s`,
        '--scroll-to': `-${props.rows.length * props.rowHeight}px`
      }
    : {}
)
</script>

<template>
  <div class="scroll-table" :style="{ height: height + 'px' }">
    <div class="thead">
      <span
        v-for="c in columns"
        :key="c.key"
        :style="{ width: c.width, textAlign: c.align ?? 'left' }"
      >{{ c.title }}</span>
    </div>
    <div class="tbody" :style="{ height: height - HEAD_H + 'px' }">
      <div class="rows" :class="{ scrolling: needScroll }" :style="scrollStyle">
        <div class="row" v-for="(r, i) in renderRows" :key="i" :style="{ height: rowHeight + 'px' }">
          <span
            v-for="c in columns"
            :key="c.key"
            :class="{ num: c.numeric }"
            :style="{ width: c.width, textAlign: c.align ?? 'left', color: c.color }"
          >{{ r[c.key] }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scroll-table { width: 100%; overflow: hidden; }
.thead {
  display: flex; height: 30px; line-height: 30px;
  font-size: 12px; color: #90a3c8; font-family: 'OPPOSans-R';
  background: rgba(36, 131, 255, 0.12);
}
.thead span, .row span {
  padding: 0 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: none;
}
.tbody { overflow: hidden; }
.rows.scrolling { animation: scroll-up linear infinite; }
.row { display: flex; align-items: center; font-size: 13px; color: #fff; font-family: 'OPPOSans-R'; }
.row span.num { font-family: Bebas, 'OPPOSans-R', sans-serif; }
.row:nth-child(odd) { background: rgba(36, 131, 255, 0.06); }
@keyframes scroll-up {
  from { transform: translateY(0); }
  to { transform: translateY(var(--scroll-to)); }
}
</style>
