import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  MAP_DISTRICT_BAR_OVERLAY_DEFAULTS,
  cloneDistrictBarOverlayConfig
} from './mapDistrictBarOverlayConfig'
import { calculateDistrictBarOverlayLayout } from './mapDistrictBarOverlayLayout'

function camera(): THREE.PerspectiveCamera {
  const value = new THREE.PerspectiveCamera(90, 2, 1, 100)
  value.position.set(0, 0, 0)
  value.lookAt(0, 0, -1)
  value.updateProjectionMatrix()
  return value
}

function orthographicCamera(): THREE.OrthographicCamera {
  const value = new THREE.OrthographicCamera(-500, 500, 250, -250, 1, 100)
  value.position.set(0, 0, 0)
  value.lookAt(0, 0, -1)
  value.updateProjectionMatrix()
  return value
}

function snapshot(
  name: string,
  worldPosition: readonly [number, number, number],
  order = 0,
  visible = true,
  caseCount = 100,
  amount = 200
) {
  return { name, caseCount, amount, order, visible, hoverProgress: 0, worldPosition }
}

function input(snapshots: ReturnType<typeof snapshot>[]) {
  return {
    snapshots,
    camera: camera(),
    viewport: { clientWidth: 1000, clientHeight: 500 },
    hoveredName: null,
    config: MAP_DISTRICT_BAR_OVERLAY_DEFAULTS
  }
}

describe('calculateDistrictBarOverlayLayout', () => {
  it('projects world-space column tops through the camera clip transform using client pixels', () => {
    const result = calculateDistrictBarOverlayLayout(input([
      snapshot('center', [0, 0, -10], 0),
      snapshot('offset', [5, 2.5, -10], 1)
    ]))

    expect(result.badges.map(({ name, projectionStatus, anchor }) => ({
      name,
      projectionStatus,
      anchor
    }))).toEqual([
      { name: 'center', projectionStatus: 'visible', anchor: { x: 500, y: 250 } },
      { name: 'offset', projectionStatus: 'visible', anchor: { x: 625, y: 187.5 } }
    ])
  })

  it('uses and refreshes a translated camera view transform without caller matrix updates', () => {
    const translatedCamera = new THREE.PerspectiveCamera(90, 2, 1, 100)
    translatedCamera.position.set(10, 0, 0)
    translatedCamera.lookAt(10, 0, -1)
    translatedCamera.updateProjectionMatrix()

    const first = calculateDistrictBarOverlayLayout({
      ...input([snapshot('first', [10, 0, -10])]),
      camera: translatedCamera
    })
    expect(first.badges[0].anchor).toEqual({ x: 500, y: 250 })

    translatedCamera.position.set(20, 0, 0)
    const afterUnflushedMove = calculateDistrictBarOverlayLayout({
      ...input([snapshot('moved', [20, 0, -10])]),
      camera: translatedCamera
    })
    expect(afterUnflushedMove.badges[0].anchor).toEqual({ x: 500, y: 250 })
  })

  it('classifies camera, WebGL clip, NDC, boundary, and invalid viewport states', () => {
    const result = calculateDistrictBarOverlayLayout(input([
      snapshot('behind', [0, 0, 1], 0),
      snapshot('near', [0, 0, -0.5], 1),
      snapshot('far', [0, 0, -101], 2),
      snapshot('outside', [21, 0, -10], 3),
      snapshot('boundary', [20, 0, -10], 4),
      snapshot('camera-plane', [0, 0, 0], 5),
      snapshot('near-boundary', [0, 0, -1], 6),
      snapshot('far-boundary', [0, 0, -100], 7)
    ]))

    expect(result.badges.map((badge) => [badge.name, badge.projectionStatus, badge.visible])).toEqual([
      ['behind', 'behind-camera', false],
      ['near', 'before-near', false],
      ['far', 'beyond-far', false],
      ['outside', 'outside-ndc', false],
      ['boundary', 'visible', true],
      ['camera-plane', 'behind-camera', false],
      ['near-boundary', 'visible', true],
      ['far-boundary', 'visible', true]
    ])

    const invalid = calculateDistrictBarOverlayLayout({
      ...input([snapshot('A', [0, 0, -10])]),
      viewport: { clientWidth: Number.NaN, clientHeight: 500 }
    })
    expect(invalid.badges[0]).toMatchObject({
      projectionStatus: 'invalid',
      anchor: null,
      rect: null,
      visible: false
    })
  })

  it('lays out measured and fallback badges and applies the complete visibility predicate', () => {
    const config = cloneDistrictBarOverlayConfig(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS)
    config.badge.hideOnHover = true
    const result = calculateDistrictBarOverlayLayout({
      ...input([
        snapshot('fallback', [0, 0, -10], 0),
        snapshot('measured', [0, 0, -10], 1),
        snapshot('hidden-snapshot', [0, 0, -10], 2, false),
        snapshot('hovered', [0, 0, -10], 3)
      ]),
      hoveredName: 'hovered',
      config,
      sizes: { badgeByName: new Map([['measured', { width: 100, height: 20 }]]) }
    })

    expect(result.badges[0]).toMatchObject({
      rect: { left: 476, top: 222, width: 48, height: 24 },
      visible: true,
      collisionShift: 0,
      collisionFree: true
    })
    expect(result.badges[1].rect).toEqual({ left: 450, top: 226, width: 100, height: 20 })
    expect(result.badges.map((badge) => badge.visible)).toEqual([true, true, false, false])

    config.collision.badgeCollisionEnabled = false
    expect(calculateDistrictBarOverlayLayout({
      ...input([
        snapshot('A', [0, 0, -10], 0),
        snapshot('B', [0, 0, -10], 1)
      ]),
      config
    }).badges.map((badge) => badge.rect?.top)).toEqual([222, 222])
  })

  it('honors both badge enable switches, literal offsets, and invalid measurement fallback', () => {
    const overlayDisabled = cloneDistrictBarOverlayConfig(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS)
    overlayDisabled.enabled = false
    expect(calculateDistrictBarOverlayLayout({
      ...input([snapshot('overlay-disabled', [0, 0, -10])]),
      config: overlayDisabled
    }).badges[0].visible).toBe(false)

    const badgeDisabled = cloneDistrictBarOverlayConfig(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS)
    badgeDisabled.badge.enabled = false
    expect(calculateDistrictBarOverlayLayout({
      ...input([snapshot('badge-disabled', [0, 0, -10])]),
      config: badgeDisabled
    }).badges[0].visible).toBe(false)

    const offsetConfig = cloneDistrictBarOverlayConfig(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS)
    offsetConfig.badge.offsetX = 7
    offsetConfig.badge.offsetY = -3
    expect(calculateDistrictBarOverlayLayout({
      ...input([snapshot('offset', [0, 0, -10])]),
      config: offsetConfig
    }).badges[0].rect).toEqual({ left: 483, top: 219, width: 48, height: 24 })

    const invalidMeasurements = calculateDistrictBarOverlayLayout({
      ...input([
        snapshot('zero-width', [0, 0, -10], 0),
        snapshot('nan-height', [0, 0, -10], 1)
      ]),
      sizes: {
        badgeByName: new Map([
          ['zero-width', { width: 0, height: 20 }],
          ['nan-height', { width: 100, height: Number.NaN }]
        ])
      }
    })
    expect(invalidMeasurements.badges.map((badge) => badge.rect)).toEqual([
      { left: 476, top: 222, width: 48, height: 24 },
      { left: 476, top: 222, width: 48, height: 24 }
    ])
  })

  it('places the hovered panel from the column anchor, flips sides, and clamps its title visual bounds', () => {
    const config = cloneDistrictBarOverlayConfig(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS)
    config.badge.offsetX = 100
    const center = calculateDistrictBarOverlayLayout({
      ...input([snapshot('center', [0, 0, -10], 0, true, 1234.5, 9876.5)]),
      hoveredName: 'center',
      config
    }).panel
    expect(center).toMatchObject({
      name: 'center',
      anchor: { x: 500, y: 250 },
      side: 'right',
      rect: { left: 526, top: 262, width: 256, height: 104 },
      viewportOverflow: false,
      titleText: 'center',
      caseText: '1235',
      amountText: '9876.50'
    })

    const rightEdge = calculateDistrictBarOverlayLayout({
      ...input([snapshot('right-edge', [14, 0, -10])]),
      hoveredName: 'right-edge',
      config
    }).panel
    expect(rightEdge?.side).toBe('left')
    expect(rightEdge?.rect.left).toBeCloseTo(568)

    const topEdge = calculateDistrictBarOverlayLayout({
      ...input([snapshot('top-edge', [0, 10, -10])]),
      hoveredName: 'top-edge',
      config
    }).panel
    expect(topEdge?.rect.top).toBe(34)
    expect(topEdge!.rect.top + config.panel.titleOffsetY).toBe(10)

    const overflow = calculateDistrictBarOverlayLayout({
      ...input([snapshot('tiny', [0, 0, -10])]),
      viewport: { clientWidth: 100, clientHeight: 50 },
      hoveredName: 'tiny',
      config
    }).panel
    expect(overflow).toMatchObject({
      side: 'right',
      rect: { left: 30, top: 34, width: 256, height: 104 },
      viewportOverflow: true
    })

    const measured = calculateDistrictBarOverlayLayout({
      ...input([snapshot('measured-panel', [0, 0, -10])]),
      hoveredName: 'measured-panel',
      config,
      sizes: { panel: { width: 300, height: 180 } }
    }).panel
    expect(measured?.rect).toEqual({ left: 526, top: 262, width: 300, height: 180 })

    const tieConfig = cloneDistrictBarOverlayConfig(config)
    Object.assign(tieConfig.panel, {
      width: 340,
      gapX: 20,
      viewportPadding: 10,
      titleOffsetX: 0,
      titleAssetWidth: 340
    })
    const tiedPanel = (preferredSide: 'left' | 'right') => {
      tieConfig.panel.preferredSide = preferredSide
      return calculateDistrictBarOverlayLayout({
        ...input([snapshot('tie', [0, 0, -10])]),
        viewport: { clientWidth: 500, clientHeight: 500 },
        hoveredName: 'tie',
        config: tieConfig
      }).panel
    }
    expect(tiedPanel('left')?.side).toBe('left')
    expect(tiedPanel('right')?.side).toBe('right')
  })

  it('uses title right and bottom protrusions in exact panel clamp bounds', () => {
    const horizontalCamera = new THREE.OrthographicCamera(0, 300, 250, -250, 1, 100)
    horizontalCamera.lookAt(0, 0, -1)
    horizontalCamera.updateProjectionMatrix()
    const horizontalConfig = cloneDistrictBarOverlayConfig(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS)
    horizontalConfig.panel.width = 100
    horizontalConfig.panel.gapX = 60
    horizontalConfig.panel.titleOffsetX = 80
    horizontalConfig.panel.titleAssetWidth = 100
    const horizontal = calculateDistrictBarOverlayLayout({
      ...input([snapshot('horizontal', [100, 0, -10])]),
      camera: horizontalCamera,
      viewport: { clientWidth: 300, clientHeight: 500 },
      hoveredName: 'horizontal',
      config: horizontalConfig
    }).panel
    expect(horizontal?.side).toBe('right')
    expect(horizontal?.rect.left).toBe(110)

    const verticalCamera = new THREE.OrthographicCamera(-500, 500, 150, -150, 1, 100)
    verticalCamera.lookAt(0, 0, -1)
    verticalCamera.updateProjectionMatrix()
    const verticalConfig = cloneDistrictBarOverlayConfig(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS)
    verticalConfig.panel.minHeight = 100
    verticalConfig.panel.titleOffsetY = 80
    verticalConfig.panel.titleAssetHeight = 80
    const vertical = calculateDistrictBarOverlayLayout({
      ...input([snapshot('vertical', [0, 0, -10])]),
      camera: verticalCamera,
      viewport: { clientWidth: 1000, clientHeight: 300 },
      hoveredName: 'vertical',
      config: verticalConfig
    }).panel
    expect(vertical?.rect.top).toBe(130)
  })

  it('greedily shifts visible colliding badges downward without hiding unresolved badges', () => {
    const config = cloneDistrictBarOverlayConfig(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS)
    config.collision.badgeCollisionEnabled = true
    config.collision.badgeCollisionGap = 4
    config.collision.badgeMaxShift = 32
    const result = calculateDistrictBarOverlayLayout({
      ...input([
        snapshot('C', [0, 81, -10], 2),
        snapshot('A', [0, 106, -10], 0),
        snapshot('B', [0, 86, -10], 1)
      ]),
      camera: orthographicCamera(),
      config
    })

    expect(result.badges.map((badge) => ({
      name: badge.name,
      top: badge.rect?.top,
      shift: badge.collisionShift,
      visible: badge.visible,
      collisionFree: badge.collisionFree
    }))).toEqual([
      { name: 'A', top: 116, shift: 0, visible: true, collisionFree: true },
      { name: 'B', top: 144, shift: 8, visible: true, collisionFree: true },
      { name: 'C', top: 172, shift: 31, visible: true, collisionFree: true }
    ])
  })

  it('preserves input order when snapshots have the same order value', () => {
    const result = calculateDistrictBarOverlayLayout(input([
      snapshot('B', [0, 0, -10], 0),
      snapshot('A', [0, 0, -10], 0)
    ]))

    expect(result.badges.map((badge) => badge.name)).toEqual(['B', 'A'])
  })

  it('formats badge numbers only through the main layout interface', () => {
    const config = cloneDistrictBarOverlayConfig(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS)
    config.badge.decimals = 2
    config.badge.thousandsSeparator = false
    const text = (value: number) => calculateDistrictBarOverlayLayout({
      ...input([snapshot('A', [0, 0, -10], 0, true, value)]),
      config
    }).badges[0].text

    expect(text(1234.5)).toBe('1234.50')
    config.badge.thousandsSeparator = true
    expect(text(1234.5)).toBe('1,234.50')
    expect(text(Number.NaN)).toBe('—')
    expect(text(-0.004)).toBe('0.00')
    config.badge.decimals = 3.6
    expect(text(1.2)).toBe('1.2000')
    config.badge.decimals = Number.POSITIVE_INFINITY
    expect(text(1234.5)).toBe('1,235')
    config.badge.thousandsSeparator = false
    config.badge.decimals = -2
    expect(text(1234.5)).toBe('1235')
    config.badge.decimals = 9
    expect(text(1234.5)).toBe('1234.5000')
  })

  it('returns a panel only for a visible projected hovered snapshot when both levels are enabled', () => {
    const config = cloneDistrictBarOverlayConfig(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS)
    const layout = (overrides: Partial<Parameters<typeof calculateDistrictBarOverlayLayout>[0]> = {}) =>
      calculateDistrictBarOverlayLayout({
        ...input([snapshot('A', [0, 0, -10])]),
        hoveredName: 'A',
        config,
        ...overrides
      })

    expect(layout().panel).not.toBeNull()
    expect(layout({ hoveredName: 'missing' }).panel).toBeNull()
    expect(layout({ snapshots: [snapshot('A', [0, 0, -10], 0, false)] }).panel).toBeNull()
    expect(layout({ snapshots: [snapshot('A', [21, 0, -10])] }).panel).toBeNull()
    config.panel.enabled = false
    expect(layout().panel).toBeNull()
    config.panel.enabled = true
    config.enabled = false
    expect(layout().panel).toBeNull()
  })
})
