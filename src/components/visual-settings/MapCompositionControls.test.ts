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
  vi.restoreAllMocks()
})

describe('MapCompositionControls', () => {
  it('does not own the region-library imagery option', () => {
    const root = document.createElement('div')
    const app = createApp(MapCompositionControls)
    app.mount(root)
    expect(root.querySelector('[data-action="toggle-local-imagery"]')).toBeNull()
    app.unmount()
  })

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
    expect(session.layout.left).toBe(0)
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
    expect(range.value).toBe('2500')
    expect(range.max).toBe('2500')
    expect(root.textContent).toContain('地图超出 1920×1080 设计视口')

    const width = root.querySelector<HTMLInputElement>('#composition-width-number')!
    width.value = '0'
    width.dispatchEvent(new Event('input', { bubbles: true }))
    width.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(session.layout.width).toBe(200)
    expect(width.value).toBe('200')

    root.querySelector<HTMLButtonElement>('[data-action="reset-composition"]')!.click()
    await nextTick()
    expect({ ...session.layout }).toEqual(MAP_LAYOUT_DEFAULT)
    expect(number.value).toBe('0')
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
      '.pos-map { left: 0px; top: 80px; width: 1280px; height: 1000px; }'
    ))
    buttons.find((button) => button.textContent?.includes('复制相机参数'))!.click()
    await vi.waitFor(() => expect(clipboard.copy).toHaveBeenCalledWith(
      '{"pos":[-6.5,127.6,97.4],"target":[2.7,-2.9,7]}'
    ))
    app.unmount()
  })

  it('uploads each layer independently and makes its current file downloadable', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:background')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const root = document.createElement('div')
    const app = createApp(MapCompositionControls)
    app.mount(root)
    await nextTick()
    const session = useMapVisualSettings()
    const mainRow = root.querySelector<HTMLElement>('[data-background-layer="main"]')!
    const terrainRow = root.querySelector<HTMLElement>('[data-background-layer="terrain"]')!
    const input = mainRow.querySelector<HTMLInputElement>('[data-background-upload="main"]')!
    const inputClick = vi.spyOn(input, 'click')

    mainRow.querySelector<HTMLButtonElement>('[data-action="upload-background-main"]')!.click()
    expect(inputClick).toHaveBeenCalledTimes(1)

    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [new File(['image'], 'custom.png', { type: 'image/png' })]
    })
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await vi.waitFor(() => expect(session.backgroundLayerSources.value.main.url).toBe('blob:background'))
    expect(session.backgroundLayerSources.value.terrain.custom).toBe(false)
    expect(mainRow.textContent).toContain('背景遮罩：custom.png')
    expect(mainRow.querySelector<HTMLAnchorElement>('a')?.getAttribute('href')).toBe('blob:background')
    expect(mainRow.querySelector<HTMLAnchorElement>('a')?.getAttribute('download')).toBe('custom.png')
    expect(input.value).toBe('')
    expect(root.querySelector('#background-image-file')).toBeNull()
    expect(root.querySelector('[data-action="reset-background"]')).toBeNull()

    const terrainInput = terrainRow.querySelector<HTMLInputElement>('[data-background-upload="terrain"]')!
    Object.defineProperty(terrainInput, 'files', {
      configurable: true,
      value: [new File(['text'], 'notes.txt', { type: 'text/plain' })]
    })
    terrainInput.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(terrainRow.querySelector('[role="alert"]')?.textContent).toContain('PNG')
    expect(session.backgroundLayerSources.value.main.url).toBe('blob:background')

    session.resetVisualSession()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:background')
    app.unmount()
  })

  it('keeps each layer name, inline filename download, tooltip, and upload action on one row', async () => {
    const root = document.createElement('div')
    const app = createApp(MapCompositionControls)
    app.mount(root)
    await nextTick()
    const session = useMapVisualSettings()
    const mainRow = root.querySelector<HTMLElement>('[data-background-layer="main"]')!
    const terrainRow = root.querySelector<HTMLElement>('[data-background-layer="terrain"]')!
    const mainToggle = mainRow.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    const terrainToggle = terrainRow.querySelector<HTMLInputElement>('input[type="checkbox"]')!

    expect(mainToggle.checked).toBe(true)
    expect(terrainToggle.checked).toBe(true)
    expect(mainRow.textContent).toContain('背景遮罩：bg-main.png')
    expect(terrainRow.textContent).toContain('背景底图：bg-terrain.png')
    expect(mainRow.querySelector('.background-layer__help')?.getAttribute('title')).toBe('建议为带透明度的PNG文件')
    expect(mainRow.querySelector('.background-layer__help')?.getAttribute('aria-label')).toBe('建议为带透明度的PNG文件')
    expect(mainRow.querySelector('[data-icon="info"]')).not.toBeNull()
    expect(mainRow.querySelector('[data-icon="download"]')).not.toBeNull()
    expect(terrainRow.querySelector('[data-icon="download"]')).not.toBeNull()
    expect(terrainRow.querySelector('.background-layer__help')).toBeNull()
    expect(root.textContent).not.toContain('ℹ️')
    expect(root.textContent).not.toContain('⬇️')
    expect(mainRow.textContent).toContain('上传背景文件')
    expect(mainRow.textContent).not.toContain('当前文件：')
    expect(mainRow.textContent).not.toContain('下载源文件')
    const mainFilename = mainRow.querySelector<HTMLAnchorElement>('.background-layer__filename')!
    const terrainFilename = terrainRow.querySelector<HTMLAnchorElement>('.background-layer__filename')!
    expect(mainFilename.getAttribute('href')).toContain('bg-main')
    expect(mainFilename.getAttribute('download')).toBe('bg-main.png')
    expect(terrainFilename.getAttribute('href')).toContain('bg-terrain')
    expect(terrainFilename.getAttribute('download')).toBe('bg-terrain.png')
    expect(mainFilename.closest('.background-layer__row')).toBe(
      mainRow.querySelector('[data-action="upload-background-main"]')?.closest('.background-layer__row')
    )
    expect(terrainFilename.closest('.background-layer__row')).toBe(
      terrainRow.querySelector('[data-action="upload-background-terrain"]')?.closest('.background-layer__row')
    )

    terrainToggle.checked = false
    terrainToggle.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(session.backgroundLayerVisibility.terrain).toBe(false)
    expect(root.textContent).toContain('当前仅显示背景遮罩')

    mainToggle.checked = false
    mainToggle.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(session.backgroundLayerVisibility.main).toBe(false)
    expect(root.textContent).toContain('背景两层均已关闭')
    app.unmount()
  })
})
