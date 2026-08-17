import * as THREE from 'three'
import type { ProjectionResult } from './mapGeometry'

export const WEB_MERCATOR_RADIUS = 6_378_137

export interface ProjectedTextureTransform {
  repeat: [number, number]
  offset: [number, number]
}

/** Maps ExtrudeGeometry's plane-space top UV back into an EPSG:3857 image extent. */
export function projectedTextureTransform(
  geometry: Pick<ProjectionResult, 'scale' | 'center'>,
  projectedBounds: readonly [number, number, number, number]
): ProjectedTextureTransform {
  const [minX, minY, maxX, maxY] = projectedBounds
  if (!Number.isFinite(geometry.scale) || geometry.scale <= 0) throw new Error('地图投影缩放无效')
  if (![minX, minY, maxX, maxY].every(Number.isFinite) || minX >= maxX || minY >= maxY) {
    throw new Error('本地影像 EPSG:3857 范围无效')
  }
  const [centerX, centerY] = geometry.center
  return {
    repeat: [
      WEB_MERCATOR_RADIUS / (geometry.scale * (maxX - minX)),
      -WEB_MERCATOR_RADIUS / (geometry.scale * (maxY - minY))
    ],
    offset: [
      (WEB_MERCATOR_RADIUS * centerX - minX) / (maxX - minX),
      1 - (-WEB_MERCATOR_RADIUS * centerY - minY) / (maxY - minY)
    ]
  }
}

export function configureProjectedTexture(
  texture: THREE.Texture,
  geometry: Pick<ProjectionResult, 'scale' | 'center'>,
  projectedBounds: readonly [number, number, number, number]
): ProjectedTextureTransform {
  const transform = projectedTextureTransform(geometry, projectedBounds)
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.flipY = false
  texture.repeat.set(...transform.repeat)
  texture.offset.set(...transform.offset)
  texture.needsUpdate = true
  return transform
}
