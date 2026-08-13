import { ref } from 'vue'
import { useMapVisualSettings } from './useMapVisualSettings'

export type {
  MapDistrictBarRuntimeStatus,
  MapEffectRuntimeStatus,
  MapLayout
} from './useMapVisualSettings'
export {
  DEFAULT_MAP_DISTRICT_BAR_RUNTIME_STATUS,
  DEFAULT_MAP_EFFECT_RUNTIME_STATUS,
  MAP_LAYOUT_DEFAULT
} from './useMapVisualSettings'

// Kept only for source/test compatibility while the obsolete drawer remains unmounted.
const drawerOpen = ref(false)

/** @deprecated New product UI should use useMapVisualSettings directly. */
export function useMapDebug() {
  return {
    ...useMapVisualSettings(),
    drawerOpen
  }
}
