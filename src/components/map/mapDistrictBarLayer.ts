import * as THREE from 'three'
import type { DistrictMapItem } from '@/types'
import type { MapDistrictBarConfig } from './mapDistrictBarConfig'
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
  baseHeight: number
  delayMs: number
  hoverProgress: number
}

export interface DistrictBarLayer {
  group: THREE.Group
  byName: Map<string, DistrictBarVisual>
  range: DistrictBarRange | null
}

interface LayerState {
  depth: number
  elapsedMs: number
}

const layerStates = new WeakMap<DistrictBarLayer, LayerState>()
const disposedLayers = new WeakSet<DistrictBarLayer>()

function clampProgress(value: number): number {
  return THREE.MathUtils.clamp(Number.isFinite(value) ? value : 0, 0, 1)
}

function entranceProgress(elapsedMs: number, delayMs: number, enterMs: number): number {
  if (enterMs <= 0) return elapsedMs >= delayMs ? 1 : 0
  const progress = clampProgress((elapsedMs - delayMs) / enterMs)
  return progress * progress * (3 - 2 * progress)
}

function visualVisible(config: Readonly<MapDistrictBarConfig>, progress: number): boolean {
  return config.enabled && config.width > 0 && progress > 0
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

  if (applyAppearance) {
    visual.column.material.color.set(config.color)
    visual.column.material.emissive.set(config.color)
    visual.column.material.opacity = config.opacity
    visual.ring.material.color.set(config.color)
    visual.column.scale.x = config.width / 2
    visual.column.scale.z = config.width / 2
    visual.ring.scale.x = config.baseRingRadius
    visual.ring.scale.y = config.baseRingRadius
  }

  visual.column.scale.y = visibleHeight
  visual.column.position.z = state.depth + visibleHeight / 2 + 0.08 + config.hoverLift * hover
  visual.ring.position.z = state.depth + 0.09 + config.hoverLift * hover
  visual.column.material.emissiveIntensity = THREE.MathUtils.lerp(
    config.glowStrength,
    config.hoverEmissiveIntensity,
    hover
  )
  visual.ring.material.opacity = config.baseRingOpacity * progress
  visual.column.visible = visualVisible(config, progress)
  visual.ring.visible = config.enabled && config.baseRingRadius > 0 && visual.ring.material.opacity > 0
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
  depth: number
): DistrictBarLayer {
  const group = new THREE.Group()
  const layer: DistrictBarLayer = { group, byName: new Map(), range: null }
  layerStates.set(layer, { depth, elapsedMs: 0 })
  if (!config.enabled) return layer

  const validItems = regions.flatMap((region) => {
    const item = dataByName.get(region.name)
    return item && Number.isFinite(item.aj) && item.aj >= 0 ? [[region, item] as const] : []
  })
  if (!validItems.length) return layer

  const values = validItems.map(([, item]) => item.aj)
  const range = Object.freeze({ min: Math.min(...values), max: Math.max(...values) })
  layer.range = range

  for (const [index, [region, item]] of validItems.entries()) {
    if (layer.byName.has(region.name)) continue
    const anchor = findRegionInteriorPoint(region)
    if (!anchor) continue
    const baseHeight = mapDistrictBarHeight(
      item.aj,
      config.minHeight,
      config.maxHeight,
      config.sqrtExponent,
      range.max
    )
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, 20, 1, false),
      new THREE.MeshStandardMaterial({
        color: config.color,
        emissive: config.color,
        emissiveIntensity: config.glowStrength,
        opacity: config.opacity,
        transparent: true,
        depthWrite: false
      })
    )
    column.rotation.x = Math.PI / 2
    column.position.set(anchor[0], anchor[1], depth + 0.08)
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 1, 32),
      new THREE.MeshBasicMaterial({
        color: config.color,
        opacity: 0,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    )
    ring.position.set(anchor[0], anchor[1], depth + 0.09)
    const visual: DistrictBarVisual = {
      name: region.name,
      group,
      column,
      ring,
      baseHeight,
      delayMs: index * config.staggerMs,
      hoverProgress: 0
    }
    layer.byName.set(region.name, visual)
    group.add(column, ring)
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
  for (const visual of layer.byName.values()) updateVisual(visual, config, state, true)
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

export function setDistrictBarHoverProgress(layer: DistrictBarLayer, name: string, progress: number): void {
  const visual = layer.byName.get(name)
  if (visual) visual.hoverProgress = clampProgress(progress)
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
