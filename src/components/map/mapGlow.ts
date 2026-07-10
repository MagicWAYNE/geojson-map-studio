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
  outerFar: GlowLayer
  outerNear: GlowLayer
  outerCore: GlowLayer
}

export interface HoverGlowBundle extends GlowBundleBase {
  glow: GlowLayer
  core: GlowLayer
}

export function deriveStaticLayerValues(config: MapEffectConfig) {
  return {
    inner: {
      color: config.base.innerColor,
      width: config.base.innerWidth,
      opacity: config.base.innerOpacity
    },
    outerFar: {
      color: config.base.outerColor,
      width: config.base.outerGlowWidth,
      opacity: config.base.outerGlowStrength * 0.35
    },
    outerNear: {
      color: config.base.outerColor,
      width: config.base.outerGlowWidth * 0.5,
      opacity: config.base.outerGlowStrength
    },
    outerCore: {
      color: config.base.outerColor,
      width: config.base.outerCoreWidth,
      opacity: 0.95
    }
  } satisfies Record<string, LayerValue>
}

export function deriveHoverLayerValues(config: MapEffectConfig) {
  return {
    glow: {
      color: config.hover.glowColor,
      width: config.hover.glowWidth,
      opacity: config.hover.glowStrength
    },
    core: {
      color: config.hover.outlineColor,
      width: config.hover.outlineWidth,
      opacity: 1
    }
  } satisfies Record<string, LayerValue>
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
  const values = deriveStaticLayerValues(config)
  const inner = layer(innerGeometry, values.inner, 10)
  const outerFar = layer(outerGeometry, values.outerFar, 11)
  const outerNear = layer(outerGeometry, values.outerNear, 12)
  const outerCore = layer(outerGeometry, values.outerCore, 13)
  const group = new THREE.Group()
  group.add(inner.line, outerFar.line, outerNear.line, outerCore.line)
  return {
    group,
    inner,
    outerFar,
    outerNear,
    outerCore,
    materials: [inner.material, outerFar.material, outerNear.material, outerCore.material],
    geometries: [innerGeometry, outerGeometry]
  }
}

export function createHoverGlowLayers(
  segments: Segment[],
  config: MapEffectConfig,
  z: number
): HoverGlowBundle {
  const geometry = geometryFor(segments, z)
  const values = deriveHoverLayerValues(config)
  const glow = layer(geometry, { ...values.glow, opacity: 0 }, 20)
  const core = layer(geometry, { ...values.core, opacity: 0 }, 21)
  const group = new THREE.Group()
  group.visible = false
  group.add(glow.line, core.line)
  return {
    group,
    glow,
    core,
    materials: [glow.material, core.material],
    geometries: [geometry]
  }
}

export function applyStaticGlowConfig(bundle: StaticGlowBundle, config: MapEffectConfig): void {
  const values = deriveStaticLayerValues(config)
  applyLayer(bundle.inner, values.inner)
  applyLayer(bundle.outerFar, values.outerFar)
  applyLayer(bundle.outerNear, values.outerNear)
  applyLayer(bundle.outerCore, values.outerCore)
}

export function applyHoverGlowConfig(bundle: HoverGlowBundle, config: MapEffectConfig): void {
  const values = deriveHoverLayerValues(config)
  bundle.glow.material.color.set(values.glow.color)
  bundle.glow.material.linewidth = values.glow.width
  bundle.core.material.color.set(values.core.color)
  bundle.core.material.linewidth = values.core.width
}

export function setHoverGlowProgress(
  bundle: HoverGlowBundle,
  config: MapEffectConfig,
  progress: number
): void {
  const values = deriveHoverLayerValues(config)
  bundle.group.visible = progress > 0.001
  bundle.glow.material.opacity = values.glow.opacity * progress
  bundle.core.material.opacity = values.core.opacity * progress
  bundle.glow.line.visible = bundle.group.visible && values.glow.width > 0 && values.glow.opacity > 0
  bundle.core.line.visible = bundle.group.visible && values.core.width > 0
}

export function setGlowResolution(
  bundle: GlowBundleBase,
  width: number,
  height: number
): void {
  for (const material of bundle.materials) material.resolution.set(width, height)
}

export function disposeGlowBundle(bundle: GlowBundleBase): void {
  new Set(bundle.geometries).forEach((geometry) => geometry.dispose())
  new Set(bundle.materials).forEach((material) => material.dispose())
}
