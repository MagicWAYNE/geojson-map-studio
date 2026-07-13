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
}

export const BASE_INWARD_GLOW_DEFAULTS: Readonly<MapInwardGlowConfig> = Object.freeze({
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
  baseRatio: 0.7
})

export const HOVER_INWARD_GLOW_DEFAULTS: Readonly<MapInwardGlowConfig> = Object.freeze({
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
  baseRatio: 0.6
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

function passCount(value: unknown, fallback: number): number {
  return Math.round(finiteNumber(value, fallback, 1, 8))
}

export function cloneInwardGlowConfig(value: Readonly<MapInwardGlowConfig>): MapInwardGlowConfig {
  return { ...value }
}

export function assignInwardGlowConfig(
  target: MapInwardGlowConfig,
  source: Readonly<MapInwardGlowConfig>
): void {
  Object.assign(target, source)
}

export function normalizeInwardGlowConfig(
  value: unknown,
  defaults: Readonly<MapInwardGlowConfig>
): MapInwardGlowConfig {
  const inward = isRecord(value) ? value : {}

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
    baseRatio: finiteNumber(inward.baseRatio, defaults.baseRatio, 0, 1)
  }
}
