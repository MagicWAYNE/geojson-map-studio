export type InwardWaveEasing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'

export interface MapInwardWaveConfig {
  enabled: boolean
  widthRatio: number
  strength: number
  periodMs: number
  delayMs: number
  travelRatio: number
  decay: number
  easing: InwardWaveEasing
}

export interface MapInwardGlowConfig {
  enabled: boolean
  color: string
  width: number
  strength: number
  maxAlpha: number
  nearRadiusRatio: number
  nearOpacityRatio: number
  farRadiusRatio: number
  farOpacityRatio: number
  falloff: number
  edgeSoftness: number
  nearPasses: number
  farPasses: number
  baseRatio: number
  wave: MapInwardWaveConfig
}

function freezeInwardGlowDefaults<T extends MapInwardGlowConfig>(value: T): Readonly<T> {
  Object.freeze(value.wave)
  return Object.freeze(value)
}

export const BASE_INWARD_GLOW_DEFAULTS = freezeInwardGlowDefaults({
  enabled: true,
  color: '#3c69eb',
  width: 36,
  strength: 0.75,
  maxAlpha: 0.5,
  nearRadiusRatio: 0.4,
  nearOpacityRatio: 0.8,
  farRadiusRatio: 0.6,
  farOpacityRatio: 1,
  falloff: 1.2,
  edgeSoftness: 1,
  nearPasses: 1,
  farPasses: 4,
  baseRatio: 0.7,
  wave: {
    enabled: false,
    widthRatio: 0.24,
    strength: 0.45,
    periodMs: 3600,
    delayMs: 0,
    travelRatio: 1,
    decay: 0.65,
    easing: 'ease-out' as const
  }
})

export const HOVER_INWARD_GLOW_DEFAULTS = freezeInwardGlowDefaults({
  enabled: true,
  color: '#d8f5ff',
  width: 64,
  strength: 0.22,
  maxAlpha: 0.6,
  nearRadiusRatio: 0.35,
  nearOpacityRatio: 0.83,
  farRadiusRatio: 1,
  farOpacityRatio: 1,
  falloff: 1,
  edgeSoftness: 0.96,
  nearPasses: 2,
  farPasses: 4,
  baseRatio: 0.6,
  wave: {
    enabled: false,
    widthRatio: 0.22,
    strength: 0.65,
    periodMs: 1400,
    delayMs: 0,
    travelRatio: 1,
    decay: 0.55,
    easing: 'ease-out' as const
  }
})

export function cloneInwardGlowConfig(value: Readonly<MapInwardGlowConfig>): MapInwardGlowConfig {
  return { ...value, wave: { ...value.wave } }
}

export function assignInwardGlowConfig(
  target: MapInwardGlowConfig,
  source: Readonly<MapInwardGlowConfig>
): void {
  const wave = target.wave
  Object.assign(target, source)
  target.wave = wave
  Object.assign(wave, source.wave)
}

type UnknownRecord = Record<string, unknown>

const HEX_COLOR = /^#[0-9a-f]{6}$/i
const INWARD_WAVE_EASINGS: readonly InwardWaveEasing[] = [
  'linear',
  'ease-in',
  'ease-out',
  'ease-in-out'
]

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function color(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value.toLowerCase() : fallback
}

function finiteNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback
}

function finiteBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function passCount(value: unknown, fallback: number): number {
  return Math.round(finiteNumber(value, fallback, 1, 8))
}

function easing(value: unknown, fallback: InwardWaveEasing): InwardWaveEasing {
  return INWARD_WAVE_EASINGS.includes(value as InwardWaveEasing)
    ? value as InwardWaveEasing
    : fallback
}

export function normalizeInwardGlowConfig(
  value: unknown,
  defaults: Readonly<MapInwardGlowConfig>
): MapInwardGlowConfig {
  const inward = isRecord(value) ? value : {}
  const wave = isRecord(inward.wave) ? inward.wave : {}
  const defaultWave = defaults.wave

  return {
    enabled: finiteBoolean(inward.enabled, defaults.enabled),
    color: color(inward.color, defaults.color),
    width: finiteNumber(inward.width, defaults.width, 0, 200),
    strength: finiteNumber(inward.strength, defaults.strength, 0, 1),
    maxAlpha: finiteNumber(inward.maxAlpha, defaults.maxAlpha, 0.1, 1),
    nearRadiusRatio: finiteNumber(inward.nearRadiusRatio, defaults.nearRadiusRatio, 0, 1.5),
    nearOpacityRatio: finiteNumber(inward.nearOpacityRatio, defaults.nearOpacityRatio, 0, 2),
    farRadiusRatio: finiteNumber(inward.farRadiusRatio, defaults.farRadiusRatio, 0.25, 2),
    farOpacityRatio: finiteNumber(inward.farOpacityRatio, defaults.farOpacityRatio, 0, 2),
    falloff: finiteNumber(inward.falloff, defaults.falloff, 0.25, 4),
    edgeSoftness: finiteNumber(inward.edgeSoftness, defaults.edgeSoftness, 0, 1),
    nearPasses: passCount(inward.nearPasses, defaults.nearPasses),
    farPasses: passCount(inward.farPasses, defaults.farPasses),
    baseRatio: finiteNumber(inward.baseRatio, defaults.baseRatio, 0, 1),
    wave: {
      enabled: finiteBoolean(wave.enabled, defaultWave.enabled),
      widthRatio: finiteNumber(wave.widthRatio, defaultWave.widthRatio, 0.01, 1),
      strength: finiteNumber(wave.strength, defaultWave.strength, 0, 2),
      periodMs: finiteNumber(wave.periodMs, defaultWave.periodMs, 250, 10000),
      delayMs: finiteNumber(wave.delayMs, defaultWave.delayMs, 0, 5000),
      travelRatio: finiteNumber(wave.travelRatio, defaultWave.travelRatio, 0.25, 2),
      decay: finiteNumber(wave.decay, defaultWave.decay, 0, 4),
      easing: easing(wave.easing, defaultWave.easing)
    }
  }
}
