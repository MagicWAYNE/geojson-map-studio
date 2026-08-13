<script setup lang="ts">
import { watch } from 'vue'
import {
  cloneMosaicParticleConfig,
  normalizeMosaicParticleConfig,
  type MapMosaicParticleConfig
} from '@/components/map/mapMosaicParticleConfig'
import {
  useMapVisualSettings,
  type VisualNumericFieldId
} from '@/composables/useMapVisualSettings'

type NumberKey = Exclude<
  keyof MapMosaicParticleConfig,
  'enabled' | 'primaryColor' | 'accentColor' | 'gapColor' | 'reseedOnEnter'
>
type ColorKey = 'primaryColor' | 'accentColor' | 'gapColor'
type BooleanKey = 'enabled' | 'reseedOnEnter'

interface NumberField {
  key: NumberKey
  label: string
  min: number
  max: number
  step: number
}

const props = defineProps<{
  modelValue: MapMosaicParticleConfig
}>()

const emit = defineEmits<{
  'update:modelValue': [value: MapMosaicParticleConfig]
}>()

const FIELDS: readonly NumberField[] = [
  { key: 'accentRatio', label: '双色比例', min: 0, max: 1, step: 0.01 },
  { key: 'density', label: '基础密度', min: 0, max: 1, step: 0.01 },
  { key: 'clusterChance', label: '簇概率', min: 0, max: 1, step: 0.01 },
  { key: 'clusterRadius', label: '簇半径', min: 1, max: 6, step: 1 },
  { key: 'clusterStrength', label: '簇增强', min: 0, max: 3, step: 0.05 },
  { key: 'accentClusterBias', label: '紫色簇偏向', min: 0, max: 1, step: 0.01 },
  { key: 'targetCellPx', label: '目标像素尺寸', min: 1, max: 32, step: 1 },
  { key: 'minCellPx', label: '最小像素尺寸', min: 1, max: 16, step: 1 },
  { key: 'maxCellPx', label: '最大像素尺寸', min: 4, max: 32, step: 1 },
  { key: 'gapRatio', label: '间隙宽度', min: 0, max: 0.8, step: 0.01 },
  { key: 'gapOpacity', label: '间隙透明度', min: 0, max: 1, step: 0.01 },
  { key: 'opacity', label: '透明度', min: 0, max: 1, step: 0.01 },
  { key: 'brightness', label: '亮度', min: 0, max: 3, step: 0.05 },
  { key: 'flickerHz', label: '闪烁频率', min: 0.1, max: 12, step: 0.1 },
  { key: 'dutyCycle', label: '闪烁占空比', min: 0, max: 1, step: 0.01 },
  { key: 'pulseSharpness', label: '闪烁锐度', min: 0.25, max: 4, step: 0.05 },
  { key: 'clusterFlickerScale', label: '簇速度倍率', min: 0.1, max: 3, step: 0.05 },
  { key: 'burstDurationMs', label: '入场时长', min: 0, max: 1500, step: 10 },
  { key: 'burstStrength', label: '入场亮度增强', min: 0, max: 3, step: 0.05 },
  { key: 'burstDensityBoost', label: '入场密度增强', min: 0, max: 1, step: 0.01 },
  { key: 'surfaceOffset', label: '顶面偏移', min: 0, max: 1, step: 0.01 },
  { key: 'seed', label: '固定种子', min: 0, max: 9999, step: 1 }
]

const visualSettings = useMapVisualSettings()
const HEX = /^#[0-9a-f]{6}$/i

function draftKey(field: NumberField): VisualNumericFieldId {
  return `effect.hover.mosaicParticles.${field.key}`
}

function fieldId(name: string, control: 'checkbox' | 'color' | 'hex' | 'number' | 'range'): string {
  return `effect-hover-mosaic-${name}-${control}`
}

function emitClone(update: (next: MapMosaicParticleConfig) => void): void {
  const next = cloneMosaicParticleConfig(props.modelValue)
  update(next)
  emit('update:modelValue', normalizeMosaicParticleConfig(next))
}

function updateBoolean(key: BooleanKey, event: Event): void {
  const value = (event.target as HTMLInputElement).checked
  if (value === props.modelValue[key]) return
  emitClone((next) => (next[key] = value))
}

function updateColor(key: ColorKey, event: Event): void {
  const input = event.target as HTMLInputElement
  if (!HEX.test(input.value)) {
    input.value = props.modelValue[key]
    return
  }
  const value = input.value.toLowerCase()
  if (value === props.modelValue[key]) {
    input.value = value
    return
  }
  emitClone((next) => (next[key] = value))
}

function numberDraft(field: NumberField): string {
  return visualSettings.numericField(draftKey(field)).read(props.modelValue[field.key])
}

function updateNumberDraft(field: NumberField, event: Event): void {
  visualSettings.numericField(draftKey(field)).edit((event.target as HTMLInputElement).value)
}

function writeNumber(field: NumberField, raw: string): void {
  const result = visualSettings.numericField(draftKey(field)).commit(
    raw,
    props.modelValue[field.key],
    field
  )
  if (!result.changed) return
  const next = cloneMosaicParticleConfig(props.modelValue)
  next[field.key] = result.value
  emit('update:modelValue', normalizeMosaicParticleConfig(next))
}

function commitNumber(field: NumberField, event: Event): void {
  writeNumber(field, (event.target as HTMLInputElement).value)
}

function updateRange(field: NumberField, event: Event): void {
  writeNumber(field, (event.target as HTMLInputElement).value)
}

function applyBluePurplePreset(): void {
  visualSettings.applyEffectMosaicPreset()
}

function randomizeSeed(): void {
  visualSettings.randomizeEffectMosaicSeed()
}

function resetGroup(): void {
  visualSettings.resetEffectMosaicParticles()
}

watch(() => props.modelValue, () => {
  for (const field of FIELDS) {
    visualSettings.numericField(draftKey(field)).sync(props.modelValue[field.key])
  }
}, { deep: true, immediate: true })
</script>

<template>
  <section class="mosaic-controls">
    <div class="field" data-control-path="hover.mosaicParticles.enabled">
      <div class="field-head">
        <label :for="fieldId('enabled', 'checkbox')">启用马赛克粒子</label>
        <input
          :id="fieldId('enabled', 'checkbox')"
          class="checkbox"
          type="checkbox"
          :checked="modelValue.enabled"
          @change="updateBoolean('enabled', $event)"
        />
      </div>
    </div>
    <div v-for="colorField in [
      { key: 'primaryColor' as const, label: '主色' },
      { key: 'accentColor' as const, label: '强调色' },
      { key: 'gapColor' as const, label: '间隙颜色' }
    ]" :key="colorField.key" class="field" :data-control-path="`hover.mosaicParticles.${colorField.key}`">
      <div class="field-head">
        <label :for="fieldId(colorField.key, 'color')">{{ colorField.label }}</label>
        <input
          :id="fieldId(colorField.key, 'color')"
          class="color"
          type="color"
          :value="modelValue[colorField.key]"
          @input="updateColor(colorField.key, $event)"
        />
        <input
          :id="fieldId(colorField.key, 'hex')"
          class="hex"
          type="text"
          :value="modelValue[colorField.key]"
          :aria-label="colorField.label + '十六进制颜色'"
          @change="updateColor(colorField.key, $event)"
        />
      </div>
    </div>
    <div v-for="field in FIELDS" :key="field.key" class="field" :data-control-path="`hover.mosaicParticles.${field.key}`">
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
    <div class="field" data-control-path="hover.mosaicParticles.reseedOnEnter">
      <div class="field-head">
        <label :for="fieldId('reseedOnEnter', 'checkbox')">每次进入重新组合</label>
        <input
          :id="fieldId('reseedOnEnter', 'checkbox')"
          class="checkbox"
          type="checkbox"
          :checked="modelValue.reseedOnEnter"
          @change="updateBoolean('reseedOnEnter', $event)"
        />
      </div>
    </div>
    <div class="effect-actions group-actions">
      <button class="btn" type="button" data-visual-action="effect.mosaic.preset" @click="applyBluePurplePreset">应用蓝紫参考预设</button>
      <button class="btn ghost" type="button" data-visual-action="effect.mosaic.randomize" @click="randomizeSeed">随机种子</button>
      <button class="btn ghost" type="button" data-visual-action="effect.mosaic.reset" @click="resetGroup">恢复固化默认</button>
    </div>
  </section>
</template>

<style scoped>
.mosaic-controls { display: flex; flex-direction: column; gap: 10px; }
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
