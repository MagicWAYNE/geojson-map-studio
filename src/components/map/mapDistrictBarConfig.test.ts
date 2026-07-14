import { describe, expect, it } from 'vitest'
import {
  MAP_DISTRICT_BAR_DEFAULTS,
  cloneDistrictBarConfig,
  normalizeDistrictBarConfig
} from './mapDistrictBarConfig'
import { MAP_DISTRICT_BAR_OVERLAY_DEFAULTS } from './mapDistrictBarOverlayConfig'

describe('mapDistrictBarConfig', () => {
  it('exports the exact defaults', () => {
    expect(MAP_DISTRICT_BAR_DEFAULTS).toEqual({
      enabled: true, color: '#6cf9ca', opacity: 1, width: 1.4,
      anchorOffsetX: 0, anchorOffsetY: 0, baseOffset: 0,
      minHeight: 3, maxHeight: 20, sqrtExponent: 0.5, glowStrength: 0.6,
      baseRingRadius: 1.9, baseRingOpacity: 0.38,
      pulseEnabled: true, pulseColor: '#6cf9ca', pulseWidth: 0.1,
      pulseOuterRadiusRatio: 2.4, pulseInnerRadiusRatio: 0.35,
      pulseOuterOpacity: 0.08, pulseInnerOpacity: 0.7,
      pulseDurationMs: 1800, pulseStaggerMs: 120,
      enterMs: 760, staggerMs: 90,
      hoverEmissiveIntensity: 0.8, hoverLift: 1.1,
      overlay: MAP_DISTRICT_BAR_OVERLAY_DEFAULTS
    })
  })

  it('normalizes colors, finite numbers, bounds, and height ordering', () => {
    expect(normalizeDistrictBarConfig({
      color: '#ABCDEF', opacity: 0.1, width: -1, anchorOffsetX: 30, anchorOffsetY: -30, baseOffset: 9, minHeight: 30,
      maxHeight: -2, sqrtExponent: Infinity, enterMs: -1
    })).toMatchObject({
      color: '#abcdef', opacity: 1, width: 0.25, anchorOffsetX: 20, anchorOffsetY: -20, baseOffset: 6,
      minHeight: 24, maxHeight: 24, sqrtExponent: 0.5, enterMs: 0
    })
  })

  it('clamps every numeric field to its documented range', () => {
    expect(normalizeDistrictBarConfig({
      opacity: -1, width: 99, anchorOffsetX: -30, anchorOffsetY: 30, baseOffset: -9, minHeight: -1, maxHeight: 99,
      sqrtExponent: 0, glowStrength: 9, baseRingRadius: -1,
      baseRingOpacity: 9, enterMs: 9999, staggerMs: -1,
      pulseWidth: 9, pulseOuterRadiusRatio: -1, pulseInnerRadiusRatio: 9,
      pulseOuterOpacity: -1, pulseInnerOpacity: 9, pulseDurationMs: 99, pulseStaggerMs: 9999,
      hoverEmissiveIntensity: 9, hoverLift: -1
    })).toMatchObject({
      opacity: 1, width: 8, anchorOffsetX: -20, anchorOffsetY: 20, baseOffset: -2, minHeight: 0, maxHeight: 24,
      sqrtExponent: 0.25, glowStrength: 2, baseRingRadius: 0,
      baseRingOpacity: 1, enterMs: 3000, staggerMs: 0,
      pulseWidth: 0.5, pulseOuterRadiusRatio: 5, pulseInnerRadiusRatio: 0.05,
      pulseOuterOpacity: 0, pulseInnerOpacity: 1, pulseDurationMs: 200, pulseStaggerMs: 1000,
      hoverEmissiveIntensity: 3, hoverLift: 0
    })
  })

  it('clones and normalizes the nested DOM overlay deeply', () => {
    const cloned = cloneDistrictBarConfig(MAP_DISTRICT_BAR_DEFAULTS)
    const normalized = normalizeDistrictBarConfig({
      ...MAP_DISTRICT_BAR_DEFAULTS,
      overlay: {
        ...MAP_DISTRICT_BAR_OVERLAY_DEFAULTS,
        badge: { ...MAP_DISTRICT_BAR_OVERLAY_DEFAULTS.badge, minWidth: 999 },
        panel: { ...MAP_DISTRICT_BAR_OVERLAY_DEFAULTS.panel, width: 1 },
        collision: { ...MAP_DISTRICT_BAR_OVERLAY_DEFAULTS.collision, badgeMaxShift: 999 }
      }
    })

    expect(cloned.overlay).toEqual(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS)
    expect(cloned.overlay).not.toBe(MAP_DISTRICT_BAR_DEFAULTS.overlay)
    expect(cloned.overlay.badge).not.toBe(MAP_DISTRICT_BAR_DEFAULTS.overlay.badge)
    expect(cloned.overlay.panel).not.toBe(MAP_DISTRICT_BAR_DEFAULTS.overlay.panel)
    expect(cloned.overlay.collision).not.toBe(MAP_DISTRICT_BAR_DEFAULTS.overlay.collision)
    expect(normalized.overlay).toMatchObject({
      badge: { minWidth: 180 },
      panel: { width: 240 },
      collision: { badgeMaxShift: 200 }
    })
  })
})
