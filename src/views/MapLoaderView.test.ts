// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createApp, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sourceMocks = vi.hoisted(() => ({
  activate: vi.fn(),
  updateVisualization: vi.fn(),
  resetToBuiltin: vi.fn()
}))
const routerMocks = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('@/components/map/mapSource', () => ({ activeMapSource: sourceMocks }))
vi.mock('vue-router', () => ({ useRouter: () => routerMocks }))

import MapLoaderView from './MapLoaderView.vue'
import { useMapVisualSettings } from '@/composables/useMapVisualSettings'
import {
  composeMapVisualization,
  prepareGeoJsonMapPackage,
  type MapVisualizationDraft
} from '@/components/map/mapDocument'

function fixture(name: string): string {
  return readFileSync(resolve(process.cwd(), 'src/components/map/__fixtures__', name), 'utf8')
}

function chooseFile(input: HTMLInputElement, file: File): void {
  Object.defineProperty(input, 'files', { configurable: true, value: [file] })
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

function enter(input: HTMLInputElement, value: string): void {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function regionRow(root: HTMLElement, key: string): HTMLElement {
  const row = [...root.querySelectorAll<HTMLElement>('[data-region-row]')]
    .find((candidate) => candidate.dataset.regionKey === key)
  if (!row) throw new Error(`Missing editor row for ${key}`)
  return row
}

async function mountView(props: Record<string, unknown> = {}) {
  const root = document.createElement('div')
  document.body.append(root)
  const app = createApp(MapLoaderView, {
    initialLoad: { document: {}, warnings: [] },
    ...props
  })
  app.mount(root)
  await nextTick()
  return { app, root }
}

beforeEach(() => {
  useMapVisualSettings().resetVisualSession()
  sourceMocks.activate.mockImplementation(async (prepared) => prepared.document)
  sourceMocks.updateVisualization.mockImplementation((prepared, visualization) =>
    composeMapVisualization(prepared.document, visualization)
  )
  sourceMocks.resetToBuiltin.mockResolvedValue({})
})

afterEach(() => {
  useMapVisualSettings().resetVisualSession()
  Object.values(sourceMocks).forEach((mock) => mock.mockReset())
  routerMocks.push.mockReset()
  document.body.replaceChildren()
})

describe('MapLoaderView', () => {
  it('作为首页右侧创作面板呈现且不创建第二层页面背景', async () => {
    const { app, root } = await mountView()
    expect(root.firstElementChild?.tagName).toBe('ASIDE')
    expect(root.firstElementChild?.getAttribute('aria-label')).toBe('GeoJSON 地图创作面板')
    expect(root.querySelector('.map-loader__background')).toBeNull()
    expect(root.querySelectorAll('.map-loader__card')).toHaveLength(1)
    app.unmount()
  })

  it('可收起右侧栏并保留一个可访问的展开入口', async () => {
    const { app, root } = await mountView()
    const session = useMapVisualSettings()
    const aside = root.querySelector<HTMLElement>('.map-loader')!
    const toggle = root.querySelector<HTMLButtonElement>('[data-action="toggle-sidebar"]')!
    const card = root.querySelector<HTMLElement>('.map-loader__card')!

    expect(toggle.getAttribute('aria-label')).toBe('收起右侧栏')
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    toggle.click()
    await nextTick()
    expect(session.sidebarCollapsed.value).toBe(true)
    expect(aside.classList.contains('is-collapsed')).toBe(true)
    expect(card.style.display).toBe('none')
    expect(toggle.getAttribute('aria-label')).toBe('展开右侧栏')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')

    toggle.click()
    await nextTick()
    expect(session.sidebarCollapsed.value).toBe(false)
    expect(aside.classList.contains('is-collapsed')).toBe(false)
    expect(card.style.display).not.toBe('none')
    app.unmount()
  })

  it('在同一右侧栏切换数据与视觉功能时保留区域编辑草稿和焦点', async () => {
    const onAuthoringFocus = vi.fn()
    const { app, root } = await mountView({ onAuthoringFocus })
    chooseFile(
      root.querySelector<HTMLInputElement>('#geometry-file')!,
      new File([fixture('valid-mixed.geojson')], 'valid-mixed.geojson')
    )
    await vi.waitFor(() => expect(root.querySelectorAll('[data-region-row]')).toHaveLength(3))

    const row = regionRow(root, '区域 A')
    row.querySelector<HTMLInputElement>('[data-field="enabled"]')!.click()
    enter(row.querySelector<HTMLInputElement>('[data-field="primary"]')!, '41')
    row.querySelector<HTMLInputElement>('[data-field="primary"]')!
      .dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    await nextTick()

    root.querySelector<HTMLButtonElement>('[data-workspace-mode="visual"]')!.click()
    await nextTick()
    expect(root.querySelector('[data-workspace-page="visual"]')).not.toBeNull()
    expect(root.textContent).toContain('构图与视角')
    expect(root.querySelectorAll('canvas')).toHaveLength(0)

    root.querySelector<HTMLButtonElement>('[data-workspace-mode="data"]')!.click()
    await nextTick()
    const restored = regionRow(root, '区域 A')
    expect(restored.dataset.dirty).toBe('true')
    expect(restored.querySelector<HTMLInputElement>('[data-field="primary"]')?.value).toBe('41')
    expect(onAuthoringFocus).toHaveBeenCalledWith('区域 A')
    app.unmount()
  })

  it('有效 GeoJSON 校验后直接激活并把新文档交给同页地图', async () => {
    const onMapActivated = vi.fn()
    const { app, root } = await mountView({ onMapActivated })

    chooseFile(
      root.querySelector<HTMLInputElement>('#geometry-file')!,
      new File([fixture('valid-mixed.geojson')], 'valid-mixed.geojson')
    )

    await vi.waitFor(() => expect(sourceMocks.activate).toHaveBeenCalledTimes(1))
    const [nextPrepared, visualization] = sourceMocks.activate.mock.calls[0]
    expect(nextPrepared.document.geometry.regions).toHaveLength(3)
    expect(visualization).toBeUndefined()
    expect(onMapActivated).toHaveBeenCalledWith(nextPrepared.document)
    expect(root.querySelectorAll('[data-region-row]')).toHaveLength(3)
    expect(root.querySelector('[data-action="apply"]')).toBeNull()
    expect(routerMocks.push).not.toHaveBeenCalled()
    app.unmount()
  })

  it('名称字段切换只有在几何激活成功后才替换当前分块会话', async () => {
    const { app, root } = await mountView()
    chooseFile(
      root.querySelector<HTMLInputElement>('#geometry-file')!,
      new File([fixture('valid-mixed.geojson')], 'valid-mixed.geojson')
    )
    await vi.waitFor(() => expect(sourceMocks.activate).toHaveBeenCalledTimes(1))
    const select = root.querySelector<HTMLSelectElement>('#name-property')!
    expect(select.value).toBe('name')

    sourceMocks.activate.mockRejectedValueOnce(new Error('disk full'))
    select.value = 'code'
    select.dispatchEvent(new Event('change', { bubbles: true }))

    await vi.waitFor(() => expect(root.textContent).toContain('disk full'))
    expect(select.value).toBe('name')
    expect([...root.querySelectorAll<HTMLElement>('[data-region-row]')]
      .map((row) => row.dataset.regionKey)).toEqual(['区域 A', '区域 B', '区域 C'])

    select.value = 'code'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    await vi.waitFor(() => {
      expect(sourceMocks.activate).toHaveBeenCalledTimes(3)
      expect([...root.querySelectorAll<HTMLElement>('[data-region-row]')]
        .map((row) => row.dataset.regionKey)).toEqual(['A', 'B', 'C'])
    })
    expect(select.value).toBe('code')
    app.unmount()
  })

  it('列出每个分块并可手动配置展示名、启用状态与两项指标', async () => {
    const { app, root } = await mountView()
    chooseFile(
      root.querySelector<HTMLInputElement>('#geometry-file')!,
      new File([fixture('valid-mixed.geojson')], 'valid-mixed.geojson')
    )

    await vi.waitFor(() => expect(root.querySelectorAll('[data-region-row]')).toHaveLength(3))
    expect(root.querySelectorAll('[data-original-key]')).toHaveLength(3)
    const row = regionRow(root, '区域 A')
    expect(row.querySelector('[data-original-key]')?.textContent).toContain('区域 A')
    expect(row.querySelector<HTMLInputElement>('[data-field="display-name"]')?.value).toBe('区域 A')
    expect(row.querySelector<HTMLInputElement>('[data-field="enabled"]')?.checked).toBe(false)

    row.querySelector<HTMLInputElement>('[data-field="enabled"]')!.click()
    await nextTick()
    expect(row.dataset.dirty).toBe('true')
    expect(sourceMocks.updateVisualization).not.toHaveBeenCalled()

    enter(root.querySelector<HTMLInputElement>('#primary-label')!, '扶持企业')
    enter(root.querySelector<HTMLInputElement>('#primary-unit')!, '家')
    enter(root.querySelector<HTMLInputElement>('#secondary-label')!, '服务资源')
    enter(root.querySelector<HTMLInputElement>('#secondary-unit')!, '项')
    enter(row.querySelector<HTMLInputElement>('[data-field="display-name"]')!, '创新一区')
    enter(row.querySelector<HTMLInputElement>('[data-field="primary"]')!, '120')
    enter(row.querySelector<HTMLInputElement>('[data-field="secondary"]')!, '45.6')

    await nextTick()
    expect(sourceMocks.activate).toHaveBeenCalledTimes(1)
    expect(sourceMocks.activate.mock.calls[0][1]).toBeUndefined()
    expect(row.querySelector<HTMLInputElement>('[data-field="display-name"]')?.value).toBe('创新一区')
    expect(row.querySelector<HTMLInputElement>('[data-field="primary"]')?.value).toBe('120')
    expect(sourceMocks.updateVisualization).not.toHaveBeenCalled()

    row.querySelector<HTMLButtonElement>('[data-action="update-region"]')!.click()
    await vi.waitFor(() => expect(sourceMocks.updateVisualization).toHaveBeenCalledTimes(1))
    const [, committedVisualization] = sourceMocks.updateVisualization.mock.calls[0]
    expect((committedVisualization as MapVisualizationDraft).regions.find((item) => item.regionKey === '区域 A'))
      .toEqual({
        regionKey: '区域 A',
        displayName: '创新一区',
        enabled: true,
        primary: 120,
        secondary: 45.6
      })
    expect(row.dataset.dirty).toBeUndefined()
    expect(routerMocks.push).not.toHaveBeenCalled()
    app.unmount()
  })

  it('指标更新与全部更新各自原子发布，非法草稿不改变已提交地图', async () => {
    const { app, root } = await mountView()
    chooseFile(
      root.querySelector<HTMLInputElement>('#geometry-file')!,
      new File([fixture('valid-mixed.geojson')], 'valid-mixed.geojson')
    )
    await vi.waitFor(() => expect(root.querySelectorAll('[data-region-row]')).toHaveLength(3))

    enter(root.querySelector<HTMLInputElement>('#primary-label')!, '入驻团队')
    enter(root.querySelector<HTMLInputElement>('#primary-unit')!, '家')
    enter(root.querySelector<HTMLInputElement>('#secondary-label')!, '导师服务')
    enter(root.querySelector<HTMLInputElement>('#secondary-unit')!, '次')
    expect(sourceMocks.updateVisualization).not.toHaveBeenCalled()
    root.querySelector<HTMLButtonElement>('[data-action="update-metrics"]')!.click()
    await vi.waitFor(() => expect(sourceMocks.updateVisualization).toHaveBeenCalledTimes(1))

    const regionA = regionRow(root, '区域 A')
    regionA.querySelector<HTMLInputElement>('[data-field="enabled"]')!.click()
    enter(regionA.querySelector<HTMLInputElement>('[data-field="primary"]')!, '12')
    enter(regionA.querySelector<HTMLInputElement>('[data-field="secondary"]')!, '')
    root.querySelector<HTMLButtonElement>('[data-action="update-all"]')!.click()
    await nextTick()
    expect(sourceMocks.updateVisualization).toHaveBeenCalledTimes(1)
    expect(regionA.querySelector('[role="alert"]')?.textContent).toContain('区域 A')

    enter(regionA.querySelector<HTMLInputElement>('[data-field="secondary"]')!, '3')
    root.querySelector<HTMLButtonElement>('[data-action="update-all"]')!.click()
    await vi.waitFor(() => expect(sourceMocks.updateVisualization).toHaveBeenCalledTimes(2))
    const [, visualization] = sourceMocks.updateVisualization.mock.calls[1]
    expect((visualization as MapVisualizationDraft).labels).toEqual({
      primary: { label: '入驻团队', unit: '家' },
      secondary: { label: '导师服务', unit: '次' }
    })
    expect((visualization as MapVisualizationDraft).regions[0]).toMatchObject({
      regionKey: '区域 A', enabled: true, primary: 12, secondary: 3
    })
    app.unmount()
  })

  it('任意分块行控件 focus 都发布稳定 key，离开该行才清除', async () => {
    const onAuthoringFocus = vi.fn()
    const { app, root } = await mountView({ onAuthoringFocus })
    chooseFile(
      root.querySelector<HTMLInputElement>('#geometry-file')!,
      new File([fixture('valid-mixed.geojson')], 'valid-mixed.geojson')
    )
    await vi.waitFor(() => expect(root.querySelectorAll('[data-region-row]')).toHaveLength(3))
    onAuthoringFocus.mockClear()
    const row = regionRow(root, '区域 A')
    const nameInput = row.querySelector<HTMLInputElement>('[data-field="display-name"]')!
    const updateButton = row.querySelector<HTMLButtonElement>('[data-action="update-region"]')!

    nameInput.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    expect(onAuthoringFocus).toHaveBeenLastCalledWith('区域 A')
    row.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: updateButton }))
    expect(onAuthoringFocus).not.toHaveBeenCalledWith(null)
    row.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: null }))
    expect(onAuthoringFocus).toHaveBeenLastCalledWith(null)
    app.unmount()
  })

  it('返回加载页时恢复同一几何的当前页面草稿', async () => {
    const prepared = prepareGeoJsonMapPackage({
      geometryText: fixture('valid-mixed.geojson'),
      geometryFileName: 'valid-mixed.geojson',
      nameProperty: 'name'
    })
    const visualization: MapVisualizationDraft = {
      labels: {
        primary: { label: '孵化项目', unit: '个' },
        secondary: { label: '导师服务', unit: '次' }
      },
      regions: prepared.visualization.regions.map((row, index) => index === 0
        ? { ...row, displayName: '创新一区', enabled: true, primary: 12, secondary: 3 }
        : row)
    }
    const initialLoad = {
      document: prepared.document,
      warnings: [],
      custom: { prepared, visualization }
    }

    const { app, root } = await mountView({ initialLoad })
    await vi.waitFor(() => expect(root.querySelectorAll('[data-region-row]')).toHaveLength(3))
    const row = regionRow(root, '区域 A')
    expect(root.querySelector<HTMLInputElement>('#primary-label')?.value).toBe('孵化项目')
    expect(row.querySelector<HTMLInputElement>('[data-field="display-name"]')?.value).toBe('创新一区')
    expect(row.querySelector<HTMLInputElement>('[data-field="enabled"]')?.checked).toBe(true)
    expect(row.querySelector<HTMLInputElement>('[data-field="primary"]')?.value).toBe('12')
    expect(root.querySelector('[data-action="apply"]')).toBeNull()
    app.unmount()
  })

  it('上传 GeoJSON 后直接激活，可选业务数据只预填草稿', async () => {
    const { app, root } = await mountView()
    expect(root.querySelector('[data-action="apply"]')).toBeNull()
    expect(root.querySelector('canvas')).toBeNull()

    chooseFile(
      root.querySelector<HTMLInputElement>('#geometry-file')!,
      new File([fixture('valid-mixed.geojson')], 'valid-mixed.geojson', { type: 'application/geo+json' })
    )
    await vi.waitFor(() => expect(root.querySelector<HTMLSelectElement>('#name-property')?.value).toBe('name'))
    chooseFile(
      root.querySelector<HTMLInputElement>('#metrics-file')!,
      new File([fixture('valid-metrics.json')], 'valid-metrics.json', { type: 'application/json' })
    )

    await vi.waitFor(() => {
      expect(root.querySelector('[data-summary="metrics"]')?.textContent).toContain('匹配 2')
    })
    expect(root.querySelector('[data-summary="geometry"]')?.textContent).toContain('3 个区域')
    expect(root.querySelector('[data-summary="geometry"]')?.textContent).toContain('名称字段 name')
    expect(root.querySelector('[data-summary="metrics"]')?.textContent).toContain('匹配 2')
    expect(root.querySelector('[data-summary="metrics"]')?.textContent).toContain('缺失 1')
    expect(root.querySelector('[data-summary="metrics"]')?.textContent).toContain('多余 1')
    expect(root.querySelector('[data-prefill="matched"]')?.textContent).toContain('区域 A、区域 B')
    expect(root.querySelector('[data-prefill="missing"]')?.textContent).toContain('区域 C')
    expect(root.querySelector('[data-prefill="extra"]')?.textContent).toContain('区域 D')

    const regionA = regionRow(root, '区域 A')
    expect(regionA.querySelector<HTMLInputElement>('[data-field="enabled"]')?.checked).toBe(true)
    expect(regionA.querySelector<HTMLInputElement>('[data-field="primary"]')?.value).toBe('120')
    enter(regionA.querySelector<HTMLInputElement>('[data-field="display-name"]')!, '手工修正 A')
    enter(regionA.querySelector<HTMLInputElement>('[data-field="primary"]')!, '121')

    await vi.waitFor(() => expect(sourceMocks.activate).toHaveBeenCalledTimes(1))
    expect(sourceMocks.updateVisualization).not.toHaveBeenCalled()
    const [prepared, visualization] = sourceMocks.activate.mock.calls[0]
    expect(prepared.document.geometry.regions).toHaveLength(3)
    expect(prepared.persisted).not.toHaveProperty('metricsText')
    expect(prepared.document.metrics.size).toBe(0)
    expect(visualization).toBeUndefined()
    expect(regionA.querySelector<HTMLInputElement>('[data-field="display-name"]')?.value).toBe('手工修正 A')
    expect(regionA.querySelector<HTMLInputElement>('[data-field="primary"]')?.value).toBe('121')
    expect(routerMocks.push).not.toHaveBeenCalled()
    app.unmount()
  })

  it('新业务文件只在校验通过后替换预填草稿，失败时保留当前编辑值', async () => {
    const { app, root } = await mountView()
    chooseFile(
      root.querySelector<HTMLInputElement>('#geometry-file')!,
      new File([fixture('valid-mixed.geojson')], 'valid-mixed.geojson')
    )
    await vi.waitFor(() => expect(root.querySelectorAll('[data-region-row]')).toHaveLength(3))
    chooseFile(
      root.querySelector<HTMLInputElement>('#metrics-file')!,
      new File([fixture('valid-metrics.json')], 'valid-metrics.json')
    )
    await vi.waitFor(() => expect(regionRow(root, '区域 A')
      .querySelector<HTMLInputElement>('[data-field="primary"]')?.value).toBe('120'))
    enter(regionRow(root, '区域 A').querySelector<HTMLInputElement>('[data-field="display-name"]')!, '保留编辑名')

    let resolveInvalid!: (text: string) => void
    const invalidText = new Promise<string>((resolve) => { resolveInvalid = resolve })
    chooseFile(
      root.querySelector<HTMLInputElement>('#metrics-file')!,
      { name: 'new-invalid.json', text: () => invalidText } as File
    )
    await nextTick()
    expect(root.querySelector<HTMLInputElement>('#metrics-file')!.disabled).toBe(true)
    expect(regionRow(root, '区域 A')
      .querySelector<HTMLInputElement>('[data-field="display-name"]')?.value).toBe('保留编辑名')
    resolveInvalid('{')
    await vi.waitFor(() => expect(root.textContent).toContain('new-invalid.json'))
    expect(root.querySelectorAll('[data-region-row]')).toHaveLength(3)
    expect(regionRow(root, '区域 A')
      .querySelector<HTMLInputElement>('[data-field="display-name"]')?.value).toBe('保留编辑名')
    enter(regionRow(root, '区域 A').querySelector<HTMLInputElement>('[data-field="display-name"]')!, '错误后继续编辑')
    await nextTick()
    expect(root.textContent).toContain('new-invalid.json')
    expect(root.querySelector<HTMLInputElement>('#metrics-file')!.disabled).toBe(false)

    const replacement = JSON.stringify({
      version: 1,
      primaryMetric: { label: '新主指标', unit: '个' },
      secondaryMetric: { label: '新次指标', unit: '次' },
      regions: [{ name: '区域 B', primary: 9, secondary: 2 }]
    })
    chooseFile(
      root.querySelector<HTMLInputElement>('#metrics-file')!,
      new File([replacement], 'replacement.json')
    )
    await vi.waitFor(() => expect(root.querySelector<HTMLInputElement>('#primary-label')?.value).toBe('新主指标'))
    expect(regionRow(root, '区域 A')
      .querySelector<HTMLInputElement>('[data-field="display-name"]')?.value).toBe('区域 A')
    expect(regionRow(root, '区域 A')
      .querySelector<HTMLInputElement>('[data-field="enabled"]')?.checked).toBe(false)
    expect(regionRow(root, '区域 B')
      .querySelector<HTMLInputElement>('[data-field="primary"]')?.value).toBe('9')
    expect(root.querySelector('[data-summary="metrics"]')?.textContent).toContain('匹配 1')
    app.unmount()
  })

  it('没有唯一名称字段时不激活，并可恢复内置地图', async () => {
    const initialLoad = {
      document: {},
      warnings: [{ code: 'invalid-record', message: '已保存地图损坏，已回退内置地图' }]
    }
    const { app, root } = await mountView({ initialLoad })
    await vi.waitFor(() => expect(root.textContent).toContain('已保存地图损坏'))

    chooseFile(
      root.querySelector<HTMLInputElement>('#geometry-file')!,
      new File([fixture('duplicate-names.geojson')], 'duplicate-names.geojson')
    )
    await vi.waitFor(() => expect(root.textContent).toContain('没有可用的唯一名称字段'))
    expect(root.querySelector('[data-name-conflicts]')?.textContent).toContain('name：重复区域')
    expect(sourceMocks.activate).not.toHaveBeenCalled()

    root.querySelector<HTMLButtonElement>('[data-action="reset"]')!.click()
    await vi.waitFor(() => expect(sourceMocks.resetToBuiltin).toHaveBeenCalledTimes(1))
    expect(routerMocks.push).not.toHaveBeenCalled()
    app.unmount()
  })

  it('读取新业务文件期间禁用输入，并让无效新几何保留当前编辑会话', async () => {
    const { app, root } = await mountView()
    chooseFile(
      root.querySelector<HTMLInputElement>('#geometry-file')!,
      new File([fixture('valid-mixed.geojson')], 'valid-mixed.geojson')
    )
    await vi.waitFor(() => expect(sourceMocks.activate).toHaveBeenCalledTimes(1))

    let resolveMetrics!: (text: string) => void
    const metricsText = new Promise<string>((resolve) => { resolveMetrics = resolve })
    chooseFile(
      root.querySelector<HTMLInputElement>('#metrics-file')!,
      { name: 'slow-invalid-metrics.json', text: () => metricsText } as File
    )
    await nextTick()
    expect(root.querySelector<HTMLInputElement>('#metrics-file')!.disabled).toBe(true)
    resolveMetrics('{')
    await vi.waitFor(() => expect(root.textContent).toContain('slow-invalid-metrics.json'))
    expect(root.querySelector<HTMLInputElement>('#metrics-file')!.disabled).toBe(false)

    chooseFile(
      root.querySelector<HTMLInputElement>('#geometry-file')!,
      new File([fixture('invalid-coordinate.geojson')], 'invalid-coordinate.geojson')
    )
    await vi.waitFor(() => expect(root.textContent).toContain('invalid-coordinate.geojson'))
    expect(root.textContent).toContain('features[0]')
    expect(root.textContent).toContain('越界区域')
    expect(sourceMocks.activate).toHaveBeenCalledTimes(1)
    expect(root.querySelectorAll('[data-region-row]')).toHaveLength(3)
    app.unmount()
  })

  it('新文件意图会中止已开始的过期激活，即使新文件随后校验失败', async () => {
    const current = prepareGeoJsonMapPackage({
      geometryText: fixture('valid-mixed.geojson'),
      geometryFileName: 'current.geojson',
      nameProperty: 'name'
    })
    const initialLoad = {
      document: current.document,
      warnings: [],
      custom: { prepared: current, visualization: current.visualization }
    }
    let activationSignal: AbortSignal | undefined
    sourceMocks.activate.mockImplementationOnce(async (_prepared, _visualization, options) => {
      activationSignal = options.signal
      await new Promise<void>((_resolve, reject) => {
        activationSignal?.addEventListener('abort', () => reject(activationSignal?.reason), { once: true })
      })
      return current.document
    })
    const onMapActivated = vi.fn()
    const { app, root } = await mountView({ initialLoad, onMapActivated })
    await vi.waitFor(() => expect(root.querySelectorAll('[data-region-row]')).toHaveLength(3))

    chooseFile(
      root.querySelector<HTMLInputElement>('#geometry-file')!,
      new File([fixture('valid-mixed.geojson')], 'stale.geojson')
    )
    await vi.waitFor(() => expect(sourceMocks.activate).toHaveBeenCalledTimes(1))
    chooseFile(
      root.querySelector<HTMLInputElement>('#geometry-file')!,
      new File([fixture('invalid-coordinate.geojson')], 'invalid-newer.geojson')
    )

    await vi.waitFor(() => expect(root.textContent).toContain('invalid-newer.geojson'))
    expect(activationSignal?.aborted).toBe(true)
    expect(onMapActivated).not.toHaveBeenCalled()
    expect([...root.querySelectorAll<HTMLElement>('[data-region-row]')]
      .map((row) => row.dataset.regionKey)).toEqual(['区域 A', '区域 B', '区域 C'])
    app.unmount()
  })
})
