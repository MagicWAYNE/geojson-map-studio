import { describe, expect, it, vi } from 'vitest'
import { MAP_EFFECT_DEFAULTS } from './mapEffectConfig'
import type { BoundarySegments } from './mapGeometry'
import {
  advanceHoverProgress,
  applyHoverGlowConfig,
  createHoverGlowLayers,
  createStaticGlowLayers,
  deriveHoverLayerValues,
  deriveStaticLayerValues,
  easeOutCubic,
  setHoverGlowProgress,
  updateHoverVisualState
} from './mapGlow'

describe('mapGlow layer values', () => {
  it('默认关闭外圈辉光但保留外圈亮芯', () => {
    const values = deriveStaticLayerValues(MAP_EFFECT_DEFAULTS)
    expect(values.outerNear.width).toBe(0)
    expect(values.outerNear.opacity).toBe(0)
    expect(values.outerFar.width).toBe(0)
    expect(values.outerFar.opacity).toBe(0)
    expect(values.outerCore.opacity).toBe(0.95)
  })

  it('hover 亮芯和辉光使用独立颜色、宽度与强度', () => {
    const values = deriveHoverLayerValues(MAP_EFFECT_DEFAULTS)
    expect(values.core).toEqual({ color: '#d8f5ff', width: 2.4, opacity: 1 })
    expect(values.glow).toEqual({ color: '#27a7ff', width: 0, opacity: 0 })
  })

  it('默认配置在真实图层中隐藏辉光并保留亮芯', () => {
    const boundaries: BoundarySegments = {
      inner: [[[0, 0], [10, 10]]],
      outer: [[[0, 0], [10, 10]]],
      byRegion: new Map()
    }
    const staticBundle = createStaticGlowLayers(boundaries, MAP_EFFECT_DEFAULTS, 0)
    expect(staticBundle.outerNear.line.visible).toBe(false)
    expect(staticBundle.outerFar.line.visible).toBe(false)
    expect(staticBundle.outerCore.line.visible).toBe(true)

    const hoverBundle = createHoverGlowLayers([[[0, 0], [10, 10]]], MAP_EFFECT_DEFAULTS, 0)
    setHoverGlowProgress(hoverBundle, MAP_EFFECT_DEFAULTS, 1)
    expect(hoverBundle.glow.line.visible).toBe(false)
    expect(hoverBundle.core.line.visible).toBe(true)
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

  it('skips stable endpoints but force-renders them after configuration changes', () => {
    const render = vi.fn()
    const inactive = { progress: 0, active: false }
    const active = { progress: 1, active: true }

    expect(updateHoverVisualState(inactive, 16, 180, 220, render)).toBe(false)
    expect(updateHoverVisualState(active, 16, 180, 220, render)).toBe(false)
    expect(render).not.toHaveBeenCalled()

    expect(updateHoverVisualState(inactive, 0, 180, 220, render, true)).toBe(true)
    expect(render).toHaveBeenCalledWith(inactive, 0)

    render.mockClear()
    expect(updateHoverVisualState({ progress: 0.5, active: true }, 18, 180, 220, render)).toBe(true)
    expect(render).toHaveBeenCalledOnce()
  })

  it('keeps real hover glow layers hidden while force-refreshing widths at zero progress', () => {
    const config = {
      ...MAP_EFFECT_DEFAULTS,
      base: { ...MAP_EFFECT_DEFAULTS.base },
      hover: {
        ...MAP_EFFECT_DEFAULTS.hover,
        glowWidth: 11,
        outlineWidth: 3.5
      }
    }
    const bundle = createHoverGlowLayers([[[0, 0], [10, 10]]], config, 0)
    const visual = { progress: 0, active: false }

    setHoverGlowProgress(bundle, MAP_EFFECT_DEFAULTS, 0)
    expect(bundle.group.visible).toBe(false)
    expect(bundle.glow.line.visible).toBe(false)
    expect(bundle.core.line.visible).toBe(false)

    expect(updateHoverVisualState(visual, 0, 180, 220, (_state, eased) => {
      applyHoverGlowConfig(bundle, config)
      setHoverGlowProgress(bundle, config, eased)
    }, true)).toBe(true)

    expect(bundle.group.visible).toBe(false)
    expect(bundle.glow.line.visible).toBe(false)
    expect(bundle.core.line.visible).toBe(false)
    expect(bundle.glow.material.linewidth).toBe(11)
    expect(bundle.core.material.linewidth).toBe(3.5)
  })
})
