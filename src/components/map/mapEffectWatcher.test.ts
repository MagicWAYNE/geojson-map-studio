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

  it('tracks full v5 quality, advanced glow, stable inward, mosaic, and bar fields', async () => {
    const effect = reactive(createEffectConfig())
    const snapshots: MapEffectConfig[] = []
    const apply = vi.fn(() => snapshots.push(JSON.parse(JSON.stringify(effect))))

    const stop = watchMapEffectConfig(effect, apply)
    effect.quality.renderScale = 0.75
    effect.quality.maxAlpha = 0.65
    effect.base.outerGlowFarPasses = 7
    effect.base.outerGlowEdgeSoftness = 0.42
    effect.base.inwardGlow.strength = 0.36
    effect.hover.glowNearPasses = 6
    effect.hover.glowFalloff = 2.25
    effect.hover.inwardGlow.width = 96
    effect.bars.hoverLift = 2.5
    effect.hover.mosaicParticles.density = 0.28
    effect.hover.mosaicParticles.flickerHz = 4.8
    await nextTick()

    expect(apply).toHaveBeenCalledTimes(2)
    expect(snapshots.at(-1)).toMatchObject({
      version: 5,
      quality: { renderScale: 0.75, maxAlpha: 0.65 },
      base: {
        outerGlowFarPasses: 7,
        outerGlowEdgeSoftness: 0.42,
        inwardGlow: { strength: 0.36 }
      },
      hover: {
        glowNearPasses: 6,
        glowFalloff: 2.25,
        inwardGlow: { width: 96 },
        mosaicParticles: { density: 0.28, flickerHz: 4.8 }
      },
      bars: { hoverLift: 2.5 }
    })
    stop()
  })
})
