export interface MapHudAnchorConfig {
  x: number
  z: number
  elevation: number
}

export interface MapHudStaticLayerConfig {
  enabled: boolean
  diameter: number
  opacity: number
  phaseDeg: number
  elevationOffset: number
}

export interface MapHudRotatingLayerConfig extends MapHudStaticLayerConfig {
  speedDegPerSecond: number
}

export interface MapHudConfig {
  version: 1
  anchor: MapHudAnchorConfig
  static: MapHudStaticLayerConfig
  rotating: MapHudRotatingLayerConfig
}

export const MAP_HUD_DEFAULTS: Readonly<MapHudConfig> = Object.freeze({
  version: 1,
  anchor: Object.freeze({ x: 1.7, z: 2.8, elevation: 0.1 }),
  static: Object.freeze({
    enabled: true,
    diameter: 145,
    opacity: 0.4,
    phaseDeg: 0,
    elevationOffset: 0
  }),
  rotating: Object.freeze({
    enabled: true,
    diameter: 93,
    opacity: 0.5,
    phaseDeg: 0,
    elevationOffset: 0.05,
    speedDegPerSecond: 6
  })
})

const LIMITS = {
  anchorOffset: 150,
  elevation: 20,
  layerElevation: 5,
  diameter: { min: 20, max: 300 },
  opacity: { min: 0, max: 1 },
  phaseDeg: { min: 0, max: 360 },
  speedDegPerSecond: { min: -30, max: 30 }
} as const

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function numberIn(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback
}

function boolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeAnchor(value: unknown): MapHudAnchorConfig {
  const anchor = isRecord(value) ? value : {}
  return {
    x: numberIn(anchor.x, MAP_HUD_DEFAULTS.anchor.x, -LIMITS.anchorOffset, LIMITS.anchorOffset),
    z: numberIn(anchor.z, MAP_HUD_DEFAULTS.anchor.z, -LIMITS.anchorOffset, LIMITS.anchorOffset),
    elevation: numberIn(anchor.elevation, MAP_HUD_DEFAULTS.anchor.elevation, -LIMITS.elevation, LIMITS.elevation)
  }
}

function normalizeStatic(value: unknown): MapHudStaticLayerConfig {
  const layer = isRecord(value) ? value : {}
  return {
    enabled: boolean(layer.enabled, MAP_HUD_DEFAULTS.static.enabled),
    diameter: numberIn(layer.diameter, MAP_HUD_DEFAULTS.static.diameter, LIMITS.diameter.min, LIMITS.diameter.max),
    opacity: numberIn(layer.opacity, MAP_HUD_DEFAULTS.static.opacity, LIMITS.opacity.min, LIMITS.opacity.max),
    phaseDeg: numberIn(layer.phaseDeg, MAP_HUD_DEFAULTS.static.phaseDeg, LIMITS.phaseDeg.min, LIMITS.phaseDeg.max),
    elevationOffset: numberIn(
      layer.elevationOffset,
      MAP_HUD_DEFAULTS.static.elevationOffset,
      -LIMITS.layerElevation,
      LIMITS.layerElevation
    )
  }
}

function normalizeRotating(value: unknown): MapHudRotatingLayerConfig {
  const layer = isRecord(value) ? value : {}
  const base = normalizeStatic(value)
  return {
    ...base,
    enabled: boolean(layer.enabled, MAP_HUD_DEFAULTS.rotating.enabled),
    diameter: numberIn(layer.diameter, MAP_HUD_DEFAULTS.rotating.diameter, LIMITS.diameter.min, LIMITS.diameter.max),
    opacity: numberIn(layer.opacity, MAP_HUD_DEFAULTS.rotating.opacity, LIMITS.opacity.min, LIMITS.opacity.max),
    phaseDeg: numberIn(layer.phaseDeg, MAP_HUD_DEFAULTS.rotating.phaseDeg, LIMITS.phaseDeg.min, LIMITS.phaseDeg.max),
    elevationOffset: numberIn(
      layer.elevationOffset,
      MAP_HUD_DEFAULTS.rotating.elevationOffset,
      -LIMITS.layerElevation,
      LIMITS.layerElevation
    ),
    speedDegPerSecond: numberIn(
      layer.speedDegPerSecond,
      MAP_HUD_DEFAULTS.rotating.speedDegPerSecond,
      LIMITS.speedDegPerSecond.min,
      LIMITS.speedDegPerSecond.max
    )
  }
}

export function normalizeMapHudConfig(value: unknown): MapHudConfig {
  const root = isRecord(value) ? value : {}
  if (root.version !== 1) return cloneMapHudConfig(MAP_HUD_DEFAULTS)
  return {
    version: 1,
    anchor: normalizeAnchor(root.anchor),
    static: normalizeStatic(root.static),
    rotating: normalizeRotating(root.rotating)
  }
}

export function cloneMapHudConfig(config: Readonly<MapHudConfig>): MapHudConfig {
  return {
    version: 1,
    anchor: { ...config.anchor },
    static: { ...config.static },
    rotating: { ...config.rotating }
  }
}

export function assignMapHudConfig(target: MapHudConfig, source: Readonly<MapHudConfig>): void {
  target.version = 1
  Object.assign(target.anchor, source.anchor)
  Object.assign(target.static, source.static)
  Object.assign(target.rotating, source.rotating)
}

export function formatMapHudConfig(config: Readonly<MapHudConfig>): string {
  return JSON.stringify(normalizeMapHudConfig(config), null, 2)
}

export const MAP_HUD_LIMITS = LIMITS
