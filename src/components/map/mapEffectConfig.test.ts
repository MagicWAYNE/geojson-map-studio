import { describe, expect, it } from 'vitest'
import {
  MAP_EFFECT_DEFAULTS,
  MAP_EFFECT_STORAGE_KEY,
  formatMapEffectConfig,
  loadMapEffectConfig,
  normalizeMapEffectConfig,
  saveMapEffectConfig
} from './mapEffectConfig'

const APPROVED_DEFAULTS = {
  version: 1,
  base: {
    innerColor: '#ffffff',
    innerWidth: 1.5,
    innerOpacity: 0.55,
    outerColor: '#ffffff',
    outerCoreWidth: 2,
    outerGlowWidth: 0,
    outerGlowStrength: 0
  },
  hover: {
    surfaceColor: '#7fcbff',
    emissiveColor: '#22b4d8',
    emissiveIntensity: 0.5,
    outlineColor: '#d8f5ff',
    outlineWidth: 2.4,
    glowColor: '#27a7ff',
    glowWidth: 0,
    glowStrength: 0,
    lift: 2,
    enterMs: 400,
    leaveMs: 300
  }
} as const

const LEGACY_DEFAULTS = {
  version: 1,
  base: {
    innerColor: '#4da3ff',
    innerWidth: 1,
    innerOpacity: 0.55,
    outerColor: '#7fcbff',
    outerCoreWidth: 1.8,
    outerGlowWidth: 10,
    outerGlowStrength: 0.3
  },
  hover: {
    surfaceColor: '#7fcbff',
    emissiveColor: '#168dff',
    emissiveIntensity: 0.8,
    outlineColor: '#d8f5ff',
    outlineWidth: 2.4,
    glowColor: '#27a7ff',
    glowWidth: 7,
    glowStrength: 0.35,
    lift: 1,
    enterMs: 180,
    leaveMs: 220
  }
} as const

describe('mapEffectConfig', () => {
  it('使用已确认的地图效果参数作为默认值', () => {
    expect(MAP_EFFECT_DEFAULTS).toEqual(APPROVED_DEFAULTS)
  })

  it('迁移旧默认缓存，同时保留真正的自定义配置', () => {
    const legacyReader = { getItem: () => JSON.stringify(LEGACY_DEFAULTS) }
    expect(loadMapEffectConfig(legacyReader)).toEqual(APPROVED_DEFAULTS)

    const customized = {
      ...LEGACY_DEFAULTS,
      base: { ...LEGACY_DEFAULTS.base, innerWidth: 2.3 }
    }
    const customReader = { getItem: () => JSON.stringify(customized) }
    expect(loadMapEffectConfig(customReader).base.innerWidth).toBe(2.3)
  })

  it('只有字段和值都完全匹配旧默认值时才迁移缓存', () => {
    const partial = {
      ...LEGACY_DEFAULTS,
      base: {
        innerColor: LEGACY_DEFAULTS.base.innerColor,
        innerWidth: LEGACY_DEFAULTS.base.innerWidth,
        outerColor: LEGACY_DEFAULTS.base.outerColor,
        outerCoreWidth: LEGACY_DEFAULTS.base.outerCoreWidth,
        outerGlowWidth: LEGACY_DEFAULTS.base.outerGlowWidth,
        outerGlowStrength: LEGACY_DEFAULTS.base.outerGlowStrength
      }
    }
    expect(loadMapEffectConfig({ getItem: () => JSON.stringify(partial) }).base.innerColor)
      .toBe(LEGACY_DEFAULTS.base.innerColor)

    const extended = { ...LEGACY_DEFAULTS, customFlag: true }
    expect(loadMapEffectConfig({ getItem: () => JSON.stringify(extended) }).base.innerColor)
      .toBe(LEGACY_DEFAULTS.base.innerColor)

    const caseChanged = {
      ...LEGACY_DEFAULTS,
      base: { ...LEGACY_DEFAULTS.base, innerColor: '#4DA3FF' }
    }
    expect(loadMapEffectConfig({ getItem: () => JSON.stringify(caseChanged) }).base.innerColor)
      .toBe(LEGACY_DEFAULTS.base.innerColor)
  })

  it('逐字段补默认值、规范化颜色并裁剪数值', () => {
    const value = normalizeMapEffectConfig({
      version: 1,
      base: {
        innerColor: '#ABCDEF',
        innerWidth: 99,
        innerOpacity: -2
      },
      hover: {
        emissiveIntensity: 9,
        lift: -1,
        enterMs: 1200,
        leaveMs: 160
      }
    })

    expect(value.base.innerColor).toBe('#abcdef')
    expect(value.base.innerWidth).toBe(4)
    expect(value.base.innerOpacity).toBe(0)
    expect(value.base.outerColor).toBe(MAP_EFFECT_DEFAULTS.base.outerColor)
    expect(value.hover.emissiveIntensity).toBe(2)
    expect(value.hover.lift).toBe(0)
    expect(value.hover.enterMs).toBe(1000)
    expect(value.hover.leaveMs).toBe(160)
  })

  it('把常态和 hover 扩散半径按屏幕像素裁剪到 0–120', () => {
    const high = normalizeMapEffectConfig({
      ...MAP_EFFECT_DEFAULTS,
      base: { ...MAP_EFFECT_DEFAULTS.base, outerGlowWidth: 999 },
      hover: { ...MAP_EFFECT_DEFAULTS.hover, glowWidth: 999 }
    })
    expect(high.base.outerGlowWidth).toBe(120)
    expect(high.hover.glowWidth).toBe(120)

    const low = normalizeMapEffectConfig({
      ...MAP_EFFECT_DEFAULTS,
      base: { ...MAP_EFFECT_DEFAULTS.base, outerGlowWidth: -1 },
      hover: { ...MAP_EFFECT_DEFAULTS.hover, glowWidth: -1 }
    })
    expect(low.base.outerGlowWidth).toBe(0)
    expect(low.hover.glowWidth).toBe(0)
    expect(MAP_EFFECT_DEFAULTS.base.outerGlowWidth).toBe(0)
    expect(MAP_EFFECT_DEFAULTS.hover.glowWidth).toBe(0)
  })

  it('非法字段逐项回退，版本不支持时整份回退', () => {
    const partial = normalizeMapEffectConfig({
      version: 1,
      base: { innerColor: 'blue' },
      hover: { glowColor: '#12zz00' }
    })
    expect(partial.base.innerColor).toBe(MAP_EFFECT_DEFAULTS.base.innerColor)
    expect(partial.hover.glowColor).toBe(MAP_EFFECT_DEFAULTS.hover.glowColor)

    expect(normalizeMapEffectConfig({ version: 2, base: {}, hover: {} }))
      .toEqual(MAP_EFFECT_DEFAULTS)
  })

  it('损坏缓存安全回退，保存失败不抛错', () => {
    const brokenReader = { getItem: () => '{broken-json' }
    expect(loadMapEffectConfig(brokenReader)).toEqual(MAP_EFFECT_DEFAULTS)

    const writes: Array<[string, string]> = []
    saveMapEffectConfig({ setItem: (key, value) => writes.push([key, value]) }, MAP_EFFECT_DEFAULTS)
    expect(writes[0][0]).toBe(MAP_EFFECT_STORAGE_KEY)
    expect(JSON.parse(writes[0][1])).toEqual(MAP_EFFECT_DEFAULTS)

    expect(() => saveMapEffectConfig({ setItem: () => { throw new Error('denied') } }, MAP_EFFECT_DEFAULTS))
      .not.toThrow()
  })

  it('复制 JSON 可重新解析且保持规范化值', () => {
    const text = formatMapEffectConfig(MAP_EFFECT_DEFAULTS)
    expect(text).toContain('\n  "version": 1')
    expect(normalizeMapEffectConfig(JSON.parse(text))).toEqual(MAP_EFFECT_DEFAULTS)
  })
})
