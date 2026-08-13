import { computed, reactive, ref, watch } from 'vue'
import {
  MAP_EFFECT_DEFAULTS,
  assignMapEffectConfig,
  cloneMapEffectConfig,
  formatMapEffectConfig,
  normalizeMapEffectConfig,
  type MapEffectConfig
} from '@/components/map/mapEffectConfig'
import {
  MAP_HUD_DEFAULTS,
  assignMapHudConfig,
  cloneMapHudConfig,
  formatMapHudConfig,
  normalizeMapHudConfig,
  type MapHudConfig
} from '@/components/map/mapHudConfig'
import type { MapOutwardGlowPipelineStatus } from '@/components/map/mapOutwardGlowPipeline'
import { copyTextToClipboard } from '@/utils/copyText'

export type VisualSettingsPageId = 'composition' | 'effects' | 'charts' | 'hud' | 'engineering'
export type VisualWorkspaceMode = 'data' | 'visual'
export type VisualCopyKey = 'composition-css' | 'camera' | 'effect' | 'bars' | 'overlay' | 'hud'
export type VisualCopyStatus = 'idle' | 'success' | 'error'

export interface VisualSettingsPage {
  id: VisualSettingsPageId
  label: string
}

export interface MapLayout {
  left: number
  top: number
  width: number
  height: number
}

export interface MapEffectRuntimeStatus extends MapOutwardGlowPipelineStatus {
  mosaicState: 'disabled' | 'ready' | 'active' | 'degraded'
  degraded: boolean
}

export interface MapDistrictBarRuntimeStatus {
  renderedCount: number
  dataMin: number | null
  dataMax: number | null
  degraded: boolean
}

export const VISUAL_SETTINGS_PAGES: readonly VisualSettingsPage[] = [
  { id: 'composition', label: '构图与视角' },
  { id: 'effects', label: '地图效果' },
  { id: 'charts', label: '图表样式' },
  { id: 'hud', label: 'HUD' },
  { id: 'engineering', label: '工程信息' }
]

/** Home rendering and reset intentionally consume this single source of truth. */
export const MAP_LAYOUT_DEFAULT: Readonly<MapLayout> = {
  left: 24,
  top: 132,
  width: 1120,
  height: 948
}

export const MAP_CAMERA_DEFAULT = {
  pos: [-89.4, 117, 56.4],
  target: [2.7, -2.9, 7]
} as const

export const DEFAULT_CAMERA_VIEW = JSON.stringify(MAP_CAMERA_DEFAULT)

export const DEFAULT_MAP_EFFECT_RUNTIME_STATUS: MapEffectRuntimeStatus = {
  targetWidth: 1,
  targetHeight: 1,
  renderScale: 0.5,
  baseState: 'enabled',
  hoverState: 'ready',
  baseInwardState: 'active',
  hoverInwardState: 'ready',
  mosaicState: 'ready',
  degraded: false
}

export const DEFAULT_MAP_DISTRICT_BAR_RUNTIME_STATUS: MapDistrictBarRuntimeStatus = {
  renderedCount: 0,
  dataMin: null,
  dataMax: null,
  degraded: false
}

const workspaceMode = ref<VisualWorkspaceMode>('data')
const activeVisualPage = ref<VisualSettingsPageId>('composition')
const layout = reactive<MapLayout>({ ...MAP_LAYOUT_DEFAULT })
const effect = reactive<MapEffectConfig>(cloneMapEffectConfig(MAP_EFFECT_DEFAULTS))
const hud = reactive<MapHudConfig>(cloneMapHudConfig(MAP_HUD_DEFAULTS))
const effectDraft = reactive<MapEffectConfig>(cloneMapEffectConfig(effect))
const hudDraft = reactive<MapHudConfig>(cloneMapHudConfig(hud))
const effectLivePreview = ref(true)
const hudLivePreview = ref(true)
const effectRuntimeStatus = reactive<MapEffectRuntimeStatus>({ ...DEFAULT_MAP_EFFECT_RUNTIME_STATUS })
const districtBarRuntimeStatus = reactive<MapDistrictBarRuntimeStatus>({
  ...DEFAULT_MAP_DISTRICT_BAR_RUNTIME_STATUS
})
const cameraView = ref(DEFAULT_CAMERA_VIEW)
const fps = ref(0)
const numericDrafts = reactive<Record<string, string>>({})
const committedNumericDrafts = new Map<string, string>()
const copyFeedback = reactive<Record<VisualCopyKey, VisualCopyStatus>>({
  'composition-css': 'idle',
  camera: 'idle',
  effect: 'idle',
  bars: 'idle',
  overlay: 'idle',
  hud: 'idle'
})
const copyRequests = new Map<VisualCopyKey, number>()
const copyTimers = new Map<VisualCopyKey, ReturnType<typeof setTimeout>>()
let applyingEffectDraft = false
let applyingHudDraft = false

const effectEditTarget = computed(() => effectLivePreview.value ? effect : effectDraft)
const hudEditTarget = computed(() => hudLivePreview.value ? hud : hudDraft)
const effectJson = computed(() => formatMapEffectConfig(effect))
const editableEffectJson = computed(() => formatMapEffectConfig(effectEditTarget.value))
const hudJson = computed(() => formatMapHudConfig(hud))
const editableHudJson = computed(() => formatMapHudConfig(hudEditTarget.value))
const compositionCss = computed(() =>
  `.pos-map { left: ${layout.left}px; top: ${layout.top}px; width: ${layout.width}px; height: ${layout.height}px; }`
)
const effectDirty = computed(() => formatMapEffectConfig(effectDraft) !== formatMapEffectConfig(effect))
const hudDirty = computed(() => formatMapHudConfig(hudDraft) !== formatMapHudConfig(hud))
const visualDirty = computed(() =>
  layout.left !== MAP_LAYOUT_DEFAULT.left
  || layout.top !== MAP_LAYOUT_DEFAULT.top
  || layout.width !== MAP_LAYOUT_DEFAULT.width
  || layout.height !== MAP_LAYOUT_DEFAULT.height
  || effectJson.value !== formatMapEffectConfig(MAP_EFFECT_DEFAULTS)
  || hudJson.value !== formatMapHudConfig(MAP_HUD_DEFAULTS)
)

const compositionWarnings = computed<string[]>(() => {
  const warnings: string[] = []
  const right = layout.left + layout.width
  const bottom = layout.top + layout.height
  if (layout.left < 0 || layout.top < 0 || right > 1920 || bottom > 1080) {
    warnings.push('地图超出 1920×1080 设计视口')
  }
  const sidebar = { left: 1176, top: 24, right: 1896, bottom: 1056 }
  const overlapsSidebar = layout.left < sidebar.right
    && right > sidebar.left
    && layout.top < sidebar.bottom
    && bottom > sidebar.top
  if (overlapsSidebar) warnings.push('地图与右侧设置栏发生重叠')
  return warnings
})

watch(effect, (value) => {
  assignMapEffectConfig(effect, normalizeMapEffectConfig(value))
}, { deep: true })

watch(hud, (value) => {
  assignMapHudConfig(hud, normalizeMapHudConfig(value))
}, { deep: true })

watch(effect, () => {
  if (!effectLivePreview.value && !applyingEffectDraft) syncEffectDraft(effect)
}, { deep: true, flush: 'sync' })

watch(hud, () => {
  if (!hudLivePreview.value && !applyingHudDraft) syncHudDraft(hud)
}, { deep: true, flush: 'sync' })

function syncEffectDraft(source: Readonly<MapEffectConfig> = effect): void {
  assignMapEffectConfig(effectDraft, cloneMapEffectConfig(source))
}

function syncHudDraft(source: Readonly<MapHudConfig> = hud): void {
  assignMapHudConfig(hudDraft, cloneMapHudConfig(source))
}

function setEffectLivePreview(next: boolean): void {
  syncEffectDraft(effect)
  effectLivePreview.value = next
}

function setHudLivePreview(next: boolean): void {
  syncHudDraft(hud)
  hudLivePreview.value = next
}

function applyEffectDraft(): void {
  const normalized = normalizeMapEffectConfig(effectDraft)
  applyingEffectDraft = true
  assignMapEffectConfig(effect, normalized)
  applyingEffectDraft = false
  syncEffectDraft(normalized)
}

function discardEffectDraft(): void {
  syncEffectDraft(effect)
}

function applyHudDraft(): void {
  const normalized = normalizeMapHudConfig(hudDraft)
  applyingHudDraft = true
  assignMapHudConfig(hud, normalized)
  applyingHudDraft = false
  syncHudDraft(normalized)
}

function discardHudDraft(): void {
  syncHudDraft(hud)
}

function resetLayout(): void {
  Object.assign(layout, MAP_LAYOUT_DEFAULT)
  for (const key of Object.keys(MAP_LAYOUT_DEFAULT) as Array<keyof MapLayout>) {
    syncNumericDraft(`layout.${key}`, layout[key])
  }
}

function resetEffect(): void {
  assignMapEffectConfig(effect, cloneMapEffectConfig(MAP_EFFECT_DEFAULTS))
  syncEffectDraft(effect)
}

function resetHud(): void {
  assignMapHudConfig(hud, cloneMapHudConfig(MAP_HUD_DEFAULTS))
  syncHudDraft(hud)
}

const LAYOUT_LIMITS: Record<keyof MapLayout, { min: number; max: number }> = {
  left: { min: -1920, max: 1920 },
  top: { min: -1080, max: 1080 },
  width: { min: 200, max: 1920 },
  height: { min: 200, max: 1080 }
}

function readNumericDraft(key: string, fallback: number): string {
  return numericDrafts[key] ?? String(fallback)
}

function editNumericDraft(key: string, raw: string): void {
  numericDrafts[key] = raw
  committedNumericDrafts.delete(key)
}

function syncNumericDraft(key: string, value: number): void {
  const normalized = String(value)
  numericDrafts[key] = normalized
  if (committedNumericDrafts.get(key) !== normalized) committedNumericDrafts.delete(key)
}

function commitNumericDraft(
  key: string,
  raw: string,
  current: number,
  normalize: (value: number) => number
): { value: number; changed: boolean } {
  const parsed = raw.trim() === '' ? Number.NaN : Number(raw)
  if (!Number.isFinite(parsed)) {
    syncNumericDraft(key, current)
    return { value: current, changed: false }
  }
  const value = normalize(parsed)
  const normalized = String(value)
  numericDrafts[key] = normalized
  const changed = committedNumericDrafts.get(key) !== normalized && value !== current
  if (changed) committedNumericDrafts.set(key, normalized)
  return { value, changed }
}

function commitLayoutField(key: keyof MapLayout, raw: string): number {
  const limits = LAYOUT_LIMITS[key]
  const result = commitNumericDraft(
    `layout.${key}`,
    raw,
    layout[key],
    (value) => Math.round(Math.min(limits.max, Math.max(limits.min, value)))
  )
  if (result.changed) layout[key] = result.value
  return result.value
}

async function copyVisualText(key: VisualCopyKey, value: string): Promise<boolean> {
  const request = (copyRequests.get(key) ?? 0) + 1
  copyRequests.set(key, request)
  const success = await copyTextToClipboard(value)
  if (copyRequests.get(key) !== request) return success
  copyFeedback[key] = success ? 'success' : 'error'
  const previousTimer = copyTimers.get(key)
  if (previousTimer) clearTimeout(previousTimer)
  copyTimers.set(key, setTimeout(() => {
    if (copyRequests.get(key) === request) copyFeedback[key] = 'idle'
  }, 1500))
  return success
}

function copyLabel(key: VisualCopyKey, idleLabel: string): string {
  if (copyFeedback[key] === 'success') return '已复制 ✓'
  if (copyFeedback[key] === 'error') return '复制失败，请重试'
  return idleLabel
}

function updateCameraView(next: string): void {
  cameraView.value = next || DEFAULT_CAMERA_VIEW
}

function updateFps(next: number): void {
  if (!Number.isFinite(next)) return
  fps.value = Math.max(0, Math.round(next))
}

function sameEffectRuntimeStatus(next: MapEffectRuntimeStatus): boolean {
  return next.targetWidth === effectRuntimeStatus.targetWidth
    && next.targetHeight === effectRuntimeStatus.targetHeight
    && next.renderScale === effectRuntimeStatus.renderScale
    && next.baseState === effectRuntimeStatus.baseState
    && next.hoverState === effectRuntimeStatus.hoverState
    && next.baseInwardState === effectRuntimeStatus.baseInwardState
    && next.hoverInwardState === effectRuntimeStatus.hoverInwardState
    && next.mosaicState === effectRuntimeStatus.mosaicState
    && next.degraded === effectRuntimeStatus.degraded
}

function updateEffectRuntimeStatus(next: MapEffectRuntimeStatus): boolean {
  if (sameEffectRuntimeStatus(next)) return false
  Object.assign(effectRuntimeStatus, next)
  return true
}

function updateDistrictBarRuntimeStatus(next: MapDistrictBarRuntimeStatus): boolean {
  if (
    next.renderedCount === districtBarRuntimeStatus.renderedCount
    && next.dataMin === districtBarRuntimeStatus.dataMin
    && next.dataMax === districtBarRuntimeStatus.dataMax
    && next.degraded === districtBarRuntimeStatus.degraded
  ) return false
  Object.assign(districtBarRuntimeStatus, next)
  return true
}

function resetVisualSession(): void {
  workspaceMode.value = 'data'
  activeVisualPage.value = 'composition'
  effectLivePreview.value = true
  hudLivePreview.value = true
  resetLayout()
  resetEffect()
  resetHud()
  Object.assign(effectRuntimeStatus, DEFAULT_MAP_EFFECT_RUNTIME_STATUS)
  Object.assign(districtBarRuntimeStatus, DEFAULT_MAP_DISTRICT_BAR_RUNTIME_STATUS)
  cameraView.value = DEFAULT_CAMERA_VIEW
  fps.value = 0
  for (const key of Object.keys(numericDrafts)) delete numericDrafts[key]
  committedNumericDrafts.clear()
  for (const key of Object.keys(copyFeedback) as VisualCopyKey[]) copyFeedback[key] = 'idle'
}

export function useMapVisualSettings() {
  return {
    workspaceMode,
    activeVisualPage,
    layout,
    effect,
    effectDraft,
    effectEditTarget,
    effectLivePreview,
    effectDirty,
    effectJson,
    editableEffectJson,
    hud,
    hudDraft,
    hudEditTarget,
    hudLivePreview,
    hudDirty,
    hudJson,
    editableHudJson,
    visualDirty,
    effectRuntimeStatus,
    districtBarRuntimeStatus,
    cameraView,
    fps,
    compositionCss,
    compositionWarnings,
    numericDrafts,
    copyFeedback,
    setEffectLivePreview,
    applyEffectDraft,
    discardEffectDraft,
    setHudLivePreview,
    applyHudDraft,
    discardHudDraft,
    resetLayout,
    resetEffect,
    resetHud,
    resetVisualSession,
    readNumericDraft,
    editNumericDraft,
    syncNumericDraft,
    commitNumericDraft,
    commitLayoutField,
    copyVisualText,
    copyLabel,
    updateCameraView,
    updateFps,
    updateEffectRuntimeStatus,
    updateDistrictBarRuntimeStatus
  }
}
