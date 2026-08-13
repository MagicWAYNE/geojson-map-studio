// @vitest-environment happy-dom
import { createApp, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const clipboard = vi.hoisted(() => ({ copy: vi.fn() }))
vi.mock('@/utils/copyText', () => ({ copyTextToClipboard: clipboard.copy }))

import MapCompositionControls from './MapCompositionControls.vue'
import { MAP_LAYOUT_DEFAULT, useMapVisualSettings } from '@/composables/useMapVisualSettings'

beforeEach(() => {
  clipboard.copy.mockResolvedValue(true)
  useMapVisualSettings().resetVisualSession()
})

afterEach(() => {
  document.body.replaceChildren()
  clipboard.copy.mockReset()
})

describe('MapCompositionControls', () => {
  it('synchronizes precise and range inputs, warns without clamping, and resets to tool defaults', async () => {
    const root = document.createElement('div')
    const app = createApp(MapCompositionControls)
    app.mount(root)
    await nextTick()
    const session = useMapVisualSettings()
    const number = root.querySelector<HTMLInputElement>('#composition-left-number')!
    const range = root.querySelector<HTMLInputElement>('#composition-left-range')!

    number.value = '1180'
    number.dispatchEvent(new Event('input', { bubbles: true }))
    expect(session.layout.left).toBe(24)
    number.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(session.layout.left).toBe(1180)
    expect(range.value).toBe('1180')
    expect(root.textContent).toContain('地图与右侧设置栏发生重叠')

    number.value = '2500'
    number.dispatchEvent(new Event('input', { bubbles: true }))
    number.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(session.layout.left).toBe(2500)
    expect(number.value).toBe('2500')
    expect(root.textContent).toContain('地图超出 1920×1080 设计视口')

    root.querySelector<HTMLButtonElement>('[data-action="reset-composition"]')!.click()
    await nextTick()
    expect({ ...session.layout }).toEqual(MAP_LAYOUT_DEFAULT)
    expect(number.value).toBe('24')
    app.unmount()
  })

  it('copies exact CSS and current camera text through the session feedback seam', async () => {
    const root = document.createElement('div')
    const app = createApp(MapCompositionControls)
    app.mount(root)
    await nextTick()
    const buttons = [...root.querySelectorAll<HTMLButtonElement>('button')]

    buttons.find((button) => button.textContent?.includes('复制 CSS'))!.click()
    await vi.waitFor(() => expect(clipboard.copy).toHaveBeenCalledWith(
      '.pos-map { left: 24px; top: 132px; width: 1120px; height: 948px; }'
    ))
    buttons.find((button) => button.textContent?.includes('复制相机参数'))!.click()
    await vi.waitFor(() => expect(clipboard.copy).toHaveBeenCalledWith(
      '{"pos":[-89.4,117,56.4],"target":[2.7,-2.9,7]}'
    ))
    app.unmount()
  })
})
