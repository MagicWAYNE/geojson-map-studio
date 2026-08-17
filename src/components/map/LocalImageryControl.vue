<script setup lang="ts">
import { computed } from 'vue'
import { useLocalImagery } from '@/composables/useLocalImagery'

const imagery = useLocalImagery()
const defaultLegalNoticeUrl = 'https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice'
const attribution = computed(() => imagery.appearance.value?.attribution ?? 'Contains modified Copernicus Sentinel data 2025')
const legalNoticeUrl = computed(() => imagery.appearance.value?.legalNoticeUrl ?? defaultLegalNoticeUrl)
const statusText = computed(() => {
  if (!imagery.available.value) return '请先从区域库加载全国、省级或地市级地图。'
  if (!imagery.enabled.value) return '关闭时沿用科技蓝地图效果。'
  if (imagery.state.value === 'loading') return '正在读取本地影像清单…'
  return imagery.message.value
})
</script>

<template>
  <section class="local-imagery-control" aria-labelledby="local-imagery-title">
    <div class="local-imagery-control__heading">
      <h2 id="local-imagery-title">区域纹理</h2>
      <span class="local-imagery-control__info-wrap">
        <button
          type="button"
          class="local-imagery-control__info"
          data-local-imagery-info
          aria-label="查看区域纹理数据来源"
          aria-describedby="local-imagery-source-tooltip"
        >
          <svg data-icon="info" aria-hidden="true" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.5" />
            <path d="M8 7.1V11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            <circle cx="8" cy="4.75" r=".8" fill="currentColor" />
          </svg>
        </button>
        <span id="local-imagery-source-tooltip" class="local-imagery-control__tooltip" role="tooltip">
          数据来源：Copernicus Sentinel-2 Level-3 Quarterly Mosaics（2025）。主季度为 2025-Q2，质量不达标时依次回退至 2025-Q4、2025-Q3；地图仅使用已生成的本地静态 JPEG。
          <a :href="legalNoticeUrl" target="_blank" rel="noreferrer">{{ attribution }}</a>
        </span>
      </span>
    </div>
    <label>
      <input
        v-model="imagery.enabled.value"
        type="checkbox"
        :disabled="!imagery.available.value"
        data-action="toggle-local-imagery"
      />
      <span>加载本地 Sentinel-2 影像</span>
    </label>
    <p class="local-imagery-control__status" :data-state="imagery.state.value" aria-live="polite">
      {{ statusText }}
    </p>
  </section>
</template>

<style scoped>
.local-imagery-control { display: grid; gap: 10px; padding: 12px 14px; background: rgba(7, 26, 55, 0.68); border: 1px solid rgba(36, 131, 255, 0.35); border-radius: 6px; }
.local-imagery-control__heading { display: flex; align-items: center; gap: 6px; }
.local-imagery-control h2 { margin: 0; color: #b9ddff; font-size: 15px; }
.local-imagery-control p { margin: 0; color: #7194be; font-size: 12px; line-height: 1.55; }
.local-imagery-control label { display: flex; gap: 8px; align-items: center; color: #d5ecff; font-size: 14px; cursor: pointer; }
.local-imagery-control label:has(input:disabled) { cursor: not-allowed; opacity: 0.55; }
.local-imagery-control__status[data-state="ready"] { color: #6de6b1; }
.local-imagery-control__status[data-state="error"], .local-imagery-control__status[data-state="unavailable"] { color: #ffb982; }
.local-imagery-control__info-wrap { position: relative; display: inline-flex; }
.local-imagery-control__info {
  display: inline-grid; width: 18px; height: 18px; padding: 0; color: #67dcff; cursor: help;
  place-items: center; background: transparent; border: 0; border-radius: 50%;
}
.local-imagery-control__info svg { width: 16px; height: 16px; }
.local-imagery-control__info:focus-visible { outline: 2px solid #8feeff; outline-offset: 2px; }
.local-imagery-control__tooltip {
  position: absolute; z-index: 5; top: calc(100% + 8px); left: -8px; width: min(360px, 70vw); padding: 10px 12px;
  color: #bcd7f2; font-size: 12px; line-height: 1.55; pointer-events: none; visibility: hidden;
  background: rgba(3, 18, 42, 0.98); border: 1px solid rgba(91, 205, 255, 0.58); border-radius: 5px;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.42); opacity: 0; transform: translateY(-3px);
  transition: opacity 120ms ease, transform 120ms ease, visibility 120ms ease;
}
.local-imagery-control__info-wrap:hover .local-imagery-control__tooltip,
.local-imagery-control__info-wrap:focus-within .local-imagery-control__tooltip {
  pointer-events: auto; visibility: visible; opacity: 1; transform: translateY(0);
}
.local-imagery-control__tooltip a { display: block; margin-top: 5px; color: #5fcaff; font-size: 12px; }
</style>
