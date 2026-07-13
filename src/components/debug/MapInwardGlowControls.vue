<script setup lang="ts">
import { reactive, watch } from 'vue'
import {
  BASE_INWARD_GLOW_DEFAULTS,
  HOVER_INWARD_GLOW_DEFAULTS,
  cloneInwardGlowConfig,
  type MapInwardGlowConfig
} from '@/components/map/mapInwardGlowConfig'

type Channel = 'base' | 'hover'
type NumberKey = Exclude<keyof MapInwardGlowConfig, 'enabled' | 'color'>

interface NumberField {
  key: NumberKey
  label: string
  min: number
  max: number
  step: number
}

const props = defineProps<{
  channel: Channel
  modelValue: MapInwardGlowConfig
  stateLabel: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: MapInwardGlowConfig]
}>()

const FIELDS: readonly NumberField[] = [
  { key: 'width', label: '内扩宽度', min: 0, max: 200, step: 1 },
  { key: 'strength', label: '内扩透明度', min: 0, max: 1, step: 0.01 },
  { key: 'maxAlpha', label: '最大透明度', min: 0.1, max: 1, step: 0.01 },
  { key: 'nearRadiusRatio', label: '近端半径比', min: 0, max: 1.5, step: 0.01 },
  { key: 'nearOpacityRatio', label: '近端透明度比', min: 0, max: 2, step: 0.01 },
  { key: 'farRadiusRatio', label: '远端半径比', min: 0.25, max: 2, step: 0.01 },
  { key: 'farOpacityRatio', label: '远端透明度比', min: 0, max: 2, step: 0.01 },
  { key: 'falloff', label: '衰减曲线', min: 0.25, max: 4, step: 0.05 },
  { key: 'edgeSoftness', label: '内侧裁切柔度', min: 0, max: 1, step: 0.01 },
  { key: 'nearPasses', label: '近端模糊次数', min: 1, max: 8, step: 1 },
  { key: 'farPasses', label: '远端模糊次数', min: 1, max: 8, step: 1 },
  { key: 'baseRatio', label: '稳定底光比例', min: 0, max: 1, step: 0.01 }
]

const HEX = /^#[0-9a-f]{6}$/i
const numberDrafts = reactive<Record<string, string>>({})
const committedNumbers = new Map<string, string>()

function fieldId(name: string, control: 'checkbox' | 'color' | 'hex' | 'number' | 'range'): string {
  return `effect-${props.channel}-inward-${name}-${control}`
}

function emitClone(update: (next: MapInwardGlowConfig) => void): void {
  const next = cloneInwardGlowConfig(props.modelValue)
  update(next)
  emit('update:modelValue', next)
}

function updateEnabled(event: Event): void {
  const enabled = (event.target as HTMLInputElement).checked
  emitClone((next) => (next.enabled = enabled))
}

function updateColor(event: Event): void {
  const input = event.target as HTMLInputElement
  if (!HEX.test(input.value)) {
    input.value = props.modelValue.color
    return
  }
  emitClone((next) => (next.color = input.value.toLowerCase()))
}

function numberDraft(field: NumberField): string {
  return numberDrafts[field.key] ?? String(props.modelValue[field.key])
}

function updateNumberDraft(field: NumberField, event: Event): void {
  numberDrafts[field.key] = (event.target as HTMLInputElement).value
  committedNumbers.delete(field.key)
}

function normalizedNumber(field: NumberField, raw: string): number {
  const current = props.modelValue[field.key]
  const parsed = raw.trim() === '' ? current : Number(raw)
  const finite = Number.isFinite(parsed) ? parsed : current
  const clamped = Math.min(field.max, Math.max(field.min, finite))
  const precision = (String(field.step).split('.')[1] ?? '').length
  return Number((Math.round(clamped / field.step) * field.step).toFixed(precision))
}

function writeNumber(field: NumberField, raw: string): void {
  const value = normalizedNumber(field, raw)
  const normalized = String(value)
  numberDrafts[field.key] = normalized
  if (committedNumbers.get(field.key) === normalized || value === props.modelValue[field.key]) return
  committedNumbers.set(field.key, normalized)
  emitClone((next) => (next[field.key] = value))
}

function commitNumber(field: NumberField, event: Event): void {
  writeNumber(field, (event.target as HTMLInputElement).value)
}

function updateRange(field: NumberField, event: Event): void {
  writeNumber(field, (event.target as HTMLInputElement).value)
}

function defaults(): Readonly<MapInwardGlowConfig> {
  return props.channel === 'base' ? BASE_INWARD_GLOW_DEFAULTS : HOVER_INWARD_GLOW_DEFAULTS
}

function applyB1Preset(): void {
  emit('update:modelValue', cloneInwardGlowConfig(defaults()))
}

function resetGroup(): void {
  emit('update:modelValue', cloneInwardGlowConfig(defaults()))
}

watch(() => props.modelValue, () => {
  for (const field of FIELDS) {
    const value = String(props.modelValue[field.key])
    numberDrafts[field.key] = value
    if (committedNumbers.get(field.key) !== value) committedNumbers.delete(field.key)
  }
}, { deep: true, immediate: true })
</script>

<template>
  <section class="inward-controls">
    <div class="inward-status">运行状态：{{ stateLabel }}</div>
    <div class="field">
      <div class="field-head">
        <label :for="fieldId('enabled', 'checkbox')">启用内扩柔光</label>
        <input
          :id="fieldId('enabled', 'checkbox')"
          class="checkbox"
          type="checkbox"
          :checked="modelValue.enabled"
          @change="updateEnabled"
        />
      </div>
    </div>
    <div class="field">
      <div class="field-head">
        <label :for="fieldId('color', 'color')">内扩颜色</label>
        <input
          :id="fieldId('color', 'color')"
          class="color"
          type="color"
          :value="modelValue.color"
          @input="updateColor"
        />
        <input
          :id="fieldId('color', 'hex')"
          class="hex"
          type="text"
          :value="modelValue.color"
          aria-label="内扩颜色十六进制颜色"
          @change="updateColor"
        />
      </div>
    </div>
    <div v-for="field in FIELDS" :key="field.key" class="field">
      <div class="field-head">
        <label :for="fieldId(field.key, 'number')">{{ field.label }}</label>
        <input
          :id="fieldId(field.key, 'number')"
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
        :id="fieldId(field.key, 'range')"
        class="slider"
        type="range"
        :value="modelValue[field.key]"
        :min="field.min"
        :max="field.max"
        :step="field.step"
        :aria-label="field.label + '滑块'"
        @input="updateRange(field, $event)"
      />
    </div>
    <div class="effect-actions group-actions">
      <button class="btn" @click="applyB1Preset">应用 B1 预设</button>
      <button class="btn ghost" @click="resetGroup">重置本组</button>
    </div>
  </section>
</template>

<style scoped>
.inward-controls { display: flex; flex-direction: column; gap: 10px; }
.inward-status { font-size: 11px; color: #8fd9ff; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field-head { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.field-head label { flex: 1; }
.num, .hex {
  box-sizing: border-box; height: 26px; padding: 2px 6px; text-align: right;
  color: #00deff; background: rgba(36, 131, 255, 0.12);
  border: 1px solid rgba(36, 131, 255, 0.4); border-radius: 3px; outline: none;
}
.num { width: 76px; }
.hex { width: 82px; }
.checkbox { width: 18px; height: 18px; accent-color: #00deff; cursor: pointer; }
.color { width: 30px; height: 26px; padding: 1px; border: 1px solid rgba(36, 131, 255, 0.4); background: transparent; }
.slider { width: 100%; accent-color: #00deff; cursor: pointer; }
.effect-actions { display: flex; gap: 8px; }
.group-actions { margin-top: 2px; }
.btn {
  flex: 1; padding: 8px 4px; font-size: 12px; font-family: 'OPPOSans-M'; cursor: pointer;
  color: #041020; background: linear-gradient(180deg, #00deff, #2483ff);
  border: none; border-radius: 4px;
}
.btn.ghost { color: #7fa8d9; background: transparent; border: 1px solid rgba(36, 131, 255, 0.5); }
</style>
