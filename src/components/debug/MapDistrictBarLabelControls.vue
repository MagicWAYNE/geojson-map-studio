<script setup lang="ts">
import {
  cloneDistrictBarLabelConfig,
  normalizeDistrictBarLabelConfig,
  type MapDistrictBarLabelConfig
} from '@/components/map/mapDistrictBarLabelConfig'

type BooleanKey = 'enabled' | 'depthTest' | 'collisionEnabled'
type ColorKey = 'tintColor' | 'districtColor' | 'metricColor' | 'valueColor'
type NumberKey = Exclude<keyof MapDistrictBarLabelConfig, BooleanKey | ColorKey>

interface NumberField { key: NumberKey; label: string; min: number; max: number; step: number }
interface BooleanField { key: BooleanKey; label: string }
interface ColorField { key: ColorKey; label: string }
interface FieldGroup {
  title: string
  booleans?: readonly BooleanField[]
  colors?: readonly ColorField[]
  numbers: readonly NumberField[]
}

const props = defineProps<{ modelValue: MapDistrictBarLabelConfig }>()
const emit = defineEmits<{ 'update:modelValue': [value: MapDistrictBarLabelConfig] }>()
const HEX_COLOR = /^#[0-9a-f]{6}$/i

const GROUPS: readonly FieldGroup[] = [
  {
    title: '显示与定位',
    booleans: [
      { key: 'enabled', label: '启用标签' },
      { key: 'depthTest', label: '启用深度遮挡' }
    ],
    numbers: [
      { key: 'width', label: '标签宽度 px', min: 120, max: 420, step: 1 },
      { key: 'height', label: '标签高度 px', min: 24, max: 80, step: 1 },
      { key: 'gapX', label: '柱体右侧间距 px', min: 0, max: 80, step: 1 },
      { key: 'offsetX', label: '水平偏移 px', min: -200, max: 200, step: 1 },
      { key: 'offsetY', label: '垂直偏移 px', min: -200, max: 200, step: 1 },
      { key: 'opacity', label: '常态透明度', min: 0, max: 1, step: 0.01 },
      { key: 'hoverOpacity', label: 'Hover 透明度', min: 0, max: 1, step: 0.01 },
      { key: 'hoverScale', label: 'Hover 放大倍率', min: 0.5, max: 2, step: 0.01 },
      { key: 'hoverBrightness', label: 'Hover 亮度增强', min: 0.2, max: 2, step: 0.01 }
    ]
  },
  {
    title: '背景素材',
    colors: [{ key: 'tintColor', label: '染色颜色' }],
    numbers: [
      { key: 'backgroundOpacity', label: '背景透明度', min: 0, max: 1, step: 0.01 },
      { key: 'hueRotate', label: '色相旋转 deg', min: -180, max: 180, step: 1 },
      { key: 'saturation', label: '背景饱和度', min: 0, max: 3, step: 0.01 },
      { key: 'brightness', label: '背景亮度', min: 0.2, max: 2, step: 0.01 },
      { key: 'contrast', label: '背景对比度', min: 0.2, max: 2, step: 0.01 },
      { key: 'tintStrength', label: '染色强度', min: 0, max: 1, step: 0.01 },
      { key: 'backgroundInsetY', label: '背景垂直内缩 px', min: 0, max: 20, step: 1 }
    ]
  },
  {
    title: '案件 ICON',
    numbers: [
      { key: 'iconSize', label: 'ICON 大小 px', min: 8, max: 80, step: 1 },
      { key: 'iconOffsetX', label: 'ICON X 偏移 px', min: -40, max: 40, step: 1 },
      { key: 'iconOffsetY', label: 'ICON Y 偏移 px', min: -40, max: 40, step: 1 },
      { key: 'iconOpacity', label: 'ICON 透明度', min: 0, max: 1, step: 0.01 },
      { key: 'iconBrightness', label: 'ICON 亮度', min: 0.2, max: 2, step: 0.01 },
      { key: 'iconSaturation', label: 'ICON 饱和度', min: 0, max: 3, step: 0.01 },
      { key: 'iconTextGap', label: 'ICON 与文字间距 px', min: 0, max: 80, step: 1 }
    ]
  },
  {
    title: '单行文字',
    colors: [
      { key: 'districtColor', label: '区名颜色' },
      { key: 'metricColor', label: '“案件量”颜色' },
      { key: 'valueColor', label: '数值颜色' }
    ],
    numbers: [
      { key: 'districtFontSize', label: '区名字号 px', min: 8, max: 40, step: 1 },
      { key: 'districtWeight', label: '区名字重', min: 100, max: 900, step: 100 },
      { key: 'metricFontSize', label: '“案件量”字号 px', min: 8, max: 40, step: 1 },
      { key: 'metricWeight', label: '“案件量”字重', min: 100, max: 900, step: 100 },
      { key: 'valueFontSize', label: '数值字号 px', min: 8, max: 48, step: 1 },
      { key: 'valueWeight', label: '数值字重', min: 100, max: 900, step: 100 },
      { key: 'districtMetricGap', label: '区名与指标间距 px', min: 0, max: 80, step: 1 },
      { key: 'metricValueGap', label: '指标与数值间距 px', min: 0, max: 40, step: 1 },
      { key: 'valueDecimals', label: '数值小数位', min: 0, max: 2, step: 1 }
    ]
  },
  {
    title: '动画与布局保护',
    booleans: [{ key: 'collisionEnabled', label: '启用纵向防重叠' }],
    numbers: [
      { key: 'enterMs', label: '标签入场时长 ms', min: 0, max: 3000, step: 10 },
      { key: 'staggerMs', label: '标签错峰时长 ms', min: 0, max: 1000, step: 10 },
      { key: 'hoverEnterMs', label: 'Hover 进入时长 ms', min: 0, max: 1000, step: 10 },
      { key: 'hoverLeaveMs', label: 'Hover 离开时长 ms', min: 0, max: 1000, step: 10 },
      { key: 'detailGap', label: '详情窗垂直间距 px', min: 0, max: 40, step: 1 },
      { key: 'collisionGap', label: '标签安全间距 px', min: 0, max: 40, step: 1 },
      { key: 'collisionMaxShift', label: '最大避让距离 px', min: 0, max: 200, step: 1 }
    ]
  }
]

function fieldId(key: keyof MapDistrictBarLabelConfig, control: string): string {
  return `effect-bars-label-${key}-${control}`
}

function emitClone(update: (next: MapDistrictBarLabelConfig) => void): void {
  const next = cloneDistrictBarLabelConfig(props.modelValue)
  update(next)
  emit('update:modelValue', normalizeDistrictBarLabelConfig(next))
}

function updateBoolean(key: BooleanKey, event: Event): void {
  emitClone((next) => (next[key] = (event.target as HTMLInputElement).checked))
}

function updateColor(key: ColorKey, event: Event): void {
  const input = event.target as HTMLInputElement
  if (!HEX_COLOR.test(input.value)) {
    input.value = props.modelValue[key]
    return
  }
  emitClone((next) => (next[key] = input.value))
}

function updateNumber(field: NumberField, event: Event): void {
  const input = event.target as HTMLInputElement
  const current = props.modelValue[field.key]
  const parsed = Number(input.value)
  if (!Number.isFinite(parsed)) {
    input.value = String(current)
    return
  }
  emitClone((next) => Object.assign(next, { [field.key]: parsed }))
}

</script>

<template>
  <div class="label-controls">
    <details v-for="group in GROUPS" :key="group.title" class="control-group" open>
      <summary>{{ group.title }}</summary>

      <div v-for="field in group.booleans ?? []" :key="field.key" class="field row-field">
        <label :for="fieldId(field.key, 'checkbox')">{{ field.label }}</label>
        <input
          :id="fieldId(field.key, 'checkbox')"
          class="checkbox"
          type="checkbox"
          :checked="modelValue[field.key]"
          @change="updateBoolean(field.key, $event)"
        />
      </div>

      <div v-for="field in group.colors ?? []" :key="field.key" class="field row-field">
        <label :for="fieldId(field.key, 'color')">{{ field.label }}</label>
        <input
          :id="fieldId(field.key, 'color')"
          class="color"
          type="color"
          :value="modelValue[field.key]"
          @input="updateColor(field.key, $event)"
        />
        <input
          :id="fieldId(field.key, 'hex')"
          class="hex"
          type="text"
          :value="modelValue[field.key]"
          :aria-label="field.label + '十六进制颜色'"
          @change="updateColor(field.key, $event)"
        />
      </div>

      <div v-for="field in group.numbers" :key="field.key" class="field">
        <div class="row-field">
          <label :for="fieldId(field.key, 'number')">{{ field.label }}</label>
          <input
            :id="fieldId(field.key, 'number')"
            class="num"
            type="number"
            :value="modelValue[field.key]"
            :min="field.min"
            :max="field.max"
            :step="field.step"
            @change="updateNumber(field, $event)"
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
          @input="updateNumber(field, $event)"
        />
      </div>
    </details>
  </div>
</template>

<style scoped>
.label-controls { display: flex; flex-direction: column; gap: 10px; }
.control-group {
  padding: 8px 10px; border: 1px solid rgba(36, 131, 255, 0.24); border-radius: 4px;
  background: rgba(36, 131, 255, 0.035);
}
.control-group summary { color: #8fd9ff; font-size: 12px; cursor: pointer; user-select: none; }
.control-group[open] summary { margin-bottom: 10px; }
.field { display: flex; flex-direction: column; gap: 6px; margin-top: 9px; }
.row-field { display: flex; flex-direction: row; align-items: center; gap: 6px; font-size: 12px; }
.row-field label { flex: 1; }
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
