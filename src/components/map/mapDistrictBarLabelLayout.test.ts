import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { MAP_DISTRICT_BAR_LABEL_DEFAULTS } from './mapDistrictBarLabelConfig'
import {
  calculateDistrictBarLabelLayout,
  resolveDistrictBarLabelCollisions
} from './mapDistrictBarLabelLayout'

function cameraAt(z: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 100)
  camera.position.set(0, 0, z)
  camera.lookAt(0, 0, 0)
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
  return camera
}

describe('mapDistrictBarLabelLayout', () => {
  it('keeps the approved pixel rect constant while world scale follows camera distance', () => {
    const near = calculateDistrictBarLabelLayout(
      new THREE.Vector3(0, 0, 0), cameraAt(10), { width: 1000, height: 1000 },
      MAP_DISTRICT_BAR_LABEL_DEFAULTS, 0
    )
    const far = calculateDistrictBarLabelLayout(
      new THREE.Vector3(0, 0, 0), cameraAt(20), { width: 1000, height: 1000 },
      MAP_DISTRICT_BAR_LABEL_DEFAULTS, 0
    )

    expect(near.rect).toEqual({ left: 508, top: 482, width: 236, height: 36 })
    expect(far.rect).toEqual(near.rect)
    expect(near.worldScale.x).toBeCloseTo(4.72)
    expect(near.worldScale.y).toBeCloseTo(0.72)
    expect(far.worldScale.x).toBeCloseTo(near.worldScale.x * 2)
    expect(far.worldScale.y).toBeCloseTo(near.worldScale.y * 2)
  })

  it('anchors the scaled hover label to the right of the column and applies pixel offsets', () => {
    const config = { ...MAP_DISTRICT_BAR_LABEL_DEFAULTS, offsetX: 5, offsetY: 7 }
    const layout = calculateDistrictBarLabelLayout(
      new THREE.Vector3(0, 0, 0), cameraAt(10), { width: 1000, height: 1000 }, config, 1
    )

    expect(layout.rect.left).toBe(513)
    expect(layout.rect.top).toBeCloseTo(487.56)
    expect(layout.rect.width).toBeCloseTo(254.88)
    expect(layout.rect.height).toBeCloseTo(38.88)
    expect(layout.spriteCenter.x).toBeCloseTo(-13 / 254.88)
    expect(layout.spriteCenter.y).toBeCloseTo(0.5 + 7 / 38.88)
  })

  it('applies the configured gap after the projected column right edge', () => {
    const layout = calculateDistrictBarLabelLayout(
      new THREE.Vector3(0, 0, 0),
      cameraAt(10),
      { width: 1000, height: 1000 },
      MAP_DISTRICT_BAR_LABEL_DEFAULTS,
      0,
      0,
      35
    )

    expect(layout.rect.left).toBe(543)
    expect(layout.spriteCenter.x).toBeCloseTo(-43 / 236)
  })

  it('moves colliding labels vertically without hiding any entry', () => {
    const layouts = resolveDistrictBarLabelCollisions([
      { name: 'A', rect: { left: 100, top: 100, width: 200, height: 36 } },
      { name: 'B', rect: { left: 120, top: 120, width: 200, height: 36 } },
      { name: 'C', rect: { left: 500, top: 120, width: 200, height: 36 } }
    ], 4, 64)

    expect(layouts).toEqual(new Map([
      ['A', 0],
      ['B', 20],
      ['C', 0]
    ]))
  })
})
