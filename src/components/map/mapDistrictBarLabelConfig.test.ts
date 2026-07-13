import { describe, expect, it } from 'vitest'
import {
  MAP_DISTRICT_BAR_LABEL_DEFAULTS,
  cloneDistrictBarLabelConfig,
  normalizeDistrictBarLabelConfig
} from './mapDistrictBarLabelConfig'

describe('mapDistrictBarLabelConfig', () => {
  it('exports the approved first-pass defaults', () => {
    expect(MAP_DISTRICT_BAR_LABEL_DEFAULTS).toEqual({
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
  })

  it('normalizes colors, booleans and every numeric range', () => {
    expect(normalizeDistrictBarLabelConfig({
      enabled: false,
      width: 999,
      height: -1,
      gapX: -1,
      offsetX: 999,
      offsetY: -999,
      opacity: 9,
      hoverOpacity: -1,
      hoverScale: 9,
      hoverBrightness: 9,
      depthTest: true,
      hueRotate: 999,
      saturation: -1,
      brightness: 9,
      contrast: 0,
      tintColor: '#ABCDEF',
      tintStrength: 9,
      iconSize: 999,
      districtWeight: 555,
      valueDecimals: 9,
      collisionEnabled: true,
      collisionMaxShift: -1
    })).toMatchObject({
      enabled: false,
      width: 420,
      height: 24,
      gapX: 0,
      offsetX: 200,
      offsetY: -200,
      opacity: 1,
      hoverOpacity: 0,
      hoverScale: 2,
      hoverBrightness: 2,
      depthTest: true,
      hueRotate: 180,
      saturation: 0,
      brightness: 2,
      contrast: 0.2,
      tintColor: '#abcdef',
      tintStrength: 1,
      iconSize: 80,
      districtWeight: 600,
      valueDecimals: 2,
      collisionEnabled: true,
      collisionMaxShift: 0
    })
  })

  it('returns an independent clone', () => {
    const cloned = cloneDistrictBarLabelConfig(MAP_DISTRICT_BAR_LABEL_DEFAULTS)
    expect(cloned).toEqual(MAP_DISTRICT_BAR_LABEL_DEFAULTS)
    expect(cloned).not.toBe(MAP_DISTRICT_BAR_LABEL_DEFAULTS)
  })
})
