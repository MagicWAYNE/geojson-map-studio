// @vitest-environment happy-dom
import { createApp, nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import catalogFixture from '../../../public/region-catalog/tianditu-2025-09/catalog.json'
import { parseRegionCatalog } from './regionCatalog'
import RegionCatalogPicker from './RegionCatalogPicker.vue'

async function mountPicker(props: Record<string, unknown> = {}) {
  const root = document.createElement('div')
  document.body.append(root)
  const onLoad = vi.fn()
  const app = createApp(RegionCatalogPicker, {
    catalog: parseRegionCatalog(catalogFixture), loading: false, error: '', onLoad, ...props
  })
  app.mount(root)
  await nextTick()
  return { app, root, onLoad }
}

function select(root: HTMLElement, id: string, value: string): void {
  const element = root.querySelector<HTMLSelectElement>(id)!
  element.value = value
  element.dispatchEvent(new Event('change', { bubbles: true }))
}

afterEach(() => document.body.replaceChildren())

describe('RegionCatalogPicker', () => {
  it('does not emit while dependent selects change and emits only from the explicit button', async () => {
    const { app, root, onLoad } = await mountPicker()
    select(root, '#catalog-scope', 'province')
    await nextTick()
    select(root, '#catalog-province', '156130000')
    await nextTick()
    select(root, '#catalog-content', 'counties')
    await nextTick()
    expect(onLoad).not.toHaveBeenCalled()
    root.querySelector<HTMLButtonElement>('[data-action="load-catalog-region"]')!.click()
    expect(onLoad).toHaveBeenCalledWith({ kind: 'province-counties', provinceGb: '156130000' })
    app.unmount()
  })

  it('disables incomplete and unavailable prefecture choices', async () => {
    const { app, root } = await mountPicker()
    select(root, '#catalog-scope', 'prefecture')
    await nextTick()
    expect(root.querySelector<HTMLButtonElement>('[data-action="load-catalog-region"]')!.disabled).toBe(true)
    select(root, '#catalog-province', '156620000')
    await nextTick()
    const unavailable = [...root.querySelectorAll<HTMLOptionElement>('#catalog-prefecture option')]
      .find((option) => option.textContent?.includes('嘉峪关市'))!
    expect(unavailable.disabled).toBe(true)
    expect(unavailable.textContent).toContain('暂无下一级区域')
    app.unmount()
  })

  it('keeps local work usable when the catalog reports a retryable error', async () => {
    const onRetry = vi.fn()
    const { app, root } = await mountPicker({ catalog: null, error: '目录加载失败', onRetry })
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('目录加载失败')
    root.querySelector<HTMLButtonElement>('[data-action="retry-catalog"]')!.click()
    expect(onRetry).toHaveBeenCalledTimes(1)
    app.unmount()
  })
})
