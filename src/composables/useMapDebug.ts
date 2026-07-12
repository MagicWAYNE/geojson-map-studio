import { computed, reactive, ref, watch } from 'vue'
import {
  MAP_EFFECT_DEFAULTS,
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

/** 与 HomeView 原 .pos-map 样式一致的默认值 */
export const MAP_LAYOUT_DEFAULT: MapLayout = { left: 40, top: 230, width: 1000, height: 680 }
export const DEFAULT_MAP_EFFECT_RUNTIME_STATUS: MapEffectRuntimeStatus = {
  targetWidth: 1,
  targetHeight: 1,
  renderScale: 0.5,
  baseState: 'enabled',
  hoverState: 'zero',
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
  Object.assign(effect.base, normalized.base)
  Object.assign(effect.hover, normalized.hover)
  Object.assign(effect.quality, normalized.quality)
  saveMapEffectConfig(storage(), normalized)
}, { deep: true })

function resetLayout(): void {
  Object.assign(layout, MAP_LAYOUT_DEFAULT)
}

function resetEffect(): void {
  const defaults = normalizeMapEffectConfig(MAP_EFFECT_DEFAULTS)
  Object.assign(effect.base, defaults.base)
  Object.assign(effect.hover, defaults.hover)
  Object.assign(effect.quality, defaults.quality)
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
    && next.degraded === current.degraded
}

function updateEffectRuntimeStatus(next: MapEffectRuntimeStatus): boolean {
  if (sameEffectRuntimeStatus(next, effectRuntimeStatus)) return false
  Object.assign(effectRuntimeStatus, next)
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
    resetLayout,
    resetEffect,
    cameraView
  }
}
