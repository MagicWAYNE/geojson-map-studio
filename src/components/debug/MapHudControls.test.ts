// @vitest-environment happy-dom
import { createApp, nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAP_HUD_DEFAULTS } from '@/components/map/mapHudConfig'

afterEach(() => {
  document.body.replaceChildren()
  vi.unstubAllGlobals()
  vi.resetModules()
})

async function mountControls() {
  const setItem = vi.fn()
  vi.stubGlobal('localStorage', { getItem: () => null, setItem })
  const { default: MapHudControls } = await import('./MapHudControls.vue')
  const { useMapVisualSettings } = await import('@/composables/useMapVisualSettings')
  const root = document.createElement('div')
  const app = createApp(MapHudControls)
  app.mount(root)
  await nextTick()
  return { app, root, hud: useMapVisualSettings().hud, setItem }
}

function setNumber(root: HTMLElement, id: string, value: number): void {
  const input = root.querySelector<HTMLInputElement>(id)!
  input.value = String(value)
  input.dispatchEvent(new Event('input'))
  input.dispatchEvent(new Event('change'))
}

describe('MapHudControls', () => {
  it('supports draft application, negative rotation, reset, and session-only tuning', async () => {
    const { app, root, hud, setItem } = await mountControls()
    const preview = root.querySelector<HTMLInputElement>('#map-hud-live-preview')!
    preview.checked = false
    preview.dispatchEvent(new Event('change'))
    await nextTick()

    setNumber(root, '#map-hud-static-diameter-number', 220)
    await nextTick()
    expect(hud.static.diameter).toBe(MAP_HUD_DEFAULTS.static.diameter)

    Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === '应用参数')!.click()
    await nextTick()
    expect(hud.static.diameter).toBe(220)

    preview.checked = true
    preview.dispatchEvent(new Event('change'))
    setNumber(root, '#map-hud-rotating-speedDegPerSecond-number', -12)
    await nextTick()
    expect(hud.rotating.speedDegPerSecond).toBe(-12)
    expect(setItem).not.toHaveBeenCalled()

    Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === '恢复 HUD 默认值')!.click()
    await nextTick()
    expect(hud).toEqual(MAP_HUD_DEFAULTS)
    app.unmount()
  })
})
