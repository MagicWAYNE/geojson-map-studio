// @vitest-environment happy-dom
import { createApp, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import HeaderBar from './HeaderBar.vue'
import { useMapDistrictCarousel } from '@/composables/useMapDistrictCarousel'

function mountHeader(debug: boolean) {
  const host = document.createElement('div')
  document.body.append(host)
  const app = createApp(HeaderBar, { debug })
  app.mount(host)
  return { host, unmount: () => app.unmount() }
}

beforeEach(() => {
  vi.useFakeTimers()
  useMapDistrictCarousel().enabled.value = true
})

afterEach(() => {
  document.body.replaceChildren()
  vi.useRealTimers()
})

describe('HeaderBar map district carousel control', () => {
  it('places the enabled carousel switch between the timer and map debug controls', async () => {
    const mounted = mountHeader(true)
    const controls = [...mounted.host.querySelector('.controls')!.children]

    expect(controls.map((element) => element.className)).toEqual([
      'timer',
      'carousel-btn active',
      'debug-btn',
      'fs-btn'
    ])

    const button = mounted.host.querySelector<HTMLButtonElement>('.carousel-btn')!
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(button.title).toBe('关闭区块轮播')

    button.click()
    await nextTick()
    expect(useMapDistrictCarousel().enabled.value).toBe(false)
    expect(button.classList.contains('active')).toBe(false)
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(button.title).toBe('开启区块轮播')
    mounted.unmount()
  })

  it('does not show the map-only carousel switch when debug map controls are absent', () => {
    const mounted = mountHeader(false)

    expect(mounted.host.querySelector('.carousel-btn')).toBeNull()
    expect(mounted.host.querySelector('.debug-btn')).toBeNull()
    mounted.unmount()
  })
})
