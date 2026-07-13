export interface MapDistrictBarLabelConfig {
  enabled: boolean
  width: number
  height: number
  gapX: number
  offsetX: number
  offsetY: number
  opacity: number
  hoverOpacity: number
  hoverScale: number
  hoverBrightness: number
  depthTest: boolean
  backgroundOpacity: number
  hueRotate: number
  saturation: number
  brightness: number
  contrast: number
  tintColor: string
  tintStrength: number
  backgroundInsetY: number
  iconSize: number
  iconOffsetX: number
  iconOffsetY: number
  iconOpacity: number
  iconBrightness: number
  iconSaturation: number
  iconTextGap: number
  districtFontSize: number
  districtColor: string
  districtWeight: number
  metricFontSize: number
  metricColor: string
  metricWeight: number
  valueFontSize: number
  valueColor: string
  valueWeight: number
  districtMetricGap: number
  metricValueGap: number
  valueDecimals: number
  enterMs: number
  staggerMs: number
  hoverEnterMs: number
  hoverLeaveMs: number
  detailGap: number
  collisionEnabled: boolean
  collisionGap: number
  collisionMaxShift: number
}

export const MAP_DISTRICT_BAR_LABEL_DEFAULTS: Readonly<MapDistrictBarLabelConfig> = Object.freeze({
  enabled: true,
  width: 236,
  height: 36,
  gapX: 8,
  offsetX: 0,
  offsetY: 0,
  opacity: 0.9,
  hoverOpacity: 1,
  hoverScale: 1.08,
  hoverBrightness: 1.12,
  depthTest: false,
  backgroundOpacity: 1,
  hueRotate: 0,
  saturation: 1,
  brightness: 1,
  contrast: 1,
  tintColor: '#2483ff',
  tintStrength: 0,
  backgroundInsetY: 4,
  iconSize: 36,
  iconOffsetX: 3,
  iconOffsetY: 0,
  iconOpacity: 1,
  iconBrightness: 1,
  iconSaturation: 1,
  iconTextGap: 16,
  districtFontSize: 14,
  districtColor: '#a5bde5',
  districtWeight: 500,
  metricFontSize: 12,
  metricColor: '#90a3c8',
  metricWeight: 400,
  valueFontSize: 16,
  valueColor: '#00deff',
  valueWeight: 500,
  districtMetricGap: 10,
  metricValueGap: 4,
  valueDecimals: 1,
  enterMs: 500,
  staggerMs: 80,
  hoverEnterMs: 180,
  hoverLeaveMs: 220,
  detailGap: 6,
  collisionEnabled: false,
  collisionGap: 4,
  collisionMaxShift: 64
})

type UnknownRecord = Record<string, unknown>

const HEX_COLOR = /^#[0-9a-f]{6}$/i

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function finiteNumber(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback
}

function integer(value: unknown, fallback: number, min: number, max: number): number {
  return Math.round(finiteNumber(value, fallback, min, max))
}

function weight(value: unknown, fallback: number): number {
  return Math.round(finiteNumber(value, fallback, 100, 900) / 100) * 100
}

function color(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value.toLowerCase() : fallback
}

export function cloneDistrictBarLabelConfig(
  value: Readonly<MapDistrictBarLabelConfig>
): MapDistrictBarLabelConfig {
  return { ...value }
}

export function normalizeDistrictBarLabelConfig(value: unknown): MapDistrictBarLabelConfig {
  const label = isRecord(value) ? value : {}
  const defaults = MAP_DISTRICT_BAR_LABEL_DEFAULTS
  return {
    enabled: typeof label.enabled === 'boolean' ? label.enabled : defaults.enabled,
    width: finiteNumber(label.width, defaults.width, 120, 420),
    height: finiteNumber(label.height, defaults.height, 24, 80),
    gapX: finiteNumber(label.gapX, defaults.gapX, 0, 80),
    offsetX: finiteNumber(label.offsetX, defaults.offsetX, -200, 200),
    offsetY: finiteNumber(label.offsetY, defaults.offsetY, -200, 200),
    opacity: finiteNumber(label.opacity, defaults.opacity, 0, 1),
    hoverOpacity: finiteNumber(label.hoverOpacity, defaults.hoverOpacity, 0, 1),
    hoverScale: finiteNumber(label.hoverScale, defaults.hoverScale, 0.5, 2),
    hoverBrightness: finiteNumber(label.hoverBrightness, defaults.hoverBrightness, 0.2, 2),
    depthTest: typeof label.depthTest === 'boolean' ? label.depthTest : defaults.depthTest,
    backgroundOpacity: finiteNumber(label.backgroundOpacity, defaults.backgroundOpacity, 0, 1),
    hueRotate: finiteNumber(label.hueRotate, defaults.hueRotate, -180, 180),
    saturation: finiteNumber(label.saturation, defaults.saturation, 0, 3),
    brightness: finiteNumber(label.brightness, defaults.brightness, 0.2, 2),
    contrast: finiteNumber(label.contrast, defaults.contrast, 0.2, 2),
    tintColor: color(label.tintColor, defaults.tintColor),
    tintStrength: finiteNumber(label.tintStrength, defaults.tintStrength, 0, 1),
    backgroundInsetY: finiteNumber(label.backgroundInsetY, defaults.backgroundInsetY, 0, 20),
    iconSize: finiteNumber(label.iconSize, defaults.iconSize, 8, 80),
    iconOffsetX: finiteNumber(label.iconOffsetX, defaults.iconOffsetX, -40, 40),
    iconOffsetY: finiteNumber(label.iconOffsetY, defaults.iconOffsetY, -40, 40),
    iconOpacity: finiteNumber(label.iconOpacity, defaults.iconOpacity, 0, 1),
    iconBrightness: finiteNumber(label.iconBrightness, defaults.iconBrightness, 0.2, 2),
    iconSaturation: finiteNumber(label.iconSaturation, defaults.iconSaturation, 0, 3),
    iconTextGap: finiteNumber(label.iconTextGap, defaults.iconTextGap, 0, 80),
    districtFontSize: finiteNumber(label.districtFontSize, defaults.districtFontSize, 8, 40),
    districtColor: color(label.districtColor, defaults.districtColor),
    districtWeight: weight(label.districtWeight, defaults.districtWeight),
    metricFontSize: finiteNumber(label.metricFontSize, defaults.metricFontSize, 8, 40),
    metricColor: color(label.metricColor, defaults.metricColor),
    metricWeight: weight(label.metricWeight, defaults.metricWeight),
    valueFontSize: finiteNumber(label.valueFontSize, defaults.valueFontSize, 8, 48),
    valueColor: color(label.valueColor, defaults.valueColor),
    valueWeight: weight(label.valueWeight, defaults.valueWeight),
    districtMetricGap: finiteNumber(label.districtMetricGap, defaults.districtMetricGap, 0, 80),
    metricValueGap: finiteNumber(label.metricValueGap, defaults.metricValueGap, 0, 40),
    valueDecimals: integer(label.valueDecimals, defaults.valueDecimals, 0, 2),
    enterMs: finiteNumber(label.enterMs, defaults.enterMs, 0, 3000),
    staggerMs: finiteNumber(label.staggerMs, defaults.staggerMs, 0, 1000),
    hoverEnterMs: finiteNumber(label.hoverEnterMs, defaults.hoverEnterMs, 0, 1000),
    hoverLeaveMs: finiteNumber(label.hoverLeaveMs, defaults.hoverLeaveMs, 0, 1000),
    detailGap: finiteNumber(label.detailGap, defaults.detailGap, 0, 40),
    collisionEnabled: typeof label.collisionEnabled === 'boolean'
      ? label.collisionEnabled
      : defaults.collisionEnabled,
    collisionGap: finiteNumber(label.collisionGap, defaults.collisionGap, 0, 40),
    collisionMaxShift: finiteNumber(label.collisionMaxShift, defaults.collisionMaxShift, 0, 200)
  }
}
