import {
  BASE_INWARD_GLOW_DEFAULTS,
  HOVER_INWARD_GLOW_DEFAULTS,
  cloneInwardGlowConfig,
  normalizeInwardGlowConfig,
  type MapInwardGlowConfig
} from './mapInwardGlowConfig'
import {
  MAP_DISTRICT_BAR_DEFAULTS,
  cloneDistrictBarConfig,
  normalizeDistrictBarConfig,
  type MapDistrictBarConfig
} from './mapDistrictBarConfig'
import {
  HOVER_MOSAIC_PARTICLE_DEFAULTS,
  cloneMosaicParticleConfig,
  normalizeMosaicParticleConfig,
  type MapMosaicParticleConfig
} from './mapMosaicParticleConfig'

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

export interface MapEffectBaseConfigV4 extends MapEffectBaseConfigV2 {
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

export interface MapEffectHoverConfigV4 extends MapEffectHoverConfigV2 {
  inwardGlow: MapInwardGlowConfig
  mosaicParticles: MapMosaicParticleConfig
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

export interface MapEffectConfigV4 {
  version: 4
  base: MapEffectBaseConfigV4
  hover: MapEffectHoverConfigV4
  quality: MapEffectQualityConfig
}

export interface MapEffectConfig {
  version: 5
  base: MapEffectBaseConfigV4
  hover: MapEffectHoverConfigV4
  quality: MapEffectQualityConfig
  bars: MapDistrictBarConfig
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

export const MAP_EFFECT_STORAGE_KEY = 'cq-map-effect-config-v5'
export const MAP_EFFECT_STORAGE_KEY_V4 = 'cq-map-effect-config-v4'
export const MAP_EFFECT_STORAGE_KEY_V3 = 'cq-map-effect-config-v3'
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

const V4_BASE_DEFAULTS: Readonly<MapEffectBaseConfigV2> = Object.freeze({
  innerColor: '#ffffff', innerWidth: 1.5, innerOpacity: 0.55,
  outerColor: '#cad6fc', outerCoreWidth: 2, outerGlowEnabled: true,
  outerGlowColor: '#8ab7ff', outerGlowWidth: 100, outerGlowStrength: 0.35,
  outerGlowNearRadiusRatio: 0.5, outerGlowNearOpacityRatio: 1.2,
  outerGlowFarRadiusRatio: 0.6, outerGlowFarOpacityRatio: 0.75,
  outerGlowFalloff: 0.9, outerGlowEdgeSoftness: 0.9,
  outerGlowNearPasses: 4, outerGlowFarPasses: B3_GLOW_PROFILE_DEFAULTS.farPasses
})

const V4_HOVER_DEFAULTS: Readonly<MapEffectHoverConfigV2> = Object.freeze({
  surfaceColor: '#000000', emissiveColor: '#5edaf3', emissiveIntensity: 0.25,
  outlineColor: '#d8f5ff', outlineWidth: 2.4, glowEnabled: true,
  glowColor: '#ffffff', glowWidth: 64, glowStrength: 0.12,
  glowNearRadiusRatio: 0.46, glowNearOpacityRatio: B3_GLOW_PROFILE_DEFAULTS.nearOpacityRatio,
  glowFarRadiusRatio: B3_GLOW_PROFILE_DEFAULTS.farRadiusRatio,
  glowFarOpacityRatio: B3_GLOW_PROFILE_DEFAULTS.farOpacityRatio,
  glowFalloff: B3_GLOW_PROFILE_DEFAULTS.falloff,
  glowEdgeSoftness: B3_GLOW_PROFILE_DEFAULTS.edgeSoftness,
  glowNearPasses: B3_GLOW_PROFILE_DEFAULTS.nearPasses,
  glowFarPasses: B3_GLOW_PROFILE_DEFAULTS.farPasses,
  lift: 2, enterMs: 400, leaveMs: 300
})

const QUALITY_DEFAULTS: Readonly<MapEffectQualityConfig> = Object.freeze({
  renderScale: 0.5,
  maxAlpha: 1
})

function freezeMapEffectDefaults<T extends MapEffectConfig>(value: T): Readonly<T> {
  Object.freeze(value.base.inwardGlow)
  Object.freeze(value.hover.inwardGlow)
  Object.freeze(value.hover.mosaicParticles)
  Object.freeze(value.base)
  Object.freeze(value.hover)
  Object.freeze(value.quality)
  Object.freeze(value.bars)
  return Object.freeze(value)
}

const CANONICAL_MAP_EFFECT_DEFAULTS = freezeMapEffectDefaults({
  version: 5 as const,
  base: { ...V4_BASE_DEFAULTS, inwardGlow: cloneInwardGlowConfig(BASE_INWARD_GLOW_DEFAULTS) },
  hover: {
    ...V4_HOVER_DEFAULTS,
    inwardGlow: cloneInwardGlowConfig(HOVER_INWARD_GLOW_DEFAULTS),
    mosaicParticles: cloneMosaicParticleConfig(HOVER_MOSAIC_PARTICLE_DEFAULTS)
  },
  quality: { ...QUALITY_DEFAULTS },
  bars: cloneDistrictBarConfig(MAP_DISTRICT_BAR_DEFAULTS)
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
    version: 5,
    base: { ...config.base, inwardGlow: cloneInwardGlowConfig(config.base.inwardGlow) },
    hover: {
      ...config.hover,
      inwardGlow: cloneInwardGlowConfig(config.hover.inwardGlow),
      mosaicParticles: cloneMosaicParticleConfig(config.hover.mosaicParticles)
    },
    quality: { ...config.quality },
    bars: cloneDistrictBarConfig(config.bars)
  }
}

function cloneDefaults(): MapEffectConfig {
  return cloneMapEffectConfig(CANONICAL_MAP_EFFECT_DEFAULTS)
}

export function assignMapEffectConfig(
  target: MapEffectConfig,
  source: Readonly<MapEffectConfig>
): void {
  const { inwardGlow: sourceBaseInward, ...sourceBase } = source.base
  const {
    inwardGlow: sourceHoverInward,
    mosaicParticles: sourceMosaicParticles,
    ...sourceHover
  } = source.hover
  const bars = target.bars

  Object.assign(target.base, sourceBase)
  Object.assign(target.hover, sourceHover)
  Object.assign(target.quality, source.quality)
  Object.assign(target.base.inwardGlow, sourceBaseInward)
  Object.assign(target.hover.inwardGlow, sourceHoverInward)
  Object.assign(target.hover.mosaicParticles, sourceMosaicParticles)
  Object.assign(bars, source.bars)
  target.bars = bars
  target.version = 5
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

function renderScale(value: unknown): MapEffectQualityConfig['renderScale'] {
  return ALLOWED_RENDER_SCALES.includes(value as MapEffectQualityConfig['renderScale'])
    ? value as MapEffectQualityConfig['renderScale']
    : QUALITY_DEFAULTS.renderScale
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

function normalizeQuality(value: unknown): MapEffectQualityConfig {
  const quality = isRecord(value) ? value : {}
  return {
    renderScale: renderScale(quality.renderScale),
    maxAlpha: finiteNumber(quality.maxAlpha, QUALITY_DEFAULTS.maxAlpha, 0.1, 1)
  }
}

function normalizeV2Config(value: unknown): MapEffectConfigV2 | null {
  const root = isRecord(value) ? value : {}
  if (root.version !== 2) return null
  return {
    version: 2,
    base: normalizeBase(root.base, LEGACY_V2_BASE_DEFAULTS),
    hover: normalizeHover(root.hover, LEGACY_V2_HOVER_DEFAULTS),
    quality: normalizeQuality(root.quality)
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

function normalizeV4Config(value: unknown): MapEffectConfigV4 | null {
  const root = isRecord(value) ? value : {}
  if (root.version !== 4) return null
  const base = isRecord(root.base) ? root.base : {}
  const hover = isRecord(root.hover) ? root.hover : {}
  return {
    version: 4,
    base: {
      ...normalizeBase(base, V4_BASE_DEFAULTS),
      inwardGlow: normalizeInwardGlowConfig(base.inwardGlow, BASE_INWARD_GLOW_DEFAULTS)
    },
    hover: {
      ...normalizeHover(hover, V4_HOVER_DEFAULTS),
      inwardGlow: normalizeInwardGlowConfig(hover.inwardGlow, HOVER_INWARD_GLOW_DEFAULTS),
      mosaicParticles: normalizeMosaicParticleConfig(hover.mosaicParticles)
    },
    quality: normalizeQuality(root.quality)
  }
}

function migrateV4Config(value: unknown): MapEffectConfig {
  const root = isRecord(value) ? value : {}
  const v4 = normalizeV4Config(value)
  if (!v4) return cloneDefaults()
  return {
    version: 5,
    base: { ...v4.base, inwardGlow: cloneInwardGlowConfig(v4.base.inwardGlow) },
    hover: {
      ...v4.hover,
      inwardGlow: cloneInwardGlowConfig(v4.hover.inwardGlow),
      mosaicParticles: cloneMosaicParticleConfig(v4.hover.mosaicParticles)
    },
    quality: { ...v4.quality },
    bars: normalizeDistrictBarConfig(root.bars)
  }
}

function migrateV3Config(value: unknown): MapEffectConfig {
  const root = isRecord(value) ? value : {}
  if (root.version !== 3) return cloneDefaults()
  const base = isRecord(root.base) ? root.base : {}
  const hover = isRecord(root.hover) ? root.hover : {}
  return {
    version: 5,
    base: {
      ...normalizeBase(base, V4_BASE_DEFAULTS),
      inwardGlow: normalizeInwardGlowConfig(base.inwardGlow, BASE_INWARD_GLOW_DEFAULTS)
    },
    hover: {
      ...normalizeHover(hover, V4_HOVER_DEFAULTS),
      inwardGlow: normalizeInwardGlowConfig(hover.inwardGlow, HOVER_INWARD_GLOW_DEFAULTS),
      mosaicParticles: cloneMosaicParticleConfig(HOVER_MOSAIC_PARTICLE_DEFAULTS)
    },
    quality: normalizeQuality(root.quality),
    bars: cloneDistrictBarConfig(MAP_DISTRICT_BAR_DEFAULTS)
  }
}

function migrateV2Config(value: unknown): MapEffectConfig {
  const v2 = normalizeV2Config(value)
  if (!v2) return cloneDefaults()
  return {
    version: 5,
    base: { ...v2.base, inwardGlow: cloneInwardGlowConfig(BASE_INWARD_GLOW_DEFAULTS) },
    hover: {
      ...v2.hover,
      inwardGlow: cloneInwardGlowConfig(HOVER_INWARD_GLOW_DEFAULTS),
      mosaicParticles: cloneMosaicParticleConfig(HOVER_MOSAIC_PARTICLE_DEFAULTS)
    },
    quality: { ...v2.quality },
    bars: cloneDistrictBarConfig(MAP_DISTRICT_BAR_DEFAULTS)
  }
}

function migrateLegacyConfig(value: unknown): MapEffectConfig {
  if (isExactValue(value, LEGACY_APPROVED_V1_DEFAULTS)
    || isExactValue(value, LEGACY_INITIAL_V1_DEFAULTS)) return cloneDefaults()
  const root = isRecord(value) ? value : {}
  if (root.version !== 1) return cloneDefaults()
  const base = normalizeLegacyBase(root.base)
  const hover = normalizeLegacyHover(root.hover)
  const defaults = cloneDefaults()
  return {
    version: 5,
    base: { ...defaults.base, ...base },
    hover: {
      ...defaults.hover,
      ...hover,
      mosaicParticles: cloneMosaicParticleConfig(defaults.hover.mosaicParticles)
    },
    quality: { ...defaults.quality },
    bars: cloneDistrictBarConfig(MAP_DISTRICT_BAR_DEFAULTS)
  }
}

export function normalizeMapEffectConfig(value: unknown): MapEffectConfig {
  const root = isRecord(value) ? value : {}
  if (root.version !== 5) return cloneDefaults()
  const base = isRecord(root.base) ? root.base : {}
  const hover = isRecord(root.hover) ? root.hover : {}
  return {
    version: 5,
    base: {
      ...normalizeBase(base, V4_BASE_DEFAULTS),
      inwardGlow: normalizeInwardGlowConfig(base.inwardGlow, BASE_INWARD_GLOW_DEFAULTS)
    },
    hover: {
      ...normalizeHover(hover, V4_HOVER_DEFAULTS),
      inwardGlow: normalizeInwardGlowConfig(hover.inwardGlow, HOVER_INWARD_GLOW_DEFAULTS),
      mosaicParticles: normalizeMosaicParticleConfig(hover.mosaicParticles)
    },
    quality: normalizeQuality(root.quality),
    bars: normalizeDistrictBarConfig(root.bars)
  }
}

function parseJson(raw: string): unknown {
  return JSON.parse(raw) as unknown
}

// 柱体调试值仅在本次会话内生效；每次页面加载都回到代码固化的基线参数。
function resetBarsOnLoad(config: MapEffectConfig): MapEffectConfig {
  return { ...config, bars: cloneDistrictBarConfig(MAP_DISTRICT_BAR_DEFAULTS) }
}

export function loadMapEffectConfig(storage?: StorageReader | null): MapEffectConfig {
  if (!storage) return cloneDefaults()
  try {
    const rawV5 = storage.getItem(MAP_EFFECT_STORAGE_KEY)
    if (rawV5 !== null) return resetBarsOnLoad(normalizeMapEffectConfig(parseJson(rawV5)))

    const rawV4 = storage.getItem(MAP_EFFECT_STORAGE_KEY_V4)
    if (rawV4 !== null) return resetBarsOnLoad(migrateV4Config(parseJson(rawV4)))

    const rawV3 = storage.getItem(MAP_EFFECT_STORAGE_KEY_V3)
    if (rawV3 !== null) return resetBarsOnLoad(migrateV3Config(parseJson(rawV3)))

    const rawV2 = storage.getItem(MAP_EFFECT_STORAGE_KEY_V2)
    if (rawV2 !== null) return resetBarsOnLoad(migrateV2Config(parseJson(rawV2)))

    const rawV1 = storage.getItem(MAP_EFFECT_STORAGE_KEY_V1)
    if (rawV1 !== null) return resetBarsOnLoad(migrateLegacyConfig(parseJson(rawV1)))
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
