import { describe, expect, it } from 'vitest'
import { createMapVisualizationDraft, prepareGeoJsonMapPackage } from './mapDocument'
import { createMemoryMapVisualizationSession } from './mapVisualizationSession'

const geometryText = JSON.stringify({
  type: 'FeatureCollection',
  features: [{
    type: 'Feature',
    properties: { name: '区域 A' },
    geometry: {
      type: 'Polygon',
      coordinates: [[[106, 29], [107, 29], [107, 30], [106, 29]]]
    }
  }]
})

describe('memory map visualization session', () => {
  it('只在当前 adapter 实例中按几何 identity 保存独立草稿副本', () => {
    const prepared = prepareGeoJsonMapPackage({
      geometryText,
      geometryFileName: 'map.geojson',
      nameProperty: 'name'
    })
    const identity = prepared.document.source
    const draft = createMapVisualizationDraft(prepared.document)
    draft.regions[0].displayName = '会话展示名'
    const session = createMemoryMapVisualizationSession()

    session.replace(identity, draft)
    draft.regions[0].displayName = '外部改写'
    const loaded = session.read(identity)
    loaded!.regions[0].displayName = '读取副本改写'

    expect(session.read(identity)?.regions[0].displayName).toBe('会话展示名')
    expect(createMemoryMapVisualizationSession().read(identity)).toBeNull()
    session.clear()
    expect(session.read(identity)).toBeNull()
  })
})
