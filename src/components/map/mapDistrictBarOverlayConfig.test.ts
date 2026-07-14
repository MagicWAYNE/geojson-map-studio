import { describe, expect, it } from 'vitest'
import {
  MAP_DISTRICT_BAR_OVERLAY_DEFAULTS,
  MAP_DISTRICT_BAR_OVERLAY_NUMBER_CONSTRAINTS,
  cloneDistrictBarOverlayConfig,
  normalizeDistrictBarOverlayConfig
} from './mapDistrictBarOverlayConfig'

describe('mapDistrictBarOverlayConfig', () => {
  it('exports the exact DOM overlay defaults', () => {
    expect(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS).toEqual({
      enabled: true,
      badge: {
        enabled: true,
        minWidth: 48,
        height: 24,
        paddingX: 10,
        gapY: 4,
        offsetX: 0,
        offsetY: 0,
        backgroundColor: '#07152e',
        backgroundOpacity: 0.85,
        borderColor: '#71ffff',
        borderWidth: 1.5,
        borderRadius: 5,
        textColor: '#45e8ff',
        fontSize: 13,
        fontWeight: 200,
        shadowColor: '#ffffff',
        shadowBlur: 16,
        shadowOpacity: 0.24,
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
        offsetY: -8,
        width: 240,
        minHeight: 108,
        viewportPadding: 10,
        backgroundColor: '#080d2a',
        backgroundOpacity: 0.85,
        borderColor: '#71ffff',
        borderWidth: 1.5,
        borderRadius: 8,
        paddingTop: 28,
        paddingRight: 12,
        paddingBottom: 0,
        paddingLeft: 18,
        rowGap: 4,
        titleAssetWidth: 106,
        titleAssetHeight: 46,
        titleOffsetX: -84,
        titleOffsetY: -24,
        titleTextOffsetX: 0,
        titleTextOffsetY: 0,
        titleColor: '#ffffff',
        titleFontSize: 18,
        titleFontWeight: 600,
        labelColor: '#ffffff',
        labelFontSize: 16,
        labelFontWeight: 400,
        valueColor: '#43ddff',
        valueFontSize: 20,
        valueFontWeight: 600,
        unitColor: '#9fa5c1',
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
  })

  it('returns mutable deep clones without exposing frozen defaults', () => {
    const first = cloneDistrictBarOverlayConfig(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS)
    const second = cloneDistrictBarOverlayConfig(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS)

    expect(first).toEqual(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS)
    expect(first).not.toBe(second)
    expect(first.badge).not.toBe(second.badge)
    expect(first.panel).not.toBe(second.panel)
    expect(first.collision).not.toBe(second.collision)
    first.badge.minWidth = 120
    expect(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS.badge.minWidth).toBe(48)
    expect(Object.isFrozen(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS)).toBe(true)
    expect(Object.isFrozen(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS.badge)).toBe(true)
    expect(Object.isFrozen(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS.panel)).toBe(true)
    expect(Object.isFrozen(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS.collision)).toBe(true)
  })

  it('normalizes nested overlay values to the public control ranges', () => {
    const normalized = normalizeDistrictBarOverlayConfig({
      enabled: false,
      badge: {
        enabled: false,
        minWidth: 1,
        height: 99,
        paddingX: -1,
        gapY: 99,
        offsetX: -999,
        offsetY: 999,
        backgroundColor: '#ABCDEF',
        backgroundOpacity: -1,
        borderColor: 'cyan',
        borderWidth: 99,
        borderRadius: 99,
        textColor: '#FEDCBA',
        fontSize: 99,
        fontWeight: 99,
        shadowColor: '#123456',
        shadowBlur: -1,
        shadowOpacity: 2,
        decimals: 3.6,
        thousandsSeparator: true,
        hideOnHover: false,
        enterDelayMs: 9999,
        enterMs: -1,
        staggerMs: Infinity
      },
      panel: {
        enabled: false,
        preferredSide: 'left',
        gapX: 99,
        offsetY: -999,
        width: 99,
        minHeight: 999,
        viewportPadding: -1,
        backgroundColor: '#ABCDEF',
        backgroundOpacity: 2,
        borderColor: '#FEDCBA',
        borderWidth: -1,
        borderRadius: 99,
        paddingTop: 99,
        paddingRight: -1,
        paddingBottom: 99,
        paddingLeft: -1,
        rowGap: 99,
        titleAssetWidth: 1,
        titleAssetHeight: 999,
        titleOffsetX: -999,
        titleOffsetY: 999,
        titleTextOffsetX: -999,
        titleTextOffsetY: 999,
        titleColor: '#123456',
        titleFontSize: 1,
        titleFontWeight: 999,
        labelColor: 'white',
        labelFontSize: 99,
        labelFontWeight: 1,
        valueColor: '#ABCDEF',
        valueFontSize: 1,
        valueFontWeight: 999,
        unitColor: '#FEDCBA',
        unitFontSize: 99,
        unitFontWeight: 1,
        caseDecimals: -1,
        amountDecimals: 9,
        thousandsSeparator: true,
        enterMs: -1,
        leaveMs: 9999,
        enterScale: 2
      },
      collision: {
        badgeCollisionEnabled: true,
        badgeCollisionGap: -1,
        badgeMaxShift: 999
      }
    })

    expect(normalized).toMatchObject({
      enabled: false,
      badge: {
        enabled: false,
        minWidth: 48,
        height: 60,
        paddingX: 0,
        gapY: 80,
        offsetX: -200,
        offsetY: 200,
        backgroundColor: '#abcdef',
        backgroundOpacity: 0,
        borderColor: '#71ffff',
        borderWidth: 8,
        borderRadius: 40,
        textColor: '#fedcba',
        fontSize: 40,
        fontWeight: 100,
        shadowColor: '#123456',
        shadowBlur: 0,
        shadowOpacity: 1,
        decimals: 4,
        thousandsSeparator: true,
        hideOnHover: false,
        enterDelayMs: 1000,
        enterMs: 0,
        staggerMs: 90
      },
      panel: {
        enabled: false,
        preferredSide: 'left',
        gapX: 80,
        offsetY: -200,
        width: 240,
        minHeight: 220,
        viewportPadding: 0,
        backgroundColor: '#abcdef',
        backgroundOpacity: 1,
        borderColor: '#fedcba',
        borderWidth: 0,
        borderRadius: 40,
        paddingTop: 80,
        paddingRight: 0,
        paddingBottom: 80,
        paddingLeft: 0,
        rowGap: 80,
        titleAssetWidth: 80,
        titleAssetHeight: 120,
        titleOffsetX: -200,
        titleOffsetY: 80,
        titleTextOffsetX: -80,
        titleTextOffsetY: 80,
        titleColor: '#123456',
        titleFontSize: 12,
        titleFontWeight: 900,
        labelColor: '#ffffff',
        labelFontSize: 40,
        labelFontWeight: 100,
        valueColor: '#abcdef',
        valueFontSize: 12,
        valueFontWeight: 900,
        unitColor: '#fedcba',
        unitFontSize: 40,
        unitFontWeight: 100,
        caseDecimals: 0,
        amountDecimals: 4,
        thousandsSeparator: true,
        enterMs: 0,
        leaveMs: 1000,
        enterScale: 1
      },
      collision: {
        badgeCollisionEnabled: true,
        badgeCollisionGap: 0,
        badgeMaxShift: 200
      }
    })
  })

  it('accepts gap values through 80 and clamps values above 80', () => {
    const withinRange = normalizeDistrictBarOverlayConfig({
      panel: { rowGap: 64 },
      collision: { badgeCollisionGap: 79 }
    })
    const aboveRange = normalizeDistrictBarOverlayConfig({
      panel: { rowGap: 81 },
      collision: { badgeCollisionGap: 81 }
    })

    expect(withinRange.panel.rowGap).toBe(64)
    expect(withinRange.collision.badgeCollisionGap).toBe(79)
    expect(aboveRange.panel.rowGap).toBe(80)
    expect(aboveRange.collision.badgeCollisionGap).toBe(80)
  })

  it('applies the shared lower and upper constraint for every numeric field', () => {
    for (const [section, fields] of Object.entries(MAP_DISTRICT_BAR_OVERLAY_NUMBER_CONSTRAINTS)) {
      for (const [key, constraint] of Object.entries(fields)) {
        const below = cloneDistrictBarOverlayConfig(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS)
        const above = cloneDistrictBarOverlayConfig(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS)
        const belowSection = below[section as 'badge' | 'panel' | 'collision'] as unknown as Record<string, number>
        const aboveSection = above[section as 'badge' | 'panel' | 'collision'] as unknown as Record<string, number>
        belowSection[key] = constraint.min - Math.max(1, constraint.step)
        aboveSection[key] = constraint.max + Math.max(1, constraint.step)

        const normalizedBelow = normalizeDistrictBarOverlayConfig(below)
        const normalizedAbove = normalizeDistrictBarOverlayConfig(above)
        const normalizedBelowSection = normalizedBelow[
          section as 'badge' | 'panel' | 'collision'
        ] as unknown as Record<string, number>
        const normalizedAboveSection = normalizedAbove[
          section as 'badge' | 'panel' | 'collision'
        ] as unknown as Record<string, number>

        expect(normalizedBelowSection[key], `${section}.${key} lower bound`).toBe(constraint.min)
        expect(normalizedAboveSection[key], `${section}.${key} upper bound`).toBe(constraint.max)
      }
    }
  })
})
