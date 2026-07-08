<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import NumberFlop from '@/components/common/NumberFlop.vue'
import SubTitle from '@/components/layout/SubTitle.vue'
import { getKejifunengData } from '@/api'
import type { KejifunengItem } from '@/types'
import iconTech from '@/assets/images/icon-tech.png'

const LABEL: Record<string, string> = { 外呼: '服务外呼' }

const list = ref<KejifunengItem[]>([])
const active = ref(0)
const error = ref('')
onMounted(async () => {
  try {
    list.value = await getKejifunengData()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
})

const cur = computed(() => list.value[active.value] ?? null)
</script>

<template>
  <div class="tech-panel">
    <SubTitle title="科技赋能" />
    <div class="tabs">
      <span
        v-for="(it, i) in list"
        :key="it.id"
        class="tab"
        :class="{ active: i === active }"
        @click="active = i"
      >{{ LABEL[it.content] ?? it.content }}</span>
    </div>
    <div v-if="error" class="err">{{ error }}</div>
    <div v-else-if="cur" class="body">
      <img :src="iconTech" alt="" />
      <div class="group">
        <div class="title">{{ cur.child.mc }}</div>
        <div class="value">
          <NumberFlop :value="parseFloat(cur.child.lj)" :font-size="28" />
          <span class="unit">{{ cur.child.dw }}</span>
        </div>
      </div>
      <div class="group" style="left: 240px">
        <div class="title">{{ cur.child.mc1 }}</div>
        <div class="value">
          <NumberFlop :value="parseFloat(cur.child.jr)" :font-size="28" color="#edd892" />
          <span class="unit">{{ cur.child.dw1 }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tech-panel { position: relative; width: 492px; height: 100px; }
.tabs { position: absolute; right: 0; top: -2px; display: flex; gap: 4px; }
.tab {
  padding: 3px 10px; font-family: 'OPPOSans-R'; font-size: 12px; color: #a5bde5;
  background: linear-gradient(180deg, #1f335e, #111c2e);
  border: 1px solid rgba(165, 189, 229, 0.1); border-radius: 2px; cursor: pointer;
}
.tab.active { color: #fff; border-color: #2483ff; background: linear-gradient(180deg, #2a4a8a, #16233d); }
.body { position: relative; margin-top: 14px; height: 60px; }
.body img { position: absolute; left: 20px; top: 2px; width: 48px; height: 48px; }
.group { position: absolute; left: 82px; top: 0; }
.title { font-family: 'OPPOSans-R'; font-size: 14px; color: #90a3c8; margin-bottom: 4px; }
.value { display: flex; align-items: baseline; gap: 5px; }
.unit { font-family: 'OPPOSans-R'; font-size: 13px; color: #90a3c8; }
.err { color: #ff7d57; font-size: 14px; padding-top: 20px; }
</style>
