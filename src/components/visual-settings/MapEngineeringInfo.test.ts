// @vitest-environment happy-dom
import { createApp, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MapEngineeringInfo from './MapEngineeringInfo.vue'
import { useMapVisualSettings } from '@/composables/useMapVisualSettings'
import { useMapDistrictCarousel } from '@/composables/useMapDistrictCarousel'

vi.mock('@/utils/copyText', () => ({ copyTextToClipboard: vi.fn().mockResolvedValue(true) }))

beforeEach(() => {
  useMapVisualSettings().resetVisualSession()
  useMapDistrictCarousel().enabled.value = true
})

afterEach(() => {
  document.body.replaceChildren()
})

describe('MapEngineeringInfo', () => {
  it('shows published renderer diagnostics and controls the session-only carousel preference', async () => {
    const session = useMapVisualSettings()
    session.updateFps(58.7)
    session.updateEffectRuntimeStatus({
      targetWidth: 560,
      targetHeight: 474,
      renderScale: 0.5,
      baseState: 'enabled',
      hoverState: 'active',
      baseInwardState: 'active',
      hoverInwardState: 'active',
      mosaicState: 'active',
      degraded: false
    })
    session.updateDistrictBarRuntimeStatus({ renderedCount: 8, dataMin: 12, dataMax: 90, degraded: false })
    const root = document.createElement('div')
    const app = createApp(MapEngineeringInfo)
    app.mount(root)
    await nextTick()

    expect(root.textContent).toContain('59')
    expect(root.textContent).toContain('560 × 474')
    expect(root.textContent).toContain('12–90')
    const carousel = root.querySelector<HTMLInputElement>('#engineering-carousel')!
    expect(carousel.checked).toBe(true)
    carousel.checked = false
    carousel.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(useMapDistrictCarousel().enabled.value).toBe(false)
    app.unmount()
  })
})
