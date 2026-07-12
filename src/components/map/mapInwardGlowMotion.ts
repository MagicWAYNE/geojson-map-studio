import type {
  InwardWaveEasing,
  MapInwardWaveConfig
} from './mapInwardGlowConfig'

export interface InwardWavePhase {
  active: boolean
  phase: number
}

export function easeInwardWave(value: number, easing: InwardWaveEasing): number {
  const t = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0

  if (easing === 'ease-in') return t * t
  if (easing === 'ease-out') return 1 - (1 - t) * (1 - t)
  if (easing === 'ease-in-out') {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  }
  return t
}

export function computeInwardWavePhase(
  nowMs: number,
  startMs: number,
  wave: Readonly<MapInwardWaveConfig>
): InwardWavePhase {
  if (!Number.isFinite(nowMs) || !Number.isFinite(startMs) || !wave.enabled) {
    return { active: false, phase: 0 }
  }

  const elapsed = nowMs - startMs
  if (elapsed < wave.delayMs) return { active: false, phase: 0 }

  const cycleElapsed = elapsed - wave.delayMs
  const phase = easeInwardWave((cycleElapsed % wave.periodMs) / wave.periodMs, wave.easing)
  return { active: true, phase }
}
