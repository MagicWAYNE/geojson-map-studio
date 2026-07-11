export interface MapEffectBaseConfig {
  innerColor: string
  innerWidth: number
  innerOpacity: number
  outerColor: string
  outerCoreWidth: number
  outerGlowWidth: number
  outerGlowStrength: number
}

export interface MapEffectBaseConfigV2 extends MapEffectBaseConfig {
  outerGlowEnabled: boolean
  outerGlowColor: string
  outerGlowNearRadiusRatio: number
  outerGlowNearOpacityRatio: number
  outerGlowFarRadiusRatio: number
  outerGlowFarOpacityRatio: number
  outerGlowFalloff: number
  outerGlowEdgeSoftness: number
  outerGlowNearPasses: number
  outerGlowFarPasses: number
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

export interface MapEffectHoverConfigV2 extends MapEffectHoverConfig {
  glowEnabled: boolean
  glowNearRadiusRatio: number
  glowNearOpacityRatio: number
  glowFarRadiusRatio: number
  glowFarOpacityRatio: number
  glowFalloff: number
  glowEdgeSoftness: number
  glowNearPasses: number
  glowFarPasses: number
}

export interface MapEffectQualityConfig {
  renderScale: 0.25 | 0.5 | 0.75 | 1
  maxAlpha: number
}

export interface MapEffectConfig {
  version: 2
  base: MapEffectBaseConfigV2
  hover: MapEffectHoverConfigV2
  quality: MapEffectQualityConfig
}

interface LegacyMapEffectConfig {
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

export const MAP_EFFECT_STORAGE_KEY = 'cq-map-effect-config-v2'
export const MAP_EFFECT_STORAGE_KEY_V1 = 'cq-map-effect-config-v1'

export const B3_GLOW_PROFILE_DEFAULTS = Object.freeze({
  nearRadiusRatio: 0.35,
  nearOpacityRatio: 0.83,
  farRadiusRatio: 1,
  farOpacityRatio: 1,
  falloff: 1,
  edgeSoftness: 0.96,
  nearPasses: 2,
  farPasses: 4
})

const LEGACY_APPROVED_V1_DEFAULTS: LegacyMapEffectConfig = {
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

const V2_BASE_DEFAULTS: MapEffectBaseConfigV2 = {
  innerColor: '#ffffff',
  innerWidth: 1.5,
  innerOpacity: 0.55,
  outerColor: '#ffffff',
  outerCoreWidth: 2,
  outerGlowEnabled: true,
  outerGlowColor: '#ffffff',
  outerGlowWidth: 54,
  outerGlowStrength: 0.23,
  outerGlowNearRadiusRatio: B3_GLOW_PROFILE_DEFAULTS.nearRadiusRatio,
  outerGlowNearOpacityRatio: B3_GLOW_PROFILE_DEFAULTS.nearOpacityRatio,
  outerGlowFarRadiusRatio: B3_GLOW_PROFILE_DEFAULTS.farRadiusRatio,
  outerGlowFarOpacityRatio: B3_GLOW_PROFILE_DEFAULTS.farOpacityRatio,
  outerGlowFalloff: B3_GLOW_PROFILE_DEFAULTS.falloff,
  outerGlowEdgeSoftness: B3_GLOW_PROFILE_DEFAULTS.edgeSoftness,
  outerGlowNearPasses: B3_GLOW_PROFILE_DEFAULTS.nearPasses,
  outerGlowFarPasses: B3_GLOW_PROFILE_DEFAULTS.farPasses
}

const V2_HOVER_DEFAULTS: MapEffectHoverConfigV2 = {
  surfaceColor: '#7fcbff',
  emissiveColor: '#22b4d8',
  emissiveIntensity: 0.5,
  outlineColor: '#d8f5ff',
  outlineWidth: 2.4,
  glowEnabled: true,
  glowColor: '#27a7ff',
  glowWidth: 0,
  glowStrength: 0,
  glowNearRadiusRatio: B3_GLOW_PROFILE_DEFAULTS.nearRadiusRatio,
  glowNearOpacityRatio: B3_GLOW_PROFILE_DEFAULTS.nearOpacityRatio,
  glowFarRadiusRatio: B3_GLOW_PROFILE_DEFAULTS.farRadiusRatio,
  glowFarOpacityRatio: B3_GLOW_PROFILE_DEFAULTS.farOpacityRatio,
  glowFalloff: B3_GLOW_PROFILE_DEFAULTS.falloff,
  glowEdgeSoftness: B3_GLOW_PROFILE_DEFAULTS.edgeSoftness,
  glowNearPasses: B3_GLOW_PROFILE_DEFAULTS.nearPasses,
  glowFarPasses: B3_GLOW_PROFILE_DEFAULTS.farPasses,
  lift: 2,
  enterMs: 400,
  leaveMs: 300
}

const V2_QUALITY_DEFAULTS: MapEffectQualityConfig = {
  renderScale: 0.5,
  maxAlpha: 1
}

function freezeMapEffectDefaults<T extends MapEffectConfig>(value: T): Readonly<T> {
  Object.freeze(value.base)
  Object.freeze(value.hover)
  Object.freeze(value.quality)
  return Object.freeze(value)
}

const CANONICAL_MAP_EFFECT_DEFAULTS = freezeMapEffectDefaults({
  version: 2,
  base: { ...V2_BASE_DEFAULTS },
  hover: { ...V2_HOVER_DEFAULTS },
  quality: { ...V2_QUALITY_DEFAULTS }
})

export const MAP_EFFECT_DEFAULTS: MapEffectConfig = CANONICAL_MAP_EFFECT_DEFAULTS as MapEffectConfig

type UnknownRecord = Record<string, unknown>

const HEX_COLOR = /^#[0-9a-f]{6}$/i
const ALLOWED_RENDER_SCALES = [0.25, 0.5, 0.75, 1] as const

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isExactValue(value: unknown, expected: unknown): boolean {
  if (Object.is(value, expected)) return true
  if (!isRecord(value) || !isRecord(expected)) return false

  const valueKeys = Object.keys(value)
  const expectedKeys = Object.keys(expected)
  return valueKeys.length === expectedKeys.length
    && expectedKeys.every((key) => Object.prototype.hasOwnProperty.call(value, key)
      && isExactValue(value[key], expected[key]))
}

function cloneDefaults(): MapEffectConfig {
  return {
    version: 2,
    base: { ...CANONICAL_MAP_EFFECT_DEFAULTS.base },
    hover: { ...CANONICAL_MAP_EFFECT_DEFAULTS.hover },
    quality: { ...CANONICAL_MAP_EFFECT_DEFAULTS.quality }
  }
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
  const clamped = finiteNumber(value, fallback, 1, 8)
  return Math.round(clamped)
}

function renderScale(value: unknown): 0.25 | 0.5 | 0.75 | 1 {
  return ALLOWED_RENDER_SCALES.includes(value as 0.25 | 0.5 | 0.75 | 1)
    ? value as 0.25 | 0.5 | 0.75 | 1
    : 0.5
}

function normalizeV2Base(value: unknown): MapEffectBaseConfigV2 {
  const base = isRecord(value) ? value : {}
  return {
    innerColor: color(base.innerColor, V2_BASE_DEFAULTS.innerColor),
    innerWidth: finiteNumber(base.innerWidth, V2_BASE_DEFAULTS.innerWidth, 0, 4),
    innerOpacity: finiteNumber(base.innerOpacity, V2_BASE_DEFAULTS.innerOpacity, 0, 1),
    outerColor: color(base.outerColor, V2_BASE_DEFAULTS.outerColor),
    outerCoreWidth: finiteNumber(base.outerCoreWidth, V2_BASE_DEFAULTS.outerCoreWidth, 0, 6),
    outerGlowEnabled: finiteBoolean(base.outerGlowEnabled, V2_BASE_DEFAULTS.outerGlowEnabled),
    outerGlowColor: color(base.outerGlowColor, V2_BASE_DEFAULTS.outerGlowColor),
    outerGlowWidth: finiteNumber(base.outerGlowWidth, V2_BASE_DEFAULTS.outerGlowWidth, 0, 120),
    outerGlowStrength: finiteNumber(base.outerGlowStrength, V2_BASE_DEFAULTS.outerGlowStrength, 0, 1),
    outerGlowNearRadiusRatio: finiteNumber(
      base.outerGlowNearRadiusRatio,
      V2_BASE_DEFAULTS.outerGlowNearRadiusRatio,
      0,
      1
    ),
    outerGlowNearOpacityRatio: finiteNumber(
      base.outerGlowNearOpacityRatio,
      V2_BASE_DEFAULTS.outerGlowNearOpacityRatio,
      0,
      1
    ),
    outerGlowFarRadiusRatio: finiteNumber(
      base.outerGlowFarRadiusRatio,
      V2_BASE_DEFAULTS.outerGlowFarRadiusRatio,
      0,
      1
    ),
    outerGlowFarOpacityRatio: finiteNumber(
      base.outerGlowFarOpacityRatio,
      V2_BASE_DEFAULTS.outerGlowFarOpacityRatio,
      0,
      1
    ),
    outerGlowFalloff: finiteNumber(base.outerGlowFalloff, V2_BASE_DEFAULTS.outerGlowFalloff, 0, 4),
    outerGlowEdgeSoftness: finiteNumber(
      base.outerGlowEdgeSoftness,
      V2_BASE_DEFAULTS.outerGlowEdgeSoftness,
      0,
      1
    ),
    outerGlowNearPasses: passCount(base.outerGlowNearPasses, V2_BASE_DEFAULTS.outerGlowNearPasses),
    outerGlowFarPasses: passCount(base.outerGlowFarPasses, V2_BASE_DEFAULTS.outerGlowFarPasses)
  }
}

function normalizeV2Hover(value: unknown): MapEffectHoverConfigV2 {
  const hover = isRecord(value) ? value : {}
  return {
    surfaceColor: color(hover.surfaceColor, V2_HOVER_DEFAULTS.surfaceColor),
    emissiveColor: color(hover.emissiveColor, V2_HOVER_DEFAULTS.emissiveColor),
    emissiveIntensity: finiteNumber(
      hover.emissiveIntensity,
      V2_HOVER_DEFAULTS.emissiveIntensity,
      0,
      2
    ),
    outlineColor: color(hover.outlineColor, V2_HOVER_DEFAULTS.outlineColor),
    outlineWidth: finiteNumber(hover.outlineWidth, V2_HOVER_DEFAULTS.outlineWidth, 0, 8),
    glowEnabled: finiteBoolean(hover.glowEnabled, V2_HOVER_DEFAULTS.glowEnabled),
    glowColor: color(hover.glowColor, V2_HOVER_DEFAULTS.glowColor),
    glowWidth: finiteNumber(hover.glowWidth, V2_HOVER_DEFAULTS.glowWidth, 0, 120),
    glowStrength: finiteNumber(hover.glowStrength, V2_HOVER_DEFAULTS.glowStrength, 0, 1),
    glowNearRadiusRatio: finiteNumber(
      hover.glowNearRadiusRatio,
      V2_HOVER_DEFAULTS.glowNearRadiusRatio,
      0,
      1
    ),
    glowNearOpacityRatio: finiteNumber(
      hover.glowNearOpacityRatio,
      V2_HOVER_DEFAULTS.glowNearOpacityRatio,
      0,
      1
    ),
    glowFarRadiusRatio: finiteNumber(
      hover.glowFarRadiusRatio,
      V2_HOVER_DEFAULTS.glowFarRadiusRatio,
      0,
      1
    ),
    glowFarOpacityRatio: finiteNumber(
      hover.glowFarOpacityRatio,
      V2_HOVER_DEFAULTS.glowFarOpacityRatio,
      0,
      1
    ),
    glowFalloff: finiteNumber(hover.glowFalloff, V2_HOVER_DEFAULTS.glowFalloff, 0, 4),
    glowEdgeSoftness: finiteNumber(
      hover.glowEdgeSoftness,
      V2_HOVER_DEFAULTS.glowEdgeSoftness,
      0,
      1
    ),
    glowNearPasses: passCount(hover.glowNearPasses, V2_HOVER_DEFAULTS.glowNearPasses),
    glowFarPasses: passCount(hover.glowFarPasses, V2_HOVER_DEFAULTS.glowFarPasses),
    lift: finiteNumber(hover.lift, V2_HOVER_DEFAULTS.lift, 0, 3),
    enterMs: finiteNumber(hover.enterMs, V2_HOVER_DEFAULTS.enterMs, 0, 1000),
    leaveMs: finiteNumber(hover.leaveMs, V2_HOVER_DEFAULTS.leaveMs, 0, 1000)
  }
}

function normalizeV2Quality(value: unknown): MapEffectQualityConfig {
  const quality = isRecord(value) ? value : {}
  return {
    renderScale: renderScale(quality.renderScale),
    maxAlpha: finiteNumber(quality.maxAlpha, V2_QUALITY_DEFAULTS.maxAlpha, 0, 1)
  }
}

function normalizeV2Config(value: unknown): MapEffectConfig {
  const root = isRecord(value) ? value : {}
  if (root.version !== 2) return cloneDefaults()
  return {
    version: 2,
    base: normalizeV2Base(root.base),
    hover: normalizeV2Hover(root.hover),
    quality: normalizeV2Quality(root.quality)
  }
}

function normalizeLegacyBase(value: unknown): MapEffectBaseConfig {
  const base = isRecord(value) ? value : {}
  return {
    innerColor: color(base.innerColor, LEGACY_APPROVED_V1_DEFAULTS.base.innerColor),
    innerWidth: finiteNumber(base.innerWidth, LEGACY_APPROVED_V1_DEFAULTS.base.innerWidth, 0, 4),
    innerOpacity: finiteNumber(base.innerOpacity, LEGACY_APPROVED_V1_DEFAULTS.base.innerOpacity, 0, 1),
    outerColor: color(base.outerColor, LEGACY_APPROVED_V1_DEFAULTS.base.outerColor),
    outerCoreWidth: finiteNumber(base.outerCoreWidth, LEGACY_APPROVED_V1_DEFAULTS.base.outerCoreWidth, 0, 6),
    outerGlowWidth: finiteNumber(base.outerGlowWidth, LEGACY_APPROVED_V1_DEFAULTS.base.outerGlowWidth, 0, 120),
    outerGlowStrength: finiteNumber(
      base.outerGlowStrength,
      LEGACY_APPROVED_V1_DEFAULTS.base.outerGlowStrength,
      0,
      1
    )
  }
}

function normalizeLegacyHover(value: unknown): MapEffectHoverConfig {
  const hover = isRecord(value) ? value : {}
  return {
    surfaceColor: color(hover.surfaceColor, LEGACY_APPROVED_V1_DEFAULTS.hover.surfaceColor),
    emissiveColor: color(hover.emissiveColor, LEGACY_APPROVED_V1_DEFAULTS.hover.emissiveColor),
    emissiveIntensity: finiteNumber(
      hover.emissiveIntensity,
      LEGACY_APPROVED_V1_DEFAULTS.hover.emissiveIntensity,
      0,
      2
    ),
    outlineColor: color(hover.outlineColor, LEGACY_APPROVED_V1_DEFAULTS.hover.outlineColor),
    outlineWidth: finiteNumber(hover.outlineWidth, LEGACY_APPROVED_V1_DEFAULTS.hover.outlineWidth, 0, 8),
    glowColor: color(hover.glowColor, LEGACY_APPROVED_V1_DEFAULTS.hover.glowColor),
    glowWidth: finiteNumber(hover.glowWidth, LEGACY_APPROVED_V1_DEFAULTS.hover.glowWidth, 0, 120),
    glowStrength: finiteNumber(hover.glowStrength, LEGACY_APPROVED_V1_DEFAULTS.hover.glowStrength, 0, 1),
    lift: finiteNumber(hover.lift, LEGACY_APPROVED_V1_DEFAULTS.hover.lift, 0, 3),
    enterMs: finiteNumber(hover.enterMs, LEGACY_APPROVED_V1_DEFAULTS.hover.enterMs, 0, 1000),
    leaveMs: finiteNumber(hover.leaveMs, LEGACY_APPROVED_V1_DEFAULTS.hover.leaveMs, 0, 1000)
  }
}

function migrateLegacyConfig(value: unknown): MapEffectConfig {
  if (isExactValue(value, LEGACY_APPROVED_V1_DEFAULTS)) return cloneDefaults()

  const root = isRecord(value) ? value : {}
  if (root.version !== 1) return cloneDefaults()

  const normalized = {
    version: 1 as const,
    base: normalizeLegacyBase(root.base),
    hover: normalizeLegacyHover(root.hover)
  }

  return {
    version: 2,
    base: {
      ...V2_BASE_DEFAULTS,
      innerColor: normalized.base.innerColor,
      innerWidth: normalized.base.innerWidth,
      innerOpacity: normalized.base.innerOpacity,
      outerColor: normalized.base.outerColor,
      outerCoreWidth: normalized.base.outerCoreWidth,
      outerGlowWidth: normalized.base.outerGlowWidth,
      outerGlowStrength: normalized.base.outerGlowStrength
    },
    hover: {
      ...V2_HOVER_DEFAULTS,
      surfaceColor: normalized.hover.surfaceColor,
      emissiveColor: normalized.hover.emissiveColor,
      emissiveIntensity: normalized.hover.emissiveIntensity,
      outlineColor: normalized.hover.outlineColor,
      outlineWidth: normalized.hover.outlineWidth,
      glowColor: normalized.hover.glowColor,
      glowWidth: normalized.hover.glowWidth,
      glowStrength: normalized.hover.glowStrength,
      lift: normalized.hover.lift,
      enterMs: normalized.hover.enterMs,
      leaveMs: normalized.hover.leaveMs
    },
    quality: { ...V2_QUALITY_DEFAULTS }
  }
}

function coerceMapEffectConfig(value: unknown): MapEffectConfig {
  const root = isRecord(value) ? value : {}
  return root.version === 2 ? normalizeV2Config(root) : migrateLegacyConfig(root)
}

function parseJson(raw: string): unknown {
  return JSON.parse(raw) as unknown
}

export function normalizeMapEffectConfig(value: unknown): MapEffectConfig {
  return normalizeV2Config(value)
}

export function loadMapEffectConfig(storage?: StorageReader | null): MapEffectConfig {
  if (!storage) return cloneDefaults()

  try {
    const rawV2 = storage.getItem(MAP_EFFECT_STORAGE_KEY)
    if (rawV2 !== null) {
      return normalizeV2Config(parseJson(rawV2))
    }

    const rawV1 = storage.getItem(MAP_EFFECT_STORAGE_KEY_V1)
    if (rawV1 !== null) {
      return migrateLegacyConfig(parseJson(rawV1))
    }
  } catch {
    return cloneDefaults()
  }

  return cloneDefaults()
}

export function saveMapEffectConfig(
  storage: StorageWriter | null | undefined,
  config: MapEffectConfig
): void {
  try {
    storage?.setItem(MAP_EFFECT_STORAGE_KEY, JSON.stringify(coerceMapEffectConfig(config)))
  } catch {
    // 存储被浏览器禁用时保留本次会话状态。
  }
}

export function formatMapEffectConfig(config: MapEffectConfig): string {
  return JSON.stringify(coerceMapEffectConfig(config), null, 2)
}
