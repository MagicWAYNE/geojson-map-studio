// @vitest-environment happy-dom
import { createApp, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MAP_EFFECT_DEFAULTS } from '@/components/map/mapEffectConfig'
import { MAP_HUD_DEFAULTS } from '@/components/map/mapHudConfig'
import VisualSettingsPanel from './VisualSettingsPanel.vue'
import { VISUAL_SETTINGS_PAGES, useMapVisualSettings } from '@/composables/useMapVisualSettings'

vi.mock('@/utils/copyText', () => ({ copyTextToClipboard: vi.fn().mockResolvedValue(true) }))

function leafPaths(value: object, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return child !== null && typeof child === 'object' && !Array.isArray(child)
      ? leafPaths(child, path)
      : [path]
  })
}

function sorted(values: Iterable<string>): string[] {
  return [...values].sort((a, b) => a.localeCompare(b))
}

beforeEach(() => {
  useMapVisualSettings().resetVisualSession()
})

afterEach(() => {
  document.body.replaceChildren()
})

describe('Engineering Visual Settings inventory', () => {
  it('publishes five stable pages and every fixed-point visual configuration leaf once', async () => {
    const root = document.createElement('div')
    const app = createApp(VisualSettingsPanel)
    app.mount(root)
    await nextTick()

    expect([...root.querySelectorAll<HTMLElement>('[data-visual-page]')].map((node) => [
      node.dataset.visualPage,
      node.textContent?.trim()
    ])).toEqual(VISUAL_SETTINGS_PAGES.map((page) => [page.id, page.label]))

    const { version: _effectVersion, bars, ...effectConfig } = MAP_EFFECT_DEFAULTS
    const { opacity: _fixedOpaque, overlay, ...barConfig } = bars
    const { version: _hudVersion, ...hudConfig } = MAP_HUD_DEFAULTS
    const expectedPaths = sorted([
      'layout.left',
      'layout.top',
      'layout.width',
      'layout.height',
      ...leafPaths(effectConfig),
      ...leafPaths(barConfig, 'bars'),
      ...leafPaths(overlay, 'overlay'),
      ...leafPaths(hudConfig, 'hud')
    ])
    const publishedPaths = sorted(new Set(
      [...root.querySelectorAll<HTMLElement>('[data-control-path]')]
        .map((node) => node.dataset.controlPath!)
    ))

    expect(publishedPaths).toEqual(expectedPaths)
    expect(root.textContent).not.toMatch(/扶持企业|服务资源|区级/)
    app.unmount()
  })

  it('keeps every legacy preset, draft, reset and copy action reachable in the single sidebar entry', async () => {
    const root = document.createElement('div')
    const app = createApp(VisualSettingsPanel)
    app.mount(root)
    await nextTick()

    const effectPreview = root.querySelector<HTMLInputElement>('[data-visual-action="effect.live-preview"]')!
    const hudPreview = root.querySelector<HTMLInputElement>('[data-visual-action="hud.live-preview"]')!
    effectPreview.checked = false
    effectPreview.dispatchEvent(new Event('change', { bubbles: true }))
    hudPreview.checked = false
    hudPreview.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()

    const actions = new Set(
      [...root.querySelectorAll<HTMLElement>('[data-visual-action]')]
        .map((node) => node.dataset.visualAction!)
    )
    expect(sorted(actions)).toEqual(sorted([
      'layout.copy-css',
      'layout.copy-camera',
      'layout.reset',
      'effect.live-preview',
      'effect.apply',
      'effect.discard',
      'effect.base.b3-preset',
      'effect.base.reset',
      'effect.hover.b3-preset',
      'effect.hover.reset',
      'effect.base.inward-preset',
      'effect.base.inward-reset',
      'effect.hover.inward-preset',
      'effect.hover.inward-reset',
      'effect.mosaic.preset',
      'effect.mosaic.randomize',
      'effect.mosaic.reset',
      'effect.copy',
      'effect.reset-all',
      'bars.copy',
      'bars.reset',
      'overlay.copy',
      'overlay.reset',
      'hud.live-preview',
      'hud.apply',
      'hud.discard',
      'hud.copy',
      'hud.reset',
      'engineering.carousel'
    ]))
    expect(root.textContent).toContain('离屏目标')
    expect(root.textContent).toContain('效果降级')
    expect(root.textContent).toContain('柱体数量')
    app.unmount()
  })

  it('preserves page selection and visual draft while navigating all five pages', async () => {
    const root = document.createElement('div')
    const app = createApp(VisualSettingsPanel)
    app.mount(root)
    await nextTick()
    const session = useMapVisualSettings()

    session.setEffectLivePreview(false)
    session.effectDraft.base.outerGlowWidth = 101
    for (const page of VISUAL_SETTINGS_PAGES) {
      root.querySelector<HTMLButtonElement>(`[data-visual-page="${page.id}"]`)!.click()
      await nextTick()
      expect(session.activeVisualPage.value).toBe(page.id)
      expect(root.querySelector(`[data-visual-page-content="${page.id}"]`)).not.toBeNull()
    }
    expect(session.effectDraft.base.outerGlowWidth).toBe(101)
    expect(session.effect.base.outerGlowWidth).not.toBe(101)
    app.unmount()
  })

  it('gives every visual page its own scroll container', async () => {
    const root = document.createElement('div')
    const app = createApp(VisualSettingsPanel)
    app.mount(root)
    await nextTick()

    const scrollPages = [...root.querySelectorAll<HTMLElement>('[data-page-scroll]')]
    expect(scrollPages.map((page) => page.dataset.pageScroll)).toEqual(
      VISUAL_SETTINGS_PAGES.map((page) => page.id)
    )
    scrollPages[1].scrollTop = 140
    scrollPages[2].scrollTop = 360
    expect(scrollPages[1].scrollTop).toBe(140)
    expect(scrollPages[2].scrollTop).toBe(360)
    app.unmount()
  })
})
