<script setup lang="ts">
import { computed } from 'vue'
import { useMapVisualSettings } from '@/composables/useMapVisualSettings'
import { useMapDistrictCarousel } from '@/composables/useMapDistrictCarousel'

const session = useMapVisualSettings()
const carousel = useMapDistrictCarousel()
const dataRange = computed(() => {
  const { dataMin, dataMax } = session.regionBarRuntimeStatus
  return dataMin === null || dataMax === null ? '—' : `${dataMin}–${dataMax}`
})
const configSections = computed(() => [
  { key: 'effect' as const, label: '完整效果参数', value: session.effectJson.value },
  { key: 'bars' as const, label: '区域数据柱体参数', value: session.regionBarJson.value },
  { key: 'overlay' as const, label: '数值标签与指标浮层参数', value: session.regionOverlayJson.value },
  { key: 'hud' as const, label: 'HUD 参数', value: session.hudJson.value }
])

function updateCarousel(event: Event): void {
  carousel.enabled.value = (event.target as HTMLInputElement).checked
}
</script>

<template>
  <div class="engineering-info" data-visual-page-content="engineering">
    <section class="engineering-group">
      <h2>运行诊断</h2>
      <dl class="runtime-grid">
        <div><dt>FPS</dt><dd>{{ session.fps.value }}</dd></div>
        <div><dt>离屏目标</dt><dd>{{ session.effectRuntimeStatus.targetWidth }} × {{ session.effectRuntimeStatus.targetHeight }}</dd></div>
        <div><dt>Render scale</dt><dd>{{ session.effectRuntimeStatus.renderScale }}</dd></div>
        <div><dt>常态外光</dt><dd>{{ session.effectRuntimeStatus.baseState }}</dd></div>
        <div><dt>Hover 外光</dt><dd>{{ session.effectRuntimeStatus.hoverState }}</dd></div>
        <div><dt>常态内光</dt><dd>{{ session.effectRuntimeStatus.baseInwardState }}</dd></div>
        <div><dt>Hover 内光</dt><dd>{{ session.effectRuntimeStatus.hoverInwardState }}</dd></div>
        <div><dt>马赛克</dt><dd>{{ session.effectRuntimeStatus.mosaicState }}</dd></div>
        <div><dt>柱体数量</dt><dd>{{ session.regionBarRuntimeStatus.renderedCount }}</dd></div>
        <div><dt>区域数值范围</dt><dd>{{ dataRange }}</dd></div>
        <div><dt>效果降级</dt><dd>{{ session.effectRuntimeStatus.degraded ? '是' : '否' }}</dd></div>
        <div><dt>柱体降级</dt><dd>{{ session.regionBarRuntimeStatus.degraded ? '是' : '否' }}</dd></div>
      </dl>
      <label class="carousel-switch" for="engineering-carousel">
        <span>自动区域轮播</span>
        <input
          id="engineering-carousel"
          data-visual-action="engineering.carousel"
          type="checkbox"
          :checked="carousel.enabled.value"
          @change="updateCarousel"
        />
      </label>
    </section>

    <section class="engineering-group">
      <div class="group-heading">
        <h2>当前相机</h2>
        <button type="button" @click="session.copyVisualText('camera', session.cameraView.value)">
          {{ session.copyLabel('camera', '复制') }}
        </button>
      </div>
      <pre>{{ session.cameraView.value }}</pre>
    </section>

    <section v-for="item in configSections" :key="item.key" class="engineering-group">
      <div class="group-heading">
        <h2>{{ item.label }}</h2>
        <button type="button" @click="session.copyVisualText(item.key, item.value)">
          {{ session.copyLabel(item.key, '复制 JSON') }}
        </button>
      </div>
      <pre>{{ item.value }}</pre>
    </section>
  </div>
</template>

<style scoped>
.engineering-info { display: flex; flex-direction: column; gap: 16px; padding-bottom: 18px; }
.engineering-group { display: flex; flex-direction: column; gap: 11px; padding: 14px; background: rgba(36, 131, 255, 0.05); border: 1px solid rgba(36, 131, 255, 0.28); border-radius: 6px; }
.engineering-group h2 { margin: 0; color: #fff; font-size: 15px; }
.runtime-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 0; }
.runtime-grid div { min-width: 0; padding: 9px; background: rgba(0, 0, 0, 0.2); border-radius: 4px; }
.runtime-grid dt { color: #7fa8d9; font-size: 12px; }
.runtime-grid dd { margin: 4px 0 0; color: #8fd9ff; font-family: monospace; font-size: 13px; overflow-wrap: anywhere; }
.group-heading, .carousel-switch { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #cfe6ff; }
.carousel-switch { padding: 10px; border: 1px solid rgba(36, 131, 255, 0.3); border-radius: 4px; }
.carousel-switch input { accent-color: #00deff; }
pre { max-height: 260px; margin: 0; padding: 10px; overflow: auto; color: #8fd9ff; white-space: pre; background: rgba(0, 0, 0, 0.35); border: 1px dashed rgba(36, 131, 255, 0.4); border-radius: 4px; }
button { padding: 6px 10px; color: #dff9ff; cursor: pointer; background: rgba(22, 111, 180, 0.58); border: 1px solid rgba(75, 203, 255, 0.58); border-radius: 4px; }
</style>
