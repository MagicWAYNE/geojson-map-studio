import * as THREE from 'three'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import type { MapEffectConfig } from './mapEffectConfig'
import type { BoundarySegments, Segment } from './mapGeometry'

interface LayerValue {
  color: string
  width: number
  opacity: number
}

interface GlowLayer {
  line: LineSegments2
  material: LineMaterial
}

interface GlowBundleBase {
  group: THREE.Group
  materials: LineMaterial[]
  geometries: LineSegmentsGeometry[]
}

export interface StaticGlowBundle extends GlowBundleBase {
  inner: GlowLayer
  outerCore: GlowLayer
}

export interface HoverGlowBundle extends GlowBundleBase {
  core: GlowLayer
}

function positions(segments: Segment[], z: number): number[] {
  return segments.flatMap(([[x1, y1], [x2, y2]]) => [x1, y1, z, x2, y2, z])
}

function geometryFor(segments: Segment[], z: number): LineSegmentsGeometry {
  return new LineSegmentsGeometry().setPositions(positions(segments, z))
}

function layer(geometry: LineSegmentsGeometry, value: LayerValue, renderOrder: number): GlowLayer {
  const material = new LineMaterial({
    color: value.color,
    linewidth: value.width,
    opacity: value.opacity,
    transparent: true,
    worldUnits: false,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
  const line = new LineSegments2(geometry, material)
  line.frustumCulled = false
  line.renderOrder = renderOrder
  line.visible = value.width > 0 && value.opacity > 0
  return { line, material }
}

function applyLayer(target: GlowLayer, value: LayerValue): void {
  target.material.color.set(value.color)
  target.material.linewidth = value.width
  target.material.opacity = value.opacity
  target.line.visible = value.width > 0 && value.opacity > 0
}

export function createStaticGlowLayers(
  boundaries: BoundarySegments,
  config: MapEffectConfig,
  z: number
): StaticGlowBundle {
  const innerGeometry = geometryFor(boundaries.inner, z)
  const outerGeometry = geometryFor(boundaries.outer, z + 0.01)
  const inner = layer(innerGeometry, {
    color: config.base.innerColor,
    width: config.base.innerWidth,
    opacity: config.base.innerOpacity
  }, 10)
  const outerCore = layer(outerGeometry, {
    color: config.base.outerColor,
    width: config.base.outerCoreWidth,
    opacity: 0.95
  }, 13)
  const group = new THREE.Group()
  group.add(inner.line, outerCore.line)
  return {
    group,
    inner,
    outerCore,
    materials: [inner.material, outerCore.material],
    geometries: [innerGeometry, outerGeometry]
  }
}

export function createHoverGlowLayers(
  segments: Segment[],
  config: MapEffectConfig,
  z: number
): HoverGlowBundle {
  const geometry = geometryFor(segments, z)
  const core = layer(geometry, {
    color: config.hover.outlineColor,
    width: config.hover.outlineWidth,
    opacity: 0
  }, 21)
  const group = new THREE.Group()
  group.visible = false
  group.add(core.line)
  return {
    group,
    core,
    materials: [core.material],
    geometries: [geometry]
  }
}

export function applyStaticGlowConfig(bundle: StaticGlowBundle, config: MapEffectConfig): void {
  applyLayer(bundle.inner, {
    color: config.base.innerColor,
    width: config.base.innerWidth,
    opacity: config.base.innerOpacity
  })
  applyLayer(bundle.outerCore, {
    color: config.base.outerColor,
    width: config.base.outerCoreWidth,
    opacity: 0.95
  })
}

export function applyHoverGlowConfig(bundle: HoverGlowBundle, config: MapEffectConfig): void {
  bundle.core.material.color.set(config.hover.outlineColor)
  bundle.core.material.linewidth = config.hover.outlineWidth
}

export function setHoverGlowProgress(
  bundle: HoverGlowBundle,
  config: MapEffectConfig,
  progress: number
): void {
  bundle.group.visible = progress > 0.001
  bundle.core.material.opacity = progress
  bundle.core.line.visible = bundle.group.visible && config.hover.outlineWidth > 0
}

export function advanceHoverProgress(
  current: number,
  active: boolean,
  deltaMs: number,
  enterMs: number,
  leaveMs: number
): number {
  const duration = active ? enterMs : leaveMs
  if (duration <= 0) return active ? 1 : 0
  const next = current + (active ? deltaMs / duration : -deltaMs / duration)
  return THREE.MathUtils.clamp(next, 0, 1)
}

export function easeOutCubic(progress: number): number {
  const value = THREE.MathUtils.clamp(progress, 0, 1)
  return 1 - Math.pow(1 - value, 3)
}

export interface HoverVisualState {
  progress: number
  active: boolean
}

export function updateHoverVisualState<T extends HoverVisualState>(
  state: T,
  deltaMs: number,
  enterMs: number,
  leaveMs: number,
  render: (state: T, easedProgress: number) => void,
  force = false
): boolean {
  const next = advanceHoverProgress(state.progress, state.active, deltaMs, enterMs, leaveMs)
  if (!force && next === state.progress) return false
  state.progress = next
  render(state, easeOutCubic(next))
  return true
}

export function setGlowResolution(
  bundle: GlowBundleBase,
  width: number,
  height: number
): void {
  for (const material of bundle.materials) material.resolution.set(width, height)
}
