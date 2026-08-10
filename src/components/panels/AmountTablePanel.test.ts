// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, type App } from 'vue'

vi.mock('@/api', () => ({
  getEnterpriseResourceDistribution: vi.fn().mockResolvedValue([])
}))

async function mountPanel(): Promise<{ app: App; root: HTMLDivElement }> {
  const { default: AmountTablePanel } = await import('./AmountTablePanel.vue')
  const root = document.createElement('div')
  const app = createApp(AmountTablePanel)
  app.mount(root)
  await nextTick()
  return { app, root }
}

afterEach(() => {
  vi.resetModules()
})

describe('AmountTablePanel', () => {
  it('fits the table to its compact panel width without trailing whitespace', async () => {
    const { app, root } = await mountPanel()

    expect(root.querySelector<HTMLElement>('.amount-panel')!.style.width).toBe('288px')
    expect(root.querySelector<HTMLElement>('.sub-title')!.style.width).toBe('288px')
    expect([...root.querySelectorAll<HTMLElement>('.thead span')].map((column) => column.style.width))
      .toEqual(['26.25%', '26.25%', '47.5%'])

    app.unmount()
  })
})
