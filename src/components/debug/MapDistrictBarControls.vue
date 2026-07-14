<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import {
  cloneDistrictBarConfig,
  normalizeDistrictBarConfig,
  type MapDistrictBarConfig
} from '@/components/map/mapDistrictBarConfig'
import type { MapDistrictBarRuntimeStatus } from '@/composables/useMapDebug'

type ColorKey = 'color' | 'pulseColor'
type NumberKey = Exclude<keyof MapDistrictBarConfig, 'enabled' | 'pulseEnabled' | 'overlay' | ColorKey>

interface NumberField {
  key: NumberKey
  label: string
  min: number
  max: number
  step: number
}

const props = defineProps<{
  modelValue: MapDistrictBarConfig
  runtimeStatus: MapDistrictBarRuntimeStatus
}>()

const emit = defineEmits<{
  'update:modelValue': [value: MapDistrictBarConfig]
}>()

const NUMBER_FIELDS: readonly NumberField[] = [
  { key: 'width', label: '柱体宽度', min: 0.25, max: 8, step: 0.05 },
  { key: 'anchorOffsetX', label: '锚点 X 偏移', min: -20, max: 20, step: 0.1 },
  { key: 'anchorOffsetY', label: '锚点 Y 偏移', min: -20, max: 20, step: 0.1 },
  { key: 'baseOffset', label: '离地高度偏移', min: -2, max: 6, step: 0.05 },
  { key: 'minHeight', label: '最小柱高', min: 0, max: 24, step: 0.5 },
  { key: 'maxHeight', label: '最大柱高', min: 0, max: 24, step: 0.5 },
  { key: 'sqrtExponent', label: '开方映射强度', min: 0.25, max: 1, step: 0.01 },
  { key: 'glowStrength', label: '柱体辉光强度', min: 0, max: 2, step: 0.01 },
  { key: 'baseRingRadius', label: '底部光环半径', min: 0, max: 4, step: 0.05 },
  { key: 'baseRingOpacity', label: '底部光环透明度', min: 0, max: 1, step: 0.01 },
  { key: 'pulseWidth', label: '脉冲环宽度比例', min: 0.02, max: 0.5, step: 0.01 },
  { key: 'pulseOuterRadiusRatio', label: '脉冲外侧半径倍率', min: 0.05, max: 5, step: 0.05 },
  { key: 'pulseInnerRadiusRatio', label: '脉冲内侧半径倍率', min: 0.05, max: 5, step: 0.05 },
  { key: 'pulseOuterOpacity', label: '脉冲外侧透明度', min: 0, max: 1, step: 0.01 },
  { key: 'pulseInnerOpacity', label: '脉冲内侧透明度', min: 0, max: 1, step: 0.01 },
  { key: 'pulseDurationMs', label: '脉冲周期 ms', min: 200, max: 6000, step: 10 },
  { key: 'pulseStaggerMs', label: '脉冲错峰 ms', min: 0, max: 1000, step: 10 },
  { key: 'enterMs', label: '入场时长 ms', min: 0, max: 3000, step: 10 },
  { key: 'staggerMs', label: '错峰间隔 ms', min: 0, max: 1000, step: 10 },
  { key: 'hoverEmissiveIntensity', label: 'Hover 提亮强度', min: 0, max: 3, step: 0.05 },
  { key: 'hoverLift', label: 'Hover 上浮距离', min: 0, max: 4, step: 0.1 },
  { key: 'hoverInactiveOpacity', label: 'Hover 时其他柱状图透明度', min: 0, max: 1, step: 0.01 }
]

const HEX = /^#[0-9a-f]{6}$/i
const numberDrafts = reactive<Record<NumberKey, string>>({} as Record<NumberKey, string>)
const committedNumbers = new Map<NumberKey, string>()

const dataRange = computed(() => {
  const { dataMin, dataMax } = props.runtimeStatus
  return dataMin === null || dataMax === null ? '—' : `${dataMin}–${dataMax}`
})

function fieldId(key: 'enabled' | 'pulseEnabled' | ColorKey | NumberKey, control: 'checkbox' | 'color' | 'hex' | 'number' | 'range'): string {
  return `effect-bars-${key}-${control}`
}

function numberValue(field: NumberField): number {
  return props.modelValue[field.key]
}

function emitClone(update: (next: MapDistrictBarConfig) => void): void {
  const next = cloneDistrictBarConfig(props.modelValue)
  update(next)
  emit('update:modelValue', normalizeDistrictBarConfig(next))
}

function updateEnabled(key: 'enabled' | 'pulseEnabled', event: Event): void {
  emitClone((next) => (next[key] = (event.target as HTMLInputElement).checked))
}

function updateColor(key: ColorKey, event: Event): void {
  const input = event.target as HTMLInputElement
  if (!HEX.test(input.value)) {
    input.value = props.modelValue[key]
    return
  }
  emitClone((next) => (next[key] = input.value.toLowerCase()))
}

function numberDraft(field: NumberField): string {
  return numberDrafts[field.key] ?? String(numberValue(field))
}

function updateNumberDraft(field: NumberField, event: Event): void {
  numberDrafts[field.key] = (event.target as HTMLInputElement).value
  committedNumbers.delete(field.key)
}

function normalizedNumber(field: NumberField, raw: string): number {
  const current = numberValue(field)
  const parsed = raw.trim() === '' ? current : Number(raw)
  const finite = Number.isFinite(parsed) ? parsed : current
  const clamped = Math.min(field.max, Math.max(field.min, finite))
  const constrained = field.key === 'maxHeight'
    ? Math.max(props.modelValue.minHeight, clamped)
    : field.key === 'pulseInnerRadiusRatio'
      ? Math.min(props.modelValue.pulseOuterRadiusRatio, clamped)
      : field.key === 'pulseOuterRadiusRatio'
        ? Math.max(props.modelValue.pulseInnerRadiusRatio, clamped)
        : clamped
  const precision = (String(field.step).split('.')[1] ?? '').length
  return Number((Math.round(constrained / field.step) * field.step).toFixed(precision))
}

function writeNumber(field: NumberField, raw: string): void {
  const value = normalizedNumber(field, raw)
  const normalized = String(value)
  numberDrafts[field.key] = normalized
  if (committedNumbers.get(field.key) === normalized || value === numberValue(field)) return
  committedNumbers.set(field.key, normalized)
  emitClone((next) => (next[field.key] = value))
}

function commitNumber(field: NumberField, event: Event): void {
  const input = event.target as HTMLInputElement
  writeNumber(field, input.value)
  input.value = numberDraft(field)
}

function updateRange(field: NumberField, event: Event): void {
  writeNumber(field, (event.target as HTMLInputElement).value)
}

watch(() => props.modelValue, () => {
  for (const field of NUMBER_FIELDS) {
    const value = String(numberValue(field))
    numberDrafts[field.key] = value
    if (committedNumbers.get(field.key) !== value) committedNumbers.delete(field.key)
  }
}, { deep: true, immediate: true })
</script>

<template>
  <section class="district-bar-controls">
    <div class="bar-runtime-status" role="status" aria-live="polite">
      <span>运行状态</span>
      <span>有效柱体：{{ runtimeStatus.renderedCount }}</span>
      <span>案件量范围：{{ dataRange }}</span>
      <span>柱体主体：不透明</span>
      <span>脉冲环：{{ modelValue.pulseEnabled ? '启用' : '已关闭' }}</span>
      <span>柱体层：{{ runtimeStatus.degraded ? '已降级关闭' : '正常' }}</span>
    </div>
    <div class="field">
      <div class="field-head">
        <label :for="fieldId('enabled', 'checkbox')">启用柱状图</label>
        <input
          :id="fieldId('enabled', 'checkbox')"
          class="checkbox"
          type="checkbox"
          :checked="modelValue.enabled"
          @change="updateEnabled('enabled', $event)"
        />
      </div>
    </div>
    <div class="field">
      <div class="field-head">
        <label :for="fieldId('color', 'color')">柱体颜色</label>
        <input
          :id="fieldId('color', 'color')"
          class="color"
          type="color"
          :value="modelValue.color"
          @input="updateColor('color', $event)"
        />
        <input
          :id="fieldId('color', 'hex')"
          class="hex"
          type="text"
          :value="modelValue.color"
          aria-label="柱体颜色十六进制颜色"
          @change="updateColor('color', $event)"
        />
      </div>
    </div>
    <div class="field">
      <div class="field-head">
        <label :for="fieldId('pulseEnabled', 'checkbox')">启用脉冲光环</label>
        <input
          :id="fieldId('pulseEnabled', 'checkbox')"
          class="checkbox"
          type="checkbox"
          :checked="modelValue.pulseEnabled"
          @change="updateEnabled('pulseEnabled', $event)"
        />
      </div>
    </div>
    <div class="field">
      <div class="field-head">
        <label :for="fieldId('pulseColor', 'color')">脉冲环颜色</label>
        <input
          :id="fieldId('pulseColor', 'color')"
          class="color"
          type="color"
          :value="modelValue.pulseColor"
          @input="updateColor('pulseColor', $event)"
        />
        <input
          :id="fieldId('pulseColor', 'hex')"
          class="hex"
          type="text"
          :value="modelValue.pulseColor"
          aria-label="脉冲环颜色十六进制颜色"
          @change="updateColor('pulseColor', $event)"
        />
      </div>
    </div>
    <div v-for="field in NUMBER_FIELDS" :key="field.key" class="field">
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
        :value="numberValue(field)"
        :min="field.min"
        :max="field.max"
        :step="field.step"
        :aria-label="field.label + '滑块'"
        @input="updateRange(field, $event)"
      />
    </div>
  </section>
</template>

<style scoped>
.district-bar-controls { display: flex; flex-direction: column; gap: 10px; }
.bar-runtime-status { display: grid; gap: 4px; font-size: 11px; color: #8fd9ff; }
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
</style>
