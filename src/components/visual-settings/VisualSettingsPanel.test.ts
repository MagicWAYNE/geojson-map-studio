// @vitest-environment happy-dom
import { createApp, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import VisualSettingsPanel from './VisualSettingsPanel.vue'
import { VISUAL_SETTINGS_PAGES, useMapVisualSettings } from '@/composables/useMapVisualSettings'

vi.mock('@/utils/copyText', () => ({ copyTextToClipboard: vi.fn().mockResolvedValue(true) }))

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

    const publishedPaths = sorted(new Set(
      [...root.querySelectorAll<HTMLElement>('[data-control-path]')]
        .map((node) => node.dataset.controlPath!)
    ))

    expect(publishedPaths).toMatchInlineSnapshot(`
      [
        "bars.anchorOffsetX",
        "bars.anchorOffsetY",
        "bars.baseOffset",
        "bars.baseRingOpacity",
        "bars.baseRingRadius",
        "bars.color",
        "bars.enabled",
        "bars.enterMs",
        "bars.glowStrength",
        "bars.hoverEmissiveIntensity",
        "bars.hoverInactiveOpacity",
        "bars.hoverLift",
        "bars.maxHeight",
        "bars.minHeight",
        "bars.pulseColor",
        "bars.pulseDurationMs",
        "bars.pulseEnabled",
        "bars.pulseInnerOpacity",
        "bars.pulseInnerRadiusRatio",
        "bars.pulseOuterOpacity",
        "bars.pulseOuterRadiusRatio",
        "bars.pulseStaggerMs",
        "bars.pulseWidth",
        "bars.sqrtExponent",
        "bars.staggerMs",
        "bars.width",
        "base.innerColor",
        "base.innerOpacity",
        "base.innerWidth",
        "base.inwardGlow.baseRatio",
        "base.inwardGlow.color",
        "base.inwardGlow.edgeSoftness",
        "base.inwardGlow.enabled",
        "base.inwardGlow.falloff",
        "base.inwardGlow.farOpacityRatio",
        "base.inwardGlow.farPasses",
        "base.inwardGlow.farRadiusRatio",
        "base.inwardGlow.maxAlpha",
        "base.inwardGlow.nearOpacityRatio",
        "base.inwardGlow.nearPasses",
        "base.inwardGlow.nearRadiusRatio",
        "base.inwardGlow.strength",
        "base.inwardGlow.width",
        "base.outerColor",
        "base.outerCoreWidth",
        "base.outerGlowColor",
        "base.outerGlowEdgeSoftness",
        "base.outerGlowEnabled",
        "base.outerGlowFalloff",
        "base.outerGlowFarOpacityRatio",
        "base.outerGlowFarPasses",
        "base.outerGlowFarRadiusRatio",
        "base.outerGlowNearOpacityRatio",
        "base.outerGlowNearPasses",
        "base.outerGlowNearRadiusRatio",
        "base.outerGlowStrength",
        "base.outerGlowWidth",
        "hover.emissiveColor",
        "hover.emissiveIntensity",
        "hover.enterMs",
        "hover.glowColor",
        "hover.glowEdgeSoftness",
        "hover.glowEnabled",
        "hover.glowFalloff",
        "hover.glowFarOpacityRatio",
        "hover.glowFarPasses",
        "hover.glowFarRadiusRatio",
        "hover.glowNearOpacityRatio",
        "hover.glowNearPasses",
        "hover.glowNearRadiusRatio",
        "hover.glowStrength",
        "hover.glowWidth",
        "hover.inwardGlow.baseRatio",
        "hover.inwardGlow.color",
        "hover.inwardGlow.edgeSoftness",
        "hover.inwardGlow.enabled",
        "hover.inwardGlow.falloff",
        "hover.inwardGlow.farOpacityRatio",
        "hover.inwardGlow.farPasses",
        "hover.inwardGlow.farRadiusRatio",
        "hover.inwardGlow.maxAlpha",
        "hover.inwardGlow.nearOpacityRatio",
        "hover.inwardGlow.nearPasses",
        "hover.inwardGlow.nearRadiusRatio",
        "hover.inwardGlow.strength",
        "hover.inwardGlow.width",
        "hover.leaveMs",
        "hover.lift",
        "hover.mosaicParticles.accentClusterBias",
        "hover.mosaicParticles.accentColor",
        "hover.mosaicParticles.accentRatio",
        "hover.mosaicParticles.brightness",
        "hover.mosaicParticles.burstDensityBoost",
        "hover.mosaicParticles.burstDurationMs",
        "hover.mosaicParticles.burstStrength",
        "hover.mosaicParticles.clusterChance",
        "hover.mosaicParticles.clusterFlickerScale",
        "hover.mosaicParticles.clusterRadius",
        "hover.mosaicParticles.clusterStrength",
        "hover.mosaicParticles.density",
        "hover.mosaicParticles.dutyCycle",
        "hover.mosaicParticles.enabled",
        "hover.mosaicParticles.flickerHz",
        "hover.mosaicParticles.gapColor",
        "hover.mosaicParticles.gapOpacity",
        "hover.mosaicParticles.gapRatio",
        "hover.mosaicParticles.maxCellPx",
        "hover.mosaicParticles.minCellPx",
        "hover.mosaicParticles.opacity",
        "hover.mosaicParticles.primaryColor",
        "hover.mosaicParticles.pulseSharpness",
        "hover.mosaicParticles.reseedOnEnter",
        "hover.mosaicParticles.seed",
        "hover.mosaicParticles.surfaceOffset",
        "hover.mosaicParticles.targetCellPx",
        "hover.outlineColor",
        "hover.outlineWidth",
        "hover.surfaceColor",
        "hud.anchor.elevation",
        "hud.anchor.x",
        "hud.anchor.z",
        "hud.rotating.diameter",
        "hud.rotating.elevationOffset",
        "hud.rotating.enabled",
        "hud.rotating.opacity",
        "hud.rotating.phaseDeg",
        "hud.rotating.speedDegPerSecond",
        "hud.static.diameter",
        "hud.static.elevationOffset",
        "hud.static.enabled",
        "hud.static.opacity",
        "hud.static.phaseDeg",
        "layout.height",
        "layout.left",
        "layout.top",
        "layout.width",
        "overlay.badge.backgroundColor",
        "overlay.badge.backgroundOpacity",
        "overlay.badge.borderColor",
        "overlay.badge.borderRadius",
        "overlay.badge.borderWidth",
        "overlay.badge.decimals",
        "overlay.badge.enabled",
        "overlay.badge.enterDelayMs",
        "overlay.badge.enterMs",
        "overlay.badge.fontSize",
        "overlay.badge.fontWeight",
        "overlay.badge.gapY",
        "overlay.badge.height",
        "overlay.badge.hideOnHover",
        "overlay.badge.hoverInactiveOpacity",
        "overlay.badge.minWidth",
        "overlay.badge.offsetX",
        "overlay.badge.offsetY",
        "overlay.badge.paddingX",
        "overlay.badge.shadowBlur",
        "overlay.badge.shadowColor",
        "overlay.badge.shadowOpacity",
        "overlay.badge.staggerMs",
        "overlay.badge.textColor",
        "overlay.badge.thousandsSeparator",
        "overlay.collision.badgeCollisionEnabled",
        "overlay.collision.badgeCollisionGap",
        "overlay.collision.badgeMaxShift",
        "overlay.enabled",
        "overlay.panel.amountDecimals",
        "overlay.panel.backgroundColor",
        "overlay.panel.backgroundOpacity",
        "overlay.panel.borderColor",
        "overlay.panel.borderRadius",
        "overlay.panel.borderWidth",
        "overlay.panel.caseDecimals",
        "overlay.panel.enabled",
        "overlay.panel.enterMs",
        "overlay.panel.enterScale",
        "overlay.panel.gapX",
        "overlay.panel.labelColor",
        "overlay.panel.labelFontSize",
        "overlay.panel.labelFontWeight",
        "overlay.panel.leaveMs",
        "overlay.panel.minHeight",
        "overlay.panel.offsetY",
        "overlay.panel.paddingBottom",
        "overlay.panel.paddingLeft",
        "overlay.panel.paddingRight",
        "overlay.panel.paddingTop",
        "overlay.panel.preferredSide",
        "overlay.panel.rowGap",
        "overlay.panel.thousandsSeparator",
        "overlay.panel.titleAssetHeight",
        "overlay.panel.titleAssetWidth",
        "overlay.panel.titleColor",
        "overlay.panel.titleFontSize",
        "overlay.panel.titleFontWeight",
        "overlay.panel.titleOffsetX",
        "overlay.panel.titleOffsetY",
        "overlay.panel.titleTextOffsetX",
        "overlay.panel.titleTextOffsetY",
        "overlay.panel.unitColor",
        "overlay.panel.unitFontSize",
        "overlay.panel.unitFontWeight",
        "overlay.panel.valueColor",
        "overlay.panel.valueFontSize",
        "overlay.panel.valueFontWeight",
        "overlay.panel.viewportPadding",
        "overlay.panel.width",
        "quality.maxAlpha",
        "quality.renderScale",
      ]
    `)
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
