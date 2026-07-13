<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import {
  MAP_DISTRICT_BAR_DEFAULTS,
  cloneDistrictBarConfig,
  normalizeDistrictBarConfig,
  type MapDistrictBarConfig
} from '@/components/map/mapDistrictBarConfig'
import {
  MAP_DISTRICT_BAR_LABEL_DEFAULTS,
  cloneDistrictBarLabelConfig,
  normalizeDistrictBarLabelConfig,
  type MapDistrictBarLabelConfig
} from '@/components/map/mapDistrictBarLabelConfig'
import { useMapDebug } from '@/composables/useMapDebug'
import { copyTextToClipboard } from '@/utils/copyText'
import MapDistrictBarControls from './MapDistrictBarControls.vue'
import MapDistrictBarLabelControls from './MapDistrictBarLabelControls.vue'

const { effect, districtBarRuntimeStatus } = useMapDebug()
type CopyTag = 'bars' | 'label'
const copyStatus = ref<{ tag: CopyTag; result: 'success' | 'error' } | null>(null)
let copiedTimer = 0

const barJson = computed(() => JSON.stringify(normalizeDistrictBarConfig(effect.bars), null, 2))
const labelJson = computed(() => JSON.stringify(normalizeDistrictBarLabelConfig(effect.bars.label), null, 2))

function replaceBars(value: MapDistrictBarConfig): void {
  const normalized = normalizeDistrictBarConfig(value)
  const { label, ...bars } = normalized
  Object.assign(effect.bars, bars)
  Object.assign(effect.bars.label, label)
}

function replaceLabel(value: MapDistrictBarLabelConfig): void {
  Object.assign(effect.bars.label, normalizeDistrictBarLabelConfig(value))
}

async function copyPayload(text: string, tag: CopyTag): Promise<void> {
  copyStatus.value = {
    tag,
    result: await copyTextToClipboard(text) ? 'success' : 'error'
  }
  clearTimeout(copiedTimer)
  copiedTimer = window.setTimeout(() => (copyStatus.value = null), 1500)
}

function resetBars(): void {
  replaceBars(cloneDistrictBarConfig(MAP_DISTRICT_BAR_DEFAULTS))
}

function resetLabel(): void {
  replaceLabel(cloneDistrictBarLabelConfig(MAP_DISTRICT_BAR_LABEL_DEFAULTS))
}

function copyButtonLabel(tag: CopyTag, idle: string): string {
  if (copyStatus.value?.tag !== tag) return idle
  return copyStatus.value.result === 'success' ? '已复制 ✓' : '复制失败，请重试'
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
      <h3>柱体标签</h3>
      <p class="hint">8 个标签固定显示在柱体顶部右侧；Hover 标签增强并在下方展开详情窗。</p>
      <MapDistrictBarLabelControls
        :model-value="effect.bars.label"
        @update:model-value="replaceLabel"
      />
    </section>

    <section class="data-group">
      <h3>可复制柱状图参数</h3>
      <pre class="json-out">{{ barJson }}</pre>
      <div class="actions">
        <button class="btn" @click="copyPayload(barJson, 'bars')">
          {{ copyButtonLabel('bars', '复制柱状图参数') }}
        </button>
        <button class="btn ghost" @click="resetBars">恢复柱状图默认值</button>
      </div>
    </section>

    <section class="data-group">
      <h3>可复制标签参数</h3>
      <pre class="json-out">{{ labelJson }}</pre>
      <div class="actions">
        <button class="btn" @click="copyPayload(labelJson, 'label')">
          {{ copyButtonLabel('label', '复制标签参数') }}
        </button>
        <button class="btn ghost" @click="resetLabel">恢复标签默认值</button>
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
