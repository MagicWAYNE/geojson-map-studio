import { nextTick, reactive } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { cloneMapEffectConfig, MAP_EFFECT_DEFAULTS, type MapEffectConfig } from './mapEffectConfig'
import { watchMapEffectConfig } from './mapEffectWatcher'

function createEffectConfig(): MapEffectConfig {
  const config = cloneMapEffectConfig(MAP_EFFECT_DEFAULTS)
  return { ...config, bars: { ...config.bars } }
}

describe('watchMapEffectConfig', () => {
  it('applies the initial config and nested changes until stopped', async () => {
    const effect = reactive(createEffectConfig())
    const apply = vi.fn()

    const stop = watchMapEffectConfig(effect, apply)

    expect(apply).toHaveBeenCalledTimes(1)

    effect.hover.glowWidth = 11
    await nextTick()

    expect(apply).toHaveBeenCalledTimes(2)

    stop()
    effect.base.outerGlowWidth = 18
    await nextTick()

    expect(apply).toHaveBeenCalledTimes(2)
  })

  it('tracks full v5 quality, advanced base and hover, bars, and nested inward wave fields', async () => {
    const effect = reactive(createEffectConfig())
    const snapshots: MapEffectConfig[] = []
    const apply = vi.fn(() => snapshots.push(JSON.parse(JSON.stringify(effect))))

    const stop = watchMapEffectConfig(effect, apply)
    effect.quality.renderScale = 0.75
    effect.quality.maxAlpha = 0.65
    effect.base.outerGlowFarPasses = 7
    effect.base.outerGlowEdgeSoftness = 0.42
    effect.base.inwardGlow.strength = 0.36
    effect.base.inwardGlow.wave.periodMs = 4800
    effect.hover.glowNearPasses = 6
    effect.hover.glowFalloff = 2.25
    effect.hover.inwardGlow.width = 96
    effect.hover.inwardGlow.wave.easing = 'linear'
    effect.bars.hoverLift = 2.5
    await nextTick()

    expect(apply).toHaveBeenCalledTimes(2)
    expect(snapshots.at(-1)).toMatchObject({
      version: 5,
      quality: { renderScale: 0.75, maxAlpha: 0.65 },
      base: {
        outerGlowFarPasses: 7,
        outerGlowEdgeSoftness: 0.42,
        inwardGlow: { strength: 0.36, wave: { periodMs: 4800 } }
      },
      hover: {
        glowNearPasses: 6,
        glowFalloff: 2.25,
        inwardGlow: { width: 96, wave: { easing: 'linear' } }
      },
      bars: { hoverLift: 2.5 }
    })
    stop()
  })
})
