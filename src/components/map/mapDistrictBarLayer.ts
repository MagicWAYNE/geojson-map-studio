import * as THREE from 'three'
import type { DistrictMapItem } from '@/types'
import type { MapDistrictBarConfig } from './mapDistrictBarConfig'
import {
  calculateDistrictBarLabelLayout,
  resolveDistrictBarLabelCollisions,
  type DistrictBarLabelScreenRect,
  type DistrictBarLabelViewport
} from './mapDistrictBarLabelLayout'
import {
  createDistrictBarLabelTexture,
  districtBarLabelTextureKey,
  type DistrictBarLabelAssets
} from './mapDistrictBarLabelTexture'
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
  label: THREE.Sprite | null
  labelPosition: THREE.Vector3
  labelScreenRect: DistrictBarLabelScreenRect | null
  labelTextureKey: string
  anchor: readonly [number, number]
  baseHeight: number
  delayMs: number
  order: number
  pulseWidth: number
  hoverProgress: number
  labelHoverProgress: number
  labelHoverTarget: number
  surfaceLift: number
}

export interface DistrictBarLayer {
  group: THREE.Group
  byName: Map<string, DistrictBarVisual>
  range: DistrictBarRange | null
}

interface LayerState {
  depth: number
  elapsedMs: number
  previousElapsedMs: number
  values: Map<string, number>
  labelAssets: DistrictBarLabelAssets | null
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
  const message = `区县柱体跳过：${name}（${reason}）`
  if (cause === undefined) console.warn(message)
  else console.warn(message, cause)
}

function warnDistrictBarLabelIssue(name: string, reason: string, cause?: unknown): void {
  const key = `${name}\u0000label\u0000${reason}`
  if (warnedDistrictBarIssues.has(key)) return
  warnedDistrictBarIssues.add(key)
  const message = `区县柱体标签跳过：${name}（${reason}）`
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

function approachProgress(current: number, target: number, deltaMs: number, durationMs: number): number {
  if (current === target) return current
  if (durationMs <= 0) return target
  const step = Math.max(0, deltaMs) / durationMs
  return target > current ? Math.min(target, current + step) : Math.max(target, current - step)
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

function replaceLabelTexture(
  visual: DistrictBarVisual,
  config: Readonly<MapDistrictBarConfig>,
  state: LayerState
): void {
  if (!visual.label || !state.labelAssets) return
  const value = state.values.get(visual.name)
  if (value === undefined) return
  const data = { name: visual.name, value }
  const key = districtBarLabelTextureKey(data, config.label)
  if (key === visual.labelTextureKey) return
  try {
    const texture = createDistrictBarLabelTexture(state.labelAssets, data, config.label)
    const previous = visual.label.material.map
    visual.label.material.map = texture
    visual.label.material.needsUpdate = true
    visual.labelTextureKey = key
    previous?.dispose()
  } catch (cause) {
    warnDistrictBarLabelIssue(visual.name, `标签纹理更新失败：${failureReason(cause)}`, cause)
  }
}

function updateVisual(
  visual: DistrictBarVisual,
  config: Readonly<MapDistrictBarConfig>,
  state: LayerState,
  applyAppearance: boolean,
  deltaMs = 0
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
  const labelEnterProgress = entranceProgress(
    state.elapsedMs,
    visual.order * config.label.staggerMs,
    config.label.enterMs
  )
  const labelHoverDuration = visual.labelHoverTarget > visual.labelHoverProgress
    ? config.label.hoverEnterMs
    : config.label.hoverLeaveMs
  visual.labelHoverProgress = approachProgress(
    visual.labelHoverProgress,
    visual.labelHoverTarget,
    deltaMs,
    labelHoverDuration
  )

  if (applyAppearance) {
    visual.column.material.color.set(config.color)
    visual.column.material.emissive.set(config.color)
    visual.column.material.opacity = 1
    visual.column.material.transparent = false
    visual.column.material.depthWrite = true
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
    if (visual.label) {
      visual.label.material.depthTest = config.label.depthTest
      visual.label.material.depthWrite = false
      visual.label.material.transparent = true
      replaceLabelTexture(visual, config, state)
    }
  }

  visual.column.scale.y = visibleHeight
  visual.column.position.set(positionX, positionY, baseZ + visibleHeight / 2 + config.hoverLift * hover)
  visual.ring.position.set(positionX, positionY, state.depth + 0.09 + config.baseOffset + visual.surfaceLift * hover)
  visual.pulseRing.position.set(positionX, positionY, state.depth + 0.095 + config.baseOffset + visual.surfaceLift * hover)
  visual.labelPosition.set(
    positionX,
    positionY,
    baseZ + visibleHeight + config.hoverLift * hover
  )
  if (visual.label) {
    visual.label.position.copy(visual.labelPosition)
    const hoverBrightness = THREE.MathUtils.lerp(
      1,
      config.label.hoverBrightness,
      visual.labelHoverProgress
    )
    visual.label.material.color.setRGB(hoverBrightness, hoverBrightness, hoverBrightness)
    visual.label.material.opacity = THREE.MathUtils.lerp(
      config.label.opacity,
      config.label.hoverOpacity,
      visual.labelHoverProgress
    ) * labelEnterProgress
  }
  visual.pulseRing.scale.set(pulseRadius, pulseRadius, 1)
  visual.column.material.emissiveIntensity = THREE.MathUtils.lerp(
    config.glowStrength,
    config.hoverEmissiveIntensity,
    hover
  )
  visual.ring.material.opacity = config.baseRingOpacity * progress
  visual.pulseRing.material.opacity = pulseOpacity
  visual.column.visible = visualVisible(config, progress)
  visual.ring.visible = config.enabled && config.baseRingRadius > 0 && visual.ring.material.opacity > 0
  visual.pulseRing.visible = config.enabled && config.pulseEnabled && config.baseRingRadius > 0 && pulseOpacity > 0
  if (visual.label) {
    visual.label.visible = config.enabled
      && config.label.enabled
      && labelEnterProgress > 0
      && visual.label.material.opacity > 0
  }
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
  dataByName: ReadonlyMap<string, DistrictMapItem>,
  config: Readonly<MapDistrictBarConfig>,
  depth: number,
  labelAssets: DistrictBarLabelAssets | null = null
): DistrictBarLayer {
  const group = new THREE.Group()
  const layer: DistrictBarLayer = { group, byName: new Map(), range: null }
  const state: LayerState = {
    depth,
    elapsedMs: 0,
    previousElapsedMs: 0,
    values: new Map(),
    labelAssets: null
  }
  layerStates.set(layer, state)

  const validItems: [Region, DistrictMapItem][] = []
  for (const region of regions) {
    const item = dataByName.get(region.name)
    if (!item || !Number.isFinite(item.aj) || item.aj < 0) {
      warnDistrictBarIssue(region.name, '无效或缺失 aj')
      continue
    }
    validItems.push([region, item])
  }
  if (!validItems.length) return layer

  const values = validItems.map(([, item]) => item.aj)
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
      item.aj,
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
        label: null,
        labelPosition: new THREE.Vector3(anchor[0], anchor[1], depth + 0.08),
        labelScreenRect: null,
        labelTextureKey: '',
        anchor: [anchor[0], anchor[1]],
        baseHeight,
        delayMs: index * config.staggerMs,
        order: index,
        pulseWidth: config.pulseWidth,
        hoverProgress: 0,
        labelHoverProgress: 0,
        labelHoverTarget: 0,
        surfaceLift: 0
      }
      layer.byName.set(region.name, visual)
      state.values.set(region.name, item.aj)
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

  if (labelAssets) attachDistrictBarLabels(layer, config, labelAssets)
  applyDistrictBarConfig(layer, config)
  return layer
}

export function attachDistrictBarLabels(
  layer: DistrictBarLayer,
  config: Readonly<MapDistrictBarConfig>,
  assets: Readonly<DistrictBarLabelAssets>
): void {
  const state = layerStates.get(layer)
  if (!state || disposedLayers.has(layer)) return
  state.labelAssets = assets
  for (const visual of layer.byName.values()) {
    if (visual.label) continue
    const value = state.values.get(visual.name)
    if (value === undefined) continue
    let texture: THREE.Texture | null = null
    try {
      const data = { name: visual.name, value }
      texture = createDistrictBarLabelTexture(assets, data, config.label)
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 0,
        depthTest: config.label.depthTest,
        depthWrite: false
      })
      const label = new THREE.Sprite(material)
      label.frustumCulled = false
      label.renderOrder = 30
      label.position.copy(visual.labelPosition)
      visual.label = label
      visual.labelTextureKey = districtBarLabelTextureKey(data, config.label)
      layer.group.add(label)
      updateVisual(visual, config, state, true)
    } catch (cause) {
      texture?.dispose()
      warnDistrictBarLabelIssue(
        visual.name,
        `标签资源构造失败：${failureReason(cause)}`,
        cause
      )
    }
  }
}

export function applyDistrictBarConfig(
  layer: DistrictBarLayer,
  config: Readonly<MapDistrictBarConfig>
): void {
  const state = layerStates.get(layer)
  if (!state) return
  layer.group.visible = config.enabled
  for (const visual of layer.byName.values()) {
    const value = state.values.get(visual.name)
    if (value !== undefined && layer.range) {
      visual.baseHeight = mapDistrictBarHeight(
        value,
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
  const nextElapsedMs = Math.max(0, Number.isFinite(elapsedMs) ? elapsedMs : 0)
  state.previousElapsedMs = state.elapsedMs
  state.elapsedMs = nextElapsedMs
  const deltaMs = Math.max(0, state.elapsedMs - state.previousElapsedMs)
  for (const visual of layer.byName.values()) updateVisual(visual, config, state, false, deltaMs)
}

function calculateVisualLabelLayout(
  layer: DistrictBarLayer,
  visual: DistrictBarVisual,
  config: Readonly<MapDistrictBarConfig>,
  camera: THREE.PerspectiveCamera,
  viewport: Readonly<DistrictBarLabelViewport>,
  verticalShift = 0
): ReturnType<typeof calculateDistrictBarLabelLayout> {
  const worldPosition = visual.labelPosition.clone()
  layer.group.localToWorld(worldPosition)
  const radius = config.width / 2
  const columnEdgeX = visual.labelPosition.clone()
  columnEdgeX.x += radius
  layer.group.localToWorld(columnEdgeX)
  const columnEdgeY = visual.labelPosition.clone()
  columnEdgeY.y += radius
  layer.group.localToWorld(columnEdgeY)
  const projectedCenter = worldPosition.clone().project(camera)
  const projectedEdgeX = columnEdgeX.project(camera)
  const projectedEdgeY = columnEdgeY.project(camera)
  const columnHalfWidth = Math.hypot(
    projectedEdgeX.x - projectedCenter.x,
    projectedEdgeY.x - projectedCenter.x
  ) * viewport.width / 2
  return calculateDistrictBarLabelLayout(
    worldPosition,
    camera,
    viewport,
    config.label,
    visual.labelHoverProgress,
    verticalShift,
    columnHalfWidth
  )
}

export function updateDistrictBarLabelLayouts(
  layer: DistrictBarLayer,
  config: Readonly<MapDistrictBarConfig>,
  camera: THREE.PerspectiveCamera,
  viewport: Readonly<DistrictBarLabelViewport>
): void {
  if (viewport.width <= 0 || viewport.height <= 0) return
  layer.group.updateWorldMatrix(true, true)
  const preliminary = new Map<string, ReturnType<typeof calculateDistrictBarLabelLayout>>()
  for (const visual of layer.byName.values()) {
    preliminary.set(
      visual.name,
      calculateVisualLabelLayout(layer, visual, config, camera, viewport)
    )
  }
  const shifts = config.label.collisionEnabled
    ? resolveDistrictBarLabelCollisions(
      [...preliminary].map(([name, layout]) => ({ name, rect: layout.rect })),
      config.label.collisionGap,
      config.label.collisionMaxShift
    )
    : new Map<string, number>()

  for (const visual of layer.byName.values()) {
    const shift = shifts.get(visual.name) ?? 0
    const layout = shift > 0
      ? calculateVisualLabelLayout(layer, visual, config, camera, viewport, shift)
      : preliminary.get(visual.name)!
    visual.labelScreenRect = { ...layout.rect }
    if (!visual.label) continue
    visual.label.scale.set(layout.worldScale.x, layout.worldScale.y, 1)
    visual.label.center.copy(layout.spriteCenter)
    visual.label.visible = visual.label.visible && layout.visible
  }
}

export function getDistrictBarLabelScreenRect(
  layer: DistrictBarLayer,
  name: string
): DistrictBarLabelScreenRect | null {
  const rect = layer.byName.get(name)?.labelScreenRect
  return rect ? { ...rect } : null
}

export function setDistrictBarHoverProgress(
  layer: DistrictBarLayer,
  name: string,
  progress: number,
  surfaceLift = 0,
  active = progress > 0
): void {
  const visual = layer.byName.get(name)
  if (!visual) return
  visual.hoverProgress = clampProgress(progress)
  visual.labelHoverTarget = active ? 1 : 0
  visual.surfaceLift = Number.isFinite(surfaceLift) ? Math.max(0, surfaceLift) : 0
}

export function disposeDistrictBarLayer(layer: DistrictBarLayer): void {
  if (disposedLayers.has(layer)) return
  disposedLayers.add(layer)
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()
  layer.group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      geometries.add(object.geometry)
      const meshMaterials = Array.isArray(object.material) ? object.material : [object.material]
      for (const material of meshMaterials) materials.add(material)
    } else if (object instanceof THREE.Sprite) {
      materials.add(object.material)
      if (object.material.map) textures.add(object.material.map)
    }
  })
  for (const geometry of geometries) geometry.dispose()
  for (const texture of textures) texture.dispose()
  for (const material of materials) material.dispose()
  layer.group.clear()
  layer.byName.clear()
  layerStates.delete(layer)
}
