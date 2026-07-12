import { computed, reactive, ref, watch } from 'vue'
import {
  MAP_EFFECT_DEFAULTS,
  assignMapEffectConfig,
  cloneMapEffectConfig,
  formatMapEffectConfig,
  loadMapEffectConfig,
  normalizeMapEffectConfig,
  saveMapEffectConfig
} from '@/components/map/mapEffectConfig'
import type { MapOutwardGlowPipelineStatus } from '@/components/map/mapOutwardGlowPipeline'

export interface MapLayout {
  left: number
  top: number
  width: number
  height: number
}

export interface MapEffectRuntimeStatus extends MapOutwardGlowPipelineStatus {
  degraded: boolean
}

export interface MapDistrictBarRuntimeStatus {
  renderedCount: number
  dataMin: number | null
  dataMax: number | null
  degraded: boolean
}

/** 与 HomeView 原 .pos-map 样式一致的默认值 */
export const MAP_LAYOUT_DEFAULT: MapLayout = { left: 40, top: 230, width: 1000, height: 680 }
export const DEFAULT_MAP_EFFECT_RUNTIME_STATUS: MapEffectRuntimeStatus = {
  targetWidth: 1,
  targetHeight: 1,
  renderScale: 0.5,
  baseState: 'enabled',
  hoverState: 'disabled',
  baseInwardState: 'active',
  hoverInwardState: 'ready',
  baseWaveActive: true,
  hoverWaveActive: false,
  degraded: false
}
export const DEFAULT_MAP_DISTRICT_BAR_RUNTIME_STATUS: MapDistrictBarRuntimeStatus = {
  renderedCount: 0,
  dataMin: null,
  dataMax: null,
  degraded: false
}
const LAYOUT_KEY = 'cq-map-debug-layout'

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function loadLayout(): MapLayout {
  try {
    const raw = storage()?.getItem(LAYOUT_KEY)
    if (raw) {
      const value = JSON.parse(raw) as Record<string, unknown>
      if ((['left', 'top', 'width', 'height'] as const).every((key) => typeof value[key] === 'number')) {
        return value as unknown as MapLayout
      }
    }
  } catch {
    // 存量数据损坏时回退默认布局。
  }
  return { ...MAP_LAYOUT_DEFAULT }
}

// 模块级单例：HeaderBar（开关）、抽屉、HomeView（应用样式）、3D 地图（视角上报）共享同一份状态
const drawerOpen = ref(false)
const layout = reactive<MapLayout>(loadLayout())
const effect = reactive(loadMapEffectConfig(storage()))
const effectRuntimeStatus = reactive<MapEffectRuntimeStatus>({ ...DEFAULT_MAP_EFFECT_RUNTIME_STATUS })
const districtBarRuntimeStatus = reactive<MapDistrictBarRuntimeStatus>({
  ...DEFAULT_MAP_DISTRICT_BAR_RUNTIME_STATUS
})
// 3D 相机实时视角（由 ChongqingMap3D 在 OrbitControls change 时写入），仅运行时读数，不持久化
const cameraView = ref('')
const effectJson = computed(() => formatMapEffectConfig(effect))

watch(layout, (value) => {
  try {
    storage()?.setItem(LAYOUT_KEY, JSON.stringify(value))
  } catch {
    // 本次会话继续可用。
  }
})

watch(effect, (value) => {
  const normalized = normalizeMapEffectConfig(value)
  assignMapEffectConfig(effect, normalized)
  saveMapEffectConfig(storage(), normalized)
}, { deep: true })

function resetLayout(): void {
  Object.assign(layout, MAP_LAYOUT_DEFAULT)
}

function resetEffect(): void {
  assignMapEffectConfig(effect, cloneMapEffectConfig(MAP_EFFECT_DEFAULTS))
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
    && next.baseWaveActive === current.baseWaveActive
    && next.hoverWaveActive === current.hoverWaveActive
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
    effectRuntimeStatus,
    updateEffectRuntimeStatus,
    districtBarRuntimeStatus,
    updateDistrictBarRuntimeStatus,
    resetLayout,
    resetEffect,
    cameraView
  }
}
