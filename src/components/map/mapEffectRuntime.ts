import type { MapEffectConfig } from './mapEffectConfig'
import {
  applyHoverGlowConfig,
  applyStaticGlowConfig,
  type HoverGlowBundle,
  type StaticGlowBundle
} from './mapGlow'

interface MapEffectRuntimeTargets {
  staticGlow: StaticGlowBundle | null
  hoverGlows: Iterable<HoverGlowBundle | null>
}

export function applyMapEffectConfig(
  effect: MapEffectConfig,
  { staticGlow, hoverGlows }: MapEffectRuntimeTargets
): void {
  if (staticGlow) applyStaticGlowConfig(staticGlow, effect)
  for (const hoverGlow of hoverGlows) {
    if (hoverGlow) applyHoverGlowConfig(hoverGlow, effect)
  }
}
