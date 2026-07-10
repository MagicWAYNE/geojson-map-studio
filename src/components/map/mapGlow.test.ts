import { describe, expect, it } from 'vitest'
import { MAP_EFFECT_DEFAULTS } from './mapEffectConfig'
import {
  advanceHoverProgress,
  deriveHoverLayerValues,
  deriveStaticLayerValues,
  easeOutCubic
} from './mapGlow'

describe('mapGlow layer values', () => {
  it('从一个外圈宽度派生近端和远端两层辉光', () => {
    const values = deriveStaticLayerValues(MAP_EFFECT_DEFAULTS)
    expect(values.outerNear.width).toBe(5)
    expect(values.outerNear.opacity).toBe(0.3)
    expect(values.outerFar.width).toBe(10)
    expect(values.outerFar.opacity).toBeCloseTo(0.105)
    expect(values.outerCore.opacity).toBe(0.95)
  })

  it('hover 亮芯和辉光使用独立颜色、宽度与强度', () => {
    const values = deriveHoverLayerValues(MAP_EFFECT_DEFAULTS)
    expect(values.core).toEqual({ color: '#d8f5ff', width: 2.4, opacity: 1 })
    expect(values.glow).toEqual({ color: '#27a7ff', width: 7, opacity: 0.35 })
  })
})

describe('mapGlow hover animation', () => {
  it('分别使用进入和离开时长推进进度', () => {
    expect(advanceHoverProgress(0, true, 90, 180, 220)).toBe(0.5)
    expect(advanceHoverProgress(0.5, false, 110, 180, 220)).toBe(0)
    expect(advanceHoverProgress(0.9, true, 90, 180, 220)).toBe(1)
  })

  it('使用 cubic ease-out 且固定端点', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(0.5)).toBe(0.875)
    expect(easeOutCubic(1)).toBe(1)
  })
})
