// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, type App } from 'vue'

type MountedControls = {
  app: App
  root: HTMLDivElement
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
  return { app, root }
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

  it('restores empty numeric input, aligns it to step, and keeps the slider synchronized', async () => {
    const { app, root } = await mountControls()
    const number = root.querySelector<HTMLInputElement>('#effect-base-innerOpacity-number')!
    const slider = root.querySelector<HTMLInputElement>('#effect-base-innerOpacity-range')!

    number.value = ''
    number.dispatchEvent(new Event('input'))
    expect(number.value).toBe('0.55')

    number.value = '0.556'
    number.dispatchEvent(new Event('input'))
    await nextTick()
    expect(number.value).toBe('0.56')
    expect(slider.value).toBe('0.56')

    slider.value = '0.73'
    slider.dispatchEvent(new Event('input'))
    await nextTick()
    expect(number.value).toBe('0.73')

    app.unmount()
  })
})
