<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  resolveRegionCatalogSelection,
  type RegionCatalog,
  type RegionCatalogSelection
} from './regionCatalog'

const props = defineProps<{
  catalog: RegionCatalog | null
  loading: boolean
  error: string
  activeLabel?: string
}>()
const emit = defineEmits<{
  load: [selection: RegionCatalogSelection]
  retry: []
}>()

type Scope = 'country' | 'province' | 'prefecture'
type ProvinceContent = 'children' | 'counties'

const scope = ref<Scope>('country')
const provinceGb = ref('')
const prefectureGb = ref('')
const provinceContent = ref<ProvinceContent>('children')

const province = computed(() => props.catalog?.provinces.find((item) => item.gb === provinceGb.value))
const selection = computed<RegionCatalogSelection | null>(() => {
  if (scope.value === 'country') return { kind: 'country-provinces' }
  if (!provinceGb.value) return null
  if (scope.value === 'province') {
    return provinceContent.value === 'children'
      ? { kind: 'province-children', provinceGb: provinceGb.value }
      : { kind: 'province-counties', provinceGb: provinceGb.value }
  }
  if (!prefectureGb.value) return null
  return {
    kind: 'prefecture-counties',
    provinceGb: provinceGb.value,
    prefectureGb: prefectureGb.value
  }
})
const selectedEntry = computed(() => selection.value && props.catalog
  ? resolveRegionCatalogSelection(props.catalog, selection.value)
  : null)
const unavailable = computed(() => Boolean(selectedEntry.value && !selectedEntry.value.available))
const canLoad = computed(() => Boolean(
  props.catalog && selection.value && selectedEntry.value?.available && !props.loading
))

watch(scope, () => {
  provinceGb.value = ''
  prefectureGb.value = ''
  provinceContent.value = 'children'
})
watch(provinceGb, () => { prefectureGb.value = '' })

function requestLoad(): void {
  if (selection.value && canLoad.value) emit('load', selection.value)
}
</script>

<template>
  <section class="region-catalog-picker" aria-labelledby="region-catalog-title">
    <div class="region-catalog-picker__divider" aria-hidden="true"><span>或</span></div>
    <header>
      <h2 id="region-catalog-title">从区域库选择</h2>
      <p>选择不会改变当前地图，点击“加载此区域”后才会应用。</p>
    </header>

    <div v-if="error && !catalog" class="region-catalog-picker__error" role="alert">
      <span>{{ error }}</span>
      <button type="button" data-action="retry-catalog" @click="emit('retry')">重试</button>
    </div>
    <p v-else-if="!catalog" class="region-catalog-picker__loading" aria-live="polite">
      {{ loading ? '正在加载区域库目录…' : '区域库目录尚未加载' }}
    </p>

    <div v-else class="region-catalog-picker__fields">
      <label for="catalog-scope">
        <span>地图范围</span>
        <select id="catalog-scope" v-model="scope" :disabled="loading">
          <option value="country">全国</option>
          <option value="province">省级区域</option>
          <option value="prefecture">地市级区域</option>
        </select>
      </label>

      <label v-if="scope !== 'country'" for="catalog-province">
        <span>省级区域</span>
        <select id="catalog-province" v-model="provinceGb" :disabled="loading">
          <option value="">请选择</option>
          <option v-for="item in catalog.provinces" :key="item.gb" :value="item.gb">
            {{ item.name }}
          </option>
        </select>
      </label>

      <label v-if="scope === 'country'" for="catalog-country-content">
        <span>展示内容</span>
        <select id="catalog-country-content" disabled><option>省级区域</option></select>
      </label>

      <label v-if="scope === 'prefecture' && province" for="catalog-prefecture">
        <span>地市级区域</span>
        <select id="catalog-prefecture" v-model="prefectureGb" :disabled="loading">
          <option value="">请选择</option>
          <option
            v-for="item in province.prefectures"
            :key="item.gb"
            :value="item.gb"
            :disabled="!item.counties.available"
          >
            {{ item.name }}{{ item.counties.available ? '' : '（暂无下一级区域）' }}
          </option>
        </select>
      </label>

      <label v-if="scope === 'province' && province" for="catalog-content">
        <span>展示内容</span>
        <select id="catalog-content" v-model="provinceContent" :disabled="loading">
          <option value="children" :disabled="!province.nextLevel.available">
            {{ province.childLevelLabel }}
          </option>
          <option value="counties" :disabled="!province.counties.available">区县</option>
        </select>
      </label>

      <label v-if="scope === 'prefecture' && provinceGb" for="catalog-prefecture-content">
        <span>展示内容</span>
        <select id="catalog-prefecture-content" disabled><option>区县</option></select>
      </label>

      <div class="region-catalog-picker__action">
        <span v-if="unavailable" data-catalog-unavailable>暂无下一级区域</span>
        <span v-else-if="loading && activeLabel" aria-live="polite">正在加载 {{ activeLabel }}…</span>
        <button
          type="button"
          data-action="load-catalog-region"
          :disabled="!canLoad"
          @click="requestLoad"
        >
          {{ loading ? '加载中…' : '加载此区域' }}
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.region-catalog-picker { grid-column: 1 / -1; display: grid; gap: 12px; }
.region-catalog-picker__divider { display: flex; align-items: center; gap: 12px; color: #6f98c4; }
.region-catalog-picker__divider::before,
.region-catalog-picker__divider::after { flex: 1; height: 1px; content: ''; background: rgba(66, 151, 236, 0.3); }
.region-catalog-picker h2 { margin: 0; }
.region-catalog-picker header p { font-size: 13px; }
.region-catalog-picker__fields { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.region-catalog-picker__fields label { display: grid; gap: 6px; color: #c9dff8; font-size: 14px; }
.region-catalog-picker select {
  box-sizing: border-box; width: 100%; min-height: 42px; padding: 8px 10px; color: #e9f5ff;
  background: rgba(8, 37, 77, 0.86); border: 1px solid rgba(66, 151, 236, 0.55); border-radius: 5px;
}
.region-catalog-picker__action { grid-column: 1 / -1; display: flex; align-items: center; justify-content: flex-end; gap: 12px; }
.region-catalog-picker__action span { color: #ffd39c; font-size: 13px; }
.region-catalog-picker__action button,
.region-catalog-picker__error button {
  min-height: 40px;
  padding: 8px 18px;
  color: #dff8ff;
  font-weight: 700;
  cursor: pointer;
  background: linear-gradient(135deg, rgba(0, 197, 235, 0.28), rgba(28, 104, 220, 0.42));
  border: 1px solid rgba(73, 221, 255, 0.72);
  border-radius: 5px;
  box-shadow: inset 0 0 18px rgba(32, 210, 255, 0.08);
}
.region-catalog-picker__action button:hover:not(:disabled),
.region-catalog-picker__error button:hover:not(:disabled) {
  border-color: #7defff;
  box-shadow: 0 0 18px rgba(0, 218, 255, 0.2), inset 0 0 18px rgba(32, 210, 255, 0.13);
}
.region-catalog-picker__action button:focus-visible,
.region-catalog-picker__error button:focus-visible { outline: 2px solid #a1f5ff; outline-offset: 2px; }
.region-catalog-picker__action button:disabled,
.region-catalog-picker__error button:disabled { cursor: not-allowed; opacity: 0.45; }
.region-catalog-picker__error { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #ffad99; }
.region-catalog-picker__loading { font-size: 13px !important; }
</style>
