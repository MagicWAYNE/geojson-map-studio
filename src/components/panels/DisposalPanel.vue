<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import SubTitle from '@/components/layout/SubTitle.vue'
import { getChuzhiList } from '@/api'
import type { ChuzhiItem } from '@/types'

const ITEM_H = 84
const BODY_H = 268

const list = ref<ChuzhiItem[]>([])
const error = ref('')
onMounted(async () => {
  try {
    list.value = await getChuzhiList()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
})

const needScroll = computed(() => list.value.length * ITEM_H > BODY_H)
const renderList = computed(() => (needScroll.value ? [...list.value, ...list.value] : list.value))
const scrollStyle = computed(() =>
  needScroll.value
    ? { animationDuration: `${list.value.length * 3}s`, '--scroll-to': `-${list.value.length * ITEM_H}px` }
    : {}
)
</script>

<template>
  <div class="disposal-panel">
    <SubTitle title="处置结果" />
    <div v-if="error" class="err">{{ error }}</div>
    <div v-else class="body">
      <div class="items" :class="{ scrolling: needScroll }" :style="scrollStyle">
        <div class="item" v-for="(it, i) in renderList" :key="i">
          <div class="line1">事由/诉求：<b>{{ it.lx }}</b></div>
          <div class="line2">电询数量：<em>{{ it.sl }}</em></div>
          <div class="line3">处置措施：{{ it.czjg }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.disposal-panel { position: relative; width: 492px; height: 312px; }
.body { margin-top: 10px; height: 268px; overflow: hidden; }
.items.scrolling { animation: scroll-up linear infinite; }
.item { height: 84px; padding: 6px 8px 0; border-bottom: 1px solid rgba(36, 131, 255, 0.15); }
.line1 { font-family: 'OPPOSans-R'; font-size: 14px; color: #90a3c8; }
.line1 b { color: #fff; font-weight: normal; }
.line2 { font-family: 'OPPOSans-R'; font-size: 14px; color: #90a3c8; margin: 4px 0; }
.line2 em { font-style: normal; font-family: Bebas, sans-serif; font-size: 18px; color: #edd892; }
.line3 {
  font-family: 'OPPOSans-R'; font-size: 12px; color: #90a3c8;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.err { color: #ff7d57; font-size: 14px; padding-top: 30px; }
@keyframes scroll-up {
  from { transform: translateY(0); }
  to { transform: translateY(var(--scroll-to)); }
}
</style>
