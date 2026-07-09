<script setup lang="ts">
import { computed, onMounted, ref, type Component } from 'vue'
import {
  Ban, FileText, MessageCircleQuestion, MessageSquareWarning,
  PhoneMissed, PhoneOff, Scale, ShieldQuestion, VolumeX
} from 'lucide-vue-next'
import SubTitle from '@/components/layout/SubTitle.vue'
import { getChuzhiList } from '@/api'
import type { ChuzhiItem } from '@/types'

/** 事由是 API 自由文本，按关键词匹配图标，未命中兜底 FileText */
const ICON_RULES: [RegExp, Component][] = [
  [/投诉/, MessageSquareWarning],
  [/身份/, ShieldQuestion],
  [/管辖/, Scale],
  [/打不通|回电/, PhoneMissed],
  [/电话错误|非被告|本人/, PhoneOff],
  [/不接受|拒绝/, Ban],
  [/不说话|骂人|表达不清/, VolumeX],
  [/询问|咨询/, MessageCircleQuestion]
]
const iconFor = (lx: string) => ICON_RULES.find(([re]) => re.test(lx))?.[1] ?? FileText

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
          <div class="icon-wrap">
            <component :is="iconFor(it.lx)" :size="20" :stroke-width="1.8" />
          </div>
          <div class="content">
            <div class="line1">事由/诉求：<b>{{ it.lx }}</b></div>
            <div class="line2">电询数量：<em>{{ it.sl }}</em></div>
            <div class="line3">处置措施：{{ it.czjg }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.disposal-panel { position: relative; width: 492px; height: 312px; }
.body { margin-top: 10px; height: 268px; overflow: hidden; }
.items.scrolling { animation: scroll-up linear infinite; }
.item {
  display: flex; align-items: center; gap: 12px;
  height: 84px; padding: 0 8px; border-bottom: 1px solid rgba(36, 131, 255, 0.4);
}
.icon-wrap {
  flex: none; display: flex; align-items: center; justify-content: center;
  width: 38px; height: 38px; border-radius: 50%; color: #6ea8ff;
  background: rgba(36, 131, 255, 0.12); border: 1px solid rgba(36, 131, 255, 0.35);
}
.content { flex: 1; min-width: 0; }
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
