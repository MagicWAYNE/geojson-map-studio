export interface MapDistrictBarBadgeOverlayConfig {
  enabled: boolean
  minWidth: number
  height: number
  paddingX: number
  gapY: number
  offsetX: number
  offsetY: number
  backgroundColor: string
  backgroundOpacity: number
  borderColor: string
  borderWidth: number
  borderRadius: number
  textColor: string
  fontSize: number
  fontWeight: number
  shadowColor: string
  shadowBlur: number
  shadowOpacity: number
  decimals: number
  thousandsSeparator: boolean
  hideOnHover: boolean
  enterDelayMs: number
  enterMs: number
  staggerMs: number
}

export interface MapDistrictBarPanelOverlayConfig {
  enabled: boolean
  preferredSide: 'left' | 'right'
  gapX: number
  offsetY: number
  width: number
  minHeight: number
  viewportPadding: number
  backgroundColor: string
  backgroundOpacity: number
  borderColor: string
  borderWidth: number
  borderRadius: number
  paddingTop: number
  paddingRight: number
  paddingBottom: number
  paddingLeft: number
  rowGap: number
  titleAssetWidth: number
  titleAssetHeight: number
  titleOffsetX: number
  titleOffsetY: number
  titleTextOffsetX: number
  titleTextOffsetY: number
  titleColor: string
  titleFontSize: number
  titleFontWeight: number
  labelColor: string
  labelFontSize: number
  labelFontWeight: number
  valueColor: string
  valueFontSize: number
  valueFontWeight: number
  unitColor: string
  unitFontSize: number
  unitFontWeight: number
  caseDecimals: number
  amountDecimals: number
  thousandsSeparator: boolean
  enterMs: number
  leaveMs: number
  enterScale: number
}

export interface MapDistrictBarOverlayCollisionConfig {
  badgeCollisionEnabled: boolean
  badgeCollisionGap: number
  badgeMaxShift: number
}

export interface MapDistrictBarOverlayConfig {
  enabled: boolean
  badge: MapDistrictBarBadgeOverlayConfig
  panel: MapDistrictBarPanelOverlayConfig
  collision: MapDistrictBarOverlayCollisionConfig
}

type KeysMatching<T, Value> = {
  [Key in keyof T]-?: T[Key] extends Value ? Key : never
}[keyof T]

type NumberConstraints<T> = {
  readonly [Key in KeysMatching<T, number>]: MapDistrictBarOverlayNumberConstraint
}

export interface MapDistrictBarOverlayNumberConstraint {
  readonly min: number
  readonly max: number
  readonly step: number
}

export type MapDistrictBarOverlayBooleanPath =
  | readonly ['enabled']
  | readonly ['badge', KeysMatching<MapDistrictBarBadgeOverlayConfig, boolean>]
  | readonly ['panel', KeysMatching<MapDistrictBarPanelOverlayConfig, boolean>]
  | readonly ['collision', KeysMatching<MapDistrictBarOverlayCollisionConfig, boolean>]

export type MapDistrictBarOverlayNumberPath =
  | readonly ['badge', KeysMatching<MapDistrictBarBadgeOverlayConfig, number>]
  | readonly ['panel', KeysMatching<MapDistrictBarPanelOverlayConfig, number>]
  | readonly ['collision', KeysMatching<MapDistrictBarOverlayCollisionConfig, number>]

export type MapDistrictBarOverlayColorPath =
  | readonly ['badge', KeysMatching<MapDistrictBarBadgeOverlayConfig, string>]
  | readonly [
    'panel',
    Exclude<KeysMatching<MapDistrictBarPanelOverlayConfig, string>, 'preferredSide'>
  ]

export type MapDistrictBarOverlaySelectPath = readonly ['panel', 'preferredSide']

export const MAP_DISTRICT_BAR_OVERLAY_NUMBER_CONSTRAINTS = {
  badge: {
    minWidth: { min: 48, max: 180, step: 1 },
    height: { min: 24, max: 60, step: 1 },
    paddingX: { min: 0, max: 40, step: 1 },
    gapY: { min: 0, max: 80, step: 1 },
    offsetX: { min: -200, max: 200, step: 1 },
    offsetY: { min: -200, max: 200, step: 1 },
    backgroundOpacity: { min: 0, max: 1, step: 0.01 },
    borderWidth: { min: 0, max: 8, step: 0.1 },
    borderRadius: { min: 0, max: 40, step: 1 },
    fontSize: { min: 12, max: 40, step: 1 },
    fontWeight: { min: 100, max: 900, step: 100 },
    shadowBlur: { min: 0, max: 40, step: 1 },
    shadowOpacity: { min: 0, max: 1, step: 0.01 },
    decimals: { min: 0, max: 4, step: 1 },
    enterDelayMs: { min: 0, max: 1000, step: 10 },
    enterMs: { min: 0, max: 1000, step: 10 },
    staggerMs: { min: 0, max: 1000, step: 10 }
  },
  panel: {
    gapX: { min: 0, max: 80, step: 1 },
    offsetY: { min: -200, max: 200, step: 1 },
    width: { min: 240, max: 520, step: 1 },
    minHeight: { min: 90, max: 220, step: 1 },
    viewportPadding: { min: 0, max: 80, step: 1 },
    backgroundOpacity: { min: 0, max: 1, step: 0.01 },
    borderWidth: { min: 0, max: 8, step: 0.1 },
    borderRadius: { min: 0, max: 40, step: 1 },
    paddingTop: { min: 0, max: 80, step: 1 },
    paddingRight: { min: 0, max: 80, step: 1 },
    paddingBottom: { min: 0, max: 80, step: 1 },
    paddingLeft: { min: 0, max: 80, step: 1 },
    rowGap: { min: 0, max: 80, step: 1 },
    titleAssetWidth: { min: 80, max: 220, step: 1 },
    titleAssetHeight: { min: 24, max: 120, step: 1 },
    titleOffsetX: { min: -80, max: 80, step: 1 },
    titleOffsetY: { min: -80, max: 80, step: 1 },
    titleTextOffsetX: { min: -80, max: 80, step: 1 },
    titleTextOffsetY: { min: -80, max: 80, step: 1 },
    titleFontSize: { min: 12, max: 40, step: 1 },
    titleFontWeight: { min: 100, max: 900, step: 100 },
    labelFontSize: { min: 12, max: 40, step: 1 },
    labelFontWeight: { min: 100, max: 900, step: 100 },
    valueFontSize: { min: 12, max: 40, step: 1 },
    valueFontWeight: { min: 100, max: 900, step: 100 },
    unitFontSize: { min: 12, max: 40, step: 1 },
    unitFontWeight: { min: 100, max: 900, step: 100 },
    caseDecimals: { min: 0, max: 4, step: 1 },
    amountDecimals: { min: 0, max: 4, step: 1 },
    enterMs: { min: 0, max: 1000, step: 10 },
    leaveMs: { min: 0, max: 1000, step: 10 },
    enterScale: { min: 0.5, max: 1, step: 0.01 }
  },
  collision: {
    badgeCollisionGap: { min: 0, max: 80, step: 1 },
    badgeMaxShift: { min: 0, max: 200, step: 1 }
  }
} as const satisfies {
  readonly badge: NumberConstraints<MapDistrictBarBadgeOverlayConfig>
  readonly panel: NumberConstraints<MapDistrictBarPanelOverlayConfig>
  readonly collision: NumberConstraints<MapDistrictBarOverlayCollisionConfig>
}

function freezeOverlayDefaults(
  value: MapDistrictBarOverlayConfig
): Readonly<MapDistrictBarOverlayConfig> {
  Object.freeze(value.badge)
  Object.freeze(value.panel)
  Object.freeze(value.collision)
  return Object.freeze(value)
}

export const MAP_DISTRICT_BAR_OVERLAY_DEFAULTS = freezeOverlayDefaults({
  enabled: true,
  badge: {
    enabled: true,
    minWidth: 78,
    height: 34,
    paddingX: 10,
    gapY: 10,
    offsetX: 0,
    offsetY: 0,
    backgroundColor: '#07152e',
    backgroundOpacity: 0.94,
    borderColor: '#71ffff',
    borderWidth: 1.5,
    borderRadius: 6,
    textColor: '#45e8ff',
    fontSize: 23,
    fontWeight: 500,
    shadowColor: '#00deff',
    shadowBlur: 8,
    shadowOpacity: 0.35,
    decimals: 0,
    thousandsSeparator: false,
    hideOnHover: true,
    enterDelayMs: 520,
    enterMs: 220,
    staggerMs: 90
  },
  panel: {
    enabled: true,
    preferredSide: 'right',
    gapX: 26,
    offsetY: 12,
    width: 340,
    minHeight: 124,
    viewportPadding: 10,
    backgroundColor: '#080d2a',
    backgroundOpacity: 0.94,
    borderColor: '#71ffff',
    borderWidth: 1.5,
    borderRadius: 8,
    paddingTop: 45,
    paddingRight: 24,
    paddingBottom: 18,
    paddingLeft: 24,
    rowGap: 10,
    titleAssetWidth: 132,
    titleAssetHeight: 46,
    titleOffsetX: -12,
    titleOffsetY: -24,
    titleTextOffsetX: 18,
    titleTextOffsetY: 0,
    titleColor: '#ffffff',
    titleFontSize: 22,
    titleFontWeight: 600,
    labelColor: '#ffffff',
    labelFontSize: 18,
    labelFontWeight: 400,
    valueColor: '#43ddff',
    valueFontSize: 23,
    valueFontWeight: 600,
    unitColor: '#ffffff',
    unitFontSize: 16,
    unitFontWeight: 400,
    caseDecimals: 0,
    amountDecimals: 2,
    thousandsSeparator: false,
    enterMs: 180,
    leaveMs: 140,
    enterScale: 0.96
  },
  collision: {
    badgeCollisionEnabled: false,
    badgeCollisionGap: 4,
    badgeMaxShift: 32
  }
})

export function cloneDistrictBarOverlayConfig(
  value: Readonly<MapDistrictBarOverlayConfig>
): MapDistrictBarOverlayConfig {
  return {
    enabled: value.enabled,
    badge: { ...value.badge },
    panel: { ...value.panel },
    collision: { ...value.collision }
  }
}

type UnknownRecord = Record<string, unknown>

const HEX_COLOR = /^#[0-9a-f]{6}$/i

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function color(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value.toLowerCase() : fallback
}

function finiteNumber(
  value: unknown,
  fallback: number,
  constraint: MapDistrictBarOverlayNumberConstraint
): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(constraint.max, Math.max(constraint.min, value))
    : fallback
}

export function normalizeDistrictBarOverlayConfig(value: unknown): MapDistrictBarOverlayConfig {
  const overlay = isRecord(value) ? value : {}
  const badge = isRecord(overlay.badge) ? overlay.badge : {}
  const panel = isRecord(overlay.panel) ? overlay.panel : {}
  const collision = isRecord(overlay.collision) ? overlay.collision : {}
  const defaults = MAP_DISTRICT_BAR_OVERLAY_DEFAULTS
  const constraints = MAP_DISTRICT_BAR_OVERLAY_NUMBER_CONSTRAINTS
  const badgeNumber = (key: KeysMatching<MapDistrictBarBadgeOverlayConfig, number>): number =>
    finiteNumber(badge[key], defaults.badge[key], constraints.badge[key])
  const panelNumber = (key: KeysMatching<MapDistrictBarPanelOverlayConfig, number>): number =>
    finiteNumber(panel[key], defaults.panel[key], constraints.panel[key])
  const collisionNumber = (
    key: KeysMatching<MapDistrictBarOverlayCollisionConfig, number>
  ): number => finiteNumber(collision[key], defaults.collision[key], constraints.collision[key])

  return {
    enabled: bool(overlay.enabled, defaults.enabled),
    badge: {
      enabled: bool(badge.enabled, defaults.badge.enabled),
      minWidth: badgeNumber('minWidth'),
      height: badgeNumber('height'),
      paddingX: badgeNumber('paddingX'),
      gapY: badgeNumber('gapY'),
      offsetX: badgeNumber('offsetX'),
      offsetY: badgeNumber('offsetY'),
      backgroundColor: color(badge.backgroundColor, defaults.badge.backgroundColor),
      backgroundOpacity: badgeNumber('backgroundOpacity'),
      borderColor: color(badge.borderColor, defaults.badge.borderColor),
      borderWidth: badgeNumber('borderWidth'),
      borderRadius: badgeNumber('borderRadius'),
      textColor: color(badge.textColor, defaults.badge.textColor),
      fontSize: badgeNumber('fontSize'),
      fontWeight: badgeNumber('fontWeight'),
      shadowColor: color(badge.shadowColor, defaults.badge.shadowColor),
      shadowBlur: badgeNumber('shadowBlur'),
      shadowOpacity: badgeNumber('shadowOpacity'),
      decimals: Math.round(badgeNumber('decimals')),
      thousandsSeparator: bool(badge.thousandsSeparator, defaults.badge.thousandsSeparator),
      hideOnHover: bool(badge.hideOnHover, defaults.badge.hideOnHover),
      enterDelayMs: badgeNumber('enterDelayMs'),
      enterMs: badgeNumber('enterMs'),
      staggerMs: badgeNumber('staggerMs')
    },
    panel: {
      enabled: bool(panel.enabled, defaults.panel.enabled),
      preferredSide: panel.preferredSide === 'left' || panel.preferredSide === 'right'
        ? panel.preferredSide
        : defaults.panel.preferredSide,
      gapX: panelNumber('gapX'),
      offsetY: panelNumber('offsetY'),
      width: panelNumber('width'),
      minHeight: panelNumber('minHeight'),
      viewportPadding: panelNumber('viewportPadding'),
      backgroundColor: color(panel.backgroundColor, defaults.panel.backgroundColor),
      backgroundOpacity: panelNumber('backgroundOpacity'),
      borderColor: color(panel.borderColor, defaults.panel.borderColor),
      borderWidth: panelNumber('borderWidth'),
      borderRadius: panelNumber('borderRadius'),
      paddingTop: panelNumber('paddingTop'),
      paddingRight: panelNumber('paddingRight'),
      paddingBottom: panelNumber('paddingBottom'),
      paddingLeft: panelNumber('paddingLeft'),
      rowGap: panelNumber('rowGap'),
      titleAssetWidth: panelNumber('titleAssetWidth'),
      titleAssetHeight: panelNumber('titleAssetHeight'),
      titleOffsetX: panelNumber('titleOffsetX'),
      titleOffsetY: panelNumber('titleOffsetY'),
      titleTextOffsetX: panelNumber('titleTextOffsetX'),
      titleTextOffsetY: panelNumber('titleTextOffsetY'),
      titleColor: color(panel.titleColor, defaults.panel.titleColor),
      titleFontSize: panelNumber('titleFontSize'),
      titleFontWeight: panelNumber('titleFontWeight'),
      labelColor: color(panel.labelColor, defaults.panel.labelColor),
      labelFontSize: panelNumber('labelFontSize'),
      labelFontWeight: panelNumber('labelFontWeight'),
      valueColor: color(panel.valueColor, defaults.panel.valueColor),
      valueFontSize: panelNumber('valueFontSize'),
      valueFontWeight: panelNumber('valueFontWeight'),
      unitColor: color(panel.unitColor, defaults.panel.unitColor),
      unitFontSize: panelNumber('unitFontSize'),
      unitFontWeight: panelNumber('unitFontWeight'),
      caseDecimals: Math.round(panelNumber('caseDecimals')),
      amountDecimals: Math.round(panelNumber('amountDecimals')),
      thousandsSeparator: bool(panel.thousandsSeparator, defaults.panel.thousandsSeparator),
      enterMs: panelNumber('enterMs'),
      leaveMs: panelNumber('leaveMs'),
      enterScale: panelNumber('enterScale')
    },
    collision: {
      badgeCollisionEnabled: bool(
        collision.badgeCollisionEnabled,
        defaults.collision.badgeCollisionEnabled
      ),
      badgeCollisionGap: collisionNumber('badgeCollisionGap'),
      badgeMaxShift: collisionNumber('badgeMaxShift')
    }
  }
}
