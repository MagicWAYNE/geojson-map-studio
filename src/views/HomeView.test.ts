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
vi.mock('@/views/MapLoaderView.vue', () => ({
  default: defineComponent({
    emits: ['mapActivated'],
    setup(_, { emit }) {
      return () => h('aside', { class: 'authoring-panel-stub' }, [
        '地图创作面板',
        h('button', {
          class: 'activate-stub-map',
          onClick: () => emit('mapActivated', {
            source: { kind: 'geojson', displayName: 'new.geojson' }
          })
        }, '激活')
      ])
    }
  })
}))

import HomeView from './HomeView.vue'

afterEach(() => {
  sourceMocks.load.mockReset()
  document.body.replaceChildren()
})

describe('HomeView same-page map authoring', () => {
  it('keeps one map shell and places the authoring panel beside it', () => {
    expect(homeViewSource).toContain('<img class="bg-main"')
    expect(homeViewSource).toContain('<img class="bg-terrain"')
    expect(homeViewSource).toContain('<ChongqingMap3D')
    expect(homeViewSource).toContain('<MapLoaderView')
    expect(homeViewSource).not.toContain('<HeaderBar')
    expect(homeViewSource).not.toContain('<KpiPanel')
    expect(homeViewSource).not.toContain('<MapDebugDrawer')
    expect(homeViewSource).toContain('left: 24px')
    expect(homeViewSource).toContain('width: 1120px')
    expect(homeViewSource).toContain('height: 948px')
  })

  it('异步加载当前地图文档并同时呈现固定创作面板', async () => {
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
    expect(root.querySelectorAll('.home > *')).toHaveLength(4)
    expect(root.querySelector('.authoring-panel-stub')?.textContent).toContain('地图创作面板')
    app.unmount()
  })

  it('面板直接激活新几何时在当前页面替换地图文档', async () => {
    sourceMocks.load.mockResolvedValue({
      document: { source: { kind: 'builtin', displayName: '内置地图' } },
      warnings: []
    })
    const root = document.createElement('div')
    const app = createApp(HomeView)
    app.mount(root)
    await vi.waitFor(() => expect(root.querySelector('.map-stub')?.getAttribute('data-source')).toBe('内置地图'))

    root.querySelector<HTMLButtonElement>('.activate-stub-map')!.click()
    await nextTick()

    expect(root.querySelector('.map-stub')?.getAttribute('data-source')).toBe('new.geojson')
    expect(root.querySelectorAll('.map-stub')).toHaveLength(1)
    app.unmount()
  })
})
