import { watch } from 'vue'
import type { MapEffectConfig } from './mapEffectConfig'

export function watchMapEffectConfig(effect: MapEffectConfig, apply: () => void): () => void {
  return watch(effect, apply, { deep: true, immediate: true })
}
