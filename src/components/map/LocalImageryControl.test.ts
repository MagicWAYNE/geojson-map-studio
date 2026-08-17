// @vitest-environment happy-dom
import { createApp, ref, shallowRef } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const holder = vi.hoisted(() => ({ runtime: null as unknown }))

vi.mock('@/composables/useLocalImagery', () => ({
  useLocalImagery: () => holder.runtime
}))

import LocalImageryControl from './LocalImageryControl.vue'

function mount() {
  const root = document.createElement('div')
  const app = createApp(LocalImageryControl)
  app.mount(root)
  return { root, app }
}

beforeEach(() => {
  holder.runtime = {
    enabled: ref(false),
    targetId: ref(null),
    available: ref(false),
    state: ref('idle'),
    message: ref(''),
    appearance: shallowRef(null)
  }
})

describe('LocalImageryControl', () => {
  it('is an explicit disabled opt-in when the active map has no catalog identity', () => {
    const { root, app } = mount()
    const input = root.querySelector<HTMLInputElement>('[data-action="toggle-local-imagery"]')!
    expect(input.disabled).toBe(true)
    expect(root.textContent).toContain('加载本地 Sentinel-2 影像')
    expect(root.textContent).toContain('请先从区域库加载')
    app.unmount()
  })

  it('keeps source details behind an accessible info affordance', () => {
    holder.runtime = {
      enabled: ref(true),
      targetId: ref('province:130000'),
      available: ref(true),
      state: ref('ready'),
      message: ref('2025-Q2 · 本地静态影像'),
      appearance: shallowRef({
        attribution: 'Contains modified Copernicus Sentinel data 2025',
        legalNoticeUrl: 'https://sentinels.copernicus.eu/legal-notice'
      })
    }
    const { root, app } = mount()
    const info = root.querySelector<HTMLElement>('[data-local-imagery-info]')!
    const tooltip = root.querySelector<HTMLElement>('[role="tooltip"]')!
    const link = tooltip.querySelector<HTMLAnchorElement>('a')!
    expect(info.getAttribute('aria-describedby')).toBe(tooltip.id)
    expect(link.textContent).toBe('Contains modified Copernicus Sentinel data 2025')
    expect(link.href).toBe('https://sentinels.copernicus.eu/legal-notice')
    expect(tooltip.textContent).toContain('Sentinel-2 Level-3 Quarterly Mosaics')
    expect(tooltip.textContent).toContain('2025-Q2')
    expect(root.querySelector('.local-imagery-control__description')).toBeNull()
    app.unmount()
  })

  it('explains that prefecture imagery is excluded from the deployment', () => {
    holder.runtime = {
      enabled: ref(false),
      targetId: ref('prefecture:130100'),
      available: ref(false),
      state: ref('unsupported'),
      message: ref(''),
      appearance: shallowRef(null)
    }
    const { root, app } = mount()
    expect(root.querySelector<HTMLInputElement>('[data-action="toggle-local-imagery"]')?.disabled).toBe(true)
    expect(root.textContent).toContain('仅支持全国与省级')
    app.unmount()
  })
})
