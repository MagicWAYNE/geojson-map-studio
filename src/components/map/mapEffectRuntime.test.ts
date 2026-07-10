import { describe, expect, it, vi } from 'vitest'
import { MAP_EFFECT_DEFAULTS } from './mapEffectConfig'
import { applyMapEffectConfig } from './mapEffectRuntime'
import { applyHoverGlowConfig, applyStaticGlowConfig, type HoverGlowBundle, type StaticGlowBundle } from './mapGlow'

vi.mock('./mapGlow', () => ({
  applyStaticGlowConfig: vi.fn(),
  applyHoverGlowConfig: vi.fn()
}))

describe('applyMapEffectConfig', () => {
  it('applies the config to static and every available hover glow bundle', () => {
    const staticGlow = {} as StaticGlowBundle
    const firstHoverGlow = {} as HoverGlowBundle
    const secondHoverGlow = {} as HoverGlowBundle

    applyMapEffectConfig(MAP_EFFECT_DEFAULTS, {
      staticGlow,
      hoverGlows: [firstHoverGlow, null, secondHoverGlow]
    })

    expect(applyStaticGlowConfig).toHaveBeenCalledWith(staticGlow, MAP_EFFECT_DEFAULTS)
    expect(applyHoverGlowConfig).toHaveBeenNthCalledWith(1, firstHoverGlow, MAP_EFFECT_DEFAULTS)
    expect(applyHoverGlowConfig).toHaveBeenNthCalledWith(2, secondHoverGlow, MAP_EFFECT_DEFAULTS)
  })
})
