export interface MapMosaicParticleConfig {
  enabled: boolean
  primaryColor: string
  accentColor: string
  accentRatio: number
  density: number
  clusterChance: number
  clusterRadius: number
  clusterStrength: number
  accentClusterBias: number
  targetCellPx: number
  minCellPx: number
  maxCellPx: number
  gapRatio: number
  gapColor: string
  gapOpacity: number
  opacity: number
  brightness: number
  flickerHz: number
  dutyCycle: number
  pulseSharpness: number
  clusterFlickerScale: number
  burstDurationMs: number
  burstStrength: number
  burstDensityBoost: number
  surfaceOffset: number
  seed: number
  reseedOnEnter: boolean
}

export const MOSAIC_LOD_STEPS_PER_OCTAVE = 8
export const MOSAIC_MIN_LOD_RANGE_RATIO = 2 ** (1 / MOSAIC_LOD_STEPS_PER_OCTAVE)

export const HOVER_MOSAIC_PARTICLE_DEFAULTS: Readonly<MapMosaicParticleConfig> = Object.freeze({
  enabled: true,
  primaryColor: '#4fc3ff',
  accentColor: '#ffffff',
  accentRatio: 0.2,
  density: 0.99,
  clusterChance: 0.15,
  clusterRadius: 1,
  clusterStrength: 0.7,
  accentClusterBias: 0.65,
  targetCellPx: 4,
  minCellPx: 4,
  maxCellPx: 5,
  gapRatio: 0.2,
  gapColor: '#ffffff',
  gapOpacity: 0,
  opacity: 0.24,
  brightness: 1.15,
  flickerHz: 0.3,
  dutyCycle: 0.35,
  pulseSharpness: 1.4,
  clusterFlickerScale: 0.65,
  burstDurationMs: 260,
  burstStrength: 1.6,
  burstDensityBoost: 0.18,
  surfaceOffset: 0.12,
  seed: 6768,
  reseedOnEnter: true
})

export const BLUE_PURPLE_MOSAIC_PARTICLE_PRESET: Readonly<MapMosaicParticleConfig> = Object.freeze({
  enabled: true,
  primaryColor: '#4fc3ff',
  accentColor: '#a56dff',
  accentRatio: 0.2,
  density: 0.12,
  clusterChance: 0.16,
  clusterRadius: 2,
  clusterStrength: 1.35,
  accentClusterBias: 0.65,
  targetCellPx: 8,
  minCellPx: 4,
  maxCellPx: 14,
  gapRatio: 0.2,
  gapColor: '#ffffff',
  gapOpacity: 0,
  opacity: 0.5,
  brightness: 1.15,
  flickerHz: 3.2,
  dutyCycle: 0.35,
  pulseSharpness: 1.4,
  clusterFlickerScale: 0.65,
  burstDurationMs: 260,
  burstStrength: 1.6,
  burstDensityBoost: 0.18,
  surfaceOffset: 0.12,
  seed: 17,
  reseedOnEnter: true
})

type UnknownRecord = Record<string, unknown>

const HEX_COLOR = /^#[0-9a-f]{6}$/i

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

function integer(value: unknown, fallback: number, min: number, max: number): number {
  return Math.round(finiteNumber(value, fallback, min, max))
}

export function cloneMosaicParticleConfig(
  value: Readonly<MapMosaicParticleConfig>
): MapMosaicParticleConfig {
  return { ...value }
}

export function assignMosaicParticleConfig(
  target: MapMosaicParticleConfig,
  source: Readonly<MapMosaicParticleConfig>
): void {
  Object.assign(target, source)
}

export function normalizeMosaicParticleConfig(value: unknown): MapMosaicParticleConfig {
  const input = isRecord(value) ? value : {}
  const defaults = HOVER_MOSAIC_PARTICLE_DEFAULTS
  const firstCellPx = finiteNumber(input.minCellPx, defaults.minCellPx, 1, 16)
  const secondCellPx = finiteNumber(input.maxCellPx, defaults.maxCellPx, 4, 32)
  const minCellPx = Math.min(firstCellPx, secondCellPx)
  const maxCellPx = Math.max(
    Math.max(firstCellPx, secondCellPx),
    minCellPx * MOSAIC_MIN_LOD_RANGE_RATIO
  )

  return {
    enabled: finiteBoolean(input.enabled, defaults.enabled),
    primaryColor: color(input.primaryColor, defaults.primaryColor),
    accentColor: color(input.accentColor, defaults.accentColor),
    accentRatio: finiteNumber(input.accentRatio, defaults.accentRatio, 0, 1),
    density: finiteNumber(input.density, defaults.density, 0, 1),
    clusterChance: finiteNumber(input.clusterChance, defaults.clusterChance, 0, 1),
    clusterRadius: integer(input.clusterRadius, defaults.clusterRadius, 1, 6),
    clusterStrength: finiteNumber(input.clusterStrength, defaults.clusterStrength, 0, 3),
    accentClusterBias: finiteNumber(input.accentClusterBias, defaults.accentClusterBias, 0, 1),
    targetCellPx: finiteNumber(input.targetCellPx, defaults.targetCellPx, minCellPx, maxCellPx),
    minCellPx,
    maxCellPx,
    gapRatio: finiteNumber(input.gapRatio, defaults.gapRatio, 0, 0.8),
    gapColor: color(input.gapColor, defaults.gapColor),
    gapOpacity: finiteNumber(input.gapOpacity, defaults.gapOpacity, 0, 1),
    opacity: finiteNumber(input.opacity, defaults.opacity, 0, 1),
    brightness: finiteNumber(input.brightness, defaults.brightness, 0, 3),
    flickerHz: finiteNumber(input.flickerHz, defaults.flickerHz, 0.1, 12),
    dutyCycle: finiteNumber(input.dutyCycle, defaults.dutyCycle, 0, 1),
    pulseSharpness: finiteNumber(input.pulseSharpness, defaults.pulseSharpness, 0.25, 4),
    clusterFlickerScale: finiteNumber(
      input.clusterFlickerScale,
      defaults.clusterFlickerScale,
      0.1,
      3
    ),
    burstDurationMs: finiteNumber(input.burstDurationMs, defaults.burstDurationMs, 0, 1500),
    burstStrength: finiteNumber(input.burstStrength, defaults.burstStrength, 0, 3),
    burstDensityBoost: finiteNumber(
      input.burstDensityBoost,
      defaults.burstDensityBoost,
      0,
      1
    ),
    surfaceOffset: finiteNumber(input.surfaceOffset, defaults.surfaceOffset, 0, 1),
    seed: integer(input.seed, defaults.seed, 0, 9999),
    reseedOnEnter: finiteBoolean(input.reseedOnEnter, defaults.reseedOnEnter)
  }
}
