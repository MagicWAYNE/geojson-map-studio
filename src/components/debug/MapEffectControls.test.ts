// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, type App } from 'vue'
import {
  B3_GLOW_PROFILE_DEFAULTS,
  MAP_EFFECT_DEFAULTS,
  type MapEffectConfig
} from '@/components/map/mapEffectConfig'

type MountedControls = {
  app: App
  root: HTMLDivElement
  effect: MapEffectConfig
  setItem: ReturnType<typeof vi.fn>
  updateEffectRuntimeStatus: ReturnType<typeof import('@/composables/useMapDebug')['useMapDebug']>['updateEffectRuntimeStatus']
  resetEffect: ReturnType<typeof import('@/composables/useMapDebug')['useMapDebug']>['resetEffect']
}

const EFFECT_STORAGE_KEYS = new Set([
  'cq-map-effect-config-v1',
  'cq-map-effect-config-v2',
  'cq-map-effect-config-v3',
  'cq-map-effect-config-v4'
])

function expectNoEffectStorageWrites(setItem: ReturnType<typeof vi.fn>): void {
  expect(setItem.mock.calls.filter(([key]) => EFFECT_STORAGE_KEYS.has(key))).toHaveLength(0)
}

async function mountControls(): Promise<MountedControls> {
  const values = new Map<string, string>()
  const setItem = vi.fn((key: string, value: string) => values.set(key, value))
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem
  })
  const { default: MapEffectControls } = await import('./MapEffectControls.vue')
  const root = document.createElement('div')
  const app = createApp(MapEffectControls)
  app.mount(root)
  await nextTick()
  const { useMapDebug } = await import('@/composables/useMapDebug')
  const debug = useMapDebug()
  return {
    app,
    root,
    effect: debug.effect,
    setItem,
    updateEffectRuntimeStatus: debug.updateEffectRuntimeStatus,
    resetEffect: debug.resetEffect
  }
}

function button(root: HTMLElement, label: string): HTMLButtonElement {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
    .find((candidate) => candidate.textContent === label)!
}

function copyButton(root: HTMLElement): HTMLButtonElement {
  const section = Array.from(root.querySelectorAll<HTMLElement>('.effect-group'))
    .find((candidate) => candidate.querySelector('h3')?.textContent === '可复制参数')!
  return section.querySelector<HTMLButtonElement>('.effect-actions .btn')!
}

async function setLivePreview(root: HTMLElement, enabled: boolean): Promise<void> {
  const toggle = root.querySelector<HTMLInputElement>('#effect-live-preview')!
  toggle.checked = enabled
  toggle.dispatchEvent(new Event('change', { bubbles: true }))
  await nextTick()
}

async function typeCharacters(input: HTMLInputElement, text: string): Promise<string[]> {
  const values: string[] = []
  input.focus()
  input.value = ''
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }))
  input.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true }))
  input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Backspace', bubbles: true }))
  await nextTick()
  values.push(input.value)

  for (const character of text) {
    input.dispatchEvent(new KeyboardEvent('keydown', { key: character, bubbles: true }))
    input.value += character
    input.dispatchEvent(new InputEvent('input', {
      data: character,
      inputType: 'insertText',
      bubbles: true
    }))
    input.dispatchEvent(new KeyboardEvent('keyup', { key: character, bubbles: true }))
    await nextTick()
    values.push(input.value)
  }
  return values
}

afterEach(() => {
  document.body.replaceChildren()
  Reflect.deleteProperty(document, 'execCommand')
  Reflect.deleteProperty(navigator, 'clipboard')
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.resetModules()
})

describe('MapEffectControls', () => {
  it('keeps draft edits, presets, group reset, and all reset out of effective state and storage', async () => {
    const { app, root, effect, setItem } = await mountControls()
    const toggle = root.querySelector<HTMLInputElement>('#effect-live-preview')!
    expect(toggle.checked).toBe(true)

    const liveWidth = root.querySelector<HTMLInputElement>('#effect-base-outerGlowWidth-number')!
    liveWidth.value = '84'
    liveWidth.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(effect.base.outerGlowWidth).toBe(84)
    expectNoEffectStorageWrites(setItem)

    const effectiveSnapshot = JSON.parse(JSON.stringify(effect)) as MapEffectConfig
    await setLivePreview(root, false)
    expect(root.textContent).toContain('切回实时预览会放弃未应用草稿')
    setItem.mockClear()

    const draftWidth = root.querySelector<HTMLInputElement>('#effect-base-outerGlowWidth-number')!
    draftWidth.value = '123'
    draftWidth.dispatchEvent(new Event('change', { bubbles: true }))
    const draftEnabled = root.querySelector<HTMLInputElement>('#effect-base-outerGlowEnabled-checkbox')!
    draftEnabled.checked = false
    draftEnabled.dispatchEvent(new Event('change', { bubbles: true }))
    const draftColor = root.querySelector<HTMLInputElement>('#effect-hover-surfaceColor-hex')!
    draftColor.value = '#123456'
    draftColor.dispatchEvent(new Event('change', { bubbles: true }))
    const draftScale = root.querySelector<HTMLSelectElement>('#effect-quality-renderScale-select')!
    draftScale.value = '0.75'
    draftScale.dispatchEvent(new Event('change', { bubbles: true }))
    button(root, '应用 B3 参考预设').click()
    button(root, '重置本组').click()
    button(root, '恢复全部默认值').click()
    await nextTick()

    expect(effect).toEqual(effectiveSnapshot)
    expectNoEffectStorageWrites(setItem)
    expect(JSON.parse(root.querySelector('.json-out')!.textContent!)).toEqual(MAP_EFFECT_DEFAULTS)
    app.unmount()
  })

  it('applies normalized drafts in place and supports discard, live-mode discard, and external sync', async () => {
    const { app, root, effect, setItem, resetEffect } = await mountControls()
    const baseIdentity = effect.base
    const hoverIdentity = effect.hover
    const qualityIdentity = effect.quality
    await setLivePreview(root, false)
    setItem.mockClear()

    const width = root.querySelector<HTMLInputElement>('#effect-base-outerGlowWidth-number')!
    width.value = '137'
    width.dispatchEvent(new Event('change', { bubbles: true }))
    const passes = root.querySelector<HTMLInputElement>('#effect-hover-glowNearPasses-number')!
    passes.value = '7.6'
    passes.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(effect.base.outerGlowWidth).not.toBe(137)
    expectNoEffectStorageWrites(setItem)

    button(root, '应用参数').click()
    await nextTick()
    expect(effect.base.outerGlowWidth).toBe(137)
    expect(effect.hover.glowNearPasses).toBe(8)
    expect(effect.base).toBe(baseIdentity)
    expect(effect.hover).toBe(hoverIdentity)
    expect(effect.quality).toBe(qualityIdentity)
    expectNoEffectStorageWrites(setItem)

    width.value = '99'
    width.dispatchEvent(new Event('change', { bubbles: true }))
    button(root, '放弃草稿').click()
    await nextTick()
    expect(width.value).toBe('137')

    width.value = '101'
    width.dispatchEvent(new Event('change', { bubbles: true }))
    await setLivePreview(root, true)
    expect(effect.base.outerGlowWidth).toBe(137)
    await setLivePreview(root, false)
    expect(width.value).toBe('137')

    effect.base.outerGlowWidth = 166
    effect.quality.renderScale = 0.75
    await nextTick()
    expect(width.value).toBe('166')
    expect(root.querySelector<HTMLSelectElement>('#effect-quality-renderScale-select')!.value).toBe('0.75')

    resetEffect()
    await nextTick()
    expect(width.value).toBe(String(MAP_EFFECT_DEFAULTS.base.outerGlowWidth))
    expect(JSON.parse(root.querySelector('.json-out')!.textContent!)).toEqual(MAP_EFFECT_DEFAULTS)
    app.unmount()
  })

  it('copies normalized draft JSON in draft mode and effective JSON in live mode', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    })
    const { app, root, effect } = await mountControls()
    await setLivePreview(root, false)
    const width = root.querySelector<HTMLInputElement>('#effect-base-outerGlowWidth-number')!
    width.value = '151'
    width.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()

    copyButton(root).click()
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
    const draftCopy = JSON.parse(writeText.mock.calls[0][0]) as MapEffectConfig
    expect(draftCopy.version).toBe(4)
    expect(draftCopy.base.outerGlowWidth).toBe(151)
    expect(draftCopy.base.inwardGlow).toEqual(MAP_EFFECT_DEFAULTS.base.inwardGlow)
    expect(draftCopy.hover.inwardGlow).toEqual(MAP_EFFECT_DEFAULTS.hover.inwardGlow)
    expect(effect.base.outerGlowWidth).not.toBe(151)

    await setLivePreview(root, true)
    copyButton(root).click()
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(2))
    expect(JSON.parse(writeText.mock.calls[1][0])).toEqual(effect)
    app.unmount()
  })

  it('renders accessible runtime status and warns at the quality and pass thresholds', async () => {
    const { app, root, effect, updateEffectRuntimeStatus } = await mountControls()
    updateEffectRuntimeStatus({
      targetWidth: 680,
      targetHeight: 680,
      renderScale: 0.5,
      baseState: 'enabled',
      hoverState: 'active',
      baseInwardState: 'active',
      hoverInwardState: 'active',
      degraded: false
    })
    await nextTick()

    const status = root.querySelector('[role="status"]')!
    expect(status.textContent).toContain('RenderTarget: 680 × 680')
    expect(status.textContent).toContain('离屏精度: 50%')
    expect(status.textContent).toContain('常态: 已启用')
    expect(status.textContent).toContain('Hover: 生效中')
    expect(status.textContent).toContain('常态内扩: 生效中')
    expect(status.textContent).toContain('Hover 内扩: 生效中')
    expect(status.textContent).not.toContain('传播波')
    expect(status.textContent).toContain('运行状态: 正常')
    expect(root.textContent).toContain('性能提示')

    effect.quality.renderScale = 0.75
    await nextTick()
    expect(root.textContent).toContain('性能提示')
    effect.quality.renderScale = 0.5
    effect.hover.glowEnabled = true
    effect.hover.glowFarPasses = 6
    await nextTick()
    expect(root.textContent).toContain('性能提示')

    updateEffectRuntimeStatus({
      targetWidth: 1,
      targetHeight: 1,
      renderScale: 0.5,
      baseState: 'disabled',
      hoverState: 'zero',
      baseInwardState: 'disabled',
      hoverInwardState: 'zero',
      degraded: true
    })
    await nextTick()
    expect(status.textContent).toContain('常态: 已关闭')
    expect(status.textContent).toContain('Hover: 参数为零')
    expect(status.textContent).toContain('常态内扩: 已关闭')
    expect(status.textContent).toContain('Hover 内扩: 参数为零')
    expect(status.textContent).not.toContain('传播波')
    expect(status.textContent).toContain('运行状态: 外扩柔光已降级关闭')
    app.unmount()
  })

  it('exposes real glow radius and opacity controls', async () => {
    const { app, root } = await mountControls()
    const baseRadius = root.querySelector<HTMLInputElement>('#effect-base-outerGlowWidth-number')!
    const hoverRadius = root.querySelector<HTMLInputElement>('#effect-hover-glowWidth-number')!

    expect(root.querySelector('label[for="effect-base-outerGlowWidth-number"]')?.textContent)
      .toBe('外圈扩散半径')
    expect(root.querySelector('label[for="effect-base-outerGlowStrength-number"]')?.textContent)
      .toBe('外圈辉光透明度')
    expect(root.querySelector('label[for="effect-hover-glowWidth-number"]')?.textContent)
      .toBe('Hover 扩散半径')
    expect(root.querySelector('label[for="effect-hover-glowStrength-number"]')?.textContent)
      .toBe('Hover 辉光透明度')
    expect([baseRadius.max, baseRadius.step]).toEqual(['200', '1'])
    expect([hoverRadius.max, hoverRadius.step]).toEqual(['200', '1'])
    app.unmount()
  })

  it('renders the seven advanced groups with stable accessible controls and design ranges', async () => {
    const { app, root } = await mountControls()
    const groups = Array.from(root.querySelectorAll<HTMLElement>('.effect-group'))
    const group = (title: string) => groups.find((element) => element.querySelector('h3')?.textContent === title)!

    expect(groups.map((element) => element.querySelector('h3')?.textContent)).toEqual([
      '常态边界',
      '常态外扩柔光',
      '常态内扩柔光',
      'Hover 表面',
      'Hover 外扩柔光',
      'Hover 内扩柔光',
      '渲染质量与性能',
      '可复制参数'
    ])

    const baseGlow = group('常态外扩柔光')
    const hoverGlow = group('Hover 外扩柔光')
    const glowKeys = [
      'Enabled', 'Color', 'Width', 'Strength', 'NearRadiusRatio', 'NearOpacityRatio',
      'FarRadiusRatio', 'FarOpacityRatio', 'Falloff', 'EdgeSoftness', 'NearPasses', 'FarPasses'
    ]

    for (const key of glowKeys) {
      const baseKey = `outerGlow${key}`
      const hoverKey = `glow${key}`
      const control = key === 'Enabled' ? 'checkbox' : key === 'Color' ? 'color' : 'number'
      expect(baseGlow.querySelector(`#effect-base-${baseKey}-${control}`)).not.toBeNull()
      expect(hoverGlow.querySelector(`#effect-hover-${hoverKey}-${control}`)).not.toBeNull()
    }

    const ranges: Array<[string, string, string, string, string]> = [
      ['base', 'outerGlowWidth', '0', '200', '1'],
      ['hover', 'glowWidth', '0', '200', '1'],
      ['base', 'outerGlowStrength', '0', '1', '0.01'],
      ['hover', 'glowStrength', '0', '1', '0.01'],
      ['base', 'outerGlowNearRadiusRatio', '0', '1.5', '0.01'],
      ['hover', 'glowNearRadiusRatio', '0', '1.5', '0.01'],
      ['base', 'outerGlowNearOpacityRatio', '0', '2', '0.01'],
      ['hover', 'glowNearOpacityRatio', '0', '2', '0.01'],
      ['base', 'outerGlowFarRadiusRatio', '0.25', '2', '0.01'],
      ['hover', 'glowFarRadiusRatio', '0.25', '2', '0.01'],
      ['base', 'outerGlowFarOpacityRatio', '0', '2', '0.01'],
      ['hover', 'glowFarOpacityRatio', '0', '2', '0.01'],
      ['base', 'outerGlowFalloff', '0.25', '4', '0.05'],
      ['hover', 'glowFalloff', '0.25', '4', '0.05'],
      ['base', 'outerGlowEdgeSoftness', '0', '1', '0.01'],
      ['hover', 'glowEdgeSoftness', '0', '1', '0.01'],
      ['base', 'outerGlowNearPasses', '1', '8', '1'],
      ['hover', 'glowNearPasses', '1', '8', '1'],
      ['base', 'outerGlowFarPasses', '1', '8', '1'],
      ['hover', 'glowFarPasses', '1', '8', '1']
    ]

    for (const [section, key, min, max, step] of ranges) {
      const input = root.querySelector<HTMLInputElement>(`#effect-${section}-${key}-number`)
      expect(input).not.toBeNull()
      expect([input!.min, input!.max, input!.step]).toEqual([min, max, step])
    }

    const maxAlpha = root.querySelector<HTMLInputElement>('#effect-quality-maxAlpha-number')
    expect([maxAlpha?.min, maxAlpha?.max, maxAlpha?.step]).toEqual(['0.1', '1', '0.05'])
    expect(baseGlow.querySelector('label[for="effect-base-outerGlowEnabled-checkbox"]')?.textContent)
      .toBe('启用常态外扩柔光')
    expect(hoverGlow.querySelector('label[for="effect-hover-glowEnabled-checkbox"]')?.textContent)
      .toBe('启用 Hover 外扩柔光')

    const renderScale = root.querySelector<HTMLSelectElement>('#effect-quality-renderScale-select')
    expect(renderScale?.options.length).toBe(4)
    expect(Array.from(renderScale?.options ?? [], (option) => option.value)).toEqual(['0.25', '0.5', '0.75', '1'])
    expect(root.querySelector('#effect-quality-renderScale-range')).toBeNull()
    app.unmount()
  })

  it('keeps disabled glow settings editable through nextTick normalization and writes render scale from the select', async () => {
    const { app, root, effect } = await mountControls()
    const enabled = root.querySelector<HTMLInputElement>('#effect-base-outerGlowEnabled-checkbox')!
    const radius = root.querySelector<HTMLInputElement>('#effect-base-outerGlowWidth-number')!
    const renderScale = root.querySelector<HTMLSelectElement>('#effect-quality-renderScale-select')!

    enabled.checked = false
    enabled.dispatchEvent(new Event('change', { bubbles: true }))
    radius.value = '200'
    radius.dispatchEvent(new Event('change', { bubbles: true }))
    renderScale.value = '0.75'
    renderScale.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()

    expect(effect.base.outerGlowEnabled).toBe(false)
    expect(effect.base.outerGlowWidth).toBe(200)
    expect(effect.quality.renderScale).toBe(0.75)
    expect(radius.disabled).toBe(false)
    app.unmount()
  })

  it('gives every effect field stable programmatic labels with distinct paired control names', async () => {
    const { app, root } = await mountControls()
    const fields = [
      ['base', 'innerColor', 'color'], ['base', 'innerWidth', 'number'], ['base', 'innerOpacity', 'number'],
      ['base', 'outerColor', 'color'], ['base', 'outerCoreWidth', 'number'], ['base', 'outerGlowWidth', 'number'], ['base', 'outerGlowStrength', 'number'],
      ['hover', 'surfaceColor', 'color'], ['hover', 'emissiveColor', 'color'], ['hover', 'emissiveIntensity', 'number'], ['hover', 'lift', 'number'],
      ['hover', 'outlineColor', 'color'], ['hover', 'outlineWidth', 'number'], ['hover', 'glowColor', 'color'], ['hover', 'glowWidth', 'number'],
      ['hover', 'glowStrength', 'number'], ['hover', 'enterMs', 'number'], ['hover', 'leaveMs', 'number']
    ] as const

    for (const [section, key, kind] of fields) {
      const id = `effect-${section}-${key}-${kind}`
      const control = root.querySelector<HTMLInputElement>(`#${id}`)
      const label = root.querySelector<HTMLLabelElement>(`label[for="${id}"]`)
      expect(control).not.toBeNull()
      expect(label?.textContent).not.toBe('')
      if (kind === 'color') {
        expect(root.querySelector(`#effect-${section}-${key}-hex`)?.getAttribute('aria-label'))
          .toContain('十六进制颜色')
      } else {
        expect(root.querySelector(`#effect-${section}-${key}-range`)?.getAttribute('aria-label'))
          .toContain('滑块')
      }
    }

    app.unmount()
  })

  it('keeps per-keystroke numeric drafts until commit, then normalizes and follows external changes', async () => {
    const { app, root, effect } = await mountControls()
    const enterMs = root.querySelector<HTMLInputElement>('#effect-hover-enterMs-number')!
    const opacity = root.querySelector<HTMLInputElement>('#effect-base-innerOpacity-number')!
    const slider = root.querySelector<HTMLInputElement>('#effect-base-innerOpacity-range')!

    expect(await typeCharacters(enterMs, '650')).toEqual(['', '6', '65', '650'])
    expect(effect.hover.enterMs).toBe(400)
    enterMs.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(enterMs.value).toBe('650')
    expect(effect.hover.enterMs).toBe(650)

    expect(await typeCharacters(opacity, '0.556')).toEqual(['', '0', '0.', '0.5', '0.55', '0.556'])
    expect(effect.base.innerOpacity).toBe(0.55)
    opacity.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
    await nextTick()
    expect(opacity.value).toBe('0.56')
    expect(effect.base.innerOpacity).toBe(0.56)
    expect(slider.value).toBe('0.56')

    slider.value = '0.73'
    slider.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
    expect(opacity.value).toBe('0.73')

    effect.base.innerOpacity = 0.42
    effect.hover.enterMs = 260
    await nextTick()
    expect(opacity.value).toBe('0.42')
    expect(enterMs.value).toBe('260')

    const reset = Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent === '恢复全部默认值')!
    reset.click()
    await nextTick()
    expect(opacity.value).toBe('0.55')
    expect(enterMs.value).toBe('400')

    app.unmount()
  })

  it('applies the B3 preset to either glow channel without replacing its identity controls', async () => {
    const { app, root, effect } = await mountControls()
    const groupButton = (title: string, label: string) => Array.from(
      Array.from(root.querySelectorAll<HTMLElement>('.effect-group'))
        .find((group) => group.querySelector('h3')?.textContent === title)!
        .querySelectorAll<HTMLButtonElement>('button')
    ).find((button) => button.textContent === label)!

    effect.base.outerGlowEnabled = false
    effect.base.outerGlowColor = '#123456'
    effect.base.outerGlowWidth = 88
    effect.base.outerGlowStrength = 0.41
    effect.base.outerGlowNearRadiusRatio = 0.81
    effect.base.outerGlowNearOpacityRatio = 0.77
    effect.base.outerGlowFarRadiusRatio = 0.91
    effect.base.outerGlowFarOpacityRatio = 0.66
    effect.base.outerGlowFalloff = 2
    effect.base.outerGlowEdgeSoftness = 0.42
    effect.base.outerGlowNearPasses = 7
    effect.base.outerGlowFarPasses = 3
    groupButton('常态外扩柔光', '应用 B3 参考预设').click()
    await nextTick()

    expect(effect.base).toMatchObject({
      outerGlowEnabled: false,
      outerGlowColor: '#123456',
      outerGlowWidth: 88,
      outerGlowStrength: 0.41,
      outerGlowNearRadiusRatio: B3_GLOW_PROFILE_DEFAULTS.nearRadiusRatio,
      outerGlowNearOpacityRatio: B3_GLOW_PROFILE_DEFAULTS.nearOpacityRatio,
      outerGlowFarRadiusRatio: B3_GLOW_PROFILE_DEFAULTS.farRadiusRatio,
      outerGlowFarOpacityRatio: B3_GLOW_PROFILE_DEFAULTS.farOpacityRatio,
      outerGlowFalloff: B3_GLOW_PROFILE_DEFAULTS.falloff,
      outerGlowEdgeSoftness: B3_GLOW_PROFILE_DEFAULTS.edgeSoftness,
      outerGlowNearPasses: B3_GLOW_PROFILE_DEFAULTS.nearPasses,
      outerGlowFarPasses: B3_GLOW_PROFILE_DEFAULTS.farPasses
    })

    effect.hover.glowEnabled = false
    effect.hover.glowColor = '#654321'
    effect.hover.glowWidth = 79
    effect.hover.glowStrength = 0.36
    effect.hover.glowNearRadiusRatio = 0.72
    effect.hover.glowNearOpacityRatio = 0.71
    effect.hover.glowFarRadiusRatio = 0.89
    effect.hover.glowFarOpacityRatio = 0.62
    effect.hover.glowFalloff = 1.5
    effect.hover.glowEdgeSoftness = 0.33
    effect.hover.glowNearPasses = 6
    effect.hover.glowFarPasses = 3
    groupButton('Hover 外扩柔光', '应用 B3 参考预设').click()
    await nextTick()

    expect(effect.hover).toMatchObject({
      glowEnabled: false,
      glowColor: '#654321',
      glowWidth: 79,
      glowStrength: 0.36,
      glowNearRadiusRatio: B3_GLOW_PROFILE_DEFAULTS.nearRadiusRatio,
      glowNearOpacityRatio: B3_GLOW_PROFILE_DEFAULTS.nearOpacityRatio,
      glowFarRadiusRatio: B3_GLOW_PROFILE_DEFAULTS.farRadiusRatio,
      glowFarOpacityRatio: B3_GLOW_PROFILE_DEFAULTS.farOpacityRatio,
      glowFalloff: B3_GLOW_PROFILE_DEFAULTS.falloff,
      glowEdgeSoftness: B3_GLOW_PROFILE_DEFAULTS.edgeSoftness,
      glowNearPasses: B3_GLOW_PROFILE_DEFAULTS.nearPasses,
      glowFarPasses: B3_GLOW_PROFILE_DEFAULTS.farPasses
    })
    app.unmount()
  })

  it('resets only the selected glow group and restores the full v3 config on all-reset', async () => {
    const { app, root, effect } = await mountControls()
    const groupButton = (title: string, label: string) => Array.from(
      Array.from(root.querySelectorAll<HTMLElement>('.effect-group'))
        .find((group) => group.querySelector('h3')?.textContent === title)!
        .querySelectorAll<HTMLButtonElement>('button')
    ).find((button) => button.textContent === label)!

    effect.base.innerWidth = 3.2
    effect.hover.surfaceColor = '#112233'
    effect.base.outerGlowEnabled = false
    effect.base.outerGlowColor = '#123456'
    effect.base.outerGlowWidth = 88
    effect.base.outerGlowStrength = 0.41
    effect.base.outerGlowNearRadiusRatio = 0.81
    effect.base.outerGlowNearOpacityRatio = 0.77
    effect.base.outerGlowFarRadiusRatio = 0.91
    effect.base.outerGlowFarOpacityRatio = 0.66
    effect.base.outerGlowFalloff = 2
    effect.base.outerGlowEdgeSoftness = 0.42
    effect.base.outerGlowNearPasses = 7
    effect.base.outerGlowFarPasses = 3
    groupButton('常态外扩柔光', '重置本组').click()
    await nextTick()

    expect(effect.base.innerWidth).toBe(3.2)
    expect(effect.hover.surfaceColor).toBe('#112233')
    expect(effect.base).toMatchObject({
      outerGlowEnabled: MAP_EFFECT_DEFAULTS.base.outerGlowEnabled,
      outerGlowColor: MAP_EFFECT_DEFAULTS.base.outerGlowColor,
      outerGlowWidth: MAP_EFFECT_DEFAULTS.base.outerGlowWidth,
      outerGlowStrength: MAP_EFFECT_DEFAULTS.base.outerGlowStrength,
      outerGlowNearRadiusRatio: MAP_EFFECT_DEFAULTS.base.outerGlowNearRadiusRatio,
      outerGlowNearOpacityRatio: MAP_EFFECT_DEFAULTS.base.outerGlowNearOpacityRatio,
      outerGlowFarRadiusRatio: MAP_EFFECT_DEFAULTS.base.outerGlowFarRadiusRatio,
      outerGlowFarOpacityRatio: MAP_EFFECT_DEFAULTS.base.outerGlowFarOpacityRatio,
      outerGlowFalloff: MAP_EFFECT_DEFAULTS.base.outerGlowFalloff,
      outerGlowEdgeSoftness: MAP_EFFECT_DEFAULTS.base.outerGlowEdgeSoftness,
      outerGlowNearPasses: MAP_EFFECT_DEFAULTS.base.outerGlowNearPasses,
      outerGlowFarPasses: MAP_EFFECT_DEFAULTS.base.outerGlowFarPasses
    })

    effect.base.innerWidth = 3.7
    effect.hover.glowEnabled = false
    effect.hover.glowColor = '#654321'
    effect.hover.glowWidth = 79
    effect.hover.glowStrength = 0.36
    effect.hover.glowNearRadiusRatio = 0.72
    effect.hover.glowNearOpacityRatio = 0.71
    effect.hover.glowFarRadiusRatio = 0.89
    effect.hover.glowFarOpacityRatio = 0.62
    effect.hover.glowFalloff = 1.5
    effect.hover.glowEdgeSoftness = 0.33
    effect.hover.glowNearPasses = 6
    effect.hover.glowFarPasses = 3
    groupButton('Hover 外扩柔光', '重置本组').click()
    await nextTick()

    expect(effect.base.innerWidth).toBe(3.7)
    expect(effect.hover).toMatchObject({
      glowEnabled: MAP_EFFECT_DEFAULTS.hover.glowEnabled,
      glowColor: MAP_EFFECT_DEFAULTS.hover.glowColor,
      glowWidth: MAP_EFFECT_DEFAULTS.hover.glowWidth,
      glowStrength: MAP_EFFECT_DEFAULTS.hover.glowStrength,
      glowNearRadiusRatio: MAP_EFFECT_DEFAULTS.hover.glowNearRadiusRatio,
      glowNearOpacityRatio: MAP_EFFECT_DEFAULTS.hover.glowNearOpacityRatio,
      glowFarRadiusRatio: MAP_EFFECT_DEFAULTS.hover.glowFarRadiusRatio,
      glowFarOpacityRatio: MAP_EFFECT_DEFAULTS.hover.glowFarOpacityRatio,
      glowFalloff: MAP_EFFECT_DEFAULTS.hover.glowFalloff,
      glowEdgeSoftness: MAP_EFFECT_DEFAULTS.hover.glowEdgeSoftness,
      glowNearPasses: MAP_EFFECT_DEFAULTS.hover.glowNearPasses,
      glowFarPasses: MAP_EFFECT_DEFAULTS.hover.glowFarPasses
    })

    effect.base.innerWidth = 3.5
    effect.hover.enterMs = 800
    effect.quality.maxAlpha = 0.55
    Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent === '恢复全部默认值')!
      .click()
    await nextTick()
    expect(effect).toEqual(MAP_EFFECT_DEFAULTS)
    app.unmount()
  })

  it('shows a temporary failure state when the clipboard fallback returns false', async () => {
    vi.useFakeTimers()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('clipboard unavailable')) }
    })
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn(() => false)
    })
    const { app, root } = await mountControls()
    const copy = Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent === '复制效果参数')!

    copy.click()
    await Promise.resolve()
    await Promise.resolve()
    await nextTick()

    expect(copy.textContent).toBe('复制失败，请重试')
    expect(document.querySelector('textarea')).toBeNull()
    vi.advanceTimersByTime(1500)
    await nextTick()
    expect(copy.textContent).toBe('复制效果参数')
    app.unmount()
  })

  it('isolates stable inward drafts and applies them in place with stable nested identities', async () => {
    const { app, root, effect, setItem } = await mountControls()
    const base = effect.base
    const inward = effect.base.inwardGlow
    const originalWidth = inward.width
    await setLivePreview(root, false)
    setItem.mockClear()

    const width = root.querySelector<HTMLInputElement>('#effect-base-inward-width-number')!
    width.value = '143'
    width.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(width.value).toBe('143')
    expect(effect.base.inwardGlow.width).toBe(originalWidth)
    expectNoEffectStorageWrites(setItem)

    button(root, '应用参数').click()
    await nextTick()
    expect(effect.base.inwardGlow.width).toBe(143)
    expect(effect.base).toBe(base)
    expect(effect.base.inwardGlow).toBe(inward)
    expectNoEffectStorageWrites(setItem)

    width.value = '151'
    width.dispatchEvent(new Event('change', { bubbles: true }))
    button(root, '放弃草稿').click()
    await nextTick()
    expect(width.value).toBe('143')
    expect(effect.base.inwardGlow.width).toBe(143)

    effect.base.inwardGlow.width = 147
    await nextTick()
    expect(width.value).toBe('147')
    app.unmount()
  })

  it('renders independent inward groups and resets one without touching outward or the other inward group', async () => {
    const { app, root, effect } = await mountControls()
    const groups = Array.from(root.querySelectorAll<HTMLElement>('.effect-group'))
    const group = (title: string) => groups.find((element) => element.querySelector('h3')?.textContent === title)!
    const groupButton = (title: string, label: string) => Array.from(group(title).querySelectorAll<HTMLButtonElement>('button'))
      .find((candidate) => candidate.textContent === label)!

    expect(group('常态内扩柔光').querySelector('#effect-base-inward-width-number')).not.toBeNull()
    expect(group('Hover 内扩柔光').querySelector('#effect-hover-inward-width-number')).not.toBeNull()
    expect(group('常态内扩柔光').querySelector('[id*="wave"]')).toBeNull()
    expect(group('Hover 内扩柔光').querySelector('[id*="wave"]')).toBeNull()

    effect.base.outerGlowWidth = 123
    effect.hover.inwardGlow.width = 101
    effect.base.inwardGlow.width = 99
    const inwardIdentity = effect.base.inwardGlow
    groupButton('常态内扩柔光', '重置本组').click()
    await nextTick()

    expect(effect.base.outerGlowWidth).toBe(123)
    expect(effect.hover.inwardGlow.width).toBe(101)
    expect(effect.base.inwardGlow).toEqual(MAP_EFFECT_DEFAULTS.base.inwardGlow)
    expect(effect.base.inwardGlow).toBe(inwardIdentity)

    effect.base.inwardGlow.width = 88
    groupButton('常态内扩柔光', '应用 B1 预设').click()
    await nextTick()
    expect(effect.base.inwardGlow).toEqual(MAP_EFFECT_DEFAULTS.base.inwardGlow)

    button(root, '恢复全部默认值').click()
    await nextTick()
    expect(effect.version).toBe(4)
    expect(effect).toEqual(MAP_EFFECT_DEFAULTS)
    app.unmount()
  })

  it('warns only after the fourth glow channel is enabled when every pass count is below six', async () => {
    const { app, root, effect } = await mountControls()
    const hasWarning = () => root.textContent?.includes('性能提示') === true

    effect.quality.renderScale = 0.5
    effect.base.outerGlowNearPasses = 5
    effect.base.outerGlowFarPasses = 5
    effect.hover.glowNearPasses = 5
    effect.hover.glowFarPasses = 5
    effect.base.inwardGlow.nearPasses = 5
    effect.base.inwardGlow.farPasses = 5
    effect.hover.inwardGlow.nearPasses = 5
    effect.hover.inwardGlow.farPasses = 5
    effect.base.outerGlowEnabled = true
    effect.hover.glowEnabled = true
    effect.base.inwardGlow.enabled = true
    effect.hover.inwardGlow.enabled = false
    await nextTick()
    expect(hasWarning()).toBe(false)

    effect.hover.inwardGlow.enabled = true
    await nextTick()
    expect(hasWarning()).toBe(true)
    expect(root.querySelector('.performance-warning')?.textContent).toContain('renderScale')
    expect(root.querySelector('.performance-warning')?.textContent).toContain('passes')
    app.unmount()
  })
})
