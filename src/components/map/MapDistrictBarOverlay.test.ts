// @vitest-environment happy-dom
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, reactive, type App } from 'vue'
import {
  MAP_DISTRICT_BAR_OVERLAY_DEFAULTS,
  cloneDistrictBarOverlayConfig,
  type MapDistrictBarOverlayConfig
} from './mapDistrictBarOverlayConfig'
import type {
  DistrictBarBadgeOverlayLayout,
  DistrictBarOverlayLayout,
  DistrictBarOverlayMeasuredSizes,
  DistrictBarPanelOverlayLayout
} from './mapDistrictBarOverlayLayout'
import MapDistrictBarOverlay from './MapDistrictBarOverlay.vue'

interface MountedOverlay {
  app: App
  root: HTMLDivElement
  state: {
    layout: DistrictBarOverlayLayout
    config: MapDistrictBarOverlayConfig
  }
  measured: DistrictBarOverlayMeasuredSizes[]
}

interface ResizeObserverHarness {
  observed: Set<Element>
  observe: ReturnType<typeof vi.fn>
  unobserve: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
  notify: (entries: ResizeObserverEntry[]) => void
}

function installResizeObserver(): ResizeObserverHarness {
  const observed = new Set<Element>()
  let callback: ResizeObserverCallback = () => undefined
  const observe = vi.fn((target: Element) => observed.add(target))
  const unobserve = vi.fn((target: Element) => observed.delete(target))
  const disconnect = vi.fn(() => observed.clear())
  const observer = { observe, unobserve, disconnect } as unknown as ResizeObserver

  vi.stubGlobal('ResizeObserver', class {
    constructor(nextCallback: ResizeObserverCallback) {
      callback = nextCallback
    }

    observe = observe
    unobserve = unobserve
    disconnect = disconnect
  })

  return {
    observed,
    observe,
    unobserve,
    disconnect,
    notify: (entries) => callback(entries, observer)
  }
}

function resizeEntry(
  target: Element,
  borderBoxSize?: ResizeObserverSize | readonly ResizeObserverSize[]
): ResizeObserverEntry {
  return { target, borderBoxSize } as unknown as ResizeObserverEntry
}

function dispatchBadgeAnimation(
  element: HTMLElement,
  type: 'animationend' | 'animationcancel',
  animationName = 'district-bar-badge-enter-7f31a9d2'
): void {
  const event = new Event(type, { bubbles: true })
  Object.defineProperty(event, 'animationName', { value: animationName })
  element.dispatchEvent(event)
}

async function waitForTransitionListener(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

async function waitForTransitionCompletion(duration: number): Promise<void> {
  await waitForTransitionListener()
  await new Promise((resolve) => setTimeout(resolve, duration + 5))
  await nextTick()
}

function installOverlayStyles(): void {
  if (document.head.querySelector('[data-overlay-test-styles]')) return
  const source = readFileSync(resolve(
    process.cwd(),
    'src/components/map/MapDistrictBarOverlay.vue'
  ), 'utf8')
  const css = source.match(/<style scoped>([\s\S]*?)<\/style>/)?.[1]
  if (!css) throw new Error('MapDistrictBarOverlay scoped styles are missing')
  const style = document.createElement('style')
  style.dataset.overlayTestStyles = ''
  style.textContent = css
  document.head.append(style)
}

function installMapErrorStyles(): void {
  const source = readFileSync(resolve(
    process.cwd(),
    'src/components/map/ChongqingMap3D.vue'
  ), 'utf8')
  const css = source.match(/<style scoped>([\s\S]*?)<\/style>/)?.[1]
  if (!css) throw new Error('ChongqingMap3D scoped styles are missing')
  const style = document.createElement('style')
  style.dataset.mapErrorTestStyles = ''
  style.textContent = css
  document.head.append(style)
}

function badge(
  name: string,
  order: number,
  overrides: Partial<DistrictBarBadgeOverlayLayout> = {}
): DistrictBarBadgeOverlayLayout {
  return {
    name,
    order,
    projectionStatus: 'visible',
    anchor: { x: 100 + order * 10, y: 200 + order * 10 },
    rect: { left: 20 + order * 10, top: 30 + order * 10, width: 90, height: 34 },
    visible: true,
    text: String((order + 1) * 11),
    collisionShift: 0,
    collisionFree: true,
    ...overrides
  }
}

function panel(
  name: string,
  overrides: Partial<DistrictBarPanelOverlayLayout> = {}
): DistrictBarPanelOverlayLayout {
  return {
    name,
    projectionStatus: 'visible',
    anchor: { x: 400, y: 260 },
    rect: { left: 426, top: 272, width: 340, height: 124 },
    side: 'right',
    viewportOverflow: false,
    titleText: name,
    caseText: '123',
    amountText: '45.67',
    ...overrides
  }
}

async function mountOverlay(
  layout: DistrictBarOverlayLayout,
  config = cloneDistrictBarOverlayConfig(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS)
): Promise<MountedOverlay> {
  installOverlayStyles()
  const state = reactive({ layout, config })
  const measured: DistrictBarOverlayMeasuredSizes[] = []
  const root = document.createElement('div')
  document.body.append(root)
  const app = createApp({
    render: () => h(MapDistrictBarOverlay, {
      layout: state.layout,
      config: state.config,
      onSizesChange: (sizes: DistrictBarOverlayMeasuredSizes) => measured.push(sizes)
    })
  })
  app.mount(root)
  await nextTick()
  return { app, root, state, measured }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.head.replaceChildren()
  document.body.replaceChildren()
})

describe('MapDistrictBarOverlay', () => {
  it('pins the exact formal title SVG bytes', () => {
    const asset = readFileSync(resolve(
      process.cwd(),
      'src/assets/images/map-district-bar-hover-title.svg'
    ))

    expect(createHash('sha256').update(asset).digest('hex')).toBe(
      '36efe8a666fad7be39093702a2ddaf07998d7bc920fdbc5b2ec8b79dfd5fd228'
    )
  })

  it('keeps all eight badges in inert DOM and renders only the panel contract text', async () => {
    vi.stubGlobal('ResizeObserver', undefined)
    const badges = Array.from({ length: 8 }, (_, index) => badge(`district-${index}`, index))
    badges[5] = badge('hidden-district', 5, { visible: false, rect: null, text: 'hidden-value' })
    const { app, root } = await mountOverlay({ badges, panel: panel('南岸区') })

    const overlay = root.querySelector<HTMLElement>('.map-district-bar-overlay')!
    const renderedBadges = [...root.querySelectorAll<HTMLElement>('[data-badge-name]')]
    expect(renderedBadges).toHaveLength(8)
    expect(renderedBadges.map((element) => element.dataset.badgeName)).toContain('hidden-district')
    expect(renderedBadges.find((element) =>
      element.dataset.badgeName === 'hidden-district'
    )?.classList.contains('is-visible')).toBe(false)
    expect(renderedBadges.map((element) => element.textContent)).toContain('hidden-value')
    const panelElement = root.querySelector<HTMLElement>('.district-bar-panel')!
    const rows = [...panelElement.querySelectorAll<HTMLElement>('.district-bar-panel-row')]
    expect(rows).toHaveLength(2)
    expect(rows.map((row) =>
      row.querySelector<HTMLElement>('.district-bar-panel-label')?.textContent
    )).toEqual(['案件量：', '在调金额：'])
    expect(rows.map((row) => row.textContent)).toEqual([
      '案件量：123 件',
      '在调金额：45.67 万元'
    ])
    expect(root.textContent).toContain('案件量：123 件')
    expect(root.textContent).toContain('在调金额：45.67 万元')
    expect(root.textContent).not.toContain('zzs')
    expect(overlay.getAttribute('aria-hidden')).toBe('true')
    const computedOverlay = getComputedStyle(overlay)
    expect(computedOverlay.pointerEvents).toBe('none')
    expect(getComputedStyle(renderedBadges[0]).pointerEvents).toBe('none')
    expect(getComputedStyle(root.querySelector<HTMLElement>('.district-bar-panel')!).pointerEvents).toBe('none')
    const heroNumberFont = 'Bebas, "Microsoft Yahei", sans-serif'
    expect(getComputedStyle(renderedBadges[0]).fontFamily).toBe(heroNumberFont)
    expect(rows.map((row) =>
      getComputedStyle(row.querySelector<HTMLElement>('.district-bar-panel-value')!).fontFamily
    )).toEqual([heroNumberFont, heroNumberFont])
    expect([
      panelElement.querySelector<HTMLElement>('.district-bar-panel-title-text'),
      ...panelElement.querySelectorAll<HTMLElement>('.district-bar-panel-label'),
      ...panelElement.querySelectorAll<HTMLElement>('.district-bar-panel-unit')
    ].map((element) => getComputedStyle(element!).fontFamily)).not.toContain(heroNumberFont)
    expect(computedOverlay.position).toBe('absolute')
    expect(computedOverlay.overflow).toBe('hidden')
    expect([
      overlay.style.position,
      overlay.style.getPropertyValue('inset'),
      overlay.style.zIndex,
      overlay.style.overflow,
      overlay.style.pointerEvents
    ]).toEqual(['', '', '', '', ''])

    app.unmount()
  })

  it('keeps map errors above the DOM overlay', async () => {
    vi.stubGlobal('ResizeObserver', undefined)
    installMapErrorStyles()
    const { app, root } = await mountOverlay({ badges: [], panel: null })
    const overlay = root.querySelector<HTMLElement>('.map-district-bar-overlay')!
    const error = document.createElement('div')
    error.className = 'err'
    document.body.append(error)

    const overlayZIndex = Number(getComputedStyle(overlay).zIndex)
    const errorZIndex = Number(getComputedStyle(error).zIndex)
    expect(errorZIndex).toBeGreaterThan(overlayZIndex)

    app.unmount()
  })

  it('uses layout rect positions and maps every visual config field without reapplying layout inputs', async () => {
    vi.stubGlobal('ResizeObserver', undefined)
    const config = cloneDistrictBarOverlayConfig(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS)
    Object.assign(config.badge, {
      minWidth: 101,
      height: 37,
      paddingX: 13,
      gapY: 79,
      offsetX: 198,
      offsetY: -197,
      backgroundColor: '#102030',
      backgroundOpacity: 0.4,
      borderColor: '#405060',
      borderWidth: 2.5,
      borderRadius: 9,
      textColor: '#abcdef',
      fontSize: 19,
      fontWeight: 700,
      shadowColor: '#123456',
      shadowBlur: 11,
      shadowOpacity: 0.25,
      enterDelayMs: 75,
      enterMs: 345,
      staggerMs: 25
    })
    Object.assign(config.panel, {
      gapX: 78,
      offsetY: -196,
      width: 360,
      minHeight: 140,
      backgroundColor: '#112233',
      backgroundOpacity: 0.6,
      borderColor: '#445566',
      borderWidth: 3,
      borderRadius: 11,
      paddingTop: 41,
      paddingRight: 22,
      paddingBottom: 19,
      paddingLeft: 17,
      rowGap: 14,
      titleAssetWidth: 145,
      titleAssetHeight: 52,
      titleOffsetX: -15,
      titleOffsetY: -25,
      titleTextOffsetX: 23,
      titleTextOffsetY: 4,
      titleColor: '#fefefe',
      titleFontSize: 21,
      titleFontWeight: 650,
      labelColor: '#aabbcc',
      labelFontSize: 17,
      labelFontWeight: 450,
      valueColor: '#00ddee',
      valueFontSize: 26,
      valueFontWeight: 750,
      unitColor: '#ddeeff',
      unitFontSize: 15,
      unitFontWeight: 350,
      enterMs: 215,
      leaveMs: 165,
      enterScale: 0.93
    })
    config.collision.badgeCollisionEnabled = true
    config.collision.badgeCollisionGap = 80
    config.collision.badgeMaxShift = 200
    const layoutBadge = badge('position-source', 3, {
      rect: { left: 155, top: 244, width: 999, height: 888 },
      collisionShift: 31
    })
    const layoutPanel = panel('渝中区', {
      rect: { left: 511, top: 177, width: 777, height: 666 },
      side: 'left'
    })
    const { app, root } = await mountOverlay({
      badges: [layoutBadge],
      panel: layoutPanel
    }, config)

    const badgeElement = root.querySelector<HTMLElement>('[data-badge-name="position-source"]')!
    expect(badgeElement.style.left).toBe('155px')
    expect(badgeElement.style.top).toBe('244px')
    expect(badgeElement.style.width).toBe('')
    expect(badgeElement.style.getPropertyValue('--district-bar-badge-min-width')).toBe('101px')
    expect(badgeElement.style.getPropertyValue('--district-bar-badge-height')).toBe('37px')
    expect(badgeElement.style.getPropertyValue('--district-bar-badge-padding-x')).toBe('13px')
    expect(badgeElement.style.getPropertyValue('--district-bar-badge-background')).toBe('rgba(16, 32, 48, 0.4)')
    expect(badgeElement.style.getPropertyValue('--district-bar-badge-border-color')).toBe('#405060')
    expect(badgeElement.style.getPropertyValue('--district-bar-badge-border-width')).toBe('2.5px')
    expect(badgeElement.style.getPropertyValue('--district-bar-badge-radius')).toBe('9px')
    expect(badgeElement.style.getPropertyValue('--district-bar-badge-text-color')).toBe('#abcdef')
    expect(badgeElement.style.getPropertyValue('--district-bar-badge-font-size')).toBe('19px')
    expect(badgeElement.style.getPropertyValue('--district-bar-badge-font-weight')).toBe('700')
    expect(badgeElement.style.getPropertyValue('--district-bar-badge-shadow')).toBe('0 0 11px rgba(18, 52, 86, 0.25)')
    expect(badgeElement.style.getPropertyValue('--district-bar-badge-enter-ms')).toBe('345ms')
    expect(badgeElement.style.getPropertyValue('--district-bar-badge-delay')).toBe('150ms')
    expect(badgeElement.style.opacity).toBe('')
    expect(getComputedStyle(badgeElement).boxSizing).toBe('border-box')
    expect(getComputedStyle(badgeElement).pointerEvents).toBe('none')
    expect([badgeElement.style.boxSizing, badgeElement.style.pointerEvents]).toEqual(['', ''])

    const panelElement = root.querySelector<HTMLElement>('.district-bar-panel')!
    expect(panelElement.style.left).toBe('511px')
    expect(panelElement.style.top).toBe('177px')
    expect(panelElement.style.transformOrigin).toBe('right center')
    expect(panelElement.style.getPropertyValue('--district-bar-panel-width')).toBe('360px')
    expect(panelElement.style.getPropertyValue('--district-bar-panel-min-height')).toBe('140px')
    expect(panelElement.style.getPropertyValue('--district-bar-panel-background')).toBe('rgba(17, 34, 51, 0.6)')
    expect(panelElement.style.getPropertyValue('--district-bar-panel-border-color')).toBe('#445566')
    expect(panelElement.style.getPropertyValue('--district-bar-panel-border-width')).toBe('3px')
    expect(panelElement.style.getPropertyValue('--district-bar-panel-radius')).toBe('11px')
    expect(panelElement.style.getPropertyValue('--district-bar-panel-padding-top')).toBe('41px')
    expect(panelElement.style.getPropertyValue('--district-bar-panel-padding-right')).toBe('22px')
    expect(panelElement.style.getPropertyValue('--district-bar-panel-padding-bottom')).toBe('19px')
    expect(panelElement.style.getPropertyValue('--district-bar-panel-padding-left')).toBe('17px')
    expect(panelElement.style.getPropertyValue('--district-bar-panel-row-gap')).toBe('14px')
    expect(panelElement.style.getPropertyValue('--district-bar-panel-title-width')).toBe('145px')
    expect(panelElement.style.getPropertyValue('--district-bar-panel-title-height')).toBe('52px')
    expect(panelElement.style.getPropertyValue('--district-bar-panel-title-x')).toBe('-15px')
    expect(panelElement.style.getPropertyValue('--district-bar-panel-title-y')).toBe('-25px')
    expect(panelElement.style.getPropertyValue('--district-bar-panel-title-text-x')).toBe('23px')
    expect(panelElement.style.getPropertyValue('--district-bar-panel-title-text-y')).toBe('4px')
    expect(panelElement.style.getPropertyValue('--district-bar-panel-title-color')).toBe('#fefefe')
    expect(panelElement.style.getPropertyValue('--district-bar-panel-title-font-size')).toBe('21px')
    expect(panelElement.style.getPropertyValue('--district-bar-panel-title-font-weight')).toBe('650')
    expect(panelElement.style.getPropertyValue('--district-bar-panel-label-color')).toBe('#aabbcc')
    expect(panelElement.style.getPropertyValue('--district-bar-panel-label-font-size')).toBe('17px')
    expect(panelElement.style.getPropertyValue('--district-bar-panel-label-font-weight')).toBe('450')
    expect(panelElement.style.getPropertyValue('--district-bar-panel-value-color')).toBe('#00ddee')
    expect(panelElement.style.getPropertyValue('--district-bar-panel-value-font-size')).toBe('26px')
    expect(panelElement.style.getPropertyValue('--district-bar-panel-value-font-weight')).toBe('750')
    expect(panelElement.style.getPropertyValue('--district-bar-panel-unit-color')).toBe('#ddeeff')
    expect(panelElement.style.getPropertyValue('--district-bar-panel-unit-font-size')).toBe('15px')
    expect(panelElement.style.getPropertyValue('--district-bar-panel-unit-font-weight')).toBe('350')
    expect(panelElement.style.getPropertyValue('--district-bar-panel-enter-ms')).toBe('215ms')
    expect(panelElement.style.getPropertyValue('--district-bar-panel-leave-ms')).toBe('165ms')
    expect(panelElement.style.getPropertyValue('--district-bar-panel-enter-scale')).toBe('0.93')
    expect(panelElement.style.opacity).toBe('')
    expect(getComputedStyle(panelElement).boxSizing).toBe('border-box')
    expect(getComputedStyle(panelElement).pointerEvents).toBe('none')
    expect([panelElement.style.boxSizing, panelElement.style.pointerEvents]).toEqual(['', ''])

    const titleImage = panelElement.querySelector<HTMLImageElement>('.district-bar-panel-title-image')
    const titleText = panelElement.querySelector<HTMLElement>('.district-bar-panel-title-text')!
    expect(titleImage).not.toBeNull()
    const titleImageSrc = titleImage!.getAttribute('src')
    expect(titleImage!.alt).toBe('')
    expect(titleImageSrc).toBeTruthy()
    expect(() => new URL(titleImageSrc!, window.location.href)).not.toThrow()
    expect(titleText.textContent).toBe('渝中区')
    expect(titleText.tagName).toBe('SPAN')
    expect(getComputedStyle(titleImage!).position).toBe('absolute')
    expect(getComputedStyle(titleImage!).pointerEvents).toBe('none')
    expect(getComputedStyle(titleImage!).transform).toBe('translateX(-50%)')
    expect(getComputedStyle(titleText).position).toBe('absolute')
    expect(getComputedStyle(titleText).pointerEvents).toBe('none')
    expect(getComputedStyle(titleText).justifyContent).toBe('center')
    expect(getComputedStyle(titleText).textAlign).toBe('center')
    expect(getComputedStyle(titleText).transform).toBe('translateX(-50%)')
    expect([titleImage!.style.position, titleImage!.style.pointerEvents]).toEqual(['', ''])
    expect([titleText.style.position, titleText.style.pointerEvents]).toEqual(['', ''])
    expect(titleText.style.transform).toBe('')

    app.unmount()
  })

  it('completes an initially visible badge from its animation event and resets only after removal', async () => {
    vi.stubGlobal('ResizeObserver', undefined)
    const config = cloneDistrictBarOverlayConfig(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS)
    config.badge.enterDelayMs = 50
    config.badge.enterMs = 100
    config.badge.staggerMs = 20
    const first = badge('timed', 2)
    const { app, root, state } = await mountOverlay({ badges: [first], panel: null }, config)
    let element = root.querySelector<HTMLElement>('[data-badge-name="timed"]')!

    expect(element.classList.contains('is-visible')).toBe(true)
    expect(element.classList.contains('is-entering')).toBe(true)
    expect(element.style.getPropertyValue('--district-bar-badge-delay')).toBe('90ms')
    expect(getComputedStyle(element).animationDuration).toBe('100ms')
    expect(getComputedStyle(element).animationDelay).toBe('90ms')
    expect(getComputedStyle(element).animationFillMode).toBe('both')

    dispatchBadgeAnimation(element, 'animationend')
    await nextTick()
    expect(element.classList.contains('is-entering')).toBe(false)
    expect(element.style.getPropertyValue('--district-bar-badge-delay')).toBe('0ms')

    state.layout = { badges: [{ ...first, visible: false }], panel: null }
    await nextTick()
    expect(element.classList.contains('is-visible')).toBe(false)
    expect(element.classList.contains('is-entering')).toBe(false)
    expect(element.style.getPropertyValue('--district-bar-badge-delay')).toBe('0ms')
    state.layout = { badges: [{ ...first, visible: true }], panel: null }
    await nextTick()
    expect(element.classList.contains('is-visible')).toBe(true)
    expect(element.classList.contains('is-entering')).toBe(false)
    expect(element.style.getPropertyValue('--district-bar-badge-delay')).toBe('0ms')

    const removedElement = element
    state.layout = { badges: [], panel: null }
    await nextTick()
    state.layout = { badges: [{ ...first, visible: true }], panel: null }
    await nextTick()
    element = root.querySelector<HTMLElement>('[data-badge-name="timed"]')!
    expect(element).not.toBe(removedElement)
    expect(element.classList.contains('is-entering')).toBe(true)
    expect(element.style.getPropertyValue('--district-bar-badge-delay')).toBe('90ms')

    dispatchBadgeAnimation(removedElement, 'animationend')
    await nextTick()
    expect(element.classList.contains('is-entering')).toBe(true)

    dispatchBadgeAnimation(element, 'animationend')
    await nextTick()
    expect(element.classList.contains('is-entering')).toBe(false)
    app.unmount()
  })

  it('ignores child, stale-name, hidden, and canceled animation events until the current entry ends', async () => {
    vi.stubGlobal('ResizeObserver', undefined)
    const config = cloneDistrictBarOverlayConfig(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS)
    config.badge.enterDelayMs = 50
    config.badge.enterMs = 100
    config.badge.staggerMs = 0
    const first = badge('restart', 0)
    const { app, root, state } = await mountOverlay({ badges: [first], panel: null }, config)
    const element = root.querySelector<HTMLElement>('[data-badge-name="restart"]')!

    expect(element.classList.contains('is-entering')).toBe(true)
    const child = document.createElement('span')
    element.append(child)
    dispatchBadgeAnimation(child, 'animationend', 'any-child-animation-name')
    await nextTick()
    expect(element.classList.contains('is-entering')).toBe(true)

    element.dataset.badgeName = 'stale-name'
    dispatchBadgeAnimation(element, 'animationend', 'scoped-enter-name-a1b2c3')
    await nextTick()
    expect(element.classList.contains('is-entering')).toBe(true)
    element.dataset.badgeName = 'restart'

    state.layout = { badges: [{ ...first, visible: false }], panel: null }
    await nextTick()
    expect(element.classList.contains('is-entering')).toBe(false)
    dispatchBadgeAnimation(element, 'animationend')
    await nextTick()

    state.layout = { badges: [{ ...first, visible: true }], panel: null }
    await nextTick()
    expect(element.classList.contains('is-entering')).toBe(true)
    dispatchBadgeAnimation(element, 'animationcancel')
    await nextTick()
    expect(element.classList.contains('is-entering')).toBe(true)

    dispatchBadgeAnimation(element, 'animationend')
    await nextTick()
    expect(element.classList.contains('is-entering')).toBe(false)

    app.unmount()
  })

  it('keeps a zero-total-time badge entering until the CSS animation end event', async () => {
    vi.stubGlobal('ResizeObserver', undefined)
    const config = cloneDistrictBarOverlayConfig(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS)
    config.badge.enterDelayMs = 0
    config.badge.enterMs = 0
    config.badge.staggerMs = 0
    const { app, root } = await mountOverlay({ badges: [badge('immediate', 0)], panel: null }, config)
    const element = root.querySelector<HTMLElement>('[data-badge-name="immediate"]')!

    expect(element.classList.contains('is-visible')).toBe(true)
    expect(element.classList.contains('is-entering')).toBe(true)
    expect(element.style.getPropertyValue('--district-bar-badge-delay')).toBe('0ms')
    expect(getComputedStyle(element).animationDuration).toBe('0ms')

    dispatchBadgeAnimation(element, 'animationend')
    await nextTick()
    expect(element.classList.contains('is-entering')).toBe(false)

    app.unmount()
  })

  it('updates entry timing CSS without completing before the real animation end event', async () => {
    vi.stubGlobal('ResizeObserver', undefined)
    const config = cloneDistrictBarOverlayConfig(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS)
    config.badge.enterDelayMs = 100
    config.badge.enterMs = 500
    config.badge.staggerMs = 100
    const first = badge('dynamic-timing', 4)
    const { app, root, state } = await mountOverlay({ badges: [first], panel: null }, config)
    const element = root.querySelector<HTMLElement>('[data-badge-name="dynamic-timing"]')!

    expect(element.classList.contains('is-entering')).toBe(true)
    expect(element.style.getPropertyValue('--district-bar-badge-delay')).toBe('500ms')
    expect(element.style.getPropertyValue('--district-bar-badge-enter-ms')).toBe('500ms')

    state.layout = { badges: [{ ...first, order: 2 }], panel: null }
    state.config.badge.enterDelayMs = 40
    state.config.badge.enterMs = 750
    state.config.badge.staggerMs = 30
    await nextTick()
    expect(element.classList.contains('is-entering')).toBe(true)
    expect(element.style.getPropertyValue('--district-bar-badge-delay')).toBe('100ms')
    expect(element.style.getPropertyValue('--district-bar-badge-enter-ms')).toBe('750ms')

    dispatchBadgeAnimation(element, 'animationend')
    await nextTick()
    expect(element.classList.contains('is-entering')).toBe(false)
    expect(element.style.getPropertyValue('--district-bar-badge-delay')).toBe('0ms')

    app.unmount()
  })

  it('reports stable natural sizes and ignores stale panel observations', async () => {
    const resize = installResizeObserver()
    const arrayBadgeRect = { left: 20, top: 30, width: 90, height: 34 }
    const singleBadgeRect = { left: 30, top: 40, width: 91, height: 35 }
    const initialPanelRect = { left: 426, top: 272, width: 340, height: 124 }
    const inputLayout: DistrictBarOverlayLayout = {
      badges: [
        badge('array-box', 0, { rect: arrayBadgeRect }),
        badge('single-box', 1, { rect: singleBadgeRect })
      ],
      panel: panel('A', { rect: initialPanelRect })
    }
    expect(inputLayout.badges[0].rect).toBe(arrayBadgeRect)
    expect(inputLayout.badges[1].rect).toBe(singleBadgeRect)
    expect(inputLayout.panel?.rect).toBe(initialPanelRect)
    expect([arrayBadgeRect, singleBadgeRect, initialPanelRect]).toEqual([
      { left: 20, top: 30, width: 90, height: 34 },
      { left: 30, top: 40, width: 91, height: 35 },
      { left: 426, top: 272, width: 340, height: 124 }
    ])

    const { app, root, state, measured } = await mountOverlay(inputLayout)
    const arrayBadge = root.querySelector<HTMLElement>('[data-badge-name="array-box"]')!
    const singleBadge = root.querySelector<HTMLElement>('[data-badge-name="single-box"]')!
    const oldPanel = root.querySelector<HTMLElement>('.district-bar-panel')!
    Object.defineProperties(oldPanel, {
      offsetWidth: { configurable: true, value: 345 },
      offsetHeight: { configurable: true, value: 126 }
    })

    expect(resize.observe).toHaveBeenCalledTimes(3)
    expect(resize.observed).toEqual(new Set([arrayBadge, singleBadge, oldPanel]))
    expect([arrayBadge.style.width, arrayBadge.style.height]).toEqual(['', ''])
    expect([singleBadge.style.width, singleBadge.style.height]).toEqual(['', ''])
    expect([oldPanel.style.width, oldPanel.style.height]).toEqual(['', ''])
    const initialEntries = [
      resizeEntry(arrayBadge, [{ inlineSize: 100.5, blockSize: 34.25 } as ResizeObserverSize]),
      resizeEntry(singleBadge, { inlineSize: 81.75, blockSize: 35 } as ResizeObserverSize),
      resizeEntry(oldPanel)
    ]
    resize.notify(initialEntries)
    expect(measured).toHaveLength(1)
    expect([...measured[0].badgeByName!]).toEqual([
      ['array-box', { width: 100.5, height: 34.25 }],
      ['single-box', { width: 81.75, height: 35 }]
    ])
    expect(measured[0].panel).toEqual({ width: 345, height: 126 })
    expect([arrayBadge.style.width, arrayBadge.style.height]).toEqual(['', ''])
    expect([singleBadge.style.width, singleBadge.style.height]).toEqual(['', ''])
    expect([oldPanel.style.width, oldPanel.style.height]).toEqual(['', ''])
    resize.notify(initialEntries)
    resize.notify([
      resizeEntry(arrayBadge, [{ inlineSize: 100.7, blockSize: 34.25 } as ResizeObserverSize])
    ])
    expect(measured).toHaveLength(1)

    resize.notify([
      resizeEntry(arrayBadge, [{ inlineSize: 100.76, blockSize: 34.25 } as ResizeObserverSize])
    ])
    expect(measured).toHaveLength(2)
    expect([...measured[1].badgeByName!]).toEqual([
      ['array-box', { width: 100.76, height: 34.25 }],
      ['single-box', { width: 81.75, height: 35 }]
    ])
    expect(measured[1].panel).toEqual({ width: 345, height: 126 })

    const nextPanelRect = { left: 300, top: 180, width: 340, height: 124 }
    const nextLayout: DistrictBarOverlayLayout = {
      badges: [inputLayout.badges[0]],
      panel: panel('B', { rect: nextPanelRect })
    }
    state.layout = nextLayout
    await nextTick()
    await Promise.resolve()
    const currentPanel = root.querySelector<HTMLElement>('[data-panel-name="B"]')!
    expect(currentPanel).not.toBe(oldPanel)
    expect(resize.unobserve).toHaveBeenCalledWith(oldPanel)
    expect(resize.unobserve).toHaveBeenCalledWith(singleBadge)
    expect(resize.observed.has(currentPanel)).toBe(true)
    expect(measured).toHaveLength(3)
    expect([...measured[2].badgeByName!]).toEqual([
      ['array-box', { width: 100.76, height: 34.25 }]
    ])
    expect(measured[2].panel).toBeUndefined()

    resize.notify([
      resizeEntry(oldPanel, { inlineSize: 999, blockSize: 999 } as ResizeObserverSize)
    ])
    expect(measured).toHaveLength(3)
    resize.notify([
      resizeEntry(currentPanel, { inlineSize: 355, blockSize: 131 } as ResizeObserverSize)
    ])
    expect(measured).toHaveLength(4)
    expect([...measured[3].badgeByName!]).toEqual([
      ['array-box', { width: 100.76, height: 34.25 }]
    ])
    expect(measured[3].panel).toEqual({ width: 355, height: 131 })
    expect([currentPanel.style.width, currentPanel.style.height]).toEqual(['', ''])
    expect(inputLayout.badges[0].rect).toBe(arrayBadgeRect)
    expect(inputLayout.badges[1].rect).toBe(singleBadgeRect)
    expect(inputLayout.panel?.rect).toBe(initialPanelRect)
    expect(nextLayout.panel?.rect).toBe(nextPanelRect)
    expect([arrayBadgeRect, singleBadgeRect, initialPanelRect, nextPanelRect]).toEqual([
      { left: 20, top: 30, width: 90, height: 34 },
      { left: 30, top: 40, width: 91, height: 35 },
      { left: 426, top: 272, width: 340, height: 124 },
      { left: 300, top: 180, width: 340, height: 124 }
    ])

    app.unmount()
    expect(resize.disconnect).toHaveBeenCalledTimes(1)
    resize.notify([
      resizeEntry(arrayBadge, { inlineSize: 500, blockSize: 500 } as ResizeObserverSize)
    ])
    await Promise.resolve()
    expect(measured).toHaveLength(4)
  })

  it('keeps keyed panels during parallel replacement and removal leave transitions', async () => {
    vi.stubGlobal('ResizeObserver', undefined)
    const config = cloneDistrictBarOverlayConfig(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS)
    config.panel.enterMs = 18
    config.panel.leaveMs = 14
    const { app, root, state } = await mountOverlay({ badges: [], panel: panel('A') }, config)

    state.layout = { badges: [], panel: panel('B') }
    await nextTick()
    let panels = [...root.querySelectorAll<HTMLElement>('[data-panel-name]')]
    expect(panels.map((element) => element.dataset.panelName)).toEqual(['A', 'B'])
    expect(panels[0].classList.contains('district-bar-panel-leave-active')).toBe(true)
    expect(panels[1].classList.contains('district-bar-panel-enter-active')).toBe(true)
    expect([
      panels[0].style.transitionProperty,
      panels[0].style.transitionDuration,
      panels[0].style.transitionDelay,
      panels[1].style.transitionProperty,
      panels[1].style.transitionDuration,
      panels[1].style.transitionDelay
    ]).toEqual(['', '', '', '', '', ''])

    await waitForTransitionCompletion(Math.max(config.panel.enterMs, config.panel.leaveMs))
    panels = [...root.querySelectorAll<HTMLElement>('[data-panel-name]')]
    expect(panels.map((element) => element.dataset.panelName)).toEqual(['B'])

    state.layout = { badges: [], panel: null }
    await nextTick()
    const leavingPanel = root.querySelector<HTMLElement>('[data-panel-name="B"]')!
    expect(leavingPanel).not.toBeNull()
    expect(leavingPanel.classList.contains('district-bar-panel-leave-active')).toBe(true)
    expect([
      leavingPanel.style.transitionProperty,
      leavingPanel.style.transitionDuration,
      leavingPanel.style.transitionDelay
    ]).toEqual(['', '', ''])
    await waitForTransitionCompletion(config.panel.leaveMs)
    expect(root.querySelector('[data-panel-name]')).toBeNull()

    app.unmount()
  })
})
