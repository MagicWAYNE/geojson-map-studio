<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import {
  MAP_DISTRICT_BAR_DEFAULTS,
  cloneDistrictBarConfig,
  normalizeDistrictBarConfig,
  type MapDistrictBarConfig
} from '@/components/map/mapDistrictBarConfig'
import { useMapDebug } from '@/composables/useMapDebug'
import { copyTextToClipboard } from '@/utils/copyText'
import MapDistrictBarControls from './MapDistrictBarControls.vue'

const { effect, districtBarRuntimeStatus } = useMapDebug()
const copyStatus = ref<'idle' | 'success' | 'error'>('idle')
let copiedTimer = 0

const barJson = computed(() => JSON.stringify(normalizeDistrictBarConfig(effect.bars), null, 2))

function replaceBars(value: MapDistrictBarConfig): void {
  Object.assign(effect.bars, normalizeDistrictBarConfig(value))
}

async function copyBars(): Promise<void> {
  copyStatus.value = await copyTextToClipboard(barJson.value) ? 'success' : 'error'
  clearTimeout(copiedTimer)
  copiedTimer = window.setTimeout(() => (copyStatus.value = 'idle'), 1500)
}

function resetBars(): void {
  Object.assign(effect.bars, cloneDistrictBarConfig(MAP_DISTRICT_BAR_DEFAULTS))
}

function copyLabel(): string {
  if (copyStatus.value === 'success') return '已复制 ✓'
  if (copyStatus.value === 'error') return '复制失败，请重试'
  return '复制柱状图参数'
}

onBeforeUnmount(() => clearTimeout(copiedTimer))
</script>

<template>
  <div class="data-controls">
    <section class="data-group">
      <h3>区级案件量柱状图</h3>
      <p class="hint">柱体主体固定为不透明；稳定底环与向内收缩的脉冲环可独立调节。</p>
      <MapDistrictBarControls
        :model-value="effect.bars"
        :runtime-status="districtBarRuntimeStatus"
        @update:model-value="replaceBars"
      />
    </section>

    <section class="data-group">
      <h3>可复制柱状图参数</h3>
      <pre class="json-out">{{ barJson }}</pre>
      <div class="actions">
        <button class="btn" @click="copyBars">{{ copyLabel() }}</button>
        <button class="btn ghost" @click="resetBars">恢复柱状图默认值</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.data-controls { display: flex; flex-direction: column; gap: 14px; padding-bottom: 4px; }
.data-group {
  display: flex; flex-direction: column; gap: 10px; padding: 12px;
  border: 1px solid rgba(36, 131, 255, 0.28); border-radius: 4px;
  background: rgba(36, 131, 255, 0.05);
}
.data-group h3 { margin: 0; font-size: 14px; font-weight: normal; color: #fff; }
.hint { margin: 0; font-size: 11px; line-height: 1.5; color: #8fd9ff; }
.json-out {
  box-sizing: border-box; max-height: 280px; margin: 0; padding: 10px;
  overflow: auto; user-select: text; white-space: pre; font-size: 11px; line-height: 1.45;
  color: #8fd9ff; background: rgba(0, 0, 0, 0.35);
  border: 1px dashed rgba(36, 131, 255, 0.4); border-radius: 4px;
}
.actions { display: flex; gap: 8px; }
.btn {
  flex: 1; padding: 8px 4px; font-size: 12px; font-family: 'OPPOSans-M'; cursor: pointer;
  color: #041020; background: linear-gradient(180deg, #00deff, #2483ff);
  border: none; border-radius: 4px;
}
.btn.ghost { color: #7fa8d9; background: transparent; border: 1px solid rgba(36, 131, 255, 0.5); }
.btn.ghost:hover { color: #00deff; border-color: #00deff; }
</style>
