<script setup lang="ts">
import { onBeforeUnmount, reactive, ref, watch } from 'vue'
import type { MapEffectBaseConfig, MapEffectHoverConfig } from '@/components/map/mapEffectConfig'
import { useMapDebug } from '@/composables/useMapDebug'

type BaseColorKey = 'innerColor' | 'outerColor'
type HoverColorKey = 'surfaceColor' | 'emissiveColor' | 'outlineColor' | 'glowColor'
type BaseNumberKey = Exclude<keyof MapEffectBaseConfig, BaseColorKey>
type HoverNumberKey = Exclude<keyof MapEffectHoverConfig, HoverColorKey>

interface NumberFieldBase {
  kind: 'number'
  label: string
  min: number
  max: number
  step: number
}

type Field =
  | { section: 'base'; key: BaseColorKey; kind: 'color'; label: string }
  | { section: 'hover'; key: HoverColorKey; kind: 'color'; label: string }
  | ({ section: 'base'; key: BaseNumberKey } & NumberFieldBase)
  | ({ section: 'hover'; key: HoverNumberKey } & NumberFieldBase)

type NumberField = Extract<Field, { kind: 'number' }>

const GROUPS: ReadonlyArray<{ title: string; fields: readonly Field[] }> = [
  {
    title: '常态边界',
    fields: [
      { section: 'base', key: 'innerColor', label: '内部线颜色', kind: 'color' },
      { section: 'base', key: 'innerWidth', label: '内部线宽', kind: 'number', min: 0, max: 4, step: 0.1 },
      { section: 'base', key: 'innerOpacity', label: '内部线透明度', kind: 'number', min: 0, max: 1, step: 0.01 },
      { section: 'base', key: 'outerColor', label: '外圈颜色', kind: 'color' },
      { section: 'base', key: 'outerCoreWidth', label: '外圈亮芯宽度', kind: 'number', min: 0, max: 6, step: 0.1 },
      { section: 'base', key: 'outerGlowWidth', label: '外圈辉光宽度', kind: 'number', min: 0, max: 24, step: 0.5 },
      { section: 'base', key: 'outerGlowStrength', label: '外圈辉光强度', kind: 'number', min: 0, max: 1, step: 0.01 }
    ]
  },
  {
    title: 'Hover 表面',
    fields: [
      { section: 'hover', key: 'surfaceColor', label: '顶面颜色', kind: 'color' },
      { section: 'hover', key: 'emissiveColor', label: '自发光颜色', kind: 'color' },
      { section: 'hover', key: 'emissiveIntensity', label: '自发光强度', kind: 'number', min: 0, max: 2, step: 0.05 },
      { section: 'hover', key: 'lift', label: '抬升高度', kind: 'number', min: 0, max: 3, step: 0.1 }
    ]
  },
  {
    title: 'Hover 轮廓与动效',
    fields: [
      { section: 'hover', key: 'outlineColor', label: '亮芯颜色', kind: 'color' },
      { section: 'hover', key: 'outlineWidth', label: '亮芯宽度', kind: 'number', min: 0, max: 8, step: 0.1 },
      { section: 'hover', key: 'glowColor', label: '辉光颜色', kind: 'color' },
      { section: 'hover', key: 'glowWidth', label: '辉光宽度', kind: 'number', min: 0, max: 20, step: 0.5 },
      { section: 'hover', key: 'glowStrength', label: '辉光强度', kind: 'number', min: 0, max: 1, step: 0.01 },
      { section: 'hover', key: 'enterMs', label: '进入时长 ms', kind: 'number', min: 0, max: 1000, step: 10 },
      { section: 'hover', key: 'leaveMs', label: '离开时长 ms', kind: 'number', min: 0, max: 1000, step: 10 }
    ]
  }
]

const { effect, effectJson, resetEffect } = useMapDebug()
const copied = ref(false)
const HEX = /^#[0-9a-f]{6}$/i
const numberDrafts = reactive<Record<string, string>>({})
let copiedTimer = 0

function valueOf(field: Field): string | number {
  return field.section === 'base'
    ? effect.base[field.key]
    : effect.hover[field.key]
}

function fieldId(field: Field, control: 'color' | 'hex' | 'number' | 'range'): string {
  return `effect-${field.section}-${field.key}-${control}`
}

function draftKey(field: NumberField): string {
  return `${field.section}.${field.key}`
}

function numberDraft(field: NumberField): string {
  return numberDrafts[draftKey(field)] ?? String(valueOf(field))
}

function normalizeNumber(field: NumberField, raw: string): number {
  const parsed = raw.trim() === '' ? Number(valueOf(field)) : Number(raw)
  const value = Number.isFinite(parsed) ? parsed : Number(valueOf(field))
  const clamped = Math.min(field.max, Math.max(field.min, value))
  const precision = (String(field.step).split('.')[1] ?? '').length
  return Number((Math.round(clamped / field.step) * field.step).toFixed(precision))
}

function writeNumber(field: NumberField, raw: string): void {
  const rounded = normalizeNumber(field, raw)
  numberDrafts[draftKey(field)] = String(rounded)
  if (field.section === 'base') effect.base[field.key] = rounded
  else effect.hover[field.key] = rounded
}

function updateNumberDraft(field: NumberField, event: Event): void {
  numberDrafts[draftKey(field)] = (event.target as HTMLInputElement).value
}

function commitNumber(field: NumberField, event: Event): void {
  writeNumber(field, (event.target as HTMLInputElement).value)
}

function updateRange(field: NumberField, event: Event): void {
  writeNumber(field, (event.target as HTMLInputElement).value)
}

function isNumberField(field: Field): field is NumberField {
  return field.kind === 'number'
}

const numberFields = GROUPS.flatMap((group) => group.fields).filter(isNumberField)
const stopDraftWatch = watch(effect, () => {
  for (const field of numberFields) numberDrafts[draftKey(field)] = String(valueOf(field))
}, { deep: true, immediate: true })

function updateColor(field: Field, event: Event): void {
  if (field.kind !== 'color') return
  const input = event.target as HTMLInputElement
  if (!HEX.test(input.value)) {
    input.value = String(valueOf(field))
    return
  }
  if (field.section === 'base') effect.base[field.key] = input.value.toLowerCase()
  else effect.hover[field.key] = input.value.toLowerCase()
}

async function copyEffect(): Promise<void> {
  try {
    await navigator.clipboard.writeText(effectJson.value)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = effectJson.value
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    textarea.remove()
  }
  copied.value = true
  clearTimeout(copiedTimer)
  copiedTimer = window.setTimeout(() => (copied.value = false), 1500)
}

onBeforeUnmount(() => {
  stopDraftWatch()
  clearTimeout(copiedTimer)
})
</script>

<template>
  <div class="effect-controls">
    <section v-for="group in GROUPS" :key="group.title" class="effect-group">
      <h3>{{ group.title }}</h3>
      <div v-for="field in group.fields" :key="field.key" class="field">
        <div class="field-head">
          <label :for="fieldId(field, field.kind === 'color' ? 'color' : 'number')">{{ field.label }}</label>
          <template v-if="field.kind === 'color'">
            <input
              :id="fieldId(field, 'color')"
              class="color"
              type="color"
              :value="valueOf(field)"
              @input="updateColor(field, $event)"
            />
            <input
              :id="fieldId(field, 'hex')"
              class="hex"
              type="text"
              :value="valueOf(field)"
              :aria-label="field.label + '十六进制颜色'"
              @change="updateColor(field, $event)"
            />
          </template>
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

    <section class="effect-group">
      <h3>可复制参数</h3>
      <pre class="json-out">{{ effectJson }}</pre>
      <div class="effect-actions">
        <button class="btn" @click="copyEffect">{{ copied ? '已复制 ✓' : '复制效果参数' }}</button>
        <button class="btn ghost" @click="resetEffect">恢复默认值</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.effect-controls { display: flex; flex-direction: column; gap: 14px; padding-bottom: 4px; }
.effect-group {
  display: flex; flex-direction: column; gap: 10px; padding: 12px;
  border: 1px solid rgba(36, 131, 255, 0.28); border-radius: 4px;
  background: rgba(36, 131, 255, 0.05);
}
.effect-group h3 { margin: 0; font-size: 14px; font-weight: normal; color: #fff; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field-head { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.field-head label { flex: 1; }
.num, .hex {
  box-sizing: border-box; height: 26px; padding: 2px 6px; text-align: right;
  color: #00deff; background: rgba(36, 131, 255, 0.12);
  border: 1px solid rgba(36, 131, 255, 0.4); border-radius: 3px; outline: none;
}
.num { width: 76px; }
.hex { width: 82px; font-family: monospace; }
.color { width: 30px; height: 26px; padding: 1px; border: 1px solid rgba(36, 131, 255, 0.4); background: transparent; }
.slider { width: 100%; accent-color: #00deff; cursor: pointer; }
.json-out {
  box-sizing: border-box; max-height: 220px; margin: 0; padding: 10px;
  overflow: auto; user-select: text; white-space: pre; font-size: 11px; line-height: 1.45;
  color: #8fd9ff; background: rgba(0, 0, 0, 0.35);
  border: 1px dashed rgba(36, 131, 255, 0.4); border-radius: 4px;
}
.effect-actions { display: flex; gap: 8px; }
.btn {
  flex: 1; padding: 8px 4px; font-size: 12px; font-family: 'OPPOSans-M'; cursor: pointer;
  color: #041020; background: linear-gradient(180deg, #00deff, #2483ff);
  border: none; border-radius: 4px;
}
.btn.ghost { color: #7fa8d9; background: transparent; border: 1px solid rgba(36, 131, 255, 0.5); }
.btn.ghost:hover { color: #00deff; border-color: #00deff; }
</style>
