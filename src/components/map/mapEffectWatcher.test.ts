import { nextTick, reactive } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { MAP_EFFECT_DEFAULTS, type MapEffectConfig } from './mapEffectConfig'
import { watchMapEffectConfig } from './mapEffectWatcher'

function createEffectConfig(): MapEffectConfig {
  return {
    ...MAP_EFFECT_DEFAULTS,
    base: { ...MAP_EFFECT_DEFAULTS.base },
    hover: { ...MAP_EFFECT_DEFAULTS.hover }
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
})
