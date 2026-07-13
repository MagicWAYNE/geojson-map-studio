import { describe, expect, it } from 'vitest'
import { MAP_DISTRICT_BAR_DEFAULTS } from './mapDistrictBarConfig'
import {
  MAP_EFFECT_DEFAULTS,
  MAP_EFFECT_STORAGE_KEY,
  MAP_EFFECT_STORAGE_KEY_V5,
  loadMapEffectConfig
} from './mapEffectConfig'

describe('mapEffectConfig v6 migration', () => {
  it('uses a v6 storage key and migrates v5 effects while resetting bars to label-aware defaults', () => {
    expect(MAP_EFFECT_STORAGE_KEY).toBe('cq-map-effect-config-v6')
    expect(MAP_EFFECT_STORAGE_KEY_V5).toBe('cq-map-effect-config-v5')

    const { label: _legacyMissingLabel, ...legacyBars } = MAP_DISTRICT_BAR_DEFAULTS
    const legacyV5 = {
      ...MAP_EFFECT_DEFAULTS,
      version: 5,
      base: { ...MAP_EFFECT_DEFAULTS.base, outerGlowWidth: 91 },
      bars: { ...legacyBars, width: 6.4 }
    }
    const migrated = loadMapEffectConfig({
      getItem: (key) => key === MAP_EFFECT_STORAGE_KEY_V5 ? JSON.stringify(legacyV5) : null
    })

    expect(migrated.version).toBe(6)
    expect(migrated.base.outerGlowWidth).toBe(91)
    expect(migrated.bars).toEqual(MAP_DISTRICT_BAR_DEFAULTS)
    expect(migrated.bars.label).toEqual(MAP_DISTRICT_BAR_DEFAULTS.label)
  })
})
