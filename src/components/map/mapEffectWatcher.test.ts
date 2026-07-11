import { nextTick, reactive } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { MAP_EFFECT_DEFAULTS, type MapEffectConfig } from './mapEffectConfig'
import { watchMapEffectConfig } from './mapEffectWatcher'

function createEffectConfig(): MapEffectConfig {
  return {
    ...MAP_EFFECT_DEFAULTS,
    base: { ...MAP_EFFECT_DEFAULTS.base },
    hover: { ...MAP_EFFECT_DEFAULTS.hover },
    quality: { ...MAP_EFFECT_DEFAULTS.quality }
  }
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

  it('tracks full v2 quality and advanced base and hover fields', async () => {
    const effect = reactive(createEffectConfig())
    const snapshots: MapEffectConfig[] = []
    const apply = vi.fn(() => snapshots.push(JSON.parse(JSON.stringify(effect))))

    const stop = watchMapEffectConfig(effect, apply)
    effect.quality.renderScale = 0.75
    effect.quality.maxAlpha = 0.65
    effect.base.outerGlowFarPasses = 7
    effect.base.outerGlowEdgeSoftness = 0.42
    effect.hover.glowNearPasses = 6
    effect.hover.glowFalloff = 2.25
    await nextTick()

    expect(apply).toHaveBeenCalledTimes(2)
    expect(snapshots.at(-1)).toMatchObject({
      version: 2,
      quality: { renderScale: 0.75, maxAlpha: 0.65 },
      base: { outerGlowFarPasses: 7, outerGlowEdgeSoftness: 0.42 },
      hover: { glowNearPasses: 6, glowFalloff: 2.25 }
    })
    stop()
  })
})
