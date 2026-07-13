import {
  BASE_INWARD_GLOW_DEFAULTS,
  HOVER_INWARD_GLOW_DEFAULTS,
  cloneInwardGlowConfig,
  normalizeInwardGlowConfig,
  type MapInwardGlowConfig
} from './mapInwardGlowConfig'

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

export interface MapEffectBaseConfigV3 extends MapEffectBaseConfigV2 {
  inwardGlow: MapInwardGlowConfig
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

export interface MapEffectHoverConfigV3 extends MapEffectHoverConfigV2 {
  inwardGlow: MapInwardGlowConfig
}

export interface MapEffectQualityConfig {
  renderScale: 0.25 | 0.5 | 0.75 | 1
  maxAlpha: number
}

interface MapEffectConfigV2 {
  version: 2
  base: MapEffectBaseConfigV2
  hover: MapEffectHoverConfigV2
  quality: MapEffectQualityConfig
}

export interface MapEffectConfig {
  version: 3
  base: MapEffectBaseConfigV3
  hover: MapEffectHoverConfigV3
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

export const MAP_EFFECT_STORAGE_KEY = 'cq-map-effect-config-v3'
export const MAP_EFFECT_STORAGE_KEY_V2 = 'cq-map-effect-config-v2'
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
    innerColor: '#ffffff', innerWidth: 1.5, innerOpacity: 0.55,
    outerColor: '#ffffff', outerCoreWidth: 2, outerGlowWidth: 0, outerGlowStrength: 0
  },
  hover: {
    surfaceColor: '#7fcbff', emissiveColor: '#22b4d8', emissiveIntensity: 0.5,
    outlineColor: '#d8f5ff', outlineWidth: 2.4, glowColor: '#27a7ff',
    glowWidth: 0, glowStrength: 0, lift: 2, enterMs: 400, leaveMs: 300
  }
}

const LEGACY_INITIAL_V1_DEFAULTS: LegacyMapEffectConfig = {
  version: 1,
  base: {
    innerColor: '#4da3ff', innerWidth: 1, innerOpacity: 0.55,
    outerColor: '#7fcbff', outerCoreWidth: 1.8, outerGlowWidth: 10, outerGlowStrength: 0.3
  },
  hover: {
    surfaceColor: '#7fcbff', emissiveColor: '#168dff', emissiveIntensity: 0.8,
    outlineColor: '#d8f5ff', outlineWidth: 2.4, glowColor: '#27a7ff',
    glowWidth: 7, glowStrength: 0.35, lift: 1, enterMs: 180, leaveMs: 220
  }
}

const LEGACY_V2_BASE_DEFAULTS: Readonly<MapEffectBaseConfigV2> = Object.freeze({
  innerColor: '#ffffff', innerWidth: 1.5, innerOpacity: 0.55,
  outerColor: '#ffffff', outerCoreWidth: 2, outerGlowEnabled: true,
  outerGlowColor: '#8ab7ff', outerGlowWidth: 72, outerGlowStrength: 0.48,
  outerGlowNearRadiusRatio: 0.35, outerGlowNearOpacityRatio: 1.25,
  outerGlowFarRadiusRatio: 0.7, outerGlowFarOpacityRatio: 0.75,
  outerGlowFalloff: 0.9, outerGlowEdgeSoftness: 0.96,
  outerGlowNearPasses: 4, outerGlowFarPasses: 4
})

const LEGACY_V2_HOVER_DEFAULTS: Readonly<MapEffectHoverConfigV2> = Object.freeze({
  surfaceColor: '#7fcbff', emissiveColor: '#22b4d8', emissiveIntensity: 0.5,
  outlineColor: '#d8f5ff', outlineWidth: 2.4, glowEnabled: false,
  glowColor: '#ffffff', glowWidth: 110, glowStrength: 0.15,
  glowNearRadiusRatio: 0.35, glowNearOpacityRatio: 0.83,
  glowFarRadiusRatio: 1, glowFarOpacityRatio: 1, glowFalloff: 1,
  glowEdgeSoftness: 0.96, glowNearPasses: 2, glowFarPasses: 4,
  lift: 2, enterMs: 400, leaveMs: 300
})

const V3_BASE_DEFAULTS: MapEffectBaseConfigV2 = {
  innerColor: '#ffffff', innerWidth: 1.5, innerOpacity: 0.55,
  outerColor: '#cad6fc', outerCoreWidth: 2, outerGlowEnabled: true,
  outerGlowColor: '#8ab7ff', outerGlowWidth: 100, outerGlowStrength: 0.35,
  outerGlowNearRadiusRatio: 0.5,
  outerGlowNearOpacityRatio: 1.2, outerGlowFarRadiusRatio: 0.6,
  outerGlowFarOpacityRatio: 0.75, outerGlowFalloff: 0.9,
  outerGlowEdgeSoftness: 0.9,
  outerGlowNearPasses: 4, outerGlowFarPasses: B3_GLOW_PROFILE_DEFAULTS.farPasses
}

const V3_HOVER_DEFAULTS: MapEffectHoverConfigV2 = {
  surfaceColor: '#7fcbff', emissiveColor: '#4894db', emissiveIntensity: 0.5,
  outlineColor: '#d8f5ff', outlineWidth: 2.4, glowEnabled: true,
  glowColor: '#ffffff', glowWidth: 64, glowStrength: 0.12,
  glowNearRadiusRatio: 0.46,
  glowNearOpacityRatio: B3_GLOW_PROFILE_DEFAULTS.nearOpacityRatio,
  glowFarRadiusRatio: B3_GLOW_PROFILE_DEFAULTS.farRadiusRatio,
  glowFarOpacityRatio: B3_GLOW_PROFILE_DEFAULTS.farOpacityRatio,
  glowFalloff: B3_GLOW_PROFILE_DEFAULTS.falloff,
  glowEdgeSoftness: B3_GLOW_PROFILE_DEFAULTS.edgeSoftness,
  glowNearPasses: B3_GLOW_PROFILE_DEFAULTS.nearPasses,
  glowFarPasses: B3_GLOW_PROFILE_DEFAULTS.farPasses,
  lift: 2, enterMs: 400, leaveMs: 300
}

const V2_QUALITY_DEFAULTS: MapEffectQualityConfig = { renderScale: 0.5, maxAlpha: 1 }

function freezeMapEffectDefaults<T extends MapEffectConfig>(value: T): Readonly<T> {
  Object.freeze(value.base.inwardGlow.wave)
  Object.freeze(value.base.inwardGlow)
  Object.freeze(value.hover.inwardGlow.wave)
  Object.freeze(value.hover.inwardGlow)
  Object.freeze(value.base)
  Object.freeze(value.hover)
  Object.freeze(value.quality)
  return Object.freeze(value)
}

const CANONICAL_MAP_EFFECT_DEFAULTS = freezeMapEffectDefaults({
  version: 3 as const,
  base: { ...V3_BASE_DEFAULTS, inwardGlow: cloneInwardGlowConfig(BASE_INWARD_GLOW_DEFAULTS) },
  hover: { ...V3_HOVER_DEFAULTS, inwardGlow: cloneInwardGlowConfig(HOVER_INWARD_GLOW_DEFAULTS) },
  quality: { ...V2_QUALITY_DEFAULTS }
})

export const MAP_EFFECT_DEFAULTS: Readonly<MapEffectConfig> = CANONICAL_MAP_EFFECT_DEFAULTS

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

export function cloneMapEffectConfig(config: Readonly<MapEffectConfig>): MapEffectConfig {
  return {
    version: 3,
    base: { ...config.base, inwardGlow: cloneInwardGlowConfig(config.base.inwardGlow) },
    hover: { ...config.hover, inwardGlow: cloneInwardGlowConfig(config.hover.inwardGlow) },
    quality: { ...config.quality }
  }
}

function cloneDefaults(): MapEffectConfig {
  return cloneMapEffectConfig(CANONICAL_MAP_EFFECT_DEFAULTS)
}

export function assignMapEffectConfig(
  target: MapEffectConfig,
  source: Readonly<MapEffectConfig>
): void {
  const { inwardGlow: sourceBaseInwardGlow, ...sourceBase } = source.base
  const { inwardGlow: sourceHoverInwardGlow, ...sourceHover } = source.hover
  const { wave: sourceBaseWave, ...sourceBaseInward } = sourceBaseInwardGlow
  const { wave: sourceHoverWave, ...sourceHoverInward } = sourceHoverInwardGlow

  Object.assign(target.base, sourceBase)
  Object.assign(target.hover, sourceHover)
  Object.assign(target.quality, source.quality)
  target.version = 3
  Object.assign(target.base.inwardGlow, sourceBaseInward)
  Object.assign(target.hover.inwardGlow, sourceHoverInward)
  Object.assign(target.base.inwardGlow.wave, sourceBaseWave)
  Object.assign(target.hover.inwardGlow.wave, sourceHoverWave)
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

function renderScale(value: unknown): 0.25 | 0.5 | 0.75 | 1 {
  return ALLOWED_RENDER_SCALES.includes(value as 0.25 | 0.5 | 0.75 | 1)
    ? value as 0.25 | 0.5 | 0.75 | 1
    : 0.5
}

function normalizeBase(
  value: unknown,
  defaults: Readonly<MapEffectBaseConfigV2>
): MapEffectBaseConfigV2 {
  const base = isRecord(value) ? value : {}
  return {
    innerColor: color(base.innerColor, defaults.innerColor),
    innerWidth: finiteNumber(base.innerWidth, defaults.innerWidth, 0, 4),
    innerOpacity: finiteNumber(base.innerOpacity, defaults.innerOpacity, 0, 1),
    outerColor: color(base.outerColor, defaults.outerColor),
    outerCoreWidth: finiteNumber(base.outerCoreWidth, defaults.outerCoreWidth, 0, 6),
    outerGlowEnabled: finiteBoolean(base.outerGlowEnabled, defaults.outerGlowEnabled),
    outerGlowColor: color(base.outerGlowColor, defaults.outerGlowColor),
    outerGlowWidth: finiteNumber(base.outerGlowWidth, defaults.outerGlowWidth, 0, 200),
    outerGlowStrength: finiteNumber(base.outerGlowStrength, defaults.outerGlowStrength, 0, 1),
    outerGlowNearRadiusRatio: finiteNumber(base.outerGlowNearRadiusRatio, defaults.outerGlowNearRadiusRatio, 0, 1.5),
    outerGlowNearOpacityRatio: finiteNumber(base.outerGlowNearOpacityRatio, defaults.outerGlowNearOpacityRatio, 0, 2),
    outerGlowFarRadiusRatio: finiteNumber(base.outerGlowFarRadiusRatio, defaults.outerGlowFarRadiusRatio, 0.25, 2),
    outerGlowFarOpacityRatio: finiteNumber(base.outerGlowFarOpacityRatio, defaults.outerGlowFarOpacityRatio, 0, 2),
    outerGlowFalloff: finiteNumber(base.outerGlowFalloff, defaults.outerGlowFalloff, 0.25, 4),
    outerGlowEdgeSoftness: finiteNumber(base.outerGlowEdgeSoftness, defaults.outerGlowEdgeSoftness, 0, 1),
    outerGlowNearPasses: passCount(base.outerGlowNearPasses, defaults.outerGlowNearPasses),
    outerGlowFarPasses: passCount(base.outerGlowFarPasses, defaults.outerGlowFarPasses)
  }
}

function normalizeV2Base(value: unknown): MapEffectBaseConfigV2 {
  return normalizeBase(value, LEGACY_V2_BASE_DEFAULTS)
}

function normalizeV3Base(value: unknown): MapEffectBaseConfigV2 {
  return normalizeBase(value, V3_BASE_DEFAULTS)
}

function normalizeHover(
  value: unknown,
  defaults: Readonly<MapEffectHoverConfigV2>
): MapEffectHoverConfigV2 {
  const hover = isRecord(value) ? value : {}
  return {
    surfaceColor: color(hover.surfaceColor, defaults.surfaceColor),
    emissiveColor: color(hover.emissiveColor, defaults.emissiveColor),
    emissiveIntensity: finiteNumber(hover.emissiveIntensity, defaults.emissiveIntensity, 0, 2),
    outlineColor: color(hover.outlineColor, defaults.outlineColor),
    outlineWidth: finiteNumber(hover.outlineWidth, defaults.outlineWidth, 0, 8),
    glowEnabled: finiteBoolean(hover.glowEnabled, defaults.glowEnabled),
    glowColor: color(hover.glowColor, defaults.glowColor),
    glowWidth: finiteNumber(hover.glowWidth, defaults.glowWidth, 0, 200),
    glowStrength: finiteNumber(hover.glowStrength, defaults.glowStrength, 0, 1),
    glowNearRadiusRatio: finiteNumber(hover.glowNearRadiusRatio, defaults.glowNearRadiusRatio, 0, 1.5),
    glowNearOpacityRatio: finiteNumber(hover.glowNearOpacityRatio, defaults.glowNearOpacityRatio, 0, 2),
    glowFarRadiusRatio: finiteNumber(hover.glowFarRadiusRatio, defaults.glowFarRadiusRatio, 0.25, 2),
    glowFarOpacityRatio: finiteNumber(hover.glowFarOpacityRatio, defaults.glowFarOpacityRatio, 0, 2),
    glowFalloff: finiteNumber(hover.glowFalloff, defaults.glowFalloff, 0.25, 4),
    glowEdgeSoftness: finiteNumber(hover.glowEdgeSoftness, defaults.glowEdgeSoftness, 0, 1),
    glowNearPasses: passCount(hover.glowNearPasses, defaults.glowNearPasses),
    glowFarPasses: passCount(hover.glowFarPasses, defaults.glowFarPasses),
    lift: finiteNumber(hover.lift, defaults.lift, 0, 3),
    enterMs: finiteNumber(hover.enterMs, defaults.enterMs, 0, 1000),
    leaveMs: finiteNumber(hover.leaveMs, defaults.leaveMs, 0, 1000)
  }
}

function normalizeV2Hover(value: unknown): MapEffectHoverConfigV2 {
  return normalizeHover(value, LEGACY_V2_HOVER_DEFAULTS)
}

function normalizeV3Hover(value: unknown): MapEffectHoverConfigV2 {
  return normalizeHover(value, V3_HOVER_DEFAULTS)
}

function normalizeV2Quality(value: unknown): MapEffectQualityConfig {
  const quality = isRecord(value) ? value : {}
  return {
    renderScale: renderScale(quality.renderScale),
    maxAlpha: finiteNumber(quality.maxAlpha, V2_QUALITY_DEFAULTS.maxAlpha, 0.1, 1)
  }
}

function normalizeV2Config(value: unknown): MapEffectConfigV2 | null {
  const root = isRecord(value) ? value : {}
  if (root.version !== 2) return null
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
    outerGlowStrength: finiteNumber(base.outerGlowStrength, LEGACY_APPROVED_V1_DEFAULTS.base.outerGlowStrength, 0, 1)
  }
}

function normalizeLegacyHover(value: unknown): MapEffectHoverConfig {
  const hover = isRecord(value) ? value : {}
  return {
    surfaceColor: color(hover.surfaceColor, LEGACY_APPROVED_V1_DEFAULTS.hover.surfaceColor),
    emissiveColor: color(hover.emissiveColor, LEGACY_APPROVED_V1_DEFAULTS.hover.emissiveColor),
    emissiveIntensity: finiteNumber(hover.emissiveIntensity, LEGACY_APPROVED_V1_DEFAULTS.hover.emissiveIntensity, 0, 2),
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

function migrateV2Config(value: unknown): MapEffectConfig {
  const v2 = normalizeV2Config(value)
  if (!v2) return cloneDefaults()
  return {
    version: 3,
    base: { ...v2.base, inwardGlow: cloneInwardGlowConfig(BASE_INWARD_GLOW_DEFAULTS) },
    hover: { ...v2.hover, inwardGlow: cloneInwardGlowConfig(HOVER_INWARD_GLOW_DEFAULTS) },
    quality: { ...v2.quality }
  }
}

function migrateLegacyConfig(value: unknown): MapEffectConfig {
  if (isExactValue(value, LEGACY_APPROVED_V1_DEFAULTS) || isExactValue(value, LEGACY_INITIAL_V1_DEFAULTS)) {
    return cloneDefaults()
  }
  const root = isRecord(value) ? value : {}
  if (root.version !== 1) return cloneDefaults()
  const base = normalizeLegacyBase(root.base)
  const hover = normalizeLegacyHover(root.hover)
  const defaults = cloneDefaults()
  return {
    version: 3,
    base: { ...defaults.base, ...base },
    hover: { ...defaults.hover, ...hover },
    quality: defaults.quality
  }
}

export function normalizeMapEffectConfig(value: unknown): MapEffectConfig {
  const root = isRecord(value) ? value : {}
  if (root.version !== 3) return cloneDefaults()
  return {
    version: 3,
    base: {
      ...normalizeV3Base(root.base),
      inwardGlow: normalizeInwardGlowConfig(
        isRecord(root.base) ? root.base.inwardGlow : undefined,
        BASE_INWARD_GLOW_DEFAULTS
      )
    },
    hover: {
      ...normalizeV3Hover(root.hover),
      inwardGlow: normalizeInwardGlowConfig(
        isRecord(root.hover) ? root.hover.inwardGlow : undefined,
        HOVER_INWARD_GLOW_DEFAULTS
      )
    },
    quality: normalizeV2Quality(root.quality)
  }
}

function parseJson(raw: string): unknown {
  return JSON.parse(raw) as unknown
}

export function loadMapEffectConfig(storage?: StorageReader | null): MapEffectConfig {
  if (!storage) return cloneDefaults()
  try {
    const rawV3 = storage.getItem(MAP_EFFECT_STORAGE_KEY)
    if (rawV3 !== null) return normalizeMapEffectConfig(parseJson(rawV3))

    const rawV2 = storage.getItem(MAP_EFFECT_STORAGE_KEY_V2)
    if (rawV2 !== null) return migrateV2Config(parseJson(rawV2))

    const rawV1 = storage.getItem(MAP_EFFECT_STORAGE_KEY_V1)
    if (rawV1 !== null) return migrateLegacyConfig(parseJson(rawV1))
  } catch {
    return cloneDefaults()
  }
  return cloneDefaults()
}

export function saveMapEffectConfig(
  storage: StorageWriter | null | undefined,
  config: Readonly<MapEffectConfig>
): void {
  try {
    storage?.setItem(MAP_EFFECT_STORAGE_KEY, JSON.stringify(normalizeMapEffectConfig(config)))
  } catch {
    // 存储被浏览器禁用时保留本次会话状态。
  }
}

export function formatMapEffectConfig(config: Readonly<MapEffectConfig>): string {
  return JSON.stringify(normalizeMapEffectConfig(config), null, 2)
}
