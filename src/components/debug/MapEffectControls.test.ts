// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, type App } from 'vue'
import type { MapEffectConfig } from '@/components/map/mapEffectConfig'

type MountedControls = {
  app: App
  root: HTMLDivElement
  effect: MapEffectConfig
}

async function mountControls(): Promise<MountedControls> {
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value)
  })
  const { default: MapEffectControls } = await import('./MapEffectControls.vue')
  const root = document.createElement('div')
  const app = createApp(MapEffectControls)
  app.mount(root)
  await nextTick()
  const { useMapDebug } = await import('@/composables/useMapDebug')
  return { app, root, effect: useMapDebug().effect }
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
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('MapEffectControls', () => {
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

    expect(await typeCharacters(enterMs, '400')).toEqual(['', '4', '40', '400'])
    expect(effect.hover.enterMs).toBe(180)
    enterMs.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(enterMs.value).toBe('400')
    expect(effect.hover.enterMs).toBe(400)

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
      .find((button) => button.textContent === '恢复默认值')!
    reset.click()
    await nextTick()
    expect(opacity.value).toBe('0.55')
    expect(enterMs.value).toBe('180')

    app.unmount()
  })
})
