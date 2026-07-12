import { describe, expect, it, vi } from 'vitest'
import { MAP_EFFECT_DEFAULTS } from './mapEffectConfig'
import type { BoundarySegments } from './mapGeometry'
import {
  advanceHoverProgress,
  applyHoverGlowConfig,
  createHoverGlowLayers,
  createStaticGlowLayers,
  easeOutCubic,
  setHoverGlowProgress,
  updateHoverVisualState
} from './mapGlow'

describe('mapGlow layer bundles', () => {
  it('creates only inner lines and a crisp static outer core', () => {
    const boundaries: BoundarySegments = {
      inner: [[[0, 0], [10, 10]]],
      outer: [[[0, 0], [10, 10]]],
      byRegion: new Map()
    }
    const bundle = createStaticGlowLayers(boundaries, MAP_EFFECT_DEFAULTS, 0)
    expect(Object.keys(bundle).sort()).toEqual([
      'geometries', 'group', 'inner', 'materials', 'outerCore'
    ])
    expect(bundle.group.children).toHaveLength(2)
    expect(bundle.outerCore.line.visible).toBe(true)
  })

  it('creates only a crisp hover core and animates its opacity', () => {
    const bundle = createHoverGlowLayers([[[0, 0], [10, 10]]], MAP_EFFECT_DEFAULTS, 0)
    expect(Object.keys(bundle).sort()).toEqual(['core', 'geometries', 'group', 'materials'])
    setHoverGlowProgress(bundle, MAP_EFFECT_DEFAULTS, 0.5)
    expect(bundle.group.visible).toBe(true)
    expect(bundle.core.material.opacity).toBe(0.5)
    expect(bundle.core.line.visible).toBe(true)
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

  it('keeps the hover core hidden while force-refreshing its width at zero progress', () => {
    const config = {
      ...MAP_EFFECT_DEFAULTS,
      base: { ...MAP_EFFECT_DEFAULTS.base },
      hover: {
        ...MAP_EFFECT_DEFAULTS.hover,
        outlineWidth: 3.5
      }
    }
    const bundle = createHoverGlowLayers([[[0, 0], [10, 10]]], config, 0)
    const visual = { progress: 0, active: false }

    setHoverGlowProgress(bundle, MAP_EFFECT_DEFAULTS, 0)
    expect(bundle.group.visible).toBe(false)
    expect(bundle.core.line.visible).toBe(false)

    expect(updateHoverVisualState(visual, 0, 180, 220, (_state, eased) => {
      applyHoverGlowConfig(bundle, config)
      setHoverGlowProgress(bundle, config, eased)
    }, true)).toBe(true)

    expect(bundle.group.visible).toBe(false)
    expect(bundle.core.line.visible).toBe(false)
    expect(bundle.core.material.linewidth).toBe(3.5)
  })
})
