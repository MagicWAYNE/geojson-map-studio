// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, type App } from 'vue'
import {
  MAP_DISTRICT_BAR_DEFAULTS,
  normalizeDistrictBarConfig
} from '@/components/map/mapDistrictBarConfig'
import {
  MAP_DISTRICT_BAR_OVERLAY_DEFAULTS,
  normalizeDistrictBarOverlayConfig
} from '@/components/map/mapDistrictBarOverlayConfig'

interface MountedControls {
  app: App
  root: HTMLDivElement
  effect: ReturnType<typeof import('@/composables/useMapVisualSettings')['useMapVisualSettings']>['effect']
  setItem: ReturnType<typeof vi.fn>
}

async function mountControls(): Promise<MountedControls> {
  const values = new Map<string, string>()
  const setItem = vi.fn((key: string, value: string) => values.set(key, value))
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem
  })
  const { default: MapDataControls } = await import('./MapDataControls.vue')
  const root = document.createElement('div')
  const app = createApp(MapDataControls)
  app.mount(root)
  await nextTick()
  const { useMapVisualSettings } = await import('@/composables/useMapVisualSettings')
  return { app, root, effect: useMapVisualSettings().effect, setItem }
}

afterEach(() => {
  document.body.replaceChildren()
  Reflect.deleteProperty(document, 'execCommand')
  Reflect.deleteProperty(navigator, 'clipboard')
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.resetModules()
})

describe('MapDataControls', () => {
  it('renders column and overlay controls and keeps all nested references stable while editing', async () => {
    const { app, root, effect, setItem } = await mountControls()
    const { useMapVisualSettings } = await import('@/composables/useMapVisualSettings')
    useMapVisualSettings().updateDistrictBarRuntimeStatus({ renderedCount: 8, dataMin: 16, dataMax: 180, degraded: false })
    await nextTick()

    expect(root.textContent).toContain('区域数据柱体')
    expect(root.textContent).not.toMatch(/扶持|企业|服务资源/)
    expect(root.textContent).toContain('有效柱体：8')
    expect(root.textContent).toContain('柱体主体：不透明')
    expect(root.querySelector('#effect-bars-width-number')).not.toBeNull()
    expect(root.querySelector('#effect-bars-anchorOffsetX-number')).not.toBeNull()
    expect(root.querySelector('#effect-bars-anchorOffsetY-number')).not.toBeNull()
    expect(root.querySelector('#effect-bars-baseOffset-number')).not.toBeNull()
    expect(root.querySelector('#effect-bars-pulseEnabled-checkbox')).not.toBeNull()
    expect(root.querySelector('#effect-bars-pulseOuterRadiusRatio-number')).not.toBeNull()
    expect(root.querySelector('#effect-bars-pulseInnerOpacity-number')).not.toBeNull()
    expect(root.querySelector('#effect-bars-opacity-number')).toBeNull()
    expect(root.querySelector('[data-testid="district-bar-overlay-controls"]')).not.toBeNull()

    const bars = effect.bars
    const overlay = bars.overlay
    const badge = overlay.badge
    const panel = overlay.panel
    const collision = overlay.collision

    const width = root.querySelector<HTMLInputElement>('#effect-bars-width-number')!
    width.value = '6.4'
    width.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(effect.bars.width).toBe(6.4)
    expect(setItem).not.toHaveBeenCalled()

    const badgeWidth = root.querySelector<HTMLInputElement>(
      '#effect-bars-overlay-badge-minWidth-number'
    )!
    badgeWidth.value = '92'
    badgeWidth.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(effect.bars.overlay.badge.minWidth).toBe(92)
    expect(effect.bars).toBe(bars)
    expect(effect.bars.overlay).toBe(overlay)
    expect(effect.bars.overlay.badge).toBe(badge)
    expect(effect.bars.overlay.panel).toBe(panel)
    expect(effect.bars.overlay.collision).toBe(collision)
    expect(setItem).not.toHaveBeenCalled()

    app.unmount()
  })

  it('resets overlay alone or complete bars without replacing references or changing base effects', async () => {
    const { app, root, effect } = await mountControls()
    const bars = effect.bars
    const overlay = bars.overlay
    const badge = overlay.badge
    const panel = overlay.panel
    const collision = overlay.collision

    effect.base.innerWidth = 3.2
    effect.bars.width = 6.4
    effect.bars.overlay.badge.minWidth = 92
    effect.bars.overlay.panel.width = 480
    root.querySelector<HTMLButtonElement>('[data-testid="reset-overlay"]')!.click()
    await nextTick()
    expect(effect.bars.width).toBe(6.4)
    expect(effect.bars.overlay).toEqual(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS)
    expect(effect.base.innerWidth).toBe(3.2)

    effect.bars.overlay.badge.minWidth = 92
    root.querySelector<HTMLButtonElement>('[data-testid="reset-bars"]')!.click()
    await nextTick()
    expect(effect.bars).toEqual(MAP_DISTRICT_BAR_DEFAULTS)
    expect(effect.base.innerWidth).toBe(3.2)
    expect(effect.bars).toBe(bars)
    expect(effect.bars.overlay).toBe(overlay)
    expect(effect.bars.overlay.badge).toBe(badge)
    expect(effect.bars.overlay.panel).toBe(panel)
    expect(effect.bars.overlay.collision).toBe(collision)
    expect(JSON.parse(root.querySelector('[data-testid="bars-json"]')!.textContent!))
      .toEqual(MAP_DISTRICT_BAR_DEFAULTS)
    expect(JSON.parse(root.querySelector('[data-testid="overlay-json"]')!.textContent!))
      .toEqual(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS)
    app.unmount()
  })

  it('renders and copies current normalized full-bars and overlay-only payloads', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const { app, root, effect, setItem } = await mountControls()

    effect.bars.width = 99
    effect.bars.overlay.badge.minWidth = 999
    effect.bars.overlay.badge.textColor = '#ABCDEF'
    effect.bars.overlay.panel.preferredSide = 'left'
    await nextTick()
    await nextTick()

    const expectedBars = normalizeDistrictBarConfig(effect.bars)
    const expectedOverlay = normalizeDistrictBarOverlayConfig(effect.bars.overlay)
    expect(expectedBars).toMatchObject({
      width: 8,
      overlay: {
        badge: { minWidth: 180, textColor: '#abcdef' },
        panel: { preferredSide: 'left' }
      }
    })
    expect(JSON.parse(root.querySelector('[data-testid="bars-json"]')!.textContent!))
      .toEqual(expectedBars)
    expect(JSON.parse(root.querySelector('[data-testid="overlay-json"]')!.textContent!))
      .toEqual(expectedOverlay)
    expect(setItem).not.toHaveBeenCalled()

    root.querySelector<HTMLButtonElement>('[data-testid="copy-bars"]')!.click()
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    const copiedBars = JSON.parse(writeText.mock.calls[0][0])
    expect(copiedBars).toEqual(expectedBars)
    expect(copiedBars.overlay).toEqual(expectedOverlay)

    root.querySelector<HTMLButtonElement>('[data-testid="copy-overlay"]')!.click()
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(2))
    const copiedOverlay = JSON.parse(writeText.mock.calls[1][0])
    expect(copiedOverlay).toEqual(expectedOverlay)
    expect(Object.keys(copiedOverlay).sort()).toEqual(['badge', 'collision', 'enabled', 'panel'])
    await vi.waitFor(() => {
      expect(root.querySelector('[data-testid="copy-bars"]')!.textContent).toContain('已复制')
      expect(root.querySelector('[data-testid="copy-overlay"]')!.textContent).toContain('已复制')
    })
    app.unmount()
  })

  it('expires bars and overlay copy feedback on independent 1500ms timers', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const { app, root } = await mountControls()
    const copyBars = root.querySelector<HTMLButtonElement>('[data-testid="copy-bars"]')!
    const copyOverlay = root.querySelector<HTMLButtonElement>('[data-testid="copy-overlay"]')!

    copyBars.click()
    await vi.advanceTimersByTimeAsync(0)
    await nextTick()
    expect(copyBars.textContent).toContain('已复制')

    vi.advanceTimersByTime(750)
    copyOverlay.click()
    await vi.advanceTimersByTimeAsync(0)
    await nextTick()
    expect(copyOverlay.textContent).toContain('已复制')

    vi.advanceTimersByTime(750)
    await nextTick()
    expect(copyBars.textContent).toBe('复制柱体参数')
    expect(copyOverlay.textContent).toContain('已复制')

    vi.advanceTimersByTime(750)
    await nextTick()
    expect(copyOverlay.textContent).toBe('复制浮层参数')
    app.unmount()
  })

  it('ignores stale copy completions and keeps bars and overlay statuses isolated', async () => {
    let resolveFirst!: () => void
    let rejectSecond!: (reason?: unknown) => void
    let resolveThird!: () => void
    const first = new Promise<void>((resolve) => (resolveFirst = resolve))
    const second = new Promise<void>((_, reject) => (rejectSecond = reject))
    const third = new Promise<void>((resolve) => (resolveThird = resolve))
    const writeText = vi.fn()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(second)
      .mockReturnValueOnce(third)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn().mockReturnValue(false)
    })
    const { app, root } = await mountControls()
    const copyBars = root.querySelector<HTMLButtonElement>('[data-testid="copy-bars"]')!
    const copyOverlay = root.querySelector<HTMLButtonElement>('[data-testid="copy-overlay"]')!

    copyBars.click()
    copyBars.click()
    copyOverlay.click()
    resolveThird()
    await vi.waitFor(() => expect(copyOverlay.textContent).toContain('已复制'))
    expect(copyBars.textContent).toBe('复制柱体参数')

    rejectSecond(new Error('denied'))
    await vi.waitFor(() => expect(copyBars.textContent).toContain('复制失败'))
    expect(copyOverlay.textContent).toContain('已复制')

    resolveFirst()
    await Promise.resolve()
    await nextTick()
    expect(copyBars.textContent).toContain('复制失败')
    expect(copyOverlay.textContent).toContain('已复制')
    app.unmount()
  })
})
