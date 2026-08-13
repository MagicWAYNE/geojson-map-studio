// @vitest-environment happy-dom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createApp, nextTick } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sourceMocks = vi.hoisted(() => ({
  load: vi.fn(),
  activate: vi.fn(),
  resetToBuiltin: vi.fn()
}))
const routerMocks = vi.hoisted(() => ({ push: vi.fn() }))

vi.mock('@/components/map/mapSource', () => ({ activeMapSource: sourceMocks }))
vi.mock('vue-router', () => ({ useRouter: () => routerMocks }))

import MapLoaderView from './MapLoaderView.vue'
import {
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

async function mountView() {
  const root = document.createElement('div')
  document.body.append(root)
  const app = createApp(MapLoaderView)
  app.mount(root)
  await nextTick()
  return { app, root }
}

beforeEach(() => {
  sourceMocks.load.mockResolvedValue({ document: {}, warnings: [] })
  sourceMocks.activate.mockImplementation(async (prepared) => prepared.document)
  sourceMocks.resetToBuiltin.mockResolvedValue({})
})

afterEach(() => {
  Object.values(sourceMocks).forEach((mock) => mock.mockReset())
  routerMocks.push.mockReset()
  document.body.replaceChildren()
})

describe('MapLoaderView', () => {
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
    expect(root.querySelector<HTMLButtonElement>('[data-action="apply"]')!.disabled).toBe(true)
    expect(root.querySelector('[role="alert"]')?.textContent).toContain('区域 A')

    enter(root.querySelector<HTMLInputElement>('#primary-label')!, '扶持企业')
    enter(root.querySelector<HTMLInputElement>('#primary-unit')!, '家')
    enter(root.querySelector<HTMLInputElement>('#secondary-label')!, '服务资源')
    enter(root.querySelector<HTMLInputElement>('#secondary-unit')!, '项')
    enter(row.querySelector<HTMLInputElement>('[data-field="display-name"]')!, '创新一区')
    enter(row.querySelector<HTMLInputElement>('[data-field="primary"]')!, '120')
    enter(row.querySelector<HTMLInputElement>('[data-field="secondary"]')!, '45.6')

    await vi.waitFor(() => {
      expect(root.querySelector<HTMLButtonElement>('[data-action="apply"]')!.disabled).toBe(false)
    })
    root.querySelector<HTMLButtonElement>('[data-action="apply"]')!.click()
    await vi.waitFor(() => expect(sourceMocks.activate).toHaveBeenCalledTimes(1))
    const [prepared, visualization] = sourceMocks.activate.mock.calls[0]
    expect(prepared.document.geometry.regions).toHaveLength(3)
    expect(visualization).toMatchObject({
      labels: {
        primary: { label: '扶持企业', unit: '家' },
        secondary: { label: '服务资源', unit: '项' }
      }
    })
    expect((visualization as MapVisualizationDraft).regions.find((item) => item.regionKey === '区域 A'))
      .toEqual({
        regionKey: '区域 A',
        displayName: '创新一区',
        enabled: true,
        primary: 120,
        secondary: 45.6
      })
    expect(routerMocks.push).toHaveBeenCalledWith('/')
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
    sourceMocks.load.mockResolvedValue({
      document: prepared.document,
      warnings: [],
      custom: { prepared, visualization }
    })

    const { app, root } = await mountView()
    await vi.waitFor(() => expect(root.querySelectorAll('[data-region-row]')).toHaveLength(3))
    const row = regionRow(root, '区域 A')
    expect(root.querySelector<HTMLInputElement>('#primary-label')?.value).toBe('孵化项目')
    expect(row.querySelector<HTMLInputElement>('[data-field="display-name"]')?.value).toBe('创新一区')
    expect(row.querySelector<HTMLInputElement>('[data-field="enabled"]')?.checked).toBe(true)
    expect(row.querySelector<HTMLInputElement>('[data-field="primary"]')?.value).toBe('12')
    expect(root.querySelector<HTMLButtonElement>('[data-action="apply"]')?.disabled).toBe(false)
    app.unmount()
  })

  it('上传 GeoJSON 和可选业务数据后展示摘要并激活地图', async () => {
    const { app, root } = await mountView()
    const applyButton = root.querySelector<HTMLButtonElement>('[data-action="apply"]')!
    expect(applyButton.disabled).toBe(true)
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
    expect(applyButton.disabled).toBe(false)
    expect(root.querySelector('[data-summary="geometry"]')?.textContent).toContain('3 个区域')
    expect(root.querySelector('[data-summary="geometry"]')?.textContent).toContain('名称字段 name')
    expect(root.querySelector('[data-summary="metrics"]')?.textContent).toContain('匹配 2')
    expect(root.querySelector('[data-summary="metrics"]')?.textContent).toContain('缺失 1')
    expect(root.querySelector('[data-summary="metrics"]')?.textContent).toContain('多余 1')

    applyButton.click()
    await vi.waitFor(() => expect(sourceMocks.activate).toHaveBeenCalledTimes(1))
    const prepared = sourceMocks.activate.mock.calls[0][0]
    expect(prepared.document.geometry.regions).toHaveLength(3)
    expect(prepared.document.metrics.size).toBe(2)
    expect(routerMocks.push).toHaveBeenCalledWith('/')
    app.unmount()
  })

  it('没有唯一名称字段时阻止应用，并可恢复内置地图', async () => {
    sourceMocks.load.mockResolvedValue({
      document: {},
      warnings: [{ code: 'invalid-record', message: '已保存地图损坏，已回退内置地图' }]
    })
    const { app, root } = await mountView()
    await vi.waitFor(() => expect(root.textContent).toContain('已保存地图损坏'))

    chooseFile(
      root.querySelector<HTMLInputElement>('#geometry-file')!,
      new File([fixture('duplicate-names.geojson')], 'duplicate-names.geojson')
    )
    await vi.waitFor(() => expect(root.textContent).toContain('没有可用的唯一名称字段'))
    expect(root.querySelector('[data-name-conflicts]')?.textContent).toContain('name：重复区域')
    expect(root.querySelector<HTMLButtonElement>('[data-action="apply"]')!.disabled).toBe(true)
    expect(sourceMocks.activate).not.toHaveBeenCalled()

    root.querySelector<HTMLButtonElement>('[data-action="reset"]')!.click()
    await vi.waitFor(() => expect(sourceMocks.resetToBuiltin).toHaveBeenCalledTimes(1))
    expect(routerMocks.push).toHaveBeenCalledWith('/')
    app.unmount()
  })

  it('读取新业务文件期间立即禁用旧准备结果，并在失败时显示文件与 feature 上下文', async () => {
    const { app, root } = await mountView()
    chooseFile(
      root.querySelector<HTMLInputElement>('#geometry-file')!,
      new File([fixture('valid-mixed.geojson')], 'valid-mixed.geojson')
    )
    await vi.waitFor(() => {
      expect(root.querySelector<HTMLButtonElement>('[data-action="apply"]')!.disabled).toBe(false)
    })

    let resolveMetrics!: (text: string) => void
    const metricsText = new Promise<string>((resolve) => { resolveMetrics = resolve })
    chooseFile(
      root.querySelector<HTMLInputElement>('#metrics-file')!,
      { name: 'slow-invalid-metrics.json', text: () => metricsText } as File
    )
    await nextTick()
    expect(root.querySelector<HTMLButtonElement>('[data-action="apply"]')!.disabled).toBe(true)
    resolveMetrics('{')
    await vi.waitFor(() => expect(root.textContent).toContain('slow-invalid-metrics.json'))
    expect(root.querySelector<HTMLButtonElement>('[data-action="apply"]')!.disabled).toBe(true)

    chooseFile(
      root.querySelector<HTMLInputElement>('#geometry-file')!,
      new File([fixture('invalid-coordinate.geojson')], 'invalid-coordinate.geojson')
    )
    await vi.waitFor(() => expect(root.textContent).toContain('invalid-coordinate.geojson'))
    expect(root.textContent).toContain('features[0]')
    expect(root.textContent).toContain('越界区域')
    expect(sourceMocks.activate).not.toHaveBeenCalled()
    app.unmount()
  })
})
