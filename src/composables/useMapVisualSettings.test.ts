// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MAP_EFFECT_DEFAULTS } from '@/components/map/mapEffectConfig'
import { MAP_HUD_DEFAULTS } from '@/components/map/mapHudConfig'

beforeEach(() => {
  vi.resetModules()
})

describe('visual-settings session', () => {
  it('starts with the tool composition and five stable visual pages', async () => {
    const { MAP_LAYOUT_DEFAULT, VISUAL_SETTINGS_PAGES, useMapVisualSettings } = await import('./useMapVisualSettings')
    const session = useMapVisualSettings()

    expect(MAP_LAYOUT_DEFAULT).toEqual({ left: 24, top: 132, width: 1120, height: 948 })
    expect({ ...session.layout }).toEqual(MAP_LAYOUT_DEFAULT)
    expect(VISUAL_SETTINGS_PAGES.map((page) => [page.id, page.label])).toEqual([
      ['composition', '构图与视角'],
      ['effects', '地图效果'],
      ['charts', '图表样式'],
      ['hud', 'HUD'],
      ['engineering', '工程信息']
    ])
    expect(session.workspaceMode.value).toBe('data')
    expect(session.activeVisualPage.value).toBe('composition')
  })

  it('keeps partial layout text in the session and only publishes finite committed values', async () => {
    const { useMapVisualSettings } = await import('./useMapVisualSettings')
    const session = useMapVisualSettings()

    session.editNumericDraft('layout.left', '-')
    expect(session.readNumericDraft('layout.left', session.layout.left)).toBe('-')
    expect(session.layout.left).toBe(24)

    session.commitLayoutField('left', '-40')
    expect(session.layout.left).toBe(-40)
    expect(session.readNumericDraft('layout.left', session.layout.left)).toBe('-40')
    expect(session.compositionWarnings.value).toContain('地图超出 1920×1080 设计视口')

    session.commitLayoutField('left', '1180')
    expect(session.layout.left).toBe(1180)
    expect(session.compositionWarnings.value).toContain('地图与右侧设置栏发生重叠')
  })

  it('shares one effect draft with live preview, apply and discard intentions', async () => {
    const { useMapVisualSettings } = await import('./useMapVisualSettings')
    const session = useMapVisualSettings()

    session.setEffectLivePreview(false)
    session.effectDraft.base.outerGlowWidth = 91
    expect(session.effect.base.outerGlowWidth).toBe(MAP_EFFECT_DEFAULTS.base.outerGlowWidth)

    session.applyEffectDraft()
    expect(session.effect.base.outerGlowWidth).toBe(91)

    session.effectDraft.base.outerGlowWidth = 17
    session.discardEffectDraft()
    expect(session.effectDraft.base.outerGlowWidth).toBe(91)
  })

  it('reset restores source defaults without writing browser persistence', async () => {
    const storageSpies = [
      vi.spyOn(Storage.prototype, 'setItem'),
      vi.spyOn(Storage.prototype, 'removeItem'),
      vi.spyOn(Storage.prototype, 'clear')
    ]
    const { MAP_LAYOUT_DEFAULT, useMapVisualSettings } = await import('./useMapVisualSettings')
    const session = useMapVisualSettings()

    session.workspaceMode.value = 'visual'
    session.layout.left = 400
    session.effect.base.outerGlowWidth = 99
    session.hud.anchor.x = 18
    session.editNumericDraft('effect.base.outerGlowWidth', '99')
    session.resetVisualSession()

    expect(session.workspaceMode.value).toBe('data')
    expect({ ...session.layout }).toEqual(MAP_LAYOUT_DEFAULT)
    expect(session.effect.base.outerGlowWidth).toBe(MAP_EFFECT_DEFAULTS.base.outerGlowWidth)
    expect(session.hud.anchor.x).toBe(MAP_HUD_DEFAULTS.anchor.x)
    expect(session.readNumericDraft('effect.base.outerGlowWidth', 0)).toBe('0')
    for (const spy of storageSpies) expect(spy).not.toHaveBeenCalled()
  })
})
