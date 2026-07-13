import * as THREE from 'three'
import type { MapDistrictBarLabelConfig } from './mapDistrictBarLabelConfig'

export interface DistrictBarLabelViewport {
  width: number
  height: number
}

export interface DistrictBarLabelScreenRect {
  left: number
  top: number
  width: number
  height: number
}

export interface DistrictBarLabelLayout {
  rect: DistrictBarLabelScreenRect
  worldScale: THREE.Vector2
  spriteCenter: THREE.Vector2
  visible: boolean
}

export interface DistrictBarLabelCollisionItem {
  name: string
  rect: DistrictBarLabelScreenRect
}

function clampProgress(value: number): number {
  return THREE.MathUtils.clamp(Number.isFinite(value) ? value : 0, 0, 1)
}

function worldUnitsPerPixel(
  worldPosition: Readonly<THREE.Vector3>,
  camera: THREE.PerspectiveCamera,
  viewportHeight: number
): number {
  if (viewportHeight <= 0) return 0
  const cameraSpace = worldPosition.clone().applyMatrix4(camera.matrixWorldInverse)
  const distance = Math.max(camera.near, -cameraSpace.z)
  const visibleHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
  return visibleHeight / viewportHeight
}

export function calculateDistrictBarLabelLayout(
  worldPosition: Readonly<THREE.Vector3>,
  camera: THREE.PerspectiveCamera,
  viewport: Readonly<DistrictBarLabelViewport>,
  config: Readonly<MapDistrictBarLabelConfig>,
  hoverProgress: number,
  verticalShift = 0,
  columnHalfWidth = 0
): DistrictBarLabelLayout {
  const projected = worldPosition.clone().project(camera)
  const hoverScale = THREE.MathUtils.lerp(1, config.hoverScale, clampProgress(hoverProgress))
  const width = config.width * hoverScale
  const height = config.height * hoverScale
  const anchorX = (projected.x * 0.5 + 0.5) * viewport.width
  const anchorY = (-projected.y * 0.5 + 0.5) * viewport.height
  const horizontalOffset = Math.max(0, columnHalfWidth) + config.gapX + config.offsetX
  const verticalOffset = config.offsetY + verticalShift
  const unitsPerPixel = worldUnitsPerPixel(worldPosition, camera, viewport.height)

  return {
    rect: {
      left: anchorX + horizontalOffset,
      top: anchorY - height / 2 + verticalOffset,
      width,
      height
    },
    worldScale: new THREE.Vector2(width * unitsPerPixel, height * unitsPerPixel),
    spriteCenter: new THREE.Vector2(
      width > 0 ? -horizontalOffset / width : 0,
      height > 0 ? 0.5 + verticalOffset / height : 0.5
    ),
    visible: projected.z >= -1 && projected.z <= 1
  }
}

function overlapsHorizontally(a: DistrictBarLabelScreenRect, b: DistrictBarLabelScreenRect): boolean {
  return a.left < b.left + b.width && b.left < a.left + a.width
}

export function resolveDistrictBarLabelCollisions(
  items: readonly DistrictBarLabelCollisionItem[],
  gap: number,
  maxShift: number
): Map<string, number> {
  const shifts = new Map<string, number>()
  const placed: DistrictBarLabelCollisionItem[] = []
  const safeGap = Math.max(0, Number.isFinite(gap) ? gap : 0)
  const safeMaxShift = Math.max(0, Number.isFinite(maxShift) ? maxShift : 0)
  const sorted = items.map((item, order) => ({ item, order }))
    .sort((a, b) => a.item.rect.top - b.item.rect.top || a.order - b.order)

  for (const { item } of sorted) {
    let shift = 0
    for (const previous of placed) {
      if (!overlapsHorizontally(item.rect, previous.rect)) continue
      const required = previous.rect.top + previous.rect.height + safeGap - item.rect.top
      if (required > shift) shift = required
    }
    shift = Math.min(safeMaxShift, Math.max(0, shift))
    shifts.set(item.name, shift)
    placed.push({
      name: item.name,
      rect: { ...item.rect, top: item.rect.top + shift }
    })
  }
  return shifts
}
