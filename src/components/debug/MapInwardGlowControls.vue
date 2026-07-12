<script setup lang="ts">
import { reactive, watch } from 'vue'
import {
  BASE_INWARD_GLOW_DEFAULTS,
  HOVER_INWARD_GLOW_DEFAULTS,
  cloneInwardGlowConfig,
  type InwardWaveEasing,
  type MapInwardGlowConfig,
  type MapInwardWaveConfig
} from '@/components/map/mapInwardGlowConfig'

type Channel = 'base' | 'hover'
type RootNumberKey = Exclude<keyof MapInwardGlowConfig, 'enabled' | 'color' | 'wave'>
type WaveNumberKey = Exclude<keyof MapInwardWaveConfig, 'enabled' | 'easing'>

interface NumberField {
  scope: 'root' | 'wave'
  key: RootNumberKey | WaveNumberKey
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

const ROOT_FIELDS: readonly NumberField[] = [
  { scope: 'root', key: 'width', label: '内扩宽度', min: 0, max: 200, step: 1 },
  { scope: 'root', key: 'strength', label: '内扩透明度', min: 0, max: 1, step: 0.01 },
  { scope: 'root', key: 'maxAlpha', label: '最大透明度', min: 0.1, max: 1, step: 0.01 },
  { scope: 'root', key: 'nearRadiusRatio', label: '近端半径比', min: 0, max: 1.5, step: 0.01 },
  { scope: 'root', key: 'nearOpacityRatio', label: '近端透明度比', min: 0, max: 2, step: 0.01 },
  { scope: 'root', key: 'farRadiusRatio', label: '远端半径比', min: 0.25, max: 2, step: 0.01 },
  { scope: 'root', key: 'farOpacityRatio', label: '远端透明度比', min: 0, max: 2, step: 0.01 },
  { scope: 'root', key: 'falloff', label: '衰减曲线', min: 0.25, max: 4, step: 0.05 },
  { scope: 'root', key: 'edgeSoftness', label: '内侧裁切柔度', min: 0, max: 1, step: 0.01 },
  { scope: 'root', key: 'nearPasses', label: '近端模糊次数', min: 1, max: 8, step: 1 },
  { scope: 'root', key: 'farPasses', label: '远端模糊次数', min: 1, max: 8, step: 1 },
  { scope: 'root', key: 'baseRatio', label: '稳定底光比例', min: 0, max: 1, step: 0.01 }
]

const WAVE_FIELDS: readonly NumberField[] = [
  { scope: 'wave', key: 'widthRatio', label: '波峰宽度比例', min: 0.01, max: 1, step: 0.01 },
  { scope: 'wave', key: 'strength', label: '波峰强度', min: 0, max: 2, step: 0.01 },
  { scope: 'wave', key: 'periodMs', label: '传播周期 ms', min: 250, max: 10000, step: 50 },
  { scope: 'wave', key: 'delayMs', label: '传播延迟 ms', min: 0, max: 5000, step: 50 },
  { scope: 'wave', key: 'travelRatio', label: '传播深度比例', min: 0.25, max: 2, step: 0.01 },
  { scope: 'wave', key: 'decay', label: '传播衰减', min: 0, max: 4, step: 0.05 }
]

const EASINGS: readonly InwardWaveEasing[] = ['linear', 'ease-in', 'ease-out', 'ease-in-out']
const HEX = /^#[0-9a-f]{6}$/i
const numberDrafts = reactive<Record<string, string>>({})
const committedNumbers = new Map<string, string>()

function fieldName(field: NumberField): string {
  return field.scope === 'wave' ? `wave-${field.key}` : field.key
}

function fieldId(name: string, control: 'checkbox' | 'color' | 'hex' | 'number' | 'range' | 'select'): string {
  return `effect-${props.channel}-inward-${name}-${control}`
}

function numberValue(field: NumberField): number {
  if (field.scope === 'wave') return props.modelValue.wave[field.key as WaveNumberKey]
  return props.modelValue[field.key as RootNumberKey]
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

function updateWaveEnabled(event: Event): void {
  const enabled = (event.target as HTMLInputElement).checked
  emitClone((next) => (next.wave.enabled = enabled))
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
  return numberDrafts[fieldName(field)] ?? String(numberValue(field))
}

function updateNumberDraft(field: NumberField, event: Event): void {
  const name = fieldName(field)
  numberDrafts[name] = (event.target as HTMLInputElement).value
  committedNumbers.delete(name)
}

function normalizedNumber(field: NumberField, raw: string): number {
  const current = numberValue(field)
  const parsed = raw.trim() === '' ? current : Number(raw)
  const finite = Number.isFinite(parsed) ? parsed : current
  const clamped = Math.min(field.max, Math.max(field.min, finite))
  const precision = (String(field.step).split('.')[1] ?? '').length
  return Number((Math.round(clamped / field.step) * field.step).toFixed(precision))
}

function writeNumber(field: NumberField, raw: string): void {
  const value = normalizedNumber(field, raw)
  const name = fieldName(field)
  const normalized = String(value)
  numberDrafts[name] = normalized
  if (committedNumbers.get(name) === normalized || value === numberValue(field)) return
  committedNumbers.set(name, normalized)
  emitClone((next) => {
    if (field.scope === 'wave') {
      next.wave[field.key as WaveNumberKey] = value
    } else {
      next[field.key as RootNumberKey] = value
    }
  })
}

function commitNumber(field: NumberField, event: Event): void {
  writeNumber(field, (event.target as HTMLInputElement).value)
}

function updateRange(field: NumberField, event: Event): void {
  writeNumber(field, (event.target as HTMLInputElement).value)
}

function updateEasing(event: Event): void {
  const value = (event.target as HTMLSelectElement).value as InwardWaveEasing
  if (EASINGS.includes(value)) emitClone((next) => (next.wave.easing = value))
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
  for (const field of [...ROOT_FIELDS, ...WAVE_FIELDS]) {
    numberDrafts[fieldName(field)] = String(numberValue(field))
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
    <div v-for="field in ROOT_FIELDS" :key="fieldName(field)" class="field">
      <div class="field-head">
        <label :for="fieldId(fieldName(field), 'number')">{{ field.label }}</label>
        <input
          :id="fieldId(fieldName(field), 'number')"
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
        :id="fieldId(fieldName(field), 'range')"
        class="slider"
        type="range"
        :value="numberValue(field)"
        :min="field.min"
        :max="field.max"
        :step="field.step"
        :aria-label="field.label + '滑块'"
        @input="updateRange(field, $event)"
      />
    </div>

    <h4>向内传播波</h4>
    <div class="field">
      <div class="field-head">
        <label :for="fieldId('wave-enabled', 'checkbox')">启用传播波</label>
        <input
          :id="fieldId('wave-enabled', 'checkbox')"
          class="checkbox"
          type="checkbox"
          :checked="modelValue.wave.enabled"
          @change="updateWaveEnabled"
        />
      </div>
    </div>
    <div v-for="field in WAVE_FIELDS" :key="fieldName(field)" class="field">
      <div class="field-head">
        <label :for="fieldId(fieldName(field), 'number')">{{ field.label }}</label>
        <input
          :id="fieldId(fieldName(field), 'number')"
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
        :id="fieldId(fieldName(field), 'range')"
        class="slider"
        type="range"
        :value="numberValue(field)"
        :min="field.min"
        :max="field.max"
        :step="field.step"
        :aria-label="field.label + '滑块'"
        @input="updateRange(field, $event)"
      />
    </div>
    <div class="field">
      <div class="field-head">
        <label :for="fieldId('wave-easing', 'select')">传播缓动</label>
        <select
          :id="fieldId('wave-easing', 'select')"
          class="select"
          :value="modelValue.wave.easing"
          @change="updateEasing"
        >
          <option v-for="easing in EASINGS" :key="easing" :value="easing">{{ easing }}</option>
        </select>
      </div>
    </div>
    <div class="effect-actions group-actions">
      <button class="btn" @click="applyB1Preset">应用 B1 预设</button>
      <button class="btn ghost" @click="resetGroup">重置本组</button>
    </div>
  </section>
</template>

<style scoped>
.inward-controls { display: flex; flex-direction: column; gap: 10px; }
.inward-controls h4 { margin: 4px 0 0; font-size: 12px; font-weight: normal; color: #8fd9ff; }
.inward-status { font-size: 11px; color: #8fd9ff; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field-head { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.field-head label { flex: 1; }
.num, .hex, .select {
  box-sizing: border-box; height: 26px; padding: 2px 6px; text-align: right;
  color: #00deff; background: rgba(36, 131, 255, 0.12);
  border: 1px solid rgba(36, 131, 255, 0.4); border-radius: 3px; outline: none;
}
.num { width: 76px; }
.hex, .select { width: 82px; }
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
