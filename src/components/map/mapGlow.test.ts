import { describe, expect, it } from 'vitest'
import { MAP_EFFECT_DEFAULTS } from './mapEffectConfig'
import { deriveHoverLayerValues, deriveStaticLayerValues } from './mapGlow'

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
