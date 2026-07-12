// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick } from 'vue'

afterEach(() => {
  document.body.replaceChildren()
  Reflect.deleteProperty(document, 'execCommand')
  Reflect.deleteProperty(navigator, 'clipboard')
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('MapDebugDrawer copy feedback', () => {
  it('shows failure when the CSS clipboard fallback returns false', async () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: vi.fn()
    })
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('clipboard unavailable')) }
    })
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn(() => false)
    })
    const { useMapDebug } = await import('@/composables/useMapDebug')
    useMapDebug().drawerOpen.value = true
    const { default: MapDebugDrawer } = await import('./MapDebugDrawer.vue')
    const root = document.createElement('div')
    const app = createApp(MapDebugDrawer)
    app.mount(root)
    await nextTick()
    const copy = Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.trim() === '复制 CSS')!

    copy.click()
    await Promise.resolve()
    await Promise.resolve()
    await nextTick()

    expect(copy.textContent?.trim()).toBe('复制失败，请重试')
    expect(document.querySelector('textarea')).toBeNull()
    app.unmount()
  })
})
