import * as THREE from 'three'
import type { MapDistrictBarOverlayConfig } from './mapDistrictBarOverlayConfig'
import type { DistrictBarTopSnapshot } from './mapDistrictBarLayer'
import type { MapMetricFormat } from './mapDocument'

export type DistrictBarOverlayProjectionStatus =
  | 'visible'
  | 'invalid'
  | 'behind-camera'
  | 'before-near'
  | 'beyond-far'
  | 'outside-ndc'

export interface DistrictBarOverlayPoint {
  x: number
  y: number
}

export interface DistrictBarOverlayRect {
  left: number
  top: number
  width: number
  height: number
}

export interface DistrictBarOverlaySize {
  width: number
  height: number
}

export interface DistrictBarOverlayMeasuredSizes {
  badgeByName?: ReadonlyMap<string, DistrictBarOverlaySize>
  panel?: DistrictBarOverlaySize
}

export interface DistrictBarOverlayLayoutInput {
  snapshots: readonly DistrictBarTopSnapshot[]
  camera: THREE.Camera
  viewport: {
    clientWidth: number
    clientHeight: number
  }
  hoveredName: string | null
  config: Readonly<MapDistrictBarOverlayConfig>
  metricFormats?: Readonly<{ primary: MapMetricFormat; secondary: MapMetricFormat }>
  sizes?: DistrictBarOverlayMeasuredSizes
}

export interface DistrictBarBadgeOverlayLayout {
  name: string
  order: number
  projectionStatus: DistrictBarOverlayProjectionStatus
  anchor: DistrictBarOverlayPoint | null
  rect: DistrictBarOverlayRect | null
  visible: boolean
  dimmed: boolean
  text: string
  collisionShift: number
  collisionFree: boolean
}

export interface DistrictBarPanelOverlayLayout {
  name: string
  projectionStatus: DistrictBarOverlayProjectionStatus
  anchor: DistrictBarOverlayPoint
  rect: DistrictBarOverlayRect
  side: 'left' | 'right'
  viewportOverflow: boolean
  titleText: string
  caseText: string
  amountText: string
}

export interface DistrictBarOverlayLayout {
  badges: DistrictBarBadgeOverlayLayout[]
  panel: DistrictBarPanelOverlayLayout | null
}

interface Projection {
  status: DistrictBarOverlayProjectionStatus
  anchor: DistrictBarOverlayPoint | null
}

function measuredBadgeSize(
  sizes: DistrictBarOverlayMeasuredSizes | undefined,
  name: string,
  fallback: DistrictBarOverlaySize
): DistrictBarOverlaySize {
  const measured = sizes?.badgeByName?.get(name)
  return validSize(measured) ? measured : fallback
}

function measuredPanelSize(
  sizes: DistrictBarOverlayMeasuredSizes | undefined,
  fallback: DistrictBarOverlaySize
): DistrictBarOverlaySize {
  return validSize(sizes?.panel) ? sizes.panel : fallback
}

function validSize(value: DistrictBarOverlaySize | undefined): value is DistrictBarOverlaySize {
  return value !== undefined && Number.isFinite(value.width) && value.width > 0 &&
    Number.isFinite(value.height) && value.height > 0
}

function formatNumber(value: number | null, decimals: number, useGrouping: boolean): string {
  if (value === null) return '—'
  if (!Number.isFinite(value)) return '—'
  const roundedDecimals = Number.isFinite(decimals) ? Math.round(decimals) : 0
  const digits = Math.min(4, Math.max(0, roundedDecimals))
  const rounded = Number(value.toFixed(digits))
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping
  }).format(rounded === 0 ? 0 : value)
}

function formatMetricNumber(
  value: number | null,
  format: MapMetricFormat | undefined,
  fallbackDecimals: number,
  useGrouping: boolean
): string {
  const decimals = format === 'integer' ? 0 : format ? 2 : fallbackDecimals
  const text = formatNumber(value, decimals, useGrouping)
  return format === 'percentage' && text !== '—' ? `${text}%` : text
}

function clampToRange(value: number, minimum: number, maximum: number): number {
  return minimum > maximum ? minimum : Math.min(maximum, Math.max(minimum, value))
}

function cleanPixel(value: number): number {
  return Math.round(value * 1_000_000_000) / 1_000_000_000
}

function horizontallyConflicts(
  left: DistrictBarOverlayRect,
  right: DistrictBarOverlayRect,
  gap: number
): boolean {
  return left.left < right.left + right.width + gap &&
    left.left + left.width + gap > right.left
}

function project(
  worldPosition: readonly [number, number, number],
  camera: THREE.Camera,
  width: number,
  height: number
): Projection {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { status: 'invalid', anchor: null }
  }

  camera.updateWorldMatrix(true, false)
  const view = new THREE.Vector4(...worldPosition, 1).applyMatrix4(camera.matrixWorldInverse)
  const clip = view.clone().applyMatrix4(camera.projectionMatrix)
  if (![view.x, view.y, view.z, view.w, clip.x, clip.y, clip.z, clip.w].every(Number.isFinite)) {
    return { status: 'invalid', anchor: null }
  }
  if (clip.w === 0) {
    return { status: view.z >= 0 ? 'behind-camera' : 'invalid', anchor: null }
  }

  const ndcX = clip.x / clip.w
  const ndcY = clip.y / clip.w
  const anchor = {
    x: cleanPixel((ndcX + 1) / 2 * width),
    y: cleanPixel((1 - ndcY) / 2 * height)
  }
  const clipTolerance = Number.EPSILON * 8 * Math.max(1, Math.abs(clip.w))
  const ndcTolerance = Number.EPSILON * 8
  let status: DistrictBarOverlayProjectionStatus = 'visible'
  if (view.z >= 0) status = 'behind-camera'
  else if (clip.z < -clip.w - clipTolerance) status = 'before-near'
  else if (clip.z > clip.w + clipTolerance) status = 'beyond-far'
  else if (
    ndcX < -1 - ndcTolerance || ndcX > 1 + ndcTolerance ||
    ndcY < -1 - ndcTolerance || ndcY > 1 + ndcTolerance
  ) status = 'outside-ndc'

  return {
    status,
    anchor
  }
}

export function calculateDistrictBarOverlayLayout(
  input: DistrictBarOverlayLayoutInput
): DistrictBarOverlayLayout {
  const width = input.viewport.clientWidth
  const height = input.viewport.clientHeight
  const snapshots = input.snapshots
    .map((snapshot, index) => ({ snapshot, index }))
    .sort((left, right) => left.snapshot.order - right.snapshot.order || left.index - right.index)
  const projectedSnapshots = snapshots.map(({ snapshot }) => ({
    snapshot,
    projection: project(snapshot.worldPosition, input.camera, width, height)
  }))

  const badges = projectedSnapshots.map(({ snapshot, projection }) => {
    const size = measuredBadgeSize(input.sizes, snapshot.name, {
      width: input.config.badge.minWidth,
      height: input.config.badge.height
    })
    const rect = projection.anchor
      ? {
          left: projection.anchor.x - size.width / 2 + input.config.badge.offsetX,
          top: projection.anchor.y - input.config.badge.gapY - size.height + input.config.badge.offsetY,
          width: size.width,
          height: size.height
        }
      : null

    return {
      name: snapshot.name,
      order: snapshot.order,
      projectionStatus: projection.status,
      anchor: projection.anchor,
      rect,
      visible: snapshot.visible && input.config.enabled && input.config.badge.enabled &&
        projection.status === 'visible' &&
        !(input.config.badge.hideOnHover && snapshot.name === input.hoveredName),
      dimmed: input.hoveredName !== null && snapshot.name !== input.hoveredName,
      text: formatMetricNumber(
        snapshot.primary,
        input.metricFormats?.primary,
        input.config.badge.decimals,
        input.config.badge.thousandsSeparator
      ),
      collisionShift: 0,
      collisionFree: true
    }
  })

  if (input.config.collision.badgeCollisionEnabled) {
    const gap = Math.max(0, input.config.collision.badgeCollisionGap)
    const maxShift = Math.max(0, input.config.collision.badgeMaxShift)
    const placed: DistrictBarBadgeOverlayLayout[] = []
    const candidates = badges
      .filter((badge): badge is DistrictBarBadgeOverlayLayout & { rect: DistrictBarOverlayRect } =>
        badge.visible && badge.rect !== null
      )
      .sort((left, right) => {
        const topDifference = left.rect.top - right.rect.top
        if (topDifference !== 0) return topDifference
        if (left.order !== right.order) return left.order - right.order
        return left.name < right.name ? -1 : left.name > right.name ? 1 : 0
      })

    for (const badge of candidates) {
      const baseTop = badge.rect.top
      let requiredShift = 0
      for (const previous of placed) {
        if (!previous.rect || !horizontallyConflicts(badge.rect, previous.rect, gap)) continue
        requiredShift = Math.max(
          requiredShift,
          previous.rect.top + previous.rect.height + gap - baseTop
        )
      }
      requiredShift = Math.max(0, cleanPixel(requiredShift))
      const shift = Math.min(requiredShift, maxShift)
      badge.collisionShift = cleanPixel(shift)
      badge.rect.top = cleanPixel(baseTop + shift)
      badge.collisionFree = requiredShift <= maxShift + 1e-9
      placed.push(badge)
    }
  }

  let panel: DistrictBarPanelOverlayLayout | null = null
  const hovered = input.hoveredName === null
    ? undefined
    : projectedSnapshots.find(({ snapshot }) => snapshot.name === input.hoveredName)
  if (
    input.config.enabled && input.config.panel.enabled && hovered?.snapshot.visible &&
    hovered.projection.status === 'visible' && hovered.projection.anchor
  ) {
    const panelConfig = input.config.panel
    const size = measuredPanelSize(input.sizes, {
      width: panelConfig.width,
      height: panelConfig.minHeight
    })
    const anchor = hovered.projection.anchor
    const titleAssetLeft = size.width / 2 + panelConfig.titleOffsetX - panelConfig.titleAssetWidth / 2
    const titleTextLeft = titleAssetLeft + panelConfig.titleTextOffsetX
    const visualLeft = Math.min(0, titleAssetLeft, titleTextLeft)
    const visualRight = Math.max(
      size.width,
      titleAssetLeft + panelConfig.titleAssetWidth,
      titleTextLeft + panelConfig.titleAssetWidth
    )
    const visualTop = Math.min(0, panelConfig.titleOffsetY)
    const visualBottom = Math.max(size.height, panelConfig.titleOffsetY + panelConfig.titleAssetHeight)
    const minX = panelConfig.viewportPadding - visualLeft
    const maxX = width - panelConfig.viewportPadding - visualRight
    const minTop = panelConfig.viewportPadding - visualTop
    const maxTop = height - panelConfig.viewportPadding - visualBottom
    const desiredBySide = {
      right: anchor.x + panelConfig.gapX,
      left: anchor.x - panelConfig.gapX - size.width
    }
    const preferred = panelConfig.preferredSide
    const alternative = preferred === 'right' ? 'left' : 'right'
    const fits = (side: 'left' | 'right') => minX <= maxX &&
      desiredBySide[side] >= minX && desiredBySide[side] <= maxX
    let side: 'left' | 'right'
    if (fits(preferred)) side = preferred
    else if (fits(alternative)) side = alternative
    else {
      const preferredShift = Math.abs(
        clampToRange(desiredBySide[preferred], minX, maxX) - desiredBySide[preferred]
      )
      const alternativeShift = Math.abs(
        clampToRange(desiredBySide[alternative], minX, maxX) - desiredBySide[alternative]
      )
      side = alternativeShift < preferredShift ? alternative : preferred
    }

    panel = {
      name: hovered.snapshot.name,
      projectionStatus: hovered.projection.status,
      anchor,
      rect: {
        left: clampToRange(desiredBySide[side], minX, maxX),
        top: clampToRange(anchor.y + panelConfig.offsetY, minTop, maxTop),
        width: size.width,
        height: size.height
      },
      side,
      viewportOverflow: minX > maxX || minTop > maxTop,
      titleText: hovered.snapshot.displayName,
      caseText: formatMetricNumber(
        hovered.snapshot.primary,
        input.metricFormats?.primary,
        panelConfig.caseDecimals,
        panelConfig.thousandsSeparator
      ),
      amountText: formatMetricNumber(
        hovered.snapshot.secondary,
        input.metricFormats?.secondary,
        panelConfig.amountDecimals,
        panelConfig.thousandsSeparator
      )
    }
  }

  return { badges, panel }
}
