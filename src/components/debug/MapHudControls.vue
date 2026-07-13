<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import {
  MAP_HUD_DEFAULTS,
  assignMapHudConfig,
  cloneMapHudConfig,
  formatMapHudConfig,
  normalizeMapHudConfig,
  type MapHudConfig
} from '@/components/map/mapHudConfig'
import { useMapDebug } from '@/composables/useMapDebug'
import { copyTextToClipboard } from '@/utils/copyText'

type Section = 'anchor' | 'static' | 'rotating'
type Field = {
  section: Section
  key: string
  label: string
  kind: 'number' | 'boolean'
  min?: number
  max?: number
  step?: number
}

interface Group {
  title: string
  fields: readonly Field[]
}

const GROUPS: readonly Group[] = [
  {
    title: '总体锚点（地图几何中心）',
    fields: [
      { section: 'anchor', key: 'x', label: '水平偏移 X', kind: 'number', min: -150, max: 150, step: 0.1 },
      { section: 'anchor', key: 'z', label: '纵深偏移 Z', kind: 'number', min: -150, max: 150, step: 0.1 },
      { section: 'anchor', key: 'elevation', label: '距模型底面高度', kind: 'number', min: -20, max: 20, step: 0.05 }
    ]
  },
  {
    title: '静态方位底盘',
    fields: [
      { section: 'static', key: 'enabled', label: '显示静态盘', kind: 'boolean' },
      { section: 'static', key: 'diameter', label: '静态盘直径', kind: 'number', min: 20, max: 300, step: 1 },
      { section: 'static', key: 'opacity', label: '静态盘透明度', kind: 'number', min: 0, max: 1, step: 0.01 },
      { section: 'static', key: 'phaseDeg', label: '静态盘朝向角 °', kind: 'number', min: 0, max: 360, step: 1 },
      { section: 'static', key: 'elevationOffset', label: '静态盘层高偏移', kind: 'number', min: -5, max: 5, step: 0.01 }
    ]
  },
  {
    title: '旋转分段环',
    fields: [
      { section: 'rotating', key: 'enabled', label: '显示旋转盘', kind: 'boolean' },
      { section: 'rotating', key: 'diameter', label: '旋转盘直径', kind: 'number', min: 20, max: 300, step: 1 },
      { section: 'rotating', key: 'opacity', label: '旋转盘透明度', kind: 'number', min: 0, max: 1, step: 0.01 },
      { section: 'rotating', key: 'phaseDeg', label: '旋转盘初始角 °', kind: 'number', min: 0, max: 360, step: 1 },
      { section: 'rotating', key: 'elevationOffset', label: '旋转盘层高偏移', kind: 'number', min: -5, max: 5, step: 0.01 },
      { section: 'rotating', key: 'speedDegPerSecond', label: '旋转速度 °/s', kind: 'number', min: -30, max: 30, step: 0.1 }
    ]
  }
]

const { hud, resetHud } = useMapDebug()
const livePreview = ref(true)
const draft = reactive<MapHudConfig>(cloneMapHudConfig(hud))
const editTarget = computed<MapHudConfig>(() => livePreview.value ? hud : draft)
const numberDrafts = reactive<Record<string, string>>({})
const committedNumbers = new Map<string, string>()
const copyStatus = ref<'idle' | 'success' | 'error'>('idle')
let copiedTimer = 0
let applyingDraft = false

function fieldId(field: Field, control: 'checkbox' | 'number' | 'range'): string {
  return `map-hud-${field.section}-${field.key}-${control}`
}

function fieldName(field: Field): string {
  return `${field.section}-${field.key}`
}

function valueOf(field: Field): number | boolean {
  if (field.section === 'anchor') return hudValue(editTarget.value.anchor, field.key)
  if (field.section === 'static') return hudValue(editTarget.value.static, field.key)
  return hudValue(editTarget.value.rotating, field.key)
}

function hudValue(source: object, key: string): number | boolean {
  const value = (source as Record<string, unknown>)[key]
  return typeof value === 'number' || typeof value === 'boolean' ? value : 0
}

function writeValue(target: MapHudConfig, field: Field, value: number | boolean): void {
  if (field.section === 'anchor') {
    target.anchor[field.key as keyof MapHudConfig['anchor']] = value as never
  } else if (field.section === 'static') {
    target.static[field.key as keyof MapHudConfig['static']] = value as never
  } else {
    target.rotating[field.key as keyof MapHudConfig['rotating']] = value as never
  }
}

function syncDraft(config: MapHudConfig = hud): void {
  assignMapHudConfig(draft, cloneMapHudConfig(config))
}

function changeLivePreview(event: Event): void {
  const next = (event.target as HTMLInputElement).checked
  syncDraft(hud)
  livePreview.value = next
}

function applyDraft(): void {
  const normalized = normalizeMapHudConfig(draft)
  applyingDraft = true
  assignMapHudConfig(hud, normalized)
  applyingDraft = false
  syncDraft(normalized)
}

function discardDraft(): void {
  syncDraft(hud)
}

function numberDraft(field: Field): string {
  return numberDrafts[fieldName(field)] ?? String(valueOf(field))
}

function updateNumberDraft(field: Field, event: Event): void {
  const name = fieldName(field)
  numberDrafts[name] = (event.target as HTMLInputElement).value
  committedNumbers.delete(name)
}

function normalizedNumber(field: Field, raw: string): number {
  const current = valueOf(field)
  const parsed = raw.trim() === '' ? current : Number(raw)
  const finite = typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : current
  const min = field.min ?? 0
  const max = field.max ?? 1
  const step = field.step ?? 1
  const clamped = Math.min(max, Math.max(min, finite as number))
  const precision = (String(step).split('.')[1] ?? '').length
  return Number((Math.round(clamped / step) * step).toFixed(precision))
}

function commitNumber(field: Field, event: Event): void {
  const value = normalizedNumber(field, (event.target as HTMLInputElement).value)
  const name = fieldName(field)
  const normalized = String(value)
  numberDrafts[name] = normalized
  if (committedNumbers.get(name) === normalized || value === valueOf(field)) return
  committedNumbers.set(name, normalized)
  writeValue(editTarget.value, field, value)
}

function updateRange(field: Field, event: Event): void {
  commitNumber(field, event)
}

function updateBoolean(field: Field, event: Event): void {
  writeValue(editTarget.value, field, (event.target as HTMLInputElement).checked)
}

function resetCurrentTarget(): void {
  if (editTarget.value === hud) {
    resetHud()
  } else {
    assignMapHudConfig(draft, MAP_HUD_DEFAULTS)
  }
}

const editableJson = computed(() => formatMapHudConfig(editTarget.value))

async function copyHud(): Promise<void> {
  copyStatus.value = await copyTextToClipboard(editableJson.value) ? 'success' : 'error'
  clearTimeout(copiedTimer)
  copiedTimer = window.setTimeout(() => (copyStatus.value = 'idle'), 1500)
}

function copyLabel(): string {
  if (copyStatus.value === 'success') return '已复制 ✓'
  if (copyStatus.value === 'error') return '复制失败，请重试'
  return '复制 HUD 参数'
}

const stopDraftSync = watch(hud, () => {
  if (!livePreview.value && !applyingDraft) syncDraft(hud)
}, { deep: true, flush: 'sync' })

watch(editTarget, (target) => {
  for (const group of GROUPS) {
    for (const field of group.fields) {
      if (field.kind !== 'number') continue
      const name = fieldName(field)
      const value = String(valueOf(field))
      numberDrafts[name] = value
      if (committedNumbers.get(name) !== value) committedNumbers.delete(name)
    }
  }
}, { deep: true, immediate: true })

onBeforeUnmount(() => {
  stopDraftSync()
  clearTimeout(copiedTimer)
})
</script>

<template>
  <div class="hud-controls">
    <section class="session-editing">
      <div class="field-head">
        <label for="map-hud-live-preview">实时预览</label>
        <input
          id="map-hud-live-preview"
          class="checkbox"
          type="checkbox"
          :checked="livePreview"
          @change="changeLivePreview"
        />
      </div>
      <p v-if="!livePreview" class="editing-hint">草稿模式：切回实时预览会放弃未应用草稿。</p>
      <div v-if="!livePreview" class="actions">
        <button class="btn" @click="applyDraft">应用参数</button>
        <button class="btn ghost" @click="discardDraft">放弃草稿</button>
      </div>
    </section>

    <section v-for="group in GROUPS" :key="group.title" class="hud-group">
      <h3>{{ group.title }}</h3>
      <div v-for="field in group.fields" :key="fieldName(field)" class="field">
        <div class="field-head">
          <label :for="fieldId(field, field.kind === 'boolean' ? 'checkbox' : 'number')">{{ field.label }}</label>
          <input
            v-if="field.kind === 'boolean'"
            :id="fieldId(field, 'checkbox')"
            class="checkbox"
            type="checkbox"
            :checked="Boolean(valueOf(field))"
            @change="updateBoolean(field, $event)"
          />
          <input
            v-else
            :id="fieldId(field, 'number')"
            class="num"
            type="number"
            :value="numberDraft(field)"
            :min="field.min"
            :max="field.max"
            :step="field.step"
            @input="updateNumberDraft(field, $event)"
            @change="commitNumber(field, $event)"
            @blur="commitNumber(field, $event)"
          />
        </div>
        <input
          v-if="field.kind === 'number'"
          :id="fieldId(field, 'range')"
          class="slider"
          type="range"
          :value="valueOf(field)"
          :min="field.min"
          :max="field.max"
          :step="field.step"
          :aria-label="field.label + '滑块'"
          @input="updateRange(field, $event)"
        />
      </div>
    </section>

    <section class="hud-group">
      <h3>可复制参数</h3>
      <pre class="json-out">{{ editableJson }}</pre>
      <div class="actions">
        <button class="btn" @click="copyHud">{{ copyLabel() }}</button>
        <button class="btn ghost" @click="resetCurrentTarget">恢复 HUD 默认值</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hud-controls { display: flex; flex-direction: column; gap: 14px; padding-bottom: 4px; }
.hud-group, .session-editing {
  display: flex; flex-direction: column; gap: 10px; padding: 12px;
  border: 1px solid rgba(36, 131, 255, 0.28); border-radius: 4px;
  background: rgba(36, 131, 255, 0.05);
}
.hud-group h3 { margin: 0; font-size: 14px; font-weight: normal; color: #fff; }
.editing-hint { margin: 0; font-size: 11px; line-height: 1.5; color: #edd892; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field-head { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.field-head label { flex: 1; }
.num {
  box-sizing: border-box; width: 76px; height: 26px; padding: 2px 6px; text-align: right;
  color: #00deff; background: rgba(36, 131, 255, 0.12);
  border: 1px solid rgba(36, 131, 255, 0.4); border-radius: 3px; outline: none;
}
.checkbox { width: 18px; height: 18px; accent-color: #00deff; cursor: pointer; }
.slider { width: 100%; accent-color: #00deff; cursor: pointer; }
.json-out {
  box-sizing: border-box; max-height: 220px; margin: 0; padding: 10px;
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
