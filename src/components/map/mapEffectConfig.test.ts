import { describe, expect, it } from 'vitest'
import {
  MAP_EFFECT_DEFAULTS,
  MAP_EFFECT_STORAGE_KEY,
  formatMapEffectConfig,
  loadMapEffectConfig,
  normalizeMapEffectConfig,
  saveMapEffectConfig
} from './mapEffectConfig'

describe('mapEffectConfig', () => {
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
