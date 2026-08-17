import { describe, expect, it } from 'vitest'
import { WEB_MERCATOR_RADIUS, projectedTextureTransform } from './mapProjectedTexture'

describe('EPSG:3857 local imagery texture transform', () => {
  it('maps plane coordinates back to the manifest extent without using image pixels', () => {
    const geometry = { scale: 10, center: [2, -1] as [number, number] }
    const minX = WEB_MERCATOR_RADIUS * 1.5
    const maxX = WEB_MERCATOR_RADIUS * 2.5
    const minY = WEB_MERCATOR_RADIUS * 0.5
    const maxY = WEB_MERCATOR_RADIUS * 1.5
    const transform = projectedTextureTransform(geometry, [minX, minY, maxX, maxY])
    const uv = (x: number, y: number) => [
      x * transform.repeat[0] + transform.offset[0],
      y * transform.repeat[1] + transform.offset[1]
    ]
    expect(uv(-5, -5)[0]).toBeCloseTo(0)
    expect(uv(5, 5)[0]).toBeCloseTo(1)
    expect(uv(-5, -5)[1]).toBeCloseTo(1)
    expect(uv(5, 5)[1]).toBeCloseTo(0)
  })

  it('rejects invalid bounds before mutating a texture', () => {
    expect(() => projectedTextureTransform({ scale: 1, center: [0, 0] }, [2, 0, 1, 1])).toThrow(/范围无效/)
  })
})
