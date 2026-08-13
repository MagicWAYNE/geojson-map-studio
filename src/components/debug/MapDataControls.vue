<script setup lang="ts">
import { computed } from 'vue'
import {
  MAP_DISTRICT_BAR_DEFAULTS,
  cloneDistrictBarConfig,
  normalizeDistrictBarConfig,
  type MapDistrictBarConfig
} from '@/components/map/mapDistrictBarConfig'
import {
  MAP_DISTRICT_BAR_OVERLAY_DEFAULTS,
  cloneDistrictBarOverlayConfig,
  normalizeDistrictBarOverlayConfig,
  type MapDistrictBarOverlayConfig
} from '@/components/map/mapDistrictBarOverlayConfig'
import { useMapVisualSettings } from '@/composables/useMapVisualSettings'
import MapDistrictBarControls from './MapDistrictBarControls.vue'
import MapDistrictBarOverlayControls from './MapDistrictBarOverlayControls.vue'

const visualSettings = useMapVisualSettings()
const { effect, districtBarRuntimeStatus } = visualSettings

const barJson = computed(() => JSON.stringify(normalizeDistrictBarConfig(effect.bars), null, 2))
const overlayJson = computed(() => JSON.stringify(
  normalizeDistrictBarOverlayConfig(effect.bars.overlay),
  null,
  2
))

function assignOverlayConfig(
  target: MapDistrictBarOverlayConfig,
  source: Readonly<MapDistrictBarOverlayConfig>
): void {
  target.enabled = source.enabled
  Object.assign(target.badge, source.badge)
  Object.assign(target.panel, source.panel)
  Object.assign(target.collision, source.collision)
}

function assignBarsConfig(target: MapDistrictBarConfig, source: Readonly<MapDistrictBarConfig>): void {
  const { overlay, ...barFields } = source
  Object.assign(target, barFields)
  assignOverlayConfig(target.overlay, overlay)
}

function replaceBars(value: MapDistrictBarConfig): void {
  assignBarsConfig(effect.bars, normalizeDistrictBarConfig(value))
}

async function copyBars(): Promise<void> {
  await visualSettings.copyVisualText('bars', barJson.value)
}

async function copyOverlay(): Promise<void> {
  await visualSettings.copyVisualText('overlay', overlayJson.value)
}

function resetBars(): void {
  assignBarsConfig(effect.bars, cloneDistrictBarConfig(MAP_DISTRICT_BAR_DEFAULTS))
}

function replaceOverlay(value: MapDistrictBarOverlayConfig): void {
  assignOverlayConfig(effect.bars.overlay, normalizeDistrictBarOverlayConfig(value))
}

function resetOverlay(): void {
  assignOverlayConfig(
    effect.bars.overlay,
    cloneDistrictBarOverlayConfig(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS)
  )
}

</script>

<template>
  <div class="data-controls">
    <section class="data-group">
      <h3>区域数据柱体</h3>
      <p class="hint">柱体主体固定为不透明；稳定底环与向内收缩的脉冲环可独立调节。</p>
      <MapDistrictBarControls
        :model-value="effect.bars"
        :runtime-status="districtBarRuntimeStatus"
        @update:model-value="replaceBars"
      />
    </section>

    <section class="data-group">
      <h3>柱顶标签与 Hover 指标面板</h3>
      <p class="hint">所有尺寸均为屏幕像素，可独立调整柱顶数值标签、指标面板及碰撞避让。</p>
      <MapDistrictBarOverlayControls
        :model-value="effect.bars.overlay"
        @update:model-value="replaceOverlay"
      />
    </section>

    <section class="data-group">
      <h3>可复制浮层参数</h3>
      <pre class="json-out" data-testid="overlay-json">{{ overlayJson }}</pre>
      <div class="actions">
        <button class="btn" data-testid="copy-overlay" @click="copyOverlay">
          {{ visualSettings.copyLabel('overlay', '复制浮层参数') }}
        </button>
        <button class="btn ghost" data-testid="reset-overlay" @click="resetOverlay">
          恢复浮层默认值
        </button>
      </div>
    </section>

    <section class="data-group">
      <h3>可复制柱体参数</h3>
      <pre class="json-out" data-testid="bars-json">{{ barJson }}</pre>
      <div class="actions">
        <button class="btn" data-testid="copy-bars" @click="copyBars">
          {{ visualSettings.copyLabel('bars', '复制柱体参数') }}
        </button>
        <button class="btn ghost" data-testid="reset-bars" @click="resetBars">
          恢复柱体默认值
        </button>
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
