import { computed, reactive, ref, watch } from 'vue'
import {
  B3_GLOW_PROFILE_DEFAULTS,
  MAP_EFFECT_DEFAULTS,
  assignMapEffectConfig,
  cloneMapEffectConfig,
  formatMapEffectConfig,
  normalizeMapEffectConfig,
  type MapEffectBaseConfigV4,
  type MapEffectConfig,
  type MapEffectHoverConfigV4,
  type MapEffectQualityConfig
} from '@/components/map/mapEffectConfig'
import {
  MAP_DISTRICT_BAR_DEFAULTS,
  cloneDistrictBarConfig,
  normalizeDistrictBarConfig,
  type MapDistrictBarConfig
} from '@/components/map/mapDistrictBarConfig'
import {
  MAP_DISTRICT_BAR_OVERLAY_DEFAULTS,
  cloneDistrictBarOverlayConfig,
  normalizeDistrictBarOverlayConfig,
  type MapDistrictBarBadgeOverlayConfig,
  type MapDistrictBarOverlayCollisionConfig,
  type MapDistrictBarOverlayConfig,
  type MapDistrictBarPanelOverlayConfig
} from '@/components/map/mapDistrictBarOverlayConfig'
import {
  BASE_INWARD_GLOW_DEFAULTS,
  HOVER_INWARD_GLOW_DEFAULTS,
  cloneInwardGlowConfig,
  type MapInwardGlowConfig
} from '@/components/map/mapInwardGlowConfig'
import {
  BLUE_PURPLE_MOSAIC_PARTICLE_PRESET,
  HOVER_MOSAIC_PARTICLE_DEFAULTS,
  cloneMosaicParticleConfig,
  type MapMosaicParticleConfig
} from '@/components/map/mapMosaicParticleConfig'
import {
  MAP_HUD_DEFAULTS,
  assignMapHudConfig,
  cloneMapHudConfig,
  formatMapHudConfig,
  normalizeMapHudConfig,
  type MapHudAnchorConfig,
  type MapHudConfig,
  type MapHudRotatingLayerConfig,
  type MapHudStaticLayerConfig
} from '@/components/map/mapHudConfig'
import type { MapOutwardGlowPipelineStatus } from '@/components/map/mapOutwardGlowPipeline'
import {
  DEFAULT_BACKGROUND_LAYERS,
  createBackgroundLayerVisibility,
  createDefaultBackgroundLayerRecord,
  type DefaultBackgroundLayerId
} from '@/components/map/defaultBackgroundLayers'
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

export interface MapLayoutFieldBounds {
  rangeMin: number
  rangeMax: number
  safetyMin?: number
}

export interface BackgroundLayerImageUpdateResult {
  ok: boolean
  message: string
}

export interface BackgroundLayerImageSource {
  url: string
  filename: string
  custom: boolean
}

export const MAP_LAYOUT_FIELD_BOUNDS: Readonly<Record<keyof MapLayout, MapLayoutFieldBounds>> = {
  left: { rangeMin: -1920, rangeMax: 1920 },
  top: { rangeMin: -1080, rangeMax: 1080 },
  width: { rangeMin: 200, rangeMax: 1920, safetyMin: 200 },
  height: { rangeMin: 200, rangeMax: 1080, safetyMin: 200 }
}

export const MAX_BACKGROUND_IMAGE_BYTES = 25 * 1024 * 1024
const SUPPORTED_BACKGROUND_IMAGE_NAME = /\.(?:png|jpe?g|webp|gif|avif)$/i

export interface MapEffectRuntimeStatus extends MapOutwardGlowPipelineStatus {
  mosaicState: 'disabled' | 'ready' | 'active' | 'degraded'
  degraded: boolean
}

export interface RegionBarRuntimeStatus {
  renderedCount: number
  dataMin: number | null
  dataMax: number | null
  degraded: boolean
}

type NumericKey<T> = {
  [Key in keyof T]-?: T[Key] extends number ? Key : never
}[keyof T] & string

export type VisualNumericFieldId =
  | `layout.${keyof MapLayout}`
  | `effect.base.${NumericKey<MapEffectBaseConfigV4>}`
  | `effect.base.inwardGlow.${NumericKey<MapInwardGlowConfig>}`
  | `effect.hover.${NumericKey<MapEffectHoverConfigV4>}`
  | `effect.hover.inwardGlow.${NumericKey<MapInwardGlowConfig>}`
  | `effect.hover.mosaicParticles.${NumericKey<MapMosaicParticleConfig>}`
  | `effect.quality.${NumericKey<MapEffectQualityConfig>}`
  | `bars.${NumericKey<MapDistrictBarConfig>}`
  | `bars.overlay.badge.${NumericKey<MapDistrictBarBadgeOverlayConfig>}`
  | `bars.overlay.panel.${NumericKey<MapDistrictBarPanelOverlayConfig>}`
  | `bars.overlay.collision.${NumericKey<MapDistrictBarOverlayCollisionConfig>}`
  | `hud.anchor.${NumericKey<MapHudAnchorConfig>}`
  | `hud.static.${NumericKey<MapHudStaticLayerConfig>}`
  | `hud.rotating.${NumericKey<MapHudRotatingLayerConfig>}`

export interface VisualNumericConstraint {
  min?: number
  max?: number
  step?: number
}

export interface VisualNumericField {
  readonly id: VisualNumericFieldId
  read(fallback: number): string
  edit(raw: string): void
  sync(value: number): void
  commit(
    raw: string,
    current: number,
    constraint?: Readonly<VisualNumericConstraint>
  ): { value: number; changed: boolean }
}

export type EffectGlowChannel = 'base' | 'hover'
type ConfigFieldUpdate<Section extends string, Config> = {
  [Key in keyof Config]: { section: Section; key: Key; value: Config[Key] }
}[keyof Config]
export type HudFieldUpdate =
  | ConfigFieldUpdate<'anchor', MapHudAnchorConfig>
  | ConfigFieldUpdate<'static', MapHudStaticLayerConfig>
  | ConfigFieldUpdate<'rotating', MapHudRotatingLayerConfig>

export const VISUAL_SETTINGS_PAGES: readonly VisualSettingsPage[] = [
  { id: 'composition', label: '构图与视角' },
  { id: 'effects', label: '地图效果' },
  { id: 'charts', label: '图表样式' },
  { id: 'hud', label: 'HUD' },
  { id: 'engineering', label: '工程信息' }
]

/** Home rendering and reset intentionally consume this single source of truth. */
export const MAP_LAYOUT_DEFAULT: Readonly<MapLayout> = {
  left: 0,
  top: 0,
  width: 1280,
  height: 1080
}

export const MAP_CAMERA_DEFAULT = {
  pos: [-19.3, 146.5, 97.9],
  target: [6.5, -2.5, 7.4]
} as const

export const DEFAULT_CAMERA_VIEW = JSON.stringify(MAP_CAMERA_DEFAULT)
export const DEFAULT_FPS_VISIBLE = true

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

export const DEFAULT_REGION_BAR_RUNTIME_STATUS: RegionBarRuntimeStatus = {
  renderedCount: 0,
  dataMin: null,
  dataMax: null,
  degraded: false
}

const workspaceMode = ref<VisualWorkspaceMode>('data')
const activeVisualPage = ref<VisualSettingsPageId>('composition')
const sidebarCollapsed = ref(false)
const layout = reactive<MapLayout>({ ...MAP_LAYOUT_DEFAULT })
const backgroundLayerVisibility = reactive(createBackgroundLayerVisibility())
const backgroundLayerOverrides = reactive<Partial<Record<DefaultBackgroundLayerId, {
  url: string
  filename: string
}>>>({})
const backgroundLayerErrors = reactive(createDefaultBackgroundLayerRecord(() => ''))
const backgroundLayerRequestIds = createDefaultBackgroundLayerRecord(() => 0)
const effect = reactive<MapEffectConfig>(cloneMapEffectConfig(MAP_EFFECT_DEFAULTS))
const hud = reactive<MapHudConfig>(cloneMapHudConfig(MAP_HUD_DEFAULTS))
const effectDraft = reactive<MapEffectConfig>(cloneMapEffectConfig(effect))
const hudDraft = reactive<MapHudConfig>(cloneMapHudConfig(hud))
const effectLivePreview = ref(true)
const hudLivePreview = ref(true)
const effectRuntimeStatus = reactive<MapEffectRuntimeStatus>({ ...DEFAULT_MAP_EFFECT_RUNTIME_STATUS })
const regionBarRuntimeStatus = reactive<RegionBarRuntimeStatus>({
  ...DEFAULT_REGION_BAR_RUNTIME_STATUS
})
const cameraView = ref(DEFAULT_CAMERA_VIEW)
const fps = ref(0)
const fpsVisible = ref(DEFAULT_FPS_VISIBLE)
const numericDrafts = reactive<Partial<Record<VisualNumericFieldId, string>>>({})
const committedNumericDrafts = new Map<VisualNumericFieldId, string>()
const numericFieldBindings = new Map<VisualNumericFieldId, VisualNumericField>()
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
let lastEffectiveEffect = cloneMapEffectConfig(effect)
let lastEffectiveHud = cloneMapHudConfig(hud)

const effectEditTarget = computed(() => effectLivePreview.value ? effect : effectDraft)
const hudEditTarget = computed(() => hudLivePreview.value ? hud : hudDraft)
const effectJson = computed(() => formatMapEffectConfig(effect))
const editableEffectJson = computed(() => formatMapEffectConfig(effectEditTarget.value))
const hudJson = computed(() => formatMapHudConfig(hud))
const editableHudJson = computed(() => formatMapHudConfig(hudEditTarget.value))
const regionBarJson = computed(() => JSON.stringify(normalizeDistrictBarConfig(effect.bars), null, 2))
const regionOverlayJson = computed(() => JSON.stringify(
  normalizeDistrictBarOverlayConfig(effect.bars.overlay),
  null,
  2
))
const effectiveMapLayout = computed<MapLayout>(() => {
  if (!sidebarCollapsed.value) return { ...layout }
  return {
    left: (1920 - layout.width) / 2,
    top: (1080 - layout.height) / 2,
    width: layout.width,
    height: layout.height
  }
})
const backgroundLayerSources = computed<Record<DefaultBackgroundLayerId, BackgroundLayerImageSource>>(
  () => createDefaultBackgroundLayerRecord((layer) => {
    const override = backgroundLayerOverrides[layer.id]
    return override
      ? { ...override, custom: true }
      : { url: layer.url, filename: layer.filename, custom: false }
  })
)
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
  || DEFAULT_BACKGROUND_LAYERS.some(
    (layer) => backgroundLayerVisibility[layer.id] !== layer.defaultVisible
  )
  || Object.keys(backgroundLayerOverrides).length > 0
  || fpsVisible.value !== DEFAULT_FPS_VISIBLE
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
  if (!effectLivePreview.value) mergeCleanDraftLeaves(
    effectDraft as unknown as Record<string, unknown>,
    value as unknown as Readonly<Record<string, unknown>>,
    lastEffectiveEffect as unknown as Readonly<Record<string, unknown>>
  )
  lastEffectiveEffect = cloneMapEffectConfig(value)
}, { deep: true })

watch(hud, (value) => {
  assignMapHudConfig(hud, normalizeMapHudConfig(value))
  if (!hudLivePreview.value) mergeCleanDraftLeaves(
    hudDraft as unknown as Record<string, unknown>,
    value as unknown as Readonly<Record<string, unknown>>,
    lastEffectiveHud as unknown as Readonly<Record<string, unknown>>
  )
  lastEffectiveHud = cloneMapHudConfig(value)
}, { deep: true })

function mergeCleanDraftLeaves(
  draftValue: Record<string, unknown>,
  nextValue: Readonly<Record<string, unknown>>,
  previousValue: Readonly<Record<string, unknown>>
): void {
  for (const key of Object.keys(nextValue)) {
    const draftChild = draftValue[key]
    const nextChild = nextValue[key]
    const previousChild = previousValue[key]
    if (
      draftChild !== null
      && nextChild !== null
      && previousChild !== null
      && typeof draftChild === 'object'
      && typeof nextChild === 'object'
      && typeof previousChild === 'object'
    ) {
      mergeCleanDraftLeaves(
        draftChild as Record<string, unknown>,
        nextChild as Readonly<Record<string, unknown>>,
        previousChild as Readonly<Record<string, unknown>>
      )
    } else if (Object.is(draftChild, previousChild)) {
      draftValue[key] = nextChild
    }
  }
}

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
  assignMapEffectConfig(effect, normalized)
  syncEffectDraft(normalized)
}

function discardEffectDraft(): void {
  syncEffectDraft(effect)
}

function applyHudDraft(): void {
  const normalized = normalizeMapHudConfig(hudDraft)
  assignMapHudConfig(hud, normalized)
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

function setSidebarCollapsed(next: boolean): void {
  sidebarCollapsed.value = next
}

function toggleSidebar(): void {
  setSidebarCollapsed(!sidebarCollapsed.value)
}

function setBackgroundLayerVisibility(
  layer: DefaultBackgroundLayerId,
  visible: boolean
): void {
  backgroundLayerVisibility[layer] = visible
}

function isSupportedBackgroundImage(file: File): boolean {
  return [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'image/avif'
  ].includes(file.type) || SUPPORTED_BACKGROUND_IMAGE_NAME.test(file.name)
}

function decodeBackgroundImage(url: string): Promise<void> {
  const image = new Image()
  return new Promise((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error('background image decode failed'))
    image.src = url
    if (typeof image.decode === 'function') image.decode().then(resolve, reject)
  })
}

async function replaceBackgroundLayerImage(
  layer: DefaultBackgroundLayerId,
  file: File
): Promise<BackgroundLayerImageUpdateResult> {
  const requestId = ++backgroundLayerRequestIds[layer]
  if (!isSupportedBackgroundImage(file)) {
    const message = '请选择 PNG、JPEG、WebP、GIF 或 AVIF 图片'
    backgroundLayerErrors[layer] = message
    return { ok: false, message }
  }
  if (file.size > MAX_BACKGROUND_IMAGE_BYTES) {
    const message = '背景图片不能超过 25 MB'
    backgroundLayerErrors[layer] = message
    return { ok: false, message }
  }
  let nextUrl = ''
  try {
    nextUrl = URL.createObjectURL(file)
    await decodeBackgroundImage(nextUrl)
    if (requestId !== backgroundLayerRequestIds[layer]) {
      URL.revokeObjectURL(nextUrl)
      return { ok: false, message: '' }
    }
    const previousUrl = backgroundLayerOverrides[layer]?.url
    backgroundLayerOverrides[layer] = { url: nextUrl, filename: file.name }
    backgroundLayerErrors[layer] = ''
    if (previousUrl) URL.revokeObjectURL(previousUrl)
    return { ok: true, message: '' }
  } catch {
    if (nextUrl) URL.revokeObjectURL(nextUrl)
    if (requestId !== backgroundLayerRequestIds[layer]) return { ok: false, message: '' }
    const message = '无法读取背景图片，请重新选择文件'
    backgroundLayerErrors[layer] = message
    return { ok: false, message }
  }
}

function resetBackgroundLayerImage(layer: DefaultBackgroundLayerId): void {
  backgroundLayerRequestIds[layer] += 1
  const override = backgroundLayerOverrides[layer]
  if (override) URL.revokeObjectURL(override.url)
  delete backgroundLayerOverrides[layer]
  backgroundLayerErrors[layer] = ''
}

function resetBackgroundLayerImages(): void {
  for (const layer of DEFAULT_BACKGROUND_LAYERS) resetBackgroundLayerImage(layer.id)
}

function resetEffect(): void {
  assignMapEffectConfig(effect, cloneMapEffectConfig(MAP_EFFECT_DEFAULTS))
  syncEffectDraft(effect)
}

function resetHud(): void {
  assignMapHudConfig(hud, cloneMapHudConfig(MAP_HUD_DEFAULTS))
  syncHudDraft(hud)
}

function readNumericDraft(key: VisualNumericFieldId, fallback: number): string {
  return numericDrafts[key] ?? String(fallback)
}

function editNumericDraft(key: VisualNumericFieldId, raw: string): void {
  numericDrafts[key] = raw
  committedNumericDrafts.delete(key)
}

function syncNumericDraft(key: VisualNumericFieldId, value: number): void {
  const normalized = String(value)
  numericDrafts[key] = normalized
  if (committedNumericDrafts.get(key) !== normalized) committedNumericDrafts.delete(key)
}

function commitNumericDraft(
  key: VisualNumericFieldId,
  raw: string,
  current: number,
  constraint: Readonly<VisualNumericConstraint> = {}
): { value: number; changed: boolean } {
  const parsed = raw.trim() === '' ? Number.NaN : Number(raw)
  if (!Number.isFinite(parsed)) {
    syncNumericDraft(key, current)
    return { value: current, changed: false }
  }
  let value = parsed
  if (constraint.min !== undefined) value = Math.max(constraint.min, value)
  if (constraint.max !== undefined) value = Math.min(constraint.max, value)
  if (constraint.step !== undefined) {
    const precision = (String(constraint.step).split('.')[1] ?? '').length
    value = Number((Math.round(value / constraint.step) * constraint.step).toFixed(precision))
  }
  const normalized = String(value)
  numericDrafts[key] = normalized
  const changed = committedNumericDrafts.get(key) !== normalized && value !== current
  if (changed) committedNumericDrafts.set(key, normalized)
  return { value, changed }
}

function numericField(id: VisualNumericFieldId): VisualNumericField {
  const existing = numericFieldBindings.get(id)
  if (existing) return existing
  const field: VisualNumericField = {
    id,
    read: (fallback) => readNumericDraft(id, fallback),
    edit: (raw) => editNumericDraft(id, raw),
    sync: (value) => syncNumericDraft(id, value),
    commit: (raw, current, constraint) => commitNumericDraft(id, raw, current, constraint)
  }
  numericFieldBindings.set(id, field)
  return field
}

function commitLayoutField(key: keyof MapLayout, raw: string): number {
  const constraint: VisualNumericConstraint = {
    min: MAP_LAYOUT_FIELD_BOUNDS[key].safetyMin,
    step: 1
  }
  const result = numericField(`layout.${key}`).commit(raw, layout[key], constraint)
  if (result.changed) layout[key] = result.value
  return result.value
}

type EffectBaseFieldKey = Exclude<keyof MapEffectBaseConfigV4, 'inwardGlow'>
type EffectHoverFieldKey = Exclude<keyof MapEffectHoverConfigV4, 'inwardGlow' | 'mosaicParticles'>

function assignEditableEffect(candidate: Readonly<MapEffectConfig>): void {
  assignMapEffectConfig(effectEditTarget.value, normalizeMapEffectConfig(candidate))
}

function updateEditableEffect(update: (candidate: MapEffectConfig) => void): void {
  const candidate = cloneMapEffectConfig(effectEditTarget.value)
  update(candidate)
  assignEditableEffect(candidate)
}

function setEffectBaseField<Key extends EffectBaseFieldKey>(
  key: Key,
  value: MapEffectBaseConfigV4[Key]
): void {
  updateEditableEffect((candidate) => {
    candidate.base[key] = value
  })
}

function setEffectHoverField<Key extends EffectHoverFieldKey>(
  key: Key,
  value: MapEffectHoverConfigV4[Key]
): void {
  updateEditableEffect((candidate) => {
    candidate.hover[key] = value
  })
}

function setEffectQualityField<Key extends keyof MapEffectQualityConfig>(
  key: Key,
  value: MapEffectQualityConfig[Key]
): void {
  updateEditableEffect((candidate) => {
    candidate.quality[key] = value
  })
}

function replaceEffectInwardGlow(
  channel: EffectGlowChannel,
  value: Readonly<MapInwardGlowConfig>
): void {
  updateEditableEffect((candidate) => {
    candidate[channel].inwardGlow = cloneInwardGlowConfig(value)
  })
}

function applyEffectInwardPreset(channel: EffectGlowChannel): void {
  replaceEffectInwardGlow(
    channel,
    channel === 'base' ? BASE_INWARD_GLOW_DEFAULTS : HOVER_INWARD_GLOW_DEFAULTS
  )
}

function replaceEffectMosaicParticles(value: Readonly<MapMosaicParticleConfig>): void {
  updateEditableEffect((candidate) => {
    candidate.hover.mosaicParticles = cloneMosaicParticleConfig(value)
  })
}

function applyEffectMosaicPreset(): void {
  replaceEffectMosaicParticles(BLUE_PURPLE_MOSAIC_PARTICLE_PRESET)
}

function randomizeEffectMosaicSeed(): void {
  updateEditableEffect((candidate) => {
    candidate.hover.mosaicParticles.seed = Math.floor(Math.random() * 10000)
  })
}

function resetEffectMosaicParticles(): void {
  replaceEffectMosaicParticles(HOVER_MOSAIC_PARTICLE_DEFAULTS)
}

function applyEffectB3Preset(channel: EffectGlowChannel): void {
  updateEditableEffect((candidate) => {
    if (channel === 'base') {
      candidate.base.outerGlowNearRadiusRatio = B3_GLOW_PROFILE_DEFAULTS.nearRadiusRatio
      candidate.base.outerGlowNearOpacityRatio = B3_GLOW_PROFILE_DEFAULTS.nearOpacityRatio
      candidate.base.outerGlowFarRadiusRatio = B3_GLOW_PROFILE_DEFAULTS.farRadiusRatio
      candidate.base.outerGlowFarOpacityRatio = B3_GLOW_PROFILE_DEFAULTS.farOpacityRatio
      candidate.base.outerGlowFalloff = B3_GLOW_PROFILE_DEFAULTS.falloff
      candidate.base.outerGlowEdgeSoftness = B3_GLOW_PROFILE_DEFAULTS.edgeSoftness
      candidate.base.outerGlowNearPasses = B3_GLOW_PROFILE_DEFAULTS.nearPasses
      candidate.base.outerGlowFarPasses = B3_GLOW_PROFILE_DEFAULTS.farPasses
      return
    }
    candidate.hover.glowNearRadiusRatio = B3_GLOW_PROFILE_DEFAULTS.nearRadiusRatio
    candidate.hover.glowNearOpacityRatio = B3_GLOW_PROFILE_DEFAULTS.nearOpacityRatio
    candidate.hover.glowFarRadiusRatio = B3_GLOW_PROFILE_DEFAULTS.farRadiusRatio
    candidate.hover.glowFarOpacityRatio = B3_GLOW_PROFILE_DEFAULTS.farOpacityRatio
    candidate.hover.glowFalloff = B3_GLOW_PROFILE_DEFAULTS.falloff
    candidate.hover.glowEdgeSoftness = B3_GLOW_PROFILE_DEFAULTS.edgeSoftness
    candidate.hover.glowNearPasses = B3_GLOW_PROFILE_DEFAULTS.nearPasses
    candidate.hover.glowFarPasses = B3_GLOW_PROFILE_DEFAULTS.farPasses
  })
}

function resetEffectGlowGroup(channel: EffectGlowChannel): void {
  updateEditableEffect((candidate) => {
    if (channel === 'base') {
      const defaults = MAP_EFFECT_DEFAULTS.base
      candidate.base.outerGlowEnabled = defaults.outerGlowEnabled
      candidate.base.outerGlowColor = defaults.outerGlowColor
      candidate.base.outerGlowWidth = defaults.outerGlowWidth
      candidate.base.outerGlowStrength = defaults.outerGlowStrength
      candidate.base.outerGlowNearRadiusRatio = defaults.outerGlowNearRadiusRatio
      candidate.base.outerGlowNearOpacityRatio = defaults.outerGlowNearOpacityRatio
      candidate.base.outerGlowFarRadiusRatio = defaults.outerGlowFarRadiusRatio
      candidate.base.outerGlowFarOpacityRatio = defaults.outerGlowFarOpacityRatio
      candidate.base.outerGlowFalloff = defaults.outerGlowFalloff
      candidate.base.outerGlowEdgeSoftness = defaults.outerGlowEdgeSoftness
      candidate.base.outerGlowNearPasses = defaults.outerGlowNearPasses
      candidate.base.outerGlowFarPasses = defaults.outerGlowFarPasses
      return
    }
    const defaults = MAP_EFFECT_DEFAULTS.hover
    candidate.hover.glowEnabled = defaults.glowEnabled
    candidate.hover.glowColor = defaults.glowColor
    candidate.hover.glowWidth = defaults.glowWidth
    candidate.hover.glowStrength = defaults.glowStrength
    candidate.hover.glowNearRadiusRatio = defaults.glowNearRadiusRatio
    candidate.hover.glowNearOpacityRatio = defaults.glowNearOpacityRatio
    candidate.hover.glowFarRadiusRatio = defaults.glowFarRadiusRatio
    candidate.hover.glowFarOpacityRatio = defaults.glowFarOpacityRatio
    candidate.hover.glowFalloff = defaults.glowFalloff
    candidate.hover.glowEdgeSoftness = defaults.glowEdgeSoftness
    candidate.hover.glowNearPasses = defaults.glowNearPasses
    candidate.hover.glowFarPasses = defaults.glowFarPasses
  })
}

function resetEditableEffect(): void {
  assignEditableEffect(MAP_EFFECT_DEFAULTS)
}

function assignOverlay(
  target: MapDistrictBarOverlayConfig,
  source: Readonly<MapDistrictBarOverlayConfig>
): void {
  target.enabled = source.enabled
  Object.assign(target.badge, source.badge)
  Object.assign(target.panel, source.panel)
  Object.assign(target.collision, source.collision)
}

function assignRegionBars(target: MapDistrictBarConfig, source: Readonly<MapDistrictBarConfig>): void {
  const { overlay, ...barFields } = source
  Object.assign(target, barFields)
  assignOverlay(target.overlay, overlay)
}

function syncBarsAcrossEffectDrafts(value: Readonly<MapDistrictBarConfig>): void {
  assignRegionBars(effect.bars, value)
  if (!effectLivePreview.value) assignRegionBars(effectDraft.bars, value)
}

function replaceRegionBars(value: Readonly<MapDistrictBarConfig>): void {
  syncBarsAcrossEffectDrafts(normalizeDistrictBarConfig(value))
}

function resetRegionBars(): void {
  replaceRegionBars(cloneDistrictBarConfig(MAP_DISTRICT_BAR_DEFAULTS))
}

function replaceRegionOverlay(value: Readonly<MapDistrictBarOverlayConfig>): void {
  const normalized = normalizeDistrictBarOverlayConfig(value)
  assignOverlay(effect.bars.overlay, normalized)
  if (!effectLivePreview.value) assignOverlay(effectDraft.bars.overlay, normalized)
}

function resetRegionOverlay(): void {
  replaceRegionOverlay(cloneDistrictBarOverlayConfig(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS))
}

function writeConfigField<Config extends object, Key extends keyof Config>(
  target: Config,
  key: Key,
  value: Config[Key]
): void {
  target[key] = value
}

function setHudField(update: HudFieldUpdate): void {
  const candidate = cloneMapHudConfig(hudEditTarget.value)
  if (update.section === 'anchor') {
    writeConfigField(candidate.anchor, update.key, update.value)
  } else if (update.section === 'static') {
    writeConfigField(candidate.static, update.key, update.value)
  } else {
    writeConfigField(candidate.rotating, update.key, update.value)
  }
  assignMapHudConfig(hudEditTarget.value, normalizeMapHudConfig(candidate))
}

function resetEditableHud(): void {
  assignMapHudConfig(hudEditTarget.value, cloneMapHudConfig(MAP_HUD_DEFAULTS))
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

function setFpsVisible(visible: boolean): void {
  fpsVisible.value = visible
}

function resetFpsVisibility(): void {
  fpsVisible.value = DEFAULT_FPS_VISIBLE
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

function updateRegionBarRuntimeStatus(next: RegionBarRuntimeStatus): boolean {
  if (
    next.renderedCount === regionBarRuntimeStatus.renderedCount
    && next.dataMin === regionBarRuntimeStatus.dataMin
    && next.dataMax === regionBarRuntimeStatus.dataMax
    && next.degraded === regionBarRuntimeStatus.degraded
  ) return false
  Object.assign(regionBarRuntimeStatus, next)
  return true
}

function resetVisualSession(): void {
  workspaceMode.value = 'data'
  activeVisualPage.value = 'composition'
  sidebarCollapsed.value = false
  effectLivePreview.value = true
  hudLivePreview.value = true
  resetLayout()
  Object.assign(backgroundLayerVisibility, createBackgroundLayerVisibility())
  resetBackgroundLayerImages()
  resetEffect()
  resetHud()
  lastEffectiveEffect = cloneMapEffectConfig(effect)
  lastEffectiveHud = cloneMapHudConfig(hud)
  Object.assign(effectRuntimeStatus, DEFAULT_MAP_EFFECT_RUNTIME_STATUS)
  Object.assign(regionBarRuntimeStatus, DEFAULT_REGION_BAR_RUNTIME_STATUS)
  cameraView.value = DEFAULT_CAMERA_VIEW
  fps.value = 0
  resetFpsVisibility()
  for (const key of Object.keys(numericDrafts) as VisualNumericFieldId[]) delete numericDrafts[key]
  committedNumericDrafts.clear()
  for (const key of Object.keys(copyFeedback) as VisualCopyKey[]) {
    copyRequests.set(key, (copyRequests.get(key) ?? 0) + 1)
    const timer = copyTimers.get(key)
    if (timer) clearTimeout(timer)
    copyTimers.delete(key)
    copyFeedback[key] = 'idle'
  }
}

export function useMapVisualSettings() {
  return {
    workspaceMode,
    activeVisualPage,
    sidebarCollapsed,
    layout,
    effectiveMapLayout,
    backgroundLayerVisibility,
    backgroundLayerSources,
    backgroundLayerErrors,
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
    regionBarJson,
    regionOverlayJson,
    visualDirty,
    effectRuntimeStatus,
    regionBarRuntimeStatus,
    cameraView,
    fps,
    fpsVisible,
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
    setSidebarCollapsed,
    toggleSidebar,
    setBackgroundLayerVisibility,
    replaceBackgroundLayerImage,
    resetBackgroundLayerImage,
    setFpsVisible,
    resetFpsVisibility,
    resetEffect,
    resetHud,
    resetVisualSession,
    numericField,
    commitLayoutField,
    setEffectBaseField,
    setEffectHoverField,
    setEffectQualityField,
    replaceEffectInwardGlow,
    applyEffectInwardPreset,
    replaceEffectMosaicParticles,
    applyEffectMosaicPreset,
    randomizeEffectMosaicSeed,
    resetEffectMosaicParticles,
    applyEffectB3Preset,
    resetEffectGlowGroup,
    resetEditableEffect,
    replaceRegionBars,
    resetRegionBars,
    replaceRegionOverlay,
    resetRegionOverlay,
    setHudField,
    resetEditableHud,
    copyVisualText,
    copyLabel,
    updateCameraView,
    updateFps,
    updateEffectRuntimeStatus,
    updateRegionBarRuntimeStatus
  }
}
