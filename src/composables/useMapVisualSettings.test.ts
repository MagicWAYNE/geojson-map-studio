// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAP_EFFECT_DEFAULTS } from '@/components/map/mapEffectConfig'
import { cloneDistrictBarConfig } from '@/components/map/mapDistrictBarConfig'
import { MAP_HUD_DEFAULTS } from '@/components/map/mapHudConfig'

beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.restoreAllMocks()
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

    session.numericField('layout.left').edit('-')
    expect(session.numericField('layout.left').read(session.layout.left)).toBe('-')
    expect(session.layout.left).toBe(24)

    session.commitLayoutField('left', '-40')
    expect(session.layout.left).toBe(-40)
    expect(session.numericField('layout.left').read(session.layout.left)).toBe('-40')
    expect(session.compositionWarnings.value).toContain('地图超出 1920×1080 设计视口')

    session.commitLayoutField('left', '1180')
    expect(session.layout.left).toBe(1180)
    expect(session.compositionWarnings.value).toContain('地图与右侧设置栏发生重叠')

    session.commitLayoutField('left', '2500')
    expect(session.layout.left).toBe(2500)
    expect(session.numericField('layout.left').read(session.layout.left)).toBe('2500')

    session.commitLayoutField('width', '0')
    session.commitLayoutField('height', '-100')
    expect(session.layout.width).toBe(200)
    expect(session.layout.height).toBe(200)
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

  it('centers the current map size while the sidebar is collapsed and restores authored position', async () => {
    const { useMapVisualSettings } = await import('./useMapVisualSettings')
    const session = useMapVisualSettings()
    session.resetVisualSession()
    session.layout.left = 81
    session.layout.top = 93
    session.layout.width = 1000
    session.layout.height = 800

    session.setSidebarCollapsed(true)
    expect(session.effectiveMapLayout.value).toEqual({
      left: 460,
      top: 140,
      width: 1000,
      height: 800
    })
    expect({ ...session.layout }).toEqual({ left: 81, top: 93, width: 1000, height: 800 })

    session.toggleSidebar()
    expect(session.sidebarCollapsed.value).toBe(false)
    expect(session.effectiveMapLayout.value).toEqual({ left: 81, top: 93, width: 1000, height: 800 })
  })

  it('owns independent session-only files for both background layers and revokes replaced or reset files', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('blob:first')
      .mockReturnValueOnce('blob:second')
      .mockReturnValueOnce('blob:terrain')
      .mockReturnValueOnce('blob:broken')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const { useMapVisualSettings } = await import('./useMapVisualSettings')
    const session = useMapVisualSettings()
    session.resetVisualSession()

    expect(await session.replaceBackgroundLayerImage('main',
      new File(['first'], 'first.png', { type: 'image/png' })
    )).toEqual({ ok: true, message: '' })
    expect(session.backgroundLayerSources.value.main).toEqual({
      url: 'blob:first', filename: 'first.png', custom: true
    })
    expect(session.backgroundLayerSources.value.terrain.custom).toBe(false)
    expect(session.visualDirty.value).toBe(true)

    await session.replaceBackgroundLayerImage('main', new File(['second'], 'second.webp', { type: 'image/webp' }))
    expect(session.backgroundLayerSources.value.main.url).toBe('blob:second')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:first')

    await session.replaceBackgroundLayerImage('terrain', new File(['terrain'], 'terrain.png', { type: 'image/png' }))
    expect(session.backgroundLayerSources.value.terrain.url).toBe('blob:terrain')

    const rejected = await session.replaceBackgroundLayerImage('main',
      new File(['text'], 'notes.txt', { type: 'text/plain' })
    )
    expect(rejected.ok).toBe(false)
    expect(session.backgroundLayerSources.value.main.url).toBe('blob:second')
    expect(session.backgroundLayerSources.value.terrain.url).toBe('blob:terrain')

    vi.spyOn(Image.prototype, 'decode').mockRejectedValueOnce(new Error('broken image'))
    const broken = await session.replaceBackgroundLayerImage('main',
      new File(['broken'], 'broken.png', { type: 'image/png' })
    )
    expect(broken).toEqual({ ok: false, message: '无法读取背景图片，请重新选择文件' })
    expect(session.backgroundLayerSources.value.main.url).toBe('blob:second')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:broken')

    session.resetBackgroundLayerImage('main')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:second')
    expect(session.backgroundLayerSources.value.main.custom).toBe(false)
    expect(session.backgroundLayerSources.value.terrain.url).toBe('blob:terrain')

    session.resetVisualSession()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:terrain')
    expect(session.backgroundLayerSources.value.terrain.custom).toBe(false)
    expect(session.sidebarCollapsed.value).toBe(false)
    expect(createObjectURL).toHaveBeenCalledTimes(4)
  })

  it('owns independent session-only visibility for both default background layers', async () => {
    const { useMapVisualSettings } = await import('./useMapVisualSettings')
    const session = useMapVisualSettings()
    session.resetVisualSession()

    expect({ ...session.backgroundLayerVisibility }).toEqual({ main: true, terrain: true })
    session.setBackgroundLayerVisibility('terrain', false)
    expect({ ...session.backgroundLayerVisibility }).toEqual({ main: true, terrain: false })
    expect(session.visualDirty.value).toBe(true)

    session.setBackgroundLayerVisibility('main', false)
    expect({ ...session.backgroundLayerVisibility }).toEqual({ main: false, terrain: false })

    session.resetVisualSession()
    expect({ ...session.backgroundLayerVisibility }).toEqual({ main: true, terrain: true })
  })

  it('preserves unpublished effect drafts while chart styling updates both bar subtrees', async () => {
    const { useMapVisualSettings } = await import('./useMapVisualSettings')
    const session = useMapVisualSettings()
    session.resetVisualSession()
    session.setEffectLivePreview(false)
    session.effectDraft.base.outerGlowWidth = 144

    const bars = cloneDistrictBarConfig(session.effect.bars)
    bars.width = 2.75
    session.replaceRegionBars(bars)

    expect(session.effect.base.outerGlowWidth).toBe(MAP_EFFECT_DEFAULTS.base.outerGlowWidth)
    expect(session.effectDraft.base.outerGlowWidth).toBe(144)
    expect(session.effect.bars.width).toBe(2.75)
    expect(session.effectDraft.bars.width).toBe(2.75)

    session.applyEffectDraft()
    expect(session.effect.base.outerGlowWidth).toBe(144)
    expect(session.effect.bars.width).toBe(2.75)
  })

  it('owns effect, chart, HUD presets, scoped resets, normalization and projections', async () => {
    const { B3_GLOW_PROFILE_DEFAULTS } = await import('@/components/map/mapEffectConfig')
    const { BLUE_PURPLE_MOSAIC_PARTICLE_PRESET } = await import('@/components/map/mapMosaicParticleConfig')
    const { useMapVisualSettings } = await import('./useMapVisualSettings')
    const session = useMapVisualSettings()
    session.resetVisualSession()

    session.applyEffectB3Preset('hover')
    expect(session.effect.hover.glowFarPasses).toBe(B3_GLOW_PROFILE_DEFAULTS.farPasses)
    session.applyEffectMosaicPreset()
    expect(session.effect.hover.mosaicParticles).toEqual(BLUE_PURPLE_MOSAIC_PARTICLE_PRESET)
    session.setHudField({ section: 'anchor', key: 'x', value: 999 })
    expect(session.hud.anchor.x).toBe(150)

    const bars = cloneDistrictBarConfig(session.effect.bars)
    bars.width = 999
    session.replaceRegionBars(bars)
    expect(session.effect.bars.width).toBe(8)
    expect(JSON.parse(session.regionBarJson.value).width).toBe(8)

    session.resetRegionBars()
    session.resetEditableHud()
    expect(session.effect.bars.width).toBe(MAP_EFFECT_DEFAULTS.bars.width)
    expect(session.hud.anchor.x).toBe(MAP_HUD_DEFAULTS.anchor.x)
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
    session.numericField('effect.base.outerGlowWidth').edit('99')
    session.resetVisualSession()

    expect(session.workspaceMode.value).toBe('data')
    expect({ ...session.layout }).toEqual(MAP_LAYOUT_DEFAULT)
    expect(session.effect.base.outerGlowWidth).toBe(MAP_EFFECT_DEFAULTS.base.outerGlowWidth)
    expect(session.hud.anchor.x).toBe(MAP_HUD_DEFAULTS.anchor.x)
    expect(session.numericField('effect.base.outerGlowWidth').read(0)).toBe('0')
    for (const spy of storageSpies) expect(spy).not.toHaveBeenCalled()
  })
})
