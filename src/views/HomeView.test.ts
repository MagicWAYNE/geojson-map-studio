// @vitest-environment happy-dom
import { createApp, defineComponent, h, nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import homeViewSource from './HomeView.vue?raw'

const sourceMocks = vi.hoisted(() => ({ load: vi.fn() }))

vi.mock('@/components/map/mapSource', () => ({
  activeMapSource: { load: sourceMocks.load }
}))
vi.mock('@/components/map/ChongqingMap3D.vue', () => ({
  default: defineComponent({
    props: ['document'],
    setup(props) {
      return () => h('div', {
        class: 'map-stub',
        'data-source': props.document.source.displayName
      })
    }
  })
}))

import HomeView from './HomeView.vue'

afterEach(() => {
  sourceMocks.load.mockReset()
  document.body.replaceChildren()
})

describe('HomeView map-only presentation', () => {
  it('keeps only the background layers and centered map shell', () => {
    expect(homeViewSource).toContain('<img class="bg-main"')
    expect(homeViewSource).toContain('<img class="bg-terrain"')
    expect(homeViewSource).toContain('<ChongqingMap3D')
    expect(homeViewSource).not.toContain('<HeaderBar')
    expect(homeViewSource).not.toContain('<KpiPanel')
    expect(homeViewSource).not.toContain('<aside')
    expect(homeViewSource).not.toContain('<MapDebugDrawer')
  })

  it('异步加载当前地图文档并保持首页只有背景与地图主体', async () => {
    sourceMocks.load.mockResolvedValue({
      document: {
        source: { kind: 'geojson', displayName: 'custom.geojson' }
      },
      warnings: []
    })
    const root = document.createElement('div')
    const app = createApp(HomeView)
    app.mount(root)

    expect(root.querySelector('.map-stub')).toBeNull()
    await vi.waitFor(() => expect(root.querySelector('.map-stub')).not.toBeNull())
    await nextTick()
    expect(root.querySelector('.map-stub')?.getAttribute('data-source')).toBe('custom.geojson')
    expect(root.querySelectorAll('.home > *')).toHaveLength(3)
    expect(root.querySelector('aside')).toBeNull()
    app.unmount()
  })
})
