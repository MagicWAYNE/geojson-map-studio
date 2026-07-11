export interface MapEffectBaseConfig {
  innerColor: string
  innerWidth: number
  innerOpacity: number
  outerColor: string
  outerCoreWidth: number
  outerGlowWidth: number
  outerGlowStrength: number
}

export interface MapEffectHoverConfig {
  surfaceColor: string
  emissiveColor: string
  emissiveIntensity: number
  outlineColor: string
  outlineWidth: number
  glowColor: string
  glowWidth: number
  glowStrength: number
  lift: number
  enterMs: number
  leaveMs: number
}

export interface MapEffectConfig {
  version: 1
  base: MapEffectBaseConfig
  hover: MapEffectHoverConfig
}

export interface StorageReader {
  getItem(key: string): string | null
}

export interface StorageWriter {
  setItem(key: string, value: string): void
}

export const MAP_EFFECT_STORAGE_KEY = 'cq-map-effect-config-v1'

const LEGACY_MAP_EFFECT_DEFAULTS: MapEffectConfig = {
  version: 1,
  base: {
    innerColor: '#4da3ff',
    innerWidth: 1,
    innerOpacity: 0.55,
    outerColor: '#7fcbff',
    outerCoreWidth: 1.8,
    outerGlowWidth: 10,
    outerGlowStrength: 0.3
  },
  hover: {
    surfaceColor: '#7fcbff',
    emissiveColor: '#168dff',
    emissiveIntensity: 0.8,
    outlineColor: '#d8f5ff',
    outlineWidth: 2.4,
    glowColor: '#27a7ff',
    glowWidth: 7,
    glowStrength: 0.35,
    lift: 1,
    enterMs: 180,
    leaveMs: 220
  }
}

export const MAP_EFFECT_DEFAULTS: MapEffectConfig = {
  version: 1,
  base: {
    innerColor: '#ffffff',
    innerWidth: 1.5,
    innerOpacity: 0.55,
    outerColor: '#ffffff',
    outerCoreWidth: 2,
    outerGlowWidth: 0,
    outerGlowStrength: 0
  },
  hover: {
    surfaceColor: '#7fcbff',
    emissiveColor: '#22b4d8',
    emissiveIntensity: 0.5,
    outlineColor: '#d8f5ff',
    outlineWidth: 2.4,
    glowColor: '#27a7ff',
    glowWidth: 0,
    glowStrength: 0,
    lift: 2,
    enterMs: 400,
    leaveMs: 300
  }
}

type UnknownRecord = Record<string, unknown>
const HEX_COLOR = /^#[0-9a-f]{6}$/i

function isExactValue(value: unknown, expected: unknown): boolean {
  if (Object.is(value, expected)) return true
  if (value === null || expected === null || typeof value !== 'object' || typeof expected !== 'object') {
    return false
  }
  const valueRecord = value as UnknownRecord
  const expectedRecord = expected as UnknownRecord
  const valueKeys = Object.keys(valueRecord)
  const expectedKeys = Object.keys(expectedRecord)
  return valueKeys.length === expectedKeys.length
    && expectedKeys.every((key) => Object.prototype.hasOwnProperty.call(valueRecord, key)
      && isExactValue(valueRecord[key], expectedRecord[key]))
}

function record(value: unknown): UnknownRecord {
  return value !== null && typeof value === 'object' ? value as UnknownRecord : {}
}

function color(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value.toLowerCase() : fallback
}

function numberInRange(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback
}

function defaults(): MapEffectConfig {
  return {
    version: 1,
    base: { ...MAP_EFFECT_DEFAULTS.base },
    hover: { ...MAP_EFFECT_DEFAULTS.hover }
  }
}

export function normalizeMapEffectConfig(value: unknown): MapEffectConfig {
  const root = record(value)
  if (root.version !== 1) return defaults()
  const base = record(root.base)
  const hover = record(root.hover)
  return {
    version: 1,
    base: {
      innerColor: color(base.innerColor, MAP_EFFECT_DEFAULTS.base.innerColor),
      innerWidth: numberInRange(base.innerWidth, MAP_EFFECT_DEFAULTS.base.innerWidth, 0, 4),
      innerOpacity: numberInRange(base.innerOpacity, MAP_EFFECT_DEFAULTS.base.innerOpacity, 0, 1),
      outerColor: color(base.outerColor, MAP_EFFECT_DEFAULTS.base.outerColor),
      outerCoreWidth: numberInRange(base.outerCoreWidth, MAP_EFFECT_DEFAULTS.base.outerCoreWidth, 0, 6),
      outerGlowWidth: numberInRange(base.outerGlowWidth, MAP_EFFECT_DEFAULTS.base.outerGlowWidth, 0, 24),
      outerGlowStrength: numberInRange(base.outerGlowStrength, MAP_EFFECT_DEFAULTS.base.outerGlowStrength, 0, 1)
    },
    hover: {
      surfaceColor: color(hover.surfaceColor, MAP_EFFECT_DEFAULTS.hover.surfaceColor),
      emissiveColor: color(hover.emissiveColor, MAP_EFFECT_DEFAULTS.hover.emissiveColor),
      emissiveIntensity: numberInRange(hover.emissiveIntensity, MAP_EFFECT_DEFAULTS.hover.emissiveIntensity, 0, 2),
      outlineColor: color(hover.outlineColor, MAP_EFFECT_DEFAULTS.hover.outlineColor),
      outlineWidth: numberInRange(hover.outlineWidth, MAP_EFFECT_DEFAULTS.hover.outlineWidth, 0, 8),
      glowColor: color(hover.glowColor, MAP_EFFECT_DEFAULTS.hover.glowColor),
      glowWidth: numberInRange(hover.glowWidth, MAP_EFFECT_DEFAULTS.hover.glowWidth, 0, 20),
      glowStrength: numberInRange(hover.glowStrength, MAP_EFFECT_DEFAULTS.hover.glowStrength, 0, 1),
      lift: numberInRange(hover.lift, MAP_EFFECT_DEFAULTS.hover.lift, 0, 3),
      enterMs: numberInRange(hover.enterMs, MAP_EFFECT_DEFAULTS.hover.enterMs, 0, 1000),
      leaveMs: numberInRange(hover.leaveMs, MAP_EFFECT_DEFAULTS.hover.leaveMs, 0, 1000)
    }
  }
}

export function loadMapEffectConfig(storage?: StorageReader | null): MapEffectConfig {
  if (!storage) return defaults()
  try {
    const raw = storage.getItem(MAP_EFFECT_STORAGE_KEY)
    if (!raw) return defaults()
    const parsed: unknown = JSON.parse(raw)
    return isExactValue(parsed, LEGACY_MAP_EFFECT_DEFAULTS)
      ? defaults()
      : normalizeMapEffectConfig(parsed)
  } catch {
    return defaults()
  }
}

export function saveMapEffectConfig(
  storage: StorageWriter | null | undefined,
  config: MapEffectConfig
): void {
  try {
    storage?.setItem(MAP_EFFECT_STORAGE_KEY, JSON.stringify(normalizeMapEffectConfig(config)))
  } catch {
    // 存储被浏览器禁用时保留本次会话状态。
  }
}

export function formatMapEffectConfig(config: MapEffectConfig): string {
  return JSON.stringify(normalizeMapEffectConfig(config), null, 2)
}
