// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import {
  classifyBoundarySegments,
  findRegionInteriorPoint,
  parsePathD,
  parseSvgRegions,
  pointInRegion,
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

  it('从 SVG 解析命名区块、孔洞和共享区界', () => {
    const regions = parseSvgRegions(`
      <svg xmlns="http://www.w3.org/2000/svg">
        <path data-name="A" d="M0 0 L4 0 L4 4 L0 4 Z M1 1 L1 2 L2 2 L2 1 Z" />
        <path data-name="B" d="M4 4 L4 0 L6 0 L6 4 Z" />
      </svg>
    `)

    expect(regions.map((region) => region.name)).toEqual(['A', 'B'])
    expect(regions[0].outers).toHaveLength(1)
    expect(regions[0].outers[0].holes).toEqual([[[1, 1], [1, 2], [2, 2], [2, 1]]])

    const boundaries = classifyBoundarySegments(regions)
    expect(boundaries.inner).toHaveLength(1)
    expect(boundaries.outer).toHaveLength(10)
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

  it('为凹多边形找到确定性的内部锚点', () => {
    const region: Region = {
      name: 'L',
      outers: [{
        ring: [[0, 0], [6, 0], [6, 2], [2, 2], [2, 6], [0, 6]],
        holes: []
      }]
    }

    const point = findRegionInteriorPoint(region)

    expect(point).not.toBeNull()
    expect(pointInRegion(point!, region)).toBe(true)
  })

  it('为包含孔洞的区块避开孔洞寻找内部锚点', () => {
    const region: Region = {
      name: '有孔',
      outers: [{
        ring: [[0, 0], [6, 0], [6, 6], [0, 6]],
        holes: [[[2, 2], [4, 2], [4, 4], [2, 4]]]
      }]
    }

    const point = findRegionInteriorPoint(region)

    expect(point).not.toBeNull()
    expect(pointInRegion(point!, region)).toBe(true)
  })

  it('优先使用所有外环按有符号面积聚合的中心', () => {
    const region: Region = {
      name: '多外环',
      outers: [
        { ring: [[0, 0], [2, 0], [2, 2], [0, 2]], holes: [] },
        { ring: [[10, 0], [16, 0], [16, 6], [10, 6]], holes: [] }
      ]
    }

    expect(findRegionInteriorPoint(region)).toEqual([11.8, 2.8])
  })
})
