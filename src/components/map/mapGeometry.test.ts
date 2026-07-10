import { describe, expect, it } from 'vitest'
import {
  classifyBoundarySegments,
  parsePathD,
  projectRegions,
  type Region
} from './mapGeometry'

const adjacent: Region[] = [
  { name: 'A', outers: [{ ring: [[0, 0], [1, 0], [1, 1], [0, 1]], holes: [] }] },
  { name: 'B', outers: [{ ring: [[1, 1], [1, 0], [2, 0], [2, 1]], holes: [] }] }
]

describe('mapGeometry', () => {
  it('解析 M/L/Z 多环路径', () => {
    expect(parsePathD('M0 0 L2 0 L2 2 L0 2 Z M.5 .5 L1 .5 L1 1 L.5 1 Z'))
      .toEqual([
        [[0, 0], [2, 0], [2, 2], [0, 2]],
        [[0.5, 0.5], [1, 0.5], [1, 1], [0.5, 1]]
      ])
  })

  it('把反向共享边归并为一条内部区界', () => {
    const result = classifyBoundarySegments(adjacent)
    expect(result.inner).toHaveLength(1)
    expect(result.outer).toHaveLength(6)
    expect(result.byRegion.get('A')).toHaveLength(4)
    expect(result.byRegion.get('B')).toHaveLength(4)
  })

  it('保留单一区块的孔洞边界', () => {
    const withHole: Region[] = [{
      name: 'A',
      outers: [{
        ring: [[0, 0], [4, 0], [4, 4], [0, 4]],
        holes: [[[1, 1], [1, 2], [2, 2], [2, 1]]]
      }]
    }]
    const result = classifyBoundarySegments(withHole)
    expect(result.outer).toHaveLength(8)
    expect(result.inner).toHaveLength(0)
  })

  it('按最长边等比投影并返回纹理映射参数', () => {
    const result = projectRegions(adjacent, 10)
    expect(result.scale).toBe(5)
    expect(result.center).toEqual([1, 0.5])
    expect(result.regions[0].outers[0].ring[0]).toEqual([-5, 2.5])
  })
})
