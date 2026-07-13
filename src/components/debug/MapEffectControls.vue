<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import {
  B3_GLOW_PROFILE_DEFAULTS,
  assignMapEffectConfig,
  cloneMapEffectConfig,
  formatMapEffectConfig,
  MAP_EFFECT_DEFAULTS,
  normalizeMapEffectConfig,
  type MapEffectBaseConfigV2,
  type MapEffectConfig,
  type MapEffectHoverConfigV2,
  type MapEffectQualityConfig
} from '@/components/map/mapEffectConfig'
import {
  assignInwardGlowConfig,
  type MapInwardGlowConfig
} from '@/components/map/mapInwardGlowConfig'
import {
  assignMosaicParticleConfig,
  type MapMosaicParticleConfig
} from '@/components/map/mapMosaicParticleConfig'
import { useMapDebug } from '@/composables/useMapDebug'
import { copyTextToClipboard } from '@/utils/copyText'
import MapInwardGlowControls from './MapInwardGlowControls.vue'
import MapMosaicParticleControls from './MapMosaicParticleControls.vue'

type GlowChannel = 'base' | 'hover'
type BaseColorKey = 'innerColor' | 'outerColor' | 'outerGlowColor'
type HoverColorKey = 'surfaceColor' | 'emissiveColor' | 'outlineColor' | 'glowColor'
type BaseBooleanKey = 'outerGlowEnabled'
type HoverBooleanKey = 'glowEnabled'
type BaseNumberKey = Exclude<keyof MapEffectBaseConfigV2, BaseColorKey | BaseBooleanKey>
type HoverNumberKey = Exclude<keyof MapEffectHoverConfigV2, HoverColorKey | HoverBooleanKey>

interface NumberFieldBase {
  kind: 'number'
  label: string
  min: number
  max: number
  step: number
}

type ColorField =
  | { section: 'base'; key: BaseColorKey; kind: 'color'; label: string }
  | { section: 'hover'; key: HoverColorKey; kind: 'color'; label: string }

type NumberField =
  | ({ section: 'base'; key: BaseNumberKey } & NumberFieldBase)
  | ({ section: 'hover'; key: HoverNumberKey } & NumberFieldBase)
  | ({ section: 'quality'; key: 'maxAlpha' } & NumberFieldBase)

type BooleanField =
  | { section: 'base'; key: BaseBooleanKey; kind: 'boolean'; label: string }
  | { section: 'hover'; key: HoverBooleanKey; kind: 'boolean'; label: string }

const RENDER_SCALE_OPTIONS = [
  { value: 0.25, label: '25%' },
  { value: 0.5, label: '50%' },
  { value: 0.75, label: '75%' },
  { value: 1, label: '100%' }
] as const

type RenderScale = typeof RENDER_SCALE_OPTIONS[number]['value']
type SelectField = {
  section: 'quality'
  key: 'renderScale'
  kind: 'select'
  label: string
  options: typeof RENDER_SCALE_OPTIONS
}
type Field = ColorField | NumberField | BooleanField | SelectField

interface Group {
  title: string
  fields: readonly Field[]
  glowChannel?: GlowChannel
}

const BASE_GLOW_FIELDS: readonly Field[] = [
  { section: 'base', key: 'outerGlowEnabled', label: '启用常态外扩柔光', kind: 'boolean' },
  { section: 'base', key: 'outerGlowColor', label: '外圈辉光颜色', kind: 'color' },
  { section: 'base', key: 'outerGlowWidth', label: '外圈扩散半径', kind: 'number', min: 0, max: 200, step: 1 },
  { section: 'base', key: 'outerGlowStrength', label: '外圈辉光透明度', kind: 'number', min: 0, max: 1, step: 0.01 },
  { section: 'base', key: 'outerGlowNearRadiusRatio', label: '近端扩散倍率', kind: 'number', min: 0, max: 1.5, step: 0.01 },
  { section: 'base', key: 'outerGlowNearOpacityRatio', label: '近端透明度倍率', kind: 'number', min: 0, max: 2, step: 0.01 },
  { section: 'base', key: 'outerGlowFarRadiusRatio', label: '远端扩散倍率', kind: 'number', min: 0.25, max: 2, step: 0.01 },
  { section: 'base', key: 'outerGlowFarOpacityRatio', label: '远端透明度倍率', kind: 'number', min: 0, max: 2, step: 0.01 },
  { section: 'base', key: 'outerGlowFalloff', label: '衰减曲线', kind: 'number', min: 0.25, max: 4, step: 0.05 },
  { section: 'base', key: 'outerGlowEdgeSoftness', label: '外侧裁切柔度', kind: 'number', min: 0, max: 1, step: 0.01 },
  { section: 'base', key: 'outerGlowNearPasses', label: '近端模糊次数', kind: 'number', min: 1, max: 8, step: 1 },
  { section: 'base', key: 'outerGlowFarPasses', label: '远端模糊次数', kind: 'number', min: 1, max: 8, step: 1 }
]

const HOVER_GLOW_FIELDS: readonly Field[] = [
  { section: 'hover', key: 'glowEnabled', label: '启用 Hover 外扩柔光', kind: 'boolean' },
  { section: 'hover', key: 'glowColor', label: 'Hover 辉光颜色', kind: 'color' },
  { section: 'hover', key: 'glowWidth', label: 'Hover 扩散半径', kind: 'number', min: 0, max: 200, step: 1 },
  { section: 'hover', key: 'glowStrength', label: 'Hover 辉光透明度', kind: 'number', min: 0, max: 1, step: 0.01 },
  { section: 'hover', key: 'glowNearRadiusRatio', label: '近端扩散倍率', kind: 'number', min: 0, max: 1.5, step: 0.01 },
  { section: 'hover', key: 'glowNearOpacityRatio', label: '近端透明度倍率', kind: 'number', min: 0, max: 2, step: 0.01 },
  { section: 'hover', key: 'glowFarRadiusRatio', label: '远端扩散倍率', kind: 'number', min: 0.25, max: 2, step: 0.01 },
  { section: 'hover', key: 'glowFarOpacityRatio', label: '远端透明度倍率', kind: 'number', min: 0, max: 2, step: 0.01 },
  { section: 'hover', key: 'glowFalloff', label: '衰减曲线', kind: 'number', min: 0.25, max: 4, step: 0.05 },
  { section: 'hover', key: 'glowEdgeSoftness', label: '外侧裁切柔度', kind: 'number', min: 0, max: 1, step: 0.01 },
  { section: 'hover', key: 'glowNearPasses', label: '近端模糊次数', kind: 'number', min: 1, max: 8, step: 1 },
  { section: 'hover', key: 'glowFarPasses', label: '远端模糊次数', kind: 'number', min: 1, max: 8, step: 1 }
]

const GROUPS: readonly Group[] = [
  {
    title: '常态边界',
    fields: [
      { section: 'base', key: 'innerColor', label: '内部线颜色', kind: 'color' },
      { section: 'base', key: 'innerWidth', label: '内部线宽', kind: 'number', min: 0, max: 4, step: 0.1 },
      { section: 'base', key: 'innerOpacity', label: '内部线透明度', kind: 'number', min: 0, max: 1, step: 0.01 },
      { section: 'base', key: 'outerColor', label: '外圈颜色', kind: 'color' },
      { section: 'base', key: 'outerCoreWidth', label: '外圈亮芯宽度', kind: 'number', min: 0, max: 6, step: 0.1 }
    ]
  },
  { title: '常态外扩柔光', fields: BASE_GLOW_FIELDS, glowChannel: 'base' },
  {
    title: 'Hover 表面',
    fields: [
      { section: 'hover', key: 'surfaceColor', label: '顶面颜色', kind: 'color' },
      { section: 'hover', key: 'emissiveColor', label: '自发光颜色', kind: 'color' },
      { section: 'hover', key: 'emissiveIntensity', label: '自发光强度', kind: 'number', min: 0, max: 2, step: 0.05 },
      { section: 'hover', key: 'outlineColor', label: '亮芯颜色', kind: 'color' },
      { section: 'hover', key: 'outlineWidth', label: '亮芯宽度', kind: 'number', min: 0, max: 8, step: 0.1 },
      { section: 'hover', key: 'lift', label: '抬升高度', kind: 'number', min: 0, max: 3, step: 0.1 },
      { section: 'hover', key: 'enterMs', label: '进入时长 ms', kind: 'number', min: 0, max: 1000, step: 10 },
      { section: 'hover', key: 'leaveMs', label: '离开时长 ms', kind: 'number', min: 0, max: 1000, step: 10 }
    ]
  },
  { title: 'Hover 外扩柔光', fields: HOVER_GLOW_FIELDS, glowChannel: 'hover' },
  {
    title: '渲染质量与性能',
    fields: [
      { section: 'quality', key: 'renderScale', label: '离屏渲染精度', kind: 'select', options: RENDER_SCALE_OPTIONS },
      { section: 'quality', key: 'maxAlpha', label: '合成透明度上限', kind: 'number', min: 0.1, max: 1, step: 0.05 }
    ]
  }
]

const { effect, effectRuntimeStatus, resetEffect } = useMapDebug()
const livePreview = ref(true)
const draft = reactive<MapEffectConfig>(cloneMapEffectConfig(effect))
const editTarget = computed<MapEffectConfig>(() => livePreview.value ? effect : draft)
const copyStatus = ref<'idle' | 'success' | 'error'>('idle')
const HEX = /^#[0-9a-f]{6}$/i
const numberDrafts = reactive<Record<string, string>>({})
let copiedTimer = 0
let applyingDraft = false

function syncDraft(config: MapEffectConfig = effect): void {
  assignMapEffectConfig(draft, cloneMapEffectConfig(config))
}

function changeLivePreview(event: Event): void {
  const next = (event.target as HTMLInputElement).checked
  syncDraft(effect)
  livePreview.value = next
}

function applyDraft(): void {
  const normalized = normalizeMapEffectConfig(draft)
  applyingDraft = true
  assignMapEffectConfig(effect, normalized)
  applyingDraft = false
  syncDraft(normalized)
}

function discardDraft(): void {
  syncDraft(effect)
}

const stopEffectDraftSync = watch(effect, () => {
  if (!livePreview.value && !applyingDraft) syncDraft(effect)
}, { deep: true, flush: 'sync' })

const editableJson = computed(() => formatMapEffectConfig(editTarget.value))
const performanceWarning = computed(() => {
  const target = editTarget.value
  const baseOutwardHighPass = target.base.outerGlowEnabled
    && (target.base.outerGlowNearPasses >= 6 || target.base.outerGlowFarPasses >= 6)
  const hoverOutwardHighPass = target.hover.glowEnabled
    && (target.hover.glowNearPasses >= 6 || target.hover.glowFarPasses >= 6)
  const baseInwardHighPass = target.base.inwardGlow.enabled
    && (target.base.inwardGlow.nearPasses >= 6 || target.base.inwardGlow.farPasses >= 6)
  const hoverInwardHighPass = target.hover.inwardGlow.enabled
    && (target.hover.inwardGlow.nearPasses >= 6 || target.hover.inwardGlow.farPasses >= 6)
  const allGlowChannelsEnabled = target.base.outerGlowEnabled
    && target.hover.glowEnabled
    && target.base.inwardGlow.enabled
    && target.hover.inwardGlow.enabled
  return target.quality.renderScale >= 0.75
    || baseOutwardHighPass
    || hoverOutwardHighPass
    || baseInwardHighPass
    || hoverInwardHighPass
    || allGlowChannelsEnabled
})

function baseStatusLabel(): string {
  return {
    enabled: '已启用',
    zero: '参数为零',
    disabled: '已关闭'
  }[effectRuntimeStatus.baseState]
}

function hoverStatusLabel(): string {
  return {
    ready: '等待 Hover',
    active: '生效中',
    zero: '参数为零',
    disabled: '已关闭'
  }[effectRuntimeStatus.hoverState]
}

function baseInwardStatusLabel(): string {
  return {
    active: '生效中',
    zero: '参数为零',
    disabled: '已关闭'
  }[effectRuntimeStatus.baseInwardState]
}

function hoverInwardStatusLabel(): string {
  return {
    ready: '等待 Hover',
    active: '生效中',
    zero: '参数为零',
    disabled: '已关闭'
  }[effectRuntimeStatus.hoverInwardState]
}

function mosaicStatusLabel(): string {
  return {
    disabled: '已关闭',
    ready: '等待 Hover',
    active: '生效中',
    degraded: '已降级'
  }[effectRuntimeStatus.mosaicState]
}

function runtimeStatusLabel(): string {
  if (effectRuntimeStatus.degraded) return '外扩柔光已降级关闭（屏幕空间柔光）'
  if (effectRuntimeStatus.mosaicState === 'degraded') {
    return '马赛克粒子已降级关闭（其他效果正常）'
  }
  return '正常'
}

function replaceInwardGlow(channel: GlowChannel, value: MapInwardGlowConfig): void {
  assignInwardGlowConfig(editTarget.value[channel].inwardGlow, value)
}

function replaceMosaicParticles(value: MapMosaicParticleConfig): void {
  assignMosaicParticleConfig(editTarget.value.hover.mosaicParticles, value)
}

function isBaseColorField(field: Field): field is Extract<ColorField, { section: 'base' }> {
  return field.section === 'base' && field.kind === 'color'
}

function isHoverColorField(field: Field): field is Extract<ColorField, { section: 'hover' }> {
  return field.section === 'hover' && field.kind === 'color'
}

function isBaseBooleanField(field: Field): field is Extract<BooleanField, { section: 'base' }> {
  return field.section === 'base' && field.kind === 'boolean'
}

function isHoverBooleanField(field: Field): field is Extract<BooleanField, { section: 'hover' }> {
  return field.section === 'hover' && field.kind === 'boolean'
}

function isBaseNumberField(field: Field): field is Extract<NumberField, { section: 'base' }> {
  return field.section === 'base' && field.kind === 'number'
}

function isHoverNumberField(field: Field): field is Extract<NumberField, { section: 'hover' }> {
  return field.section === 'hover' && field.kind === 'number'
}

function isQualityNumberField(field: Field): field is Extract<NumberField, { section: 'quality' }> {
  return field.section === 'quality' && field.kind === 'number'
}

function isQualitySelectField(field: Field): field is SelectField {
  return field.section === 'quality' && field.kind === 'select'
}

function isRenderScale(value: number): value is MapEffectQualityConfig['renderScale'] {
  return RENDER_SCALE_OPTIONS.some((option) => option.value === value)
}

function valueOf(field: Field): string | number | boolean {
  const target = editTarget.value
  if (field.section === 'base') return target.base[field.key]
  if (field.section === 'hover') return target.hover[field.key]
  return target.quality[field.key]
}

function writeValue(field: Field, value: string | number | boolean): void {
  const target = editTarget.value
  if (isBaseColorField(field) && typeof value === 'string') {
    target.base[field.key] = value
  } else if (isHoverColorField(field) && typeof value === 'string') {
    target.hover[field.key] = value
  } else if (isBaseBooleanField(field) && typeof value === 'boolean') {
    target.base[field.key] = value
  } else if (isHoverBooleanField(field) && typeof value === 'boolean') {
    target.hover[field.key] = value
  } else if (isBaseNumberField(field) && typeof value === 'number') {
    target.base[field.key] = value
  } else if (isHoverNumberField(field) && typeof value === 'number') {
    target.hover[field.key] = value
  } else if (isQualityNumberField(field) && typeof value === 'number') {
    target.quality[field.key] = value
  } else if (isQualitySelectField(field) && typeof value === 'number' && isRenderScale(value)) {
    target.quality.renderScale = value
  }
}

function fieldId(field: Field, control: 'color' | 'hex' | 'number' | 'range' | 'checkbox' | 'select'): string {
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
  writeValue(field, rounded)
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

function updateColor(field: ColorField, event: Event): void {
  const input = event.target as HTMLInputElement
  if (!HEX.test(input.value)) {
    input.value = String(valueOf(field))
    return
  }
  writeValue(field, input.value.toLowerCase())
}

function updateBoolean(field: BooleanField, event: Event): void {
  writeValue(field, (event.target as HTMLInputElement).checked)
}

function checkedValue(field: BooleanField): boolean {
  return valueOf(field) === true
}

function updateSelect(field: SelectField, event: Event): void {
  const value = Number((event.target as HTMLSelectElement).value)
  if (field.options.some((option) => option.value === value)) writeValue(field, value)
}

const numberFields = GROUPS.flatMap((group) => group.fields).filter(
  (field): field is NumberField => field.kind === 'number'
)
const stopDraftWatch = watch(editTarget, () => {
  for (const field of numberFields) numberDrafts[draftKey(field)] = String(valueOf(field))
}, { deep: true, immediate: true })

function applyB3Preset(channel: GlowChannel, target: MapEffectConfig): void {
  if (channel === 'base') {
    target.base.outerGlowNearRadiusRatio = B3_GLOW_PROFILE_DEFAULTS.nearRadiusRatio
    target.base.outerGlowNearOpacityRatio = B3_GLOW_PROFILE_DEFAULTS.nearOpacityRatio
    target.base.outerGlowFarRadiusRatio = B3_GLOW_PROFILE_DEFAULTS.farRadiusRatio
    target.base.outerGlowFarOpacityRatio = B3_GLOW_PROFILE_DEFAULTS.farOpacityRatio
    target.base.outerGlowFalloff = B3_GLOW_PROFILE_DEFAULTS.falloff
    target.base.outerGlowEdgeSoftness = B3_GLOW_PROFILE_DEFAULTS.edgeSoftness
    target.base.outerGlowNearPasses = B3_GLOW_PROFILE_DEFAULTS.nearPasses
    target.base.outerGlowFarPasses = B3_GLOW_PROFILE_DEFAULTS.farPasses
  } else {
    target.hover.glowNearRadiusRatio = B3_GLOW_PROFILE_DEFAULTS.nearRadiusRatio
    target.hover.glowNearOpacityRatio = B3_GLOW_PROFILE_DEFAULTS.nearOpacityRatio
    target.hover.glowFarRadiusRatio = B3_GLOW_PROFILE_DEFAULTS.farRadiusRatio
    target.hover.glowFarOpacityRatio = B3_GLOW_PROFILE_DEFAULTS.farOpacityRatio
    target.hover.glowFalloff = B3_GLOW_PROFILE_DEFAULTS.falloff
    target.hover.glowEdgeSoftness = B3_GLOW_PROFILE_DEFAULTS.edgeSoftness
    target.hover.glowNearPasses = B3_GLOW_PROFILE_DEFAULTS.nearPasses
    target.hover.glowFarPasses = B3_GLOW_PROFILE_DEFAULTS.farPasses
  }
}

function resetGlowGroup(channel: GlowChannel, target: MapEffectConfig): void {
  if (channel === 'base') {
    const defaults = MAP_EFFECT_DEFAULTS.base
    target.base.outerGlowEnabled = defaults.outerGlowEnabled
    target.base.outerGlowColor = defaults.outerGlowColor
    target.base.outerGlowWidth = defaults.outerGlowWidth
    target.base.outerGlowStrength = defaults.outerGlowStrength
    target.base.outerGlowNearRadiusRatio = defaults.outerGlowNearRadiusRatio
    target.base.outerGlowNearOpacityRatio = defaults.outerGlowNearOpacityRatio
    target.base.outerGlowFarRadiusRatio = defaults.outerGlowFarRadiusRatio
    target.base.outerGlowFarOpacityRatio = defaults.outerGlowFarOpacityRatio
    target.base.outerGlowFalloff = defaults.outerGlowFalloff
    target.base.outerGlowEdgeSoftness = defaults.outerGlowEdgeSoftness
    target.base.outerGlowNearPasses = defaults.outerGlowNearPasses
    target.base.outerGlowFarPasses = defaults.outerGlowFarPasses
  } else {
    const defaults = MAP_EFFECT_DEFAULTS.hover
    target.hover.glowEnabled = defaults.glowEnabled
    target.hover.glowColor = defaults.glowColor
    target.hover.glowWidth = defaults.glowWidth
    target.hover.glowStrength = defaults.glowStrength
    target.hover.glowNearRadiusRatio = defaults.glowNearRadiusRatio
    target.hover.glowNearOpacityRatio = defaults.glowNearOpacityRatio
    target.hover.glowFarRadiusRatio = defaults.glowFarRadiusRatio
    target.hover.glowFarOpacityRatio = defaults.glowFarOpacityRatio
    target.hover.glowFalloff = defaults.glowFalloff
    target.hover.glowEdgeSoftness = defaults.glowEdgeSoftness
    target.hover.glowNearPasses = defaults.glowNearPasses
    target.hover.glowFarPasses = defaults.glowFarPasses
  }
}

function resetAll(target: MapEffectConfig): void {
  if (target === effect) {
    resetEffect()
    return
  }
  assignMapEffectConfig(target, MAP_EFFECT_DEFAULTS)
}

function runB3Preset(channel: GlowChannel | undefined): void {
  if (channel) applyB3Preset(channel, editTarget.value)
}

function resetGroup(channel: GlowChannel | undefined): void {
  if (channel) resetGlowGroup(channel, editTarget.value)
}

function resetCurrentTarget(): void {
  resetAll(editTarget.value)
}

async function copyEffect(): Promise<void> {
  copyStatus.value = await copyTextToClipboard(editableJson.value) ? 'success' : 'error'
  clearTimeout(copiedTimer)
  copiedTimer = window.setTimeout(() => (copyStatus.value = 'idle'), 1500)
}

function copyLabel(): string {
  if (copyStatus.value === 'success') return '已复制 ✓'
  if (copyStatus.value === 'error') return '复制失败，请重试'
  return '复制效果参数'
}

onBeforeUnmount(() => {
  stopEffectDraftSync()
  stopDraftWatch()
  clearTimeout(copiedTimer)
})
</script>

<template>
  <div class="effect-controls">
    <section class="session-editing">
      <div class="field-head">
        <label for="effect-live-preview">实时预览</label>
        <input
          id="effect-live-preview"
          class="checkbox"
          type="checkbox"
          :checked="livePreview"
          @change="changeLivePreview"
        />
      </div>
      <p v-if="!livePreview" class="editing-hint">草稿模式：切回实时预览会放弃未应用草稿。</p>
      <div v-if="!livePreview" class="effect-actions">
        <button class="btn" @click="applyDraft">应用参数</button>
        <button class="btn ghost" @click="discardDraft">放弃草稿</button>
      </div>
    </section>

    <template v-for="group in GROUPS" :key="group.title">
      <section class="effect-group">
        <h3>{{ group.title }}</h3>
        <div v-for="field in group.fields" :key="field.key" class="field">
          <div class="field-head">
            <label :for="fieldId(field, field.kind === 'color' ? 'color' : field.kind === 'number' ? 'number' : field.kind === 'boolean' ? 'checkbox' : 'select')">
              {{ field.label }}
            </label>
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
              v-else-if="field.kind === 'boolean'"
            :id="fieldId(field, 'checkbox')"
            class="checkbox"
            type="checkbox"
            :checked="checkedValue(field)"
            @change="updateBoolean(field, $event)"
            />
            <select
              v-else-if="field.kind === 'select'"
            :id="fieldId(field, 'select')"
            class="select"
            :value="valueOf(field)"
            @change="updateSelect(field, $event)"
          >
            <option v-for="option in field.options" :key="option.value" :value="option.value">{{ option.label }}</option>
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
          :value="valueOf(field)"
          :min="field.min"
          :max="field.max"
          :step="field.step"
          :aria-label="field.label + '滑块'"
          @input="updateRange(field, $event)"
          />
        </div>
        <div v-if="group.glowChannel" class="effect-actions group-actions">
          <button class="btn" @click="runB3Preset(group.glowChannel)">应用 B3 参考预设</button>
          <button class="btn ghost" @click="resetGroup(group.glowChannel)">重置本组</button>
        </div>
        <div v-if="group.title === '渲染质量与性能'" class="runtime-status" role="status" aria-live="polite">
          <span>RenderTarget: {{ effectRuntimeStatus.targetWidth }} × {{ effectRuntimeStatus.targetHeight }}</span>
          <span>离屏精度: {{ Math.round(effectRuntimeStatus.renderScale * 100) }}%</span>
          <span>常态: {{ baseStatusLabel() }}</span>
          <span>Hover: {{ hoverStatusLabel() }}</span>
          <span>常态内扩: {{ baseInwardStatusLabel() }}</span>
          <span>Hover 内扩: {{ hoverInwardStatusLabel() }}</span>
          <span>马赛克粒子: {{ mosaicStatusLabel() }}</span>
          <span>运行状态: {{ runtimeStatusLabel() }}</span>
        </div>
        <p v-if="group.title === '渲染质量与性能' && performanceWarning" class="performance-warning">
          性能提示：建议先降低 renderScale 或已启用通道的 passes，减少 GPU 负载。
        </p>
      </section>

      <section v-if="group.title === '常态外扩柔光'" class="effect-group">
        <h3>常态内扩柔光</h3>
        <MapInwardGlowControls
          channel="base"
          :model-value="editTarget.base.inwardGlow"
          :state-label="baseInwardStatusLabel()"
          @update:model-value="replaceInwardGlow('base', $event)"
        />
      </section>

      <section v-if="group.title === 'Hover 外扩柔光'" class="effect-group">
        <h3>Hover 内扩柔光</h3>
        <MapInwardGlowControls
          channel="hover"
          :model-value="editTarget.hover.inwardGlow"
          :state-label="hoverInwardStatusLabel()"
          @update:model-value="replaceInwardGlow('hover', $event)"
        />
      </section>

      <section v-if="group.title === 'Hover 外扩柔光'" class="effect-group">
        <h3>Hover 马赛克粒子</h3>
        <MapMosaicParticleControls
          :model-value="editTarget.hover.mosaicParticles"
          @update:model-value="replaceMosaicParticles"
        />
      </section>
    </template>

    <section class="effect-group">
      <h3>可复制参数</h3>
      <pre class="json-out">{{ editableJson }}</pre>
      <div class="effect-actions">
        <button class="btn" @click="copyEffect">{{ copyLabel() }}</button>
        <button class="btn ghost" @click="resetCurrentTarget">恢复全部默认值</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.effect-controls { display: flex; flex-direction: column; gap: 14px; padding-bottom: 4px; }
.effect-group, .session-editing {
  display: flex; flex-direction: column; gap: 10px; padding: 12px;
  border: 1px solid rgba(36, 131, 255, 0.28); border-radius: 4px;
  background: rgba(36, 131, 255, 0.05);
}
.effect-group h3 { margin: 0; font-size: 14px; font-weight: normal; color: #fff; }
.editing-hint, .performance-warning { margin: 0; font-size: 11px; line-height: 1.5; color: #edd892; }
.runtime-status { display: grid; gap: 4px; font-size: 11px; line-height: 1.45; color: #8fd9ff; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field-head { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.field-head label { flex: 1; }
.num, .hex, .select {
  box-sizing: border-box; height: 26px; padding: 2px 6px; text-align: right;
  color: #00deff; background: rgba(36, 131, 255, 0.12);
  border: 1px solid rgba(36, 131, 255, 0.4); border-radius: 3px; outline: none;
}
.num { width: 76px; }
.hex { width: 82px; font-family: monospace; }
.select { width: 82px; }
.checkbox { width: 18px; height: 18px; accent-color: #00deff; cursor: pointer; }
.color { width: 30px; height: 26px; padding: 1px; border: 1px solid rgba(36, 131, 255, 0.4); background: transparent; }
.slider { width: 100%; accent-color: #00deff; cursor: pointer; }
.json-out {
  box-sizing: border-box; max-height: 220px; margin: 0; padding: 10px;
  overflow: auto; user-select: text; white-space: pre; font-size: 11px; line-height: 1.45;
  color: #8fd9ff; background: rgba(0, 0, 0, 0.35);
  border: 1px dashed rgba(36, 131, 255, 0.4); border-radius: 4px;
}
.effect-actions { display: flex; gap: 8px; }
.group-actions { margin-top: 2px; }
.btn {
  flex: 1; padding: 8px 4px; font-size: 12px; font-family: 'OPPOSans-M'; cursor: pointer;
  color: #041020; background: linear-gradient(180deg, #00deff, #2483ff);
  border: none; border-radius: 4px;
}
.btn.ghost { color: #7fa8d9; background: transparent; border: 1px solid rgba(36, 131, 255, 0.5); }
.btn.ghost:hover { color: #00deff; border-color: #00deff; }
</style>
