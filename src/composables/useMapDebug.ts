import { computed, reactive, ref, watch } from 'vue'
import {
  MAP_EFFECT_DEFAULTS,
  assignMapEffectConfig,
  cloneMapEffectConfig,
  formatMapEffectConfig,
  normalizeMapEffectConfig
} from '@/components/map/mapEffectConfig'
import {
  MAP_HUD_DEFAULTS,
  assignMapHudConfig,
  cloneMapHudConfig,
  formatMapHudConfig,
  normalizeMapHudConfig
} from '@/components/map/mapHudConfig'
import type { MapOutwardGlowPipelineStatus } from '@/components/map/mapOutwardGlowPipeline'

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

/** 刷新后固定恢复为 HomeView 中 .pos-map 的源码布局。 */
export const MAP_LAYOUT_DEFAULT: MapLayout = { left: 400, top: 132, width: 1120, height: 948 }
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
// 模块级单例：HeaderBar（开关）、抽屉、HomeView（应用样式）、3D 地图（视角上报）共享同一份状态
const drawerOpen = ref(false)
// 布局调试只在当前页面会话有效，浏览器刷新始终恢复源码默认值。
const layout = reactive<MapLayout>({ ...MAP_LAYOUT_DEFAULT })
const effect = reactive(cloneMapEffectConfig(MAP_EFFECT_DEFAULTS))
// HUD 调试参数只在当前页面会话内有效，刷新后始终恢复源码默认值。
const hud = reactive(cloneMapHudConfig(MAP_HUD_DEFAULTS))
const effectRuntimeStatus = reactive<MapEffectRuntimeStatus>({ ...DEFAULT_MAP_EFFECT_RUNTIME_STATUS })
const districtBarRuntimeStatus = reactive<MapDistrictBarRuntimeStatus>({
  ...DEFAULT_MAP_DISTRICT_BAR_RUNTIME_STATUS
})
// 3D 相机实时视角（由 ChongqingMap3D 在 OrbitControls change 时写入），仅运行时读数，不持久化
const cameraView = ref('')
const effectJson = computed(() => formatMapEffectConfig(effect))
const hudJson = computed(() => formatMapHudConfig(hud))

watch(effect, (value) => {
  const normalized = normalizeMapEffectConfig(value)
  assignMapEffectConfig(effect, normalized)
}, { deep: true })

watch(hud, (value) => {
  assignMapHudConfig(hud, normalizeMapHudConfig(value))
}, { deep: true })

function resetLayout(): void {
  Object.assign(layout, MAP_LAYOUT_DEFAULT)
}

function resetEffect(): void {
  assignMapEffectConfig(effect, cloneMapEffectConfig(MAP_EFFECT_DEFAULTS))
}

function resetHud(): void {
  assignMapHudConfig(hud, cloneMapHudConfig(MAP_HUD_DEFAULTS))
}

function sameEffectRuntimeStatus(
  next: MapEffectRuntimeStatus,
  current: MapEffectRuntimeStatus
): boolean {
  return next.targetWidth === current.targetWidth
    && next.targetHeight === current.targetHeight
    && next.renderScale === current.renderScale
    && next.baseState === current.baseState
    && next.hoverState === current.hoverState
    && next.baseInwardState === current.baseInwardState
    && next.hoverInwardState === current.hoverInwardState
    && next.mosaicState === current.mosaicState
    && next.degraded === current.degraded
}

function updateEffectRuntimeStatus(next: MapEffectRuntimeStatus): boolean {
  if (sameEffectRuntimeStatus(next, effectRuntimeStatus)) return false
  Object.assign(effectRuntimeStatus, next)
  return true
}

function sameDistrictBarRuntimeStatus(
  next: MapDistrictBarRuntimeStatus,
  current: MapDistrictBarRuntimeStatus
): boolean {
  return next.renderedCount === current.renderedCount
    && next.dataMin === current.dataMin
    && next.dataMax === current.dataMax
    && next.degraded === current.degraded
}

function updateDistrictBarRuntimeStatus(next: MapDistrictBarRuntimeStatus): boolean {
  if (sameDistrictBarRuntimeStatus(next, districtBarRuntimeStatus)) return false
  Object.assign(districtBarRuntimeStatus, next)
  return true
}

export function useMapDebug() {
  return {
    drawerOpen,
    layout,
    effect,
    effectJson,
    hud,
    hudJson,
    effectRuntimeStatus,
    updateEffectRuntimeStatus,
    districtBarRuntimeStatus,
    updateDistrictBarRuntimeStatus,
    resetLayout,
    resetEffect,
    resetHud,
    cameraView
  }
}
