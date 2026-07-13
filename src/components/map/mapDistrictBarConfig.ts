export interface MapDistrictBarConfig {
  enabled: boolean
  color: string
  opacity: number
  width: number
  anchorOffsetX: number
  anchorOffsetY: number
  baseOffset: number
  minHeight: number
  maxHeight: number
  sqrtExponent: number
  glowStrength: number
  baseRingRadius: number
  baseRingOpacity: number
  pulseEnabled: boolean
  pulseColor: string
  pulseWidth: number
  pulseOuterRadiusRatio: number
  pulseInnerRadiusRatio: number
  pulseOuterOpacity: number
  pulseInnerOpacity: number
  pulseDurationMs: number
  pulseStaggerMs: number
  enterMs: number
  staggerMs: number
  hoverEmissiveIntensity: number
  hoverLift: number
}

export const MAP_DISTRICT_BAR_DEFAULTS: Readonly<MapDistrictBarConfig> = Object.freeze({
  enabled: true,
  color: '#6cf9ca',
  opacity: 1,
  width: 1.4,
  anchorOffsetX: 0,
  anchorOffsetY: 0,
  baseOffset: 0,
  minHeight: 3,
  maxHeight: 20,
  sqrtExponent: 0.5,
  glowStrength: 0.6,
  baseRingRadius: 1.9,
  baseRingOpacity: 0.38,
  pulseEnabled: true,
  pulseColor: '#6cf9ca',
  pulseWidth: 0.1,
  pulseOuterRadiusRatio: 2.4,
  pulseInnerRadiusRatio: 0.35,
  pulseOuterOpacity: 0.08,
  pulseInnerOpacity: 0.7,
  pulseDurationMs: 1800,
  pulseStaggerMs: 120,
  enterMs: 760,
  staggerMs: 90,
  hoverEmissiveIntensity: 0.8,
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
  const pulseInnerRadiusRatio = finiteNumber(
    bars.pulseInnerRadiusRatio,
    MAP_DISTRICT_BAR_DEFAULTS.pulseInnerRadiusRatio,
    0.05,
    5
  )
  const pulseOuterRadiusRatio = finiteNumber(
    bars.pulseOuterRadiusRatio,
    MAP_DISTRICT_BAR_DEFAULTS.pulseOuterRadiusRatio,
    0.05,
    5
  )

  return {
    enabled: typeof bars.enabled === 'boolean' ? bars.enabled : MAP_DISTRICT_BAR_DEFAULTS.enabled,
    color: color(bars.color, MAP_DISTRICT_BAR_DEFAULTS.color),
    // 柱体主体统一采用不透明材质；保留该字段仅为兼容旧版可复制参数。
    opacity: 1,
    width: finiteNumber(bars.width, MAP_DISTRICT_BAR_DEFAULTS.width, 0.25, 8),
    anchorOffsetX: finiteNumber(bars.anchorOffsetX, MAP_DISTRICT_BAR_DEFAULTS.anchorOffsetX, -20, 20),
    anchorOffsetY: finiteNumber(bars.anchorOffsetY, MAP_DISTRICT_BAR_DEFAULTS.anchorOffsetY, -20, 20),
    baseOffset: finiteNumber(bars.baseOffset, MAP_DISTRICT_BAR_DEFAULTS.baseOffset, -2, 6),
    minHeight,
    maxHeight: Math.max(minHeight, maxHeight),
    sqrtExponent: finiteNumber(bars.sqrtExponent, MAP_DISTRICT_BAR_DEFAULTS.sqrtExponent, 0.25, 1),
    glowStrength: finiteNumber(bars.glowStrength, MAP_DISTRICT_BAR_DEFAULTS.glowStrength, 0, 2),
    baseRingRadius: finiteNumber(bars.baseRingRadius, MAP_DISTRICT_BAR_DEFAULTS.baseRingRadius, 0, 4),
    baseRingOpacity: finiteNumber(bars.baseRingOpacity, MAP_DISTRICT_BAR_DEFAULTS.baseRingOpacity, 0, 1),
    pulseEnabled: typeof bars.pulseEnabled === 'boolean'
      ? bars.pulseEnabled
      : MAP_DISTRICT_BAR_DEFAULTS.pulseEnabled,
    pulseColor: color(bars.pulseColor, MAP_DISTRICT_BAR_DEFAULTS.pulseColor),
    pulseWidth: finiteNumber(bars.pulseWidth, MAP_DISTRICT_BAR_DEFAULTS.pulseWidth, 0.02, 0.5),
    pulseOuterRadiusRatio: Math.max(pulseInnerRadiusRatio, pulseOuterRadiusRatio),
    pulseInnerRadiusRatio: Math.min(pulseInnerRadiusRatio, pulseOuterRadiusRatio),
    pulseOuterOpacity: finiteNumber(bars.pulseOuterOpacity, MAP_DISTRICT_BAR_DEFAULTS.pulseOuterOpacity, 0, 1),
    pulseInnerOpacity: finiteNumber(bars.pulseInnerOpacity, MAP_DISTRICT_BAR_DEFAULTS.pulseInnerOpacity, 0, 1),
    pulseDurationMs: finiteNumber(bars.pulseDurationMs, MAP_DISTRICT_BAR_DEFAULTS.pulseDurationMs, 200, 6000),
    pulseStaggerMs: finiteNumber(bars.pulseStaggerMs, MAP_DISTRICT_BAR_DEFAULTS.pulseStaggerMs, 0, 1000),
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
