import { describe, expect, it, vi } from 'vitest'
import { prepareGeoJsonMapPackage } from './mapDocument'
import {
  createMapAuthoringSession,
  createMapAuthoringWorkspace
} from './mapAuthoringWorkspace'

function preparedMap() {
  return prepareGeoJsonMapPackage({
    geometryFileName: 'workspace.geojson',
    nameProperty: 'name',
    geometryText: JSON.stringify({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: '区域 A' },
          geometry: { type: 'Polygon', coordinates: [[[106, 29], [107, 29], [107, 30], [106, 29]]] }
        },
        {
          type: 'Feature',
          properties: { name: '区域 B' },
          geometry: { type: 'Polygon', coordinates: [[[108, 29], [109, 29], [109, 30], [108, 29]]] }
        }
      ]
    })
  })
}

describe('map authoring workspace', () => {
  it('session owns geometry loading, focus and reset intents while stale activation stays inert', async () => {
    const current = preparedMap()
    const activateGeometry = vi.fn(async (_prepared, options: { signal: AbortSignal }) => {
      await new Promise<void>((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
      })
      return current.document
    })
    const resetGeometry = vi.fn(async () => current.document)
    const session = createMapAuthoringSession({
      document: current.document,
      warnings: [],
      custom: { prepared: current, visualization: current.visualization }
    }, {
      activateGeometry,
      publishVisualization: (_prepared, _visualization, document) => document,
      resetGeometry
    })

    session.focusRegion('区域 A')
    expect(session.read().workspace?.authoringFocus).toBe('区域 A')
    const staleIntent = session.beginGeometryLoad()
    const staleLoad = session.loadGeometry(current, staleIntent)
    session.beginGeometryLoad()
    await expect(staleLoad).rejects.toMatchObject({ name: 'AbortError' })
    expect(session.read().workspace?.authoringFocus).toBe('区域 A')

    await session.reset()
    expect(resetGeometry).toHaveBeenCalledTimes(1)
    expect(session.read().workspace).toBeUndefined()
    expect(session.read().authoringFocus).toBeNull()
  })

  it('workspace owns stable authoring focus and clears it when geometry intent resets', () => {
    const prepared = preparedMap()
    const workspace = createMapAuthoringWorkspace(prepared.document, prepared.visualization)

    workspace.focusRegion('区域 A')
    expect(workspace.read().authoringFocus).toBe('区域 A')
    workspace.focusRegion(null)
    expect(workspace.read().authoringFocus).toBeNull()
    expect(() => workspace.focusRegion('不存在')).toThrow('未知地图分块')
  })

  it('编辑保持草稿，更新一个分块后才原子替换该分块的已提交可视化', () => {
    const prepared = preparedMap()
    const workspace = createMapAuthoringWorkspace(prepared.document, prepared.visualization)

    workspace.editRegion('区域 A', {
      enabled: true,
      displayName: '创新一区',
      primary: '120',
      secondary: '45.6'
    })

    const dirty = workspace.read()
    expect(dirty.document.metrics.size).toBe(0)
    expect(dirty.dirtyRegionKeys).toEqual(['区域 A'])

    const committed = workspace.commitRegion('区域 A')
    expect(committed).toMatchObject({ ok: true })
    if (!committed.ok) throw new Error(committed.error)
    expect(committed.document.metrics.get('区域 A')).toEqual({
      name: '区域 A',
      displayName: '创新一区',
      primary: 120,
      secondary: 45.6
    })
    expect(committed.visualization.regions.find((row) => row.regionKey === '区域 B')?.enabled).toBe(false)
    expect(workspace.read().dirtyRegionKeys).toEqual([])
  })

  it('非法或不完整的行更新保留已提交文档，且不阻止更新其他有效行', () => {
    const prepared = preparedMap()
    const workspace = createMapAuthoringWorkspace(prepared.document, prepared.visualization)
    const before = workspace.read().document

    workspace.editRegion('区域 A', { enabled: true, primary: '12.', secondary: '' })
    const failed = workspace.commitRegion('区域 A')
    expect(failed.ok).toBe(false)
    expect(workspace.read().document).toBe(before)
    expect(workspace.read().regionErrors['区域 A']).toContain('区域 A')
    expect(workspace.read().dirtyRegionKeys).toEqual(['区域 A'])

    workspace.editRegion('区域 B', { enabled: true, primary: '9', secondary: '2' })
    const committed = workspace.commitRegion('区域 B')
    expect(committed.ok).toBe(true)
    expect(workspace.read().document.metrics.get('区域 B')?.primary).toBe(9)
    expect(workspace.read().dirtyRegionKeys).toEqual(['区域 A'])
  })

  it('两组指标名称和单位作为一个整体更新，失败时保留上一版', () => {
    const prepared = preparedMap()
    const workspace = createMapAuthoringWorkspace(prepared.document, prepared.visualization)
    workspace.editMetric('primary', { label: '入驻团队', unit: '家' })
    workspace.editMetric('secondary', { label: '', unit: '次' })
    expect(workspace.read().dirtyMetrics).toBe(true)

    const failed = workspace.commitMetrics()
    expect(failed.ok).toBe(false)
    expect(workspace.read().committed.labels).toEqual(prepared.visualization.labels)
    expect(workspace.read().metricError).toContain('secondaryMetric.label')

    workspace.editMetric('secondary', { label: '导师服务' })
    const committed = workspace.commitMetrics()
    expect(committed.ok).toBe(true)
    expect(workspace.read().committed.labels).toEqual({
      primary: { label: '入驻团队', unit: '家' },
      secondary: { label: '导师服务', unit: '次' }
    })
    expect(workspace.read().dirtyMetrics).toBe(false)
  })

  it('关闭副指标后保留草稿并原子发布仅含主指标的地图', () => {
    const prepared = preparedMap()
    const workspace = createMapAuthoringWorkspace(prepared.document, prepared.visualization)
    workspace.editRegion('区域 A', { enabled: true, primary: '12', secondary: '3' })
    workspace.setSecondaryEnabled(false)

    const committed = workspace.commitAll()

    expect(committed.ok).toBe(true)
    if (!committed.ok) throw new Error(committed.error)
    expect(committed.document.metricLabels?.secondary).toBeNull()
    expect(committed.document.metrics.get('区域 A')).toMatchObject({
      primary: 12,
      secondary: null
    })
    expect(workspace.read().metricError).toBe('')
    expect(workspace.read().regionErrors).toEqual({})
    expect(workspace.read().editable.labels.secondary).toEqual({ label: '服务资源', unit: '项' })
    expect(workspace.read().editable.regions[0].secondary).toBe('3')
  })

  it('关闭副指标时只清除已失效的副数值错误', () => {
    const prepared = preparedMap()
    const workspace = createMapAuthoringWorkspace(prepared.document, prepared.visualization)
    workspace.editRegion('区域 A', { enabled: true, primary: '12', secondary: '' })
    workspace.editRegion('区域 B', { enabled: true, primary: '', secondary: '7' })

    expect(workspace.commitRegion('区域 A').ok).toBe(false)
    expect(workspace.commitRegion('区域 B').ok).toBe(false)
    expect(workspace.read().regionErrors['区域 A']).toContain('secondary')
    expect(workspace.read().regionErrors['区域 B']).toContain('primary')

    workspace.setSecondaryEnabled(false)

    expect(workspace.read().regionErrors['区域 A']).toBeUndefined()
    expect(workspace.read().regionErrors['区域 B']).toContain('primary')
  })

  it('全部更新先校验完整草稿，任何一行失败都不会部分提交', () => {
    const prepared = preparedMap()
    const workspace = createMapAuthoringWorkspace(prepared.document, prepared.visualization)
    const before = workspace.read().document
    workspace.editRegion('区域 A', { enabled: true, primary: '12', secondary: '3' })
    workspace.editRegion('区域 B', { enabled: true, primary: '', secondary: '7' })

    const failed = workspace.commitAll()
    expect(failed.ok).toBe(false)
    expect(workspace.read().document).toBe(before)
    expect(workspace.read().document.metrics.size).toBe(0)
    expect(workspace.read().regionErrors['区域 B']).toContain('区域 B')

    workspace.editRegion('区域 B', { primary: '20' })
    const committed = workspace.commitAll()
    expect(committed.ok).toBe(true)
    expect(workspace.read().document.metrics.get('区域 A')?.primary).toBe(12)
    expect(workspace.read().document.metrics.get('区域 B')?.primary).toBe(20)
    expect(workspace.read().dirtyRegionKeys).toEqual([])
  })

  it('业务 JSON 预填只替换可编辑草稿，手工修正后显式更新才进入地图', () => {
    const prepared = preparedMap()
    const workspace = createMapAuthoringWorkspace(prepared.document, prepared.visualization)
    const prefill = structuredClone(prepared.visualization)
    prefill.labels.primary = { label: '预填企业', unit: '家' }
    prefill.regions[0] = {
      regionKey: '区域 A', displayName: '区域 A', enabled: true, primary: 120, secondary: 45
    }

    workspace.prefill(prefill)
    expect(workspace.read().document.metrics.size).toBe(0)
    expect(workspace.read().editable.regions[0].primary).toBe('120')
    workspace.editRegion('区域 A', { primary: '121' })

    const committed = workspace.commitAll()
    expect(committed.ok).toBe(true)
    expect(workspace.read().document.metrics.get('区域 A')?.primary).toBe(121)
    expect(workspace.read().document.metricLabels?.primary.label).toBe('预填企业')
  })
})
