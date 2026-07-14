<script lang="ts">
import {
  MAP_DISTRICT_BAR_OVERLAY_NUMBER_CONSTRAINTS,
  type MapDistrictBarOverlayBooleanPath,
  type MapDistrictBarOverlayColorPath,
  type MapDistrictBarOverlayConfig,
  type MapDistrictBarOverlayNumberPath,
  type MapDistrictBarOverlaySelectPath
} from '@/components/map/mapDistrictBarOverlayConfig'

export type MapDistrictBarOverlayControlPath =
  | MapDistrictBarOverlayBooleanPath
  | MapDistrictBarOverlayColorPath
  | MapDistrictBarOverlayNumberPath
  | MapDistrictBarOverlaySelectPath

interface OverlayControlBase<Path extends MapDistrictBarOverlayControlPath> {
  path: Path
  label: string
}

export interface OverlayBoolControl extends OverlayControlBase<MapDistrictBarOverlayBooleanPath> {
  kind: 'bool'
}

export interface OverlayColorControl extends OverlayControlBase<MapDistrictBarOverlayColorPath> {
  kind: 'color'
}

export interface OverlayNumberControl extends OverlayControlBase<MapDistrictBarOverlayNumberPath> {
  kind: 'number'
  min: number
  max: number
  step: number
}

export interface OverlaySelectControl extends OverlayControlBase<MapDistrictBarOverlaySelectPath> {
  kind: 'select'
  options: readonly { value: 'left' | 'right'; label: string }[]
}

export type MapDistrictBarOverlayControl =
  | OverlayBoolControl
  | OverlayColorControl
  | OverlayNumberControl
  | OverlaySelectControl

export interface MapDistrictBarOverlayControlGroup {
  id: string
  label: string
  fields: readonly MapDistrictBarOverlayControl[]
}

function numberControl(
  path: MapDistrictBarOverlayNumberPath,
  label: string
): OverlayNumberControl {
  const constraint = path[0] === 'badge'
    ? MAP_DISTRICT_BAR_OVERLAY_NUMBER_CONSTRAINTS.badge[path[1]]
    : path[0] === 'panel'
      ? MAP_DISTRICT_BAR_OVERLAY_NUMBER_CONSTRAINTS.panel[path[1]]
      : MAP_DISTRICT_BAR_OVERLAY_NUMBER_CONSTRAINTS.collision[path[1]]
  return { kind: 'number', path, label, ...constraint }
}

export const MAP_DISTRICT_BAR_OVERLAY_CONTROL_GROUPS: readonly MapDistrictBarOverlayControlGroup[] = [
  {
    id: 'master',
    label: '浮层总开关',
    fields: [
      { kind: 'bool', path: ['enabled'], label: '启用柱顶标签与 Hover 指标面板' }
    ]
  },
  {
    id: 'badge-layout',
    label: '柱顶标签 · 显示与定位',
    fields: [
      { kind: 'bool', path: ['badge', 'enabled'], label: '显示柱顶数值标签' },
      numberControl(['badge', 'minWidth'], '最小宽度 px'),
      numberControl(['badge', 'height'], '高度 px'),
      numberControl(['badge', 'paddingX'], '水平内边距 px'),
      numberControl(['badge', 'gapY'], '距柱顶间距 px'),
      numberControl(['badge', 'offsetX'], '水平偏移 px'),
      numberControl(['badge', 'offsetY'], '垂直偏移 px'),
      { kind: 'bool', path: ['badge', 'hideOnHover'], label: 'Hover 时隐藏当前标签' }
    ]
  },
  {
    id: 'badge-appearance',
    label: '柱顶标签 · 外观',
    fields: [
      { kind: 'color', path: ['badge', 'backgroundColor'], label: '背景颜色' },
      numberControl(['badge', 'backgroundOpacity'], '背景透明度'),
      { kind: 'color', path: ['badge', 'borderColor'], label: '边框颜色' },
      numberControl(['badge', 'borderWidth'], '边框宽度 px'),
      numberControl(['badge', 'borderRadius'], '圆角 px'),
      { kind: 'color', path: ['badge', 'textColor'], label: '数值颜色' },
      numberControl(['badge', 'fontSize'], '字号 px'),
      numberControl(['badge', 'fontWeight'], '字重'),
      { kind: 'color', path: ['badge', 'shadowColor'], label: '辉光颜色' },
      numberControl(['badge', 'shadowBlur'], '辉光模糊 px'),
      numberControl(['badge', 'shadowOpacity'], '辉光透明度'),
      numberControl(['badge', 'hoverInactiveOpacity'], 'Hover 时其他标签透明度')
    ]
  },
  {
    id: 'badge-format-animation',
    label: '柱顶标签 · 数值与动画',
    fields: [
      numberControl(['badge', 'decimals'], '小数位数'),
      { kind: 'bool', path: ['badge', 'thousandsSeparator'], label: '显示千分位' },
      numberControl(['badge', 'enterDelayMs'], '首个入场延迟 ms'),
      numberControl(['badge', 'enterMs'], '入场时长 ms'),
      numberControl(['badge', 'staggerMs'], '错峰间隔 ms')
    ]
  },
  {
    id: 'panel-layout',
    label: 'Hover 面板 · 显示与定位',
    fields: [
      { kind: 'bool', path: ['panel', 'enabled'], label: '显示 Hover 指标面板' },
      {
        kind: 'select',
        path: ['panel', 'preferredSide'],
        label: '优先显示方向',
        options: [
          { value: 'right', label: '柱体右侧' },
          { value: 'left', label: '柱体左侧' }
        ]
      },
      numberControl(['panel', 'gapX'], '距柱体间距 px'),
      numberControl(['panel', 'offsetY'], '垂直偏移 px'),
      numberControl(['panel', 'width'], '面板宽度 px'),
      numberControl(['panel', 'minHeight'], '最小高度 px'),
      numberControl(['panel', 'viewportPadding'], '视口安全边距 px')
    ]
  },
  {
    id: 'panel-box',
    label: 'Hover 面板 · 盒模型',
    fields: [
      { kind: 'color', path: ['panel', 'backgroundColor'], label: '背景颜色' },
      numberControl(['panel', 'backgroundOpacity'], '背景透明度'),
      { kind: 'color', path: ['panel', 'borderColor'], label: '边框颜色' },
      numberControl(['panel', 'borderWidth'], '边框宽度 px'),
      numberControl(['panel', 'borderRadius'], '圆角 px'),
      numberControl(['panel', 'paddingTop'], '上内边距 px'),
      numberControl(['panel', 'paddingRight'], '右内边距 px'),
      numberControl(['panel', 'paddingBottom'], '下内边距 px'),
      numberControl(['panel', 'paddingLeft'], '左内边距 px'),
      numberControl(['panel', 'rowGap'], '指标行间距 px')
    ]
  },
  {
    id: 'panel-title',
    label: 'Hover 面板 · 标题',
    fields: [
      numberControl(['panel', 'titleAssetWidth'], '标题素材宽度 px'),
      numberControl(['panel', 'titleAssetHeight'], '标题素材高度 px'),
      numberControl(['panel', 'titleOffsetX'], '标题素材 X 偏移 px'),
      numberControl(['panel', 'titleOffsetY'], '标题素材 Y 偏移 px'),
      numberControl(['panel', 'titleTextOffsetX'], '标题文字 X 偏移 px'),
      numberControl(['panel', 'titleTextOffsetY'], '标题文字 Y 偏移 px'),
      { kind: 'color', path: ['panel', 'titleColor'], label: '标题文字颜色' },
      numberControl(['panel', 'titleFontSize'], '标题字号 px'),
      numberControl(['panel', 'titleFontWeight'], '标题字重')
    ]
  },
  {
    id: 'panel-format-animation',
    label: 'Hover 面板 · 文字、格式与动画',
    fields: [
      { kind: 'color', path: ['panel', 'labelColor'], label: '指标名称颜色' },
      numberControl(['panel', 'labelFontSize'], '指标名称字号 px'),
      numberControl(['panel', 'labelFontWeight'], '指标名称字重'),
      { kind: 'color', path: ['panel', 'valueColor'], label: '指标数值颜色' },
      numberControl(['panel', 'valueFontSize'], '指标数值字号 px'),
      numberControl(['panel', 'valueFontWeight'], '指标数值字重'),
      { kind: 'color', path: ['panel', 'unitColor'], label: '单位颜色' },
      numberControl(['panel', 'unitFontSize'], '单位字号 px'),
      numberControl(['panel', 'unitFontWeight'], '单位字重'),
      numberControl(['panel', 'caseDecimals'], '案件量小数位'),
      numberControl(['panel', 'amountDecimals'], '在调金额小数位'),
      { kind: 'bool', path: ['panel', 'thousandsSeparator'], label: '显示千分位' },
      numberControl(['panel', 'enterMs'], '进入时长 ms'),
      numberControl(['panel', 'leaveMs'], '离开时长 ms'),
      numberControl(['panel', 'enterScale'], '进入缩放比例')
    ]
  },
  {
    id: 'collision',
    label: '柱顶标签 · 碰撞避让',
    fields: [
      { kind: 'bool', path: ['collision', 'badgeCollisionEnabled'], label: '启用标签碰撞避让' },
      numberControl(['collision', 'badgeCollisionGap'], '标签避让间距 px'),
      numberControl(['collision', 'badgeMaxShift'], '最大下移距离 px')
    ]
  }
]
</script>

<script setup lang="ts">
import { reactive, watch } from 'vue'
import {
  cloneDistrictBarOverlayConfig,
  normalizeDistrictBarOverlayConfig
} from '@/components/map/mapDistrictBarOverlayConfig'

const props = defineProps<{
  modelValue: MapDistrictBarOverlayConfig
}>()

const emit = defineEmits<{
  'update:modelValue': [value: MapDistrictBarOverlayConfig]
}>()

const HEX_COLOR = /^#[0-9a-f]{6}$/i
const numberDrafts = reactive<Record<string, string>>({})
const committedNumbers = new Map<string, string>()

function pathKey(path: MapDistrictBarOverlayControlPath): string {
  return path.join('-')
}

function fieldId(field: MapDistrictBarOverlayControl, control: string): string {
  return `effect-bars-overlay-${pathKey(field.path)}-${control}`
}

function readBoolean(
  value: Readonly<MapDistrictBarOverlayConfig>,
  path: MapDistrictBarOverlayBooleanPath
): boolean {
  if (path[0] === 'enabled') return value.enabled
  if (path[0] === 'badge') return value.badge[path[1]]
  if (path[0] === 'panel') return value.panel[path[1]]
  return value.collision[path[1]]
}

function writeBoolean(
  value: MapDistrictBarOverlayConfig,
  path: MapDistrictBarOverlayBooleanPath,
  next: boolean
): void {
  if (path[0] === 'enabled') {
    value.enabled = next
    return
  }
  if (path[0] === 'badge') value.badge[path[1]] = next
  else if (path[0] === 'panel') value.panel[path[1]] = next
  else value.collision[path[1]] = next
}

function readNumber(
  value: Readonly<MapDistrictBarOverlayConfig>,
  path: MapDistrictBarOverlayNumberPath
): number {
  if (path[0] === 'badge') return value.badge[path[1]]
  if (path[0] === 'panel') return value.panel[path[1]]
  return value.collision[path[1]]
}

function writeNumberPath(
  value: MapDistrictBarOverlayConfig,
  path: MapDistrictBarOverlayNumberPath,
  next: number
): void {
  if (path[0] === 'badge') value.badge[path[1]] = next
  else if (path[0] === 'panel') value.panel[path[1]] = next
  else value.collision[path[1]] = next
}

function readColor(
  value: Readonly<MapDistrictBarOverlayConfig>,
  path: MapDistrictBarOverlayColorPath
): string {
  return path[0] === 'badge' ? value.badge[path[1]] : value.panel[path[1]]
}

function writeColor(
  value: MapDistrictBarOverlayConfig,
  path: MapDistrictBarOverlayColorPath,
  next: string
): void {
  if (path[0] === 'badge') value.badge[path[1]] = next
  else value.panel[path[1]] = next
}

function readSelect(value: Readonly<MapDistrictBarOverlayConfig>): 'left' | 'right' {
  return value.panel.preferredSide
}

function writeSelect(value: MapDistrictBarOverlayConfig, next: 'left' | 'right'): void {
  value.panel.preferredSide = next
}

function emitClone(update: (next: MapDistrictBarOverlayConfig) => void): void {
  const next = cloneDistrictBarOverlayConfig(props.modelValue)
  update(next)
  emit('update:modelValue', normalizeDistrictBarOverlayConfig(next))
}

function updateBool(field: OverlayBoolControl, event: Event): void {
  emitClone((next) => writeBoolean(next, field.path, (event.target as HTMLInputElement).checked))
}

function updateSelect(field: OverlaySelectControl, event: Event): void {
  const value = (event.target as HTMLSelectElement).value
  if (value !== 'left' && value !== 'right') return
  emitClone((next) => writeSelect(next, value))
}

function updateColor(field: OverlayColorControl, event: Event): void {
  const input = event.target as HTMLInputElement
  if (!HEX_COLOR.test(input.value)) {
    input.value = readColor(props.modelValue, field.path)
    return
  }
  const normalizedColor = input.value.toLowerCase()
  emitClone((next) => writeColor(next, field.path, normalizedColor))
}

function numberDraft(field: OverlayNumberControl): string {
  return numberDrafts[pathKey(field.path)] ?? String(readNumber(props.modelValue, field.path))
}

function updateNumberDraft(field: OverlayNumberControl, event: Event): void {
  const key = pathKey(field.path)
  numberDrafts[key] = (event.target as HTMLInputElement).value
  committedNumbers.delete(key)
}

function writeNumber(field: OverlayNumberControl, raw: string): void {
  const key = pathKey(field.path)
  const current = readNumber(props.modelValue, field.path)
  const parsed = raw.trim() === '' ? Number.NaN : Number(raw)
  if (!Number.isFinite(parsed)) {
    numberDrafts[key] = String(current)
    committedNumbers.delete(key)
    return
  }

  const candidate = cloneDistrictBarOverlayConfig(props.modelValue)
  writeNumberPath(candidate, field.path, parsed)
  const normalizedConfig = normalizeDistrictBarOverlayConfig(candidate)
  const normalized = readNumber(normalizedConfig, field.path)
  numberDrafts[key] = String(normalized)
  if (committedNumbers.get(key) === String(normalized) || normalized === current) return
  committedNumbers.set(key, String(normalized))
  emit('update:modelValue', normalizedConfig)
}

function commitNumber(field: OverlayNumberControl, event: Event): void {
  const input = event.target as HTMLInputElement
  writeNumber(field, input.value)
  input.value = numberDraft(field)
}

function updateRange(field: OverlayNumberControl, event: Event): void {
  writeNumber(field, (event.target as HTMLInputElement).value)
}

watch(() => props.modelValue, () => {
  for (const group of MAP_DISTRICT_BAR_OVERLAY_CONTROL_GROUPS) {
    for (const field of group.fields) {
      if (field.kind !== 'number') continue
      const key = pathKey(field.path)
      const value = String(readNumber(props.modelValue, field.path))
      numberDrafts[key] = value
      if (committedNumbers.get(key) !== value) committedNumbers.delete(key)
    }
  }
}, { deep: true, immediate: true })
</script>

<template>
  <section class="overlay-controls" data-testid="district-bar-overlay-controls">
    <details
      v-for="(group, index) in MAP_DISTRICT_BAR_OVERLAY_CONTROL_GROUPS"
      :key="group.id"
      class="control-group"
      :open="index === 0"
      :data-testid="`overlay-group-${group.id}`"
    >
      <summary>{{ group.label }}</summary>
      <div class="group-fields">
        <div v-for="field in group.fields" :key="pathKey(field.path)" class="field">
          <div class="field-head">
            <label :for="fieldId(field, field.kind === 'bool' ? 'checkbox' : field.kind)">
              {{ field.label }}
            </label>

            <input
              v-if="field.kind === 'bool'"
              :id="fieldId(field, 'checkbox')"
              class="checkbox"
              type="checkbox"
              :checked="readBoolean(modelValue, field.path)"
              @change="updateBool(field, $event)"
            />

            <template v-else-if="field.kind === 'color'">
              <input
                :id="fieldId(field, 'color')"
                class="color"
                type="color"
                :value="readColor(modelValue, field.path)"
                @input="updateColor(field, $event)"
              />
              <input
                :id="fieldId(field, 'hex')"
                class="hex"
                type="text"
                :value="readColor(modelValue, field.path)"
                :aria-label="`${field.label}十六进制颜色`"
                @change="updateColor(field, $event)"
              />
            </template>

            <select
              v-else-if="field.kind === 'select'"
              :id="fieldId(field, 'select')"
              class="select"
              :value="readSelect(modelValue)"
              @change="updateSelect(field, $event)"
            >
              <option v-for="option in field.options" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>

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
            :value="readNumber(modelValue, field.path)"
            :min="field.min"
            :max="field.max"
            :step="field.step"
            :aria-label="`${field.label}滑块`"
            @input="updateRange(field, $event)"
          />
        </div>
      </div>
    </details>
  </section>
</template>

<style scoped>
.overlay-controls { display: flex; flex-direction: column; gap: 8px; }
.control-group {
  border: 1px solid rgba(36, 131, 255, 0.28); border-radius: 4px;
  background: rgba(0, 12, 35, 0.24);
}
.control-group summary {
  padding: 9px 10px; cursor: pointer; user-select: none; font-size: 12px; color: #8fd9ff;
}
.group-fields { display: flex; flex-direction: column; gap: 9px; padding: 2px 10px 10px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field-head { display: flex; align-items: center; gap: 6px; min-height: 26px; font-size: 12px; }
.field-head label { flex: 1; }
.num, .hex, .select {
  box-sizing: border-box; height: 26px; padding: 2px 6px; text-align: right;
  color: #00deff; background: rgba(36, 131, 255, 0.12);
  border: 1px solid rgba(36, 131, 255, 0.4); border-radius: 3px; outline: none;
}
.num { width: 84px; }
.hex { width: 82px; }
.select { width: 110px; text-align: left; }
.checkbox { width: 18px; height: 18px; accent-color: #00deff; cursor: pointer; }
.color {
  width: 30px; height: 26px; padding: 1px;
  border: 1px solid rgba(36, 131, 255, 0.4); background: transparent;
}
.slider { width: 100%; accent-color: #00deff; cursor: pointer; }
</style>
