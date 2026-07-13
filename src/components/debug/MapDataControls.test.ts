// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, type App } from 'vue'
import { MAP_DISTRICT_BAR_DEFAULTS } from '@/components/map/mapDistrictBarConfig'
import { MAP_DISTRICT_BAR_LABEL_DEFAULTS } from '@/components/map/mapDistrictBarLabelConfig'

interface MountedControls {
  app: App
  root: HTMLDivElement
  effect: ReturnType<typeof import('@/composables/useMapDebug')['useMapDebug']>['effect']
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
  const { useMapDebug } = await import('@/composables/useMapDebug')
  return { app, root, effect: useMapDebug().effect, setItem }
}

afterEach(() => {
  document.body.replaceChildren()
  Reflect.deleteProperty(navigator, 'clipboard')
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('MapDataControls', () => {
  it('renders column style controls, persists direct edits, and resets only the bar config', async () => {
    const { app, root, effect, setItem } = await mountControls()
    const { useMapDebug } = await import('@/composables/useMapDebug')
    useMapDebug().updateDistrictBarRuntimeStatus({ renderedCount: 8, dataMin: 16, dataMax: 180, degraded: false })
    await nextTick()

    expect(root.textContent).toContain('区级案件量柱状图')
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
    expect(root.textContent).toContain('柱体标签')
    expect(root.querySelector('#effect-bars-label-width-number')).not.toBeNull()
    expect(root.querySelector('#effect-bars-label-valueColor-hex')).not.toBeNull()

    const width = root.querySelector<HTMLInputElement>('#effect-bars-width-number')!
    width.value = '6.4'
    width.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(effect.bars.width).toBe(6.4)
    expect(setItem).not.toHaveBeenCalled()

    effect.base.innerWidth = 3.2
    root.querySelector<HTMLButtonElement>('button.ghost')!.click()
    await nextTick()
    expect(effect.bars).toEqual(MAP_DISTRICT_BAR_DEFAULTS)
    expect(effect.base.innerWidth).toBe(3.2)
    expect(JSON.parse(root.querySelector('.json-out')!.textContent!)).toEqual(MAP_DISTRICT_BAR_DEFAULTS)

    const labelWidth = root.querySelector<HTMLInputElement>('#effect-bars-label-width-number')!
    labelWidth.value = '300'
    labelWidth.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(effect.bars.label.width).toBe(300)
    Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === '恢复标签默认值')!
      .click()
    await nextTick()
    expect(effect.bars.label).toEqual(MAP_DISTRICT_BAR_LABEL_DEFAULTS)
    app.unmount()
  })

  it('copies the normalized standalone bar and label payloads', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const { app, root } = await mountControls()

    Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === '复制柱状图参数')!
      .click()
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    expect(JSON.parse(writeText.mock.calls[0][0])).toEqual(MAP_DISTRICT_BAR_DEFAULTS)

    Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === '复制标签参数')!
      .click()
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(2))
    expect(JSON.parse(writeText.mock.calls[1][0])).toEqual(MAP_DISTRICT_BAR_LABEL_DEFAULTS)
    app.unmount()
  })
})
