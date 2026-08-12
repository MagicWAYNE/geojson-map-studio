import * as THREE from 'three'
import type { MapDistrictBarConfig } from './mapDistrictBarConfig'
import type { MapRegionMetrics } from './mapDocument'
import { findRegionInteriorPoint, type Region } from './mapGeometry'

export interface DistrictBarRange {
  min: number
  max: number
}

export interface DistrictBarVisual {
  name: string
  group: THREE.Group
  column: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>
  pulseRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>
  anchor: readonly [number, number]
  baseHeight: number
  delayMs: number
  order: number
  pulseWidth: number
  hoverProgress: number
  surfaceLift: number
}

export interface DistrictBarLayer {
  group: THREE.Group
  byName: Map<string, DistrictBarVisual>
  range: DistrictBarRange | null
}

export interface DistrictBarTopSnapshot {
  readonly name: string
  readonly primary: number
  readonly secondary: number
  readonly order: number
  readonly visible: boolean
  readonly hoverProgress: number
  readonly worldPosition: readonly [number, number, number]
}

interface LayerDatum {
  primary: number
  secondary: number
}

interface LayerState {
  depth: number
  elapsedMs: number
  dataByName: Map<string, LayerDatum>
  focusedName: string | null
}

const layerStates = new WeakMap<DistrictBarLayer, LayerState>()
const disposedLayers = new WeakSet<DistrictBarLayer>()
const warnedDistrictBarIssues = new Set<string>()

function failureReason(cause: unknown): string {
  return cause instanceof Error && cause.message ? cause.message : String(cause)
}

function warnDistrictBarIssue(name: string, reason: string, cause?: unknown): void {
  const key = `${name}\u0000${reason}`
  if (warnedDistrictBarIssues.has(key)) return
  warnedDistrictBarIssues.add(key)
  const message = `区域柱体跳过：${name}（${reason}）`
  if (cause === undefined) console.warn(message)
  else console.warn(message, cause)
}

function disposePartialVisual(
  columnGeometry: THREE.CylinderGeometry | null,
  columnMaterial: THREE.MeshStandardMaterial | null,
  ringGeometry: THREE.RingGeometry | null,
  ringMaterial: THREE.MeshBasicMaterial | null,
  pulseRingGeometry: THREE.RingGeometry | null,
  pulseRingMaterial: THREE.MeshBasicMaterial | null
): void {
  columnGeometry?.dispose()
  columnMaterial?.dispose()
  ringGeometry?.dispose()
  ringMaterial?.dispose()
  pulseRingGeometry?.dispose()
  pulseRingMaterial?.dispose()
}

function clampProgress(value: number): number {
  return THREE.MathUtils.clamp(Number.isFinite(value) ? value : 0, 0, 1)
}

function entranceProgress(elapsedMs: number, delayMs: number, enterMs: number): number {
  if (enterMs <= 0) return elapsedMs >= delayMs ? 1 : 0
  const progress = clampProgress((elapsedMs - delayMs) / enterMs)
  return progress * progress * (3 - 2 * progress)
}

function pulseProgress(elapsedMs: number, order: number, durationMs: number, staggerMs: number): number {
  const phaseMs = elapsedMs + order * staggerMs
  return (phaseMs % durationMs) / durationMs
}

function createPulseRingGeometry(width: number): THREE.RingGeometry {
  return new THREE.RingGeometry(Math.max(0.001, 1 - width), 1, 32)
}

function visualVisible(config: Readonly<MapDistrictBarConfig>, progress: number): boolean {
  return config.enabled && config.width > 0 && progress > 0
}

function sceneGraphVisible(object: THREE.Object3D): boolean {
  let current: THREE.Object3D | null = object
  while (current) {
    if (!current.visible) return false
    current = current.parent
  }
  return true
}

function updateVisual(
  visual: DistrictBarVisual,
  config: Readonly<MapDistrictBarConfig>,
  state: LayerState,
  applyAppearance: boolean
): void {
  const progress = entranceProgress(state.elapsedMs, visual.delayMs, config.enterMs)
  const hover = clampProgress(visual.hoverProgress)
  const visibleHeight = visual.baseHeight * progress
  const positionX = visual.anchor[0] + config.anchorOffsetX
  const positionY = visual.anchor[1] + config.anchorOffsetY
  const baseZ = state.depth + 0.08 + config.baseOffset
  const pulse = pulseProgress(state.elapsedMs, visual.order, config.pulseDurationMs, config.pulseStaggerMs)
  const pulseRadius = config.baseRingRadius * THREE.MathUtils.lerp(
    config.pulseOuterRadiusRatio,
    config.pulseInnerRadiusRatio,
    pulse
  )
  const pulseOpacity = THREE.MathUtils.lerp(config.pulseOuterOpacity, config.pulseInnerOpacity, pulse) * progress
  const inactiveOpacity = state.focusedName !== null && visual.name !== state.focusedName
    ? config.hoverInactiveOpacity
    : 1

  if (applyAppearance) {
    visual.column.material.color.set(config.color)
    visual.column.material.emissive.set(config.color)
    visual.ring.material.color.set(config.color)
    visual.pulseRing.material.color.set(config.pulseColor)
    if (visual.pulseWidth !== config.pulseWidth) {
      const previousGeometry = visual.pulseRing.geometry
      visual.pulseRing.geometry = createPulseRingGeometry(config.pulseWidth)
      visual.pulseWidth = config.pulseWidth
      previousGeometry.dispose()
    }
    visual.column.scale.x = config.width / 2
    visual.column.scale.z = config.width / 2
    visual.ring.scale.x = config.baseRingRadius
    visual.ring.scale.y = config.baseRingRadius
  }

  visual.column.scale.y = visibleHeight
  visual.column.position.set(positionX, positionY, baseZ + visibleHeight / 2 + config.hoverLift * hover)
  visual.ring.position.set(positionX, positionY, state.depth + 0.09 + config.baseOffset + visual.surfaceLift * hover)
  visual.pulseRing.position.set(positionX, positionY, state.depth + 0.095 + config.baseOffset + visual.surfaceLift * hover)
  visual.pulseRing.scale.set(pulseRadius, pulseRadius, 1)
  visual.column.material.emissiveIntensity = THREE.MathUtils.lerp(
    config.glowStrength,
    config.hoverEmissiveIntensity,
    hover
  )
  const transparent = inactiveOpacity < 1
  if (visual.column.material.transparent !== transparent) {
    visual.column.material.transparent = transparent
    visual.column.material.needsUpdate = true
  }
  visual.column.material.opacity = inactiveOpacity
  visual.column.material.depthWrite = !transparent
  visual.ring.material.opacity = config.baseRingOpacity * progress * inactiveOpacity
  visual.pulseRing.material.opacity = pulseOpacity * inactiveOpacity
  visual.column.visible = visualVisible(config, progress)
  visual.ring.visible = config.enabled && config.baseRingRadius > 0 && visual.ring.material.opacity > 0
  visual.pulseRing.visible = config.enabled && config.pulseEnabled && config.baseRingRadius > 0 && pulseOpacity > 0
}

export function mapDistrictBarHeight(
  value: number,
  min: number,
  max: number,
  exponent: number,
  rangeMax: number
): number {
  if (!Number.isFinite(value) || !Number.isFinite(rangeMax) || rangeMax <= 0) return min
  return min + (max - min) * Math.pow(Math.max(0, value) / rangeMax, exponent)
}

export function createDistrictBarLayer(
  regions: Region[],
  dataByName: ReadonlyMap<string, MapRegionMetrics>,
  config: Readonly<MapDistrictBarConfig>,
  depth: number
): DistrictBarLayer {
  const group = new THREE.Group()
  const layer: DistrictBarLayer = { group, byName: new Map(), range: null }
  const state: LayerState = { depth, elapsedMs: 0, dataByName: new Map(), focusedName: null }
  layerStates.set(layer, state)

  const validItems: [Region, MapRegionMetrics][] = []
  for (const region of regions) {
    const item = dataByName.get(region.name)
    if (!item) continue
    if (!Number.isFinite(item.primary) || item.primary < 0) {
      warnDistrictBarIssue(region.name, '无效 primary')
      continue
    }
    validItems.push([region, item])
  }
  if (!validItems.length) return layer

  const values = validItems.map(([, item]) => item.primary)
  const range = Object.freeze({ min: Math.min(...values), max: Math.max(...values) })
  layer.range = range

  for (const [index, [region, item]] of validItems.entries()) {
    if (layer.byName.has(region.name)) continue
    const anchor = findRegionInteriorPoint(region)
    if (!anchor) {
      warnDistrictBarIssue(region.name, '缺少安全锚点')
      continue
    }
    const baseHeight = mapDistrictBarHeight(
      item.primary,
      config.minHeight,
      config.maxHeight,
      config.sqrtExponent,
      range.max
    )
    let columnGeometry: THREE.CylinderGeometry | null = null
    let columnMaterial: THREE.MeshStandardMaterial | null = null
    let ringGeometry: THREE.RingGeometry | null = null
    let ringMaterial: THREE.MeshBasicMaterial | null = null
    let pulseGeometry: THREE.RingGeometry | null = null
    let pulseRingMaterial: THREE.MeshBasicMaterial | null = null

    try {
      columnGeometry = new THREE.CylinderGeometry(1, 1, 1, 20, 1, false)
      columnMaterial = new THREE.MeshStandardMaterial({
        color: config.color,
        emissive: config.color,
        emissiveIntensity: config.glowStrength,
        opacity: 1,
        transparent: false,
        depthWrite: true
      })
      const column = new THREE.Mesh(columnGeometry, columnMaterial)
      column.rotation.x = Math.PI / 2
      column.position.set(anchor[0], anchor[1], depth + 0.08)
      ringGeometry = new THREE.RingGeometry(0.45, 1, 32)
      ringMaterial = new THREE.MeshBasicMaterial({
        color: config.color,
        opacity: 0,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
      const ring = new THREE.Mesh(ringGeometry, ringMaterial)
      ring.position.set(anchor[0], anchor[1], depth + 0.09)
      pulseGeometry = createPulseRingGeometry(config.pulseWidth)
      pulseRingMaterial = new THREE.MeshBasicMaterial({
        color: config.pulseColor,
        opacity: 0,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
      const pulseRing = new THREE.Mesh(pulseGeometry, pulseRingMaterial)
      pulseRing.position.set(anchor[0], anchor[1], depth + 0.095)
      const visual: DistrictBarVisual = {
        name: region.name,
        group,
        column,
        ring,
        pulseRing,
        anchor: [anchor[0], anchor[1]],
        baseHeight,
        delayMs: index * config.staggerMs,
        order: index,
        pulseWidth: config.pulseWidth,
        hoverProgress: 0,
        surfaceLift: 0
      }
      layer.byName.set(region.name, visual)
      state.dataByName.set(region.name, {
        primary: item.primary,
        secondary: item.secondary
      })
      group.add(column, ring, pulseRing)
    } catch (cause) {
      disposePartialVisual(
        columnGeometry,
        columnMaterial,
        ringGeometry,
        ringMaterial,
        pulseGeometry,
        pulseRingMaterial
      )
      warnDistrictBarIssue(region.name, `资源构造失败：${failureReason(cause)}`, cause)
    }
  }

  applyDistrictBarConfig(layer, config)
  return layer
}

export function applyDistrictBarConfig(
  layer: DistrictBarLayer,
  config: Readonly<MapDistrictBarConfig>
): void {
  const state = layerStates.get(layer)
  if (!state) return
  layer.group.visible = config.enabled
  for (const visual of layer.byName.values()) {
    const datum = state.dataByName.get(visual.name)
    if (datum && layer.range) {
      visual.baseHeight = mapDistrictBarHeight(
        datum.primary,
        config.minHeight,
        config.maxHeight,
        config.sqrtExponent,
        layer.range.max
      )
    }
    updateVisual(visual, config, state, true)
  }
}

export function updateDistrictBarLayer(
  layer: DistrictBarLayer,
  config: Readonly<MapDistrictBarConfig>,
  elapsedMs: number
): void {
  const state = layerStates.get(layer)
  if (!state) return
  state.elapsedMs = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0)
  for (const visual of layer.byName.values()) updateVisual(visual, config, state, false)
}

export function setDistrictBarHoverProgress(
  layer: DistrictBarLayer,
  name: string,
  progress: number,
  surfaceLift = 0
): void {
  const visual = layer.byName.get(name)
  if (!visual) return
  visual.hoverProgress = clampProgress(progress)
  visual.surfaceLift = Number.isFinite(surfaceLift) ? Math.max(0, surfaceLift) : 0
}

export function setDistrictBarFocus(layer: DistrictBarLayer, name: string | null): void {
  const state = layerStates.get(layer)
  if (!state) return
  state.focusedName = name !== null && layer.byName.has(name) ? name : null
}

export function getDistrictBarTopSnapshots(layer: DistrictBarLayer): DistrictBarTopSnapshot[] {
  if (disposedLayers.has(layer)) return []
  const state = layerStates.get(layer)
  if (!state) return []
  layer.group.updateWorldMatrix(true, true)

  return [...layer.byName.values()]
    .sort((left, right) => left.order - right.order)
    .flatMap((visual) => {
      const datum = state.dataByName.get(visual.name)
      if (!datum) return []
      const worldTop = new THREE.Vector3(0, 0.5, 0).applyMatrix4(visual.column.matrixWorld)
      return [{
        name: visual.name,
        primary: datum.primary,
        secondary: datum.secondary,
        order: visual.order,
        visible: sceneGraphVisible(visual.column),
        hoverProgress: clampProgress(visual.hoverProgress),
        worldPosition: [worldTop.x, worldTop.y, worldTop.z] as const
      }]
    })
}

export function disposeDistrictBarLayer(layer: DistrictBarLayer): void {
  if (disposedLayers.has(layer)) return
  disposedLayers.add(layer)
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  layer.group.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    geometries.add(object.geometry)
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material]
    for (const material of meshMaterials) materials.add(material)
  })
  for (const geometry of geometries) geometry.dispose()
  for (const material of materials) material.dispose()
  layer.group.clear()
  layer.byName.clear()
  layerStates.delete(layer)
}
