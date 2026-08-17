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
    props: ['document', 'focus'],
    setup(props) {
      return () => h('div', {
        class: 'map-stub',
        'data-source': props.document.source.displayName,
        'data-focus': props.focus
      })
    }
  })
}))
vi.mock('@/views/MapLoaderView.vue', () => ({
  default: defineComponent({
    props: ['initialLoad'],
    emits: ['mapActivated', 'authoringFocus'],
    setup(props, { emit }) {
      return () => h('aside', {
        class: 'authoring-panel-stub',
        'data-initial-source': props.initialLoad.document.source.displayName
      }, [
        '地图创作面板',
        h('button', {
          class: 'activate-stub-map',
          onClick: () => emit('mapActivated', {
            source: { kind: 'geojson', displayName: 'new.geojson' }
          })
        }, '激活'),
        h('button', {
          class: 'focus-stub-region',
          onClick: () => emit('authoringFocus', '区域 A')
        }, '聚焦')
      ])
    }
  })
}))

import HomeView from './HomeView.vue'
import { useMapVisualSettings } from '@/composables/useMapVisualSettings'

afterEach(() => {
  sourceMocks.load.mockReset()
  useMapVisualSettings().resetVisualSession()
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('HomeView same-page map authoring', () => {
  it('keeps one map shell and places the authoring panel beside it', () => {
    expect(homeViewSource).toContain('DEFAULT_BACKGROUND_LAYERS')
    expect(homeViewSource).toContain(':class="`bg-${layer.id}`"')
    expect(homeViewSource).toContain('visualSettings.backgroundLayerVisibility[layer.id]')
    expect(homeViewSource).toContain('<ChongqingMap3D')
    expect(homeViewSource).toContain('<MapLoaderView')
    expect(homeViewSource).not.toContain('<HeaderBar')
    expect(homeViewSource).not.toContain('<KpiPanel')
    expect(homeViewSource).not.toContain('<MapDebugDrawer')
    expect(homeViewSource).toContain('useMapVisualSettings')
    expect(homeViewSource).toContain(':style="mapStyle"')
    expect(homeViewSource).not.toContain('left: 400px')
  })

  it('uses the visual session composition as the single live map layout', async () => {
    sourceMocks.load.mockResolvedValue({
      document: { source: { kind: 'builtin', displayName: '内置地图' } },
      warnings: []
    })
    const session = useMapVisualSettings()
    session.resetVisualSession()
    const root = document.createElement('div')
    const app = createApp(HomeView)
    app.mount(root)
    await vi.waitFor(() => expect(root.querySelector('.map-stub')).not.toBeNull())

    const map = root.querySelector<HTMLElement>('.map-stub')!
    expect(map.style.left).toBe('0px')
    expect(map.style.top).toBe('0px')
    session.layout.left = 81
    session.layout.width = 1000
    await nextTick()
    expect(map.style.left).toBe('81px')
    expect(map.style.width).toBe('1000px')
    session.setSidebarCollapsed(true)
    await nextTick()
    expect(map.style.left).toBe('460px')
    expect(map.style.top).toBe('0px')
    session.setSidebarCollapsed(false)
    await nextTick()
    expect(map.style.left).toBe('81px')
    expect(map.style.top).toBe('0px')
    app.unmount()
    expect(session.layout.left).toBe(0)
    expect(session.layout.width).toBe(1280)
  })

  it('replaces the uploaded background image for this session', async () => {
    sourceMocks.load.mockResolvedValue({
      document: { source: { kind: 'builtin', displayName: '内置地图' } },
      warnings: []
    })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:custom-main')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const session = useMapVisualSettings()
    session.resetVisualSession()
    const root = document.createElement('div')
    const app = createApp(HomeView)
    app.mount(root)
    await vi.waitFor(() => expect(root.querySelector('.map-stub')).not.toBeNull())

    await session.replaceBackgroundLayerImage('main', new File(['image'], 'studio.png', { type: 'image/png' }))
    await nextTick()
    expect(root.querySelector<HTMLImageElement>('.bg-main')?.src).toContain('blob:custom-main')
    expect(root.querySelector('.bg-custom')).toBeNull()

    session.resetBackgroundLayerImage('main')
    await nextTick()
    expect(root.querySelector<HTMLImageElement>('.bg-main')?.src).toContain('bg-1')
    app.unmount()
  })

  it('renders the single background only while its session switch is enabled', async () => {
    sourceMocks.load.mockResolvedValue({
      document: { source: { kind: 'builtin', displayName: '内置地图' } },
      warnings: []
    })
    const session = useMapVisualSettings()
    session.resetVisualSession()
    const root = document.createElement('div')
    const app = createApp(HomeView)
    app.mount(root)
    await vi.waitFor(() => expect(root.querySelector('.map-stub')).not.toBeNull())

    expect(root.querySelector('.bg-main')).not.toBeNull()
    expect(root.querySelector('.bg-terrain')).toBeNull()

    session.setBackgroundLayerVisibility('main', false)
    await nextTick()
    expect(root.querySelector('.bg-main')).toBeNull()

    session.setBackgroundLayerVisibility('main', true)
    await nextTick()
    expect(root.querySelector('.bg-main')).not.toBeNull()

    app.unmount()
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
    expect(root.querySelector('.authoring-panel-stub')?.getAttribute('data-initial-source')).toBe('custom.geojson')
    expect(sourceMocks.load).toHaveBeenCalledTimes(1)
    expect(root.querySelectorAll('.home > *')).toHaveLength(3)
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

  it('把面板的稳定分块 focus 作为受控 hover 传给地图', async () => {
    sourceMocks.load.mockResolvedValue({
      document: { source: { kind: 'geojson', displayName: 'map.geojson' } },
      warnings: []
    })
    const root = document.createElement('div')
    const app = createApp(HomeView)
    app.mount(root)
    await vi.waitFor(() => expect(root.querySelector('.map-stub')).not.toBeNull())

    root.querySelector<HTMLButtonElement>('.focus-stub-region')!.click()
    await nextTick()
    expect(root.querySelector('.map-stub')?.getAttribute('data-focus')).toBe('区域 A')
    app.unmount()
  })
})
