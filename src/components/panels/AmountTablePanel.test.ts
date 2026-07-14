// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, type App } from 'vue'

vi.mock('@/api', () => ({
  getJeFenbuList: vi.fn().mockResolvedValue([])
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
  it('renders every table column at 70 percent of its original width', async () => {
    const { app, root } = await mountPanel()

    expect([...root.querySelectorAll<HTMLElement>('.thead span')].map((column) => column.style.width))
      .toEqual(['21%', '21%', '28%'])

    app.unmount()
  })
})
