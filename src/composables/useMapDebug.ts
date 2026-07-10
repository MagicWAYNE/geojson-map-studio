import { reactive, ref, watch } from 'vue'

export interface MapLayout {
  left: number
  top: number
  width: number
  height: number
}

/** 与 HomeView 原 .pos-map 样式一致的默认值 */
export const MAP_LAYOUT_DEFAULT: MapLayout = { left: 115, top: 230, width: 680, height: 680 }

const KEY = 'cq-map-debug-layout'

function load(): MapLayout {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const v = JSON.parse(raw) as Record<string, unknown>
      if ((['left', 'top', 'width', 'height'] as const).every((k) => typeof v[k] === 'number')) {
        return v as unknown as MapLayout
      }
    }
  } catch {
    /* 存量数据损坏时回退默认值 */
  }
  return { ...MAP_LAYOUT_DEFAULT }
}

// 模块级单例：HeaderBar（开关）、抽屉、HomeView（应用样式）、3D 地图（视角上报）共享同一份状态
const drawerOpen = ref(false)
const layout = reactive<MapLayout>(load())
// 3D 相机实时视角（由 ChongqingMap3D 在 OrbitControls change 时写入），仅运行时读数，不持久化
const cameraView = ref('')

watch(layout, (v) => localStorage.setItem(KEY, JSON.stringify(v)))

function reset() {
  Object.assign(layout, MAP_LAYOUT_DEFAULT)
}

export function useMapDebug() {
  return { drawerOpen, layout, reset, cameraView }
}
