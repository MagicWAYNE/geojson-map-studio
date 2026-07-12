export interface MapDistrictBarConfig {
  enabled: boolean
  color: string
  opacity: number
  width: number
  minHeight: number
  maxHeight: number
  sqrtExponent: number
  glowStrength: number
  baseRingRadius: number
  baseRingOpacity: number
  enterMs: number
  staggerMs: number
  hoverEmissiveIntensity: number
  hoverLift: number
}

export const MAP_DISTRICT_BAR_DEFAULTS: Readonly<MapDistrictBarConfig> = Object.freeze({
  enabled: true,
  color: '#39c9ff',
  opacity: 0.72,
  width: 2.8,
  minHeight: 3,
  maxHeight: 20,
  sqrtExponent: 0.5,
  glowStrength: 0.8,
  baseRingRadius: 1.65,
  baseRingOpacity: 0.38,
  enterMs: 760,
  staggerMs: 90,
  hoverEmissiveIntensity: 1.35,
  hoverLift: 1.1
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

export function cloneDistrictBarConfig(value: Readonly<MapDistrictBarConfig>): MapDistrictBarConfig {
  return { ...value }
}

export function normalizeDistrictBarConfig(value: unknown): MapDistrictBarConfig {
  const bars = isRecord(value) ? value : {}
  const minHeight = finiteNumber(bars.minHeight, MAP_DISTRICT_BAR_DEFAULTS.minHeight, 0, 24)
  const maxHeight = finiteNumber(bars.maxHeight, MAP_DISTRICT_BAR_DEFAULTS.maxHeight, 0, 24)

  return {
    enabled: typeof bars.enabled === 'boolean' ? bars.enabled : MAP_DISTRICT_BAR_DEFAULTS.enabled,
    color: color(bars.color, MAP_DISTRICT_BAR_DEFAULTS.color),
    opacity: finiteNumber(bars.opacity, MAP_DISTRICT_BAR_DEFAULTS.opacity, 0, 1),
    width: finiteNumber(bars.width, MAP_DISTRICT_BAR_DEFAULTS.width, 0.25, 8),
    minHeight,
    maxHeight: Math.max(minHeight, maxHeight),
    sqrtExponent: finiteNumber(bars.sqrtExponent, MAP_DISTRICT_BAR_DEFAULTS.sqrtExponent, 0.25, 1),
    glowStrength: finiteNumber(bars.glowStrength, MAP_DISTRICT_BAR_DEFAULTS.glowStrength, 0, 2),
    baseRingRadius: finiteNumber(bars.baseRingRadius, MAP_DISTRICT_BAR_DEFAULTS.baseRingRadius, 0, 4),
    baseRingOpacity: finiteNumber(bars.baseRingOpacity, MAP_DISTRICT_BAR_DEFAULTS.baseRingOpacity, 0, 1),
    enterMs: finiteNumber(bars.enterMs, MAP_DISTRICT_BAR_DEFAULTS.enterMs, 0, 3000),
    staggerMs: finiteNumber(bars.staggerMs, MAP_DISTRICT_BAR_DEFAULTS.staggerMs, 0, 1000),
    hoverEmissiveIntensity: finiteNumber(
      bars.hoverEmissiveIntensity,
      MAP_DISTRICT_BAR_DEFAULTS.hoverEmissiveIntensity,
      0,
      3
    ),
    hoverLift: finiteNumber(bars.hoverLift, MAP_DISTRICT_BAR_DEFAULTS.hoverLift, 0, 4)
  }
}
