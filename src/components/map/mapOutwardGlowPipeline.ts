import * as THREE from 'three'
import { MAP_EFFECT_DEFAULTS, type MapEffectConfig } from './mapEffectConfig'
import {
  computeGlowTargetMetrics,
  deriveB3GlowProfile,
  isGlowEnabled,
  type GlowTargetMetrics
} from './mapOutwardGlowProfile'
import {
  createGlowShaderResources,
  disposeGlowShaderResources,
  renderOutwardComposite,
  renderSeparableBlur
} from './mapOutwardGlowShaders'

const GLOW_TARGET_SCALE = 0.5
const HOVER_VISIBILITY_THRESHOLD = 0.001

export interface MapOutwardGlowPipeline {
  setSize(cssWidth: number, cssHeight: number, pixelRatio: number): void
  setConfig(config: MapEffectConfig): void
  setRegionProgress(source: THREE.Mesh, easedProgress: number): void
  markCameraDirty(): void
  render(mainScene: THREE.Scene, camera: THREE.Camera): void
  dispose(): void
}

interface ChannelTargets {
  mask: THREE.WebGLRenderTarget
  near: THREE.WebGLRenderTarget
  far: THREE.WebGLRenderTarget
}

interface HoverCloneState {
  clone: THREE.Mesh
  material: THREE.MeshBasicMaterial
  progress: number
}

function createTarget(): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(1, 1, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    depthBuffer: false,
    stencilBuffer: false
  })
}

function createChannelTargets(): ChannelTargets {
  return {
    mask: createTarget(),
    near: createTarget(),
    far: createTarget()
  }
}

function snapshotConfig(config: MapEffectConfig): MapEffectConfig {
  return {
    version: config.version,
    base: { ...config.base },
    hover: { ...config.hover }
  }
}

function safeProgress(value: number): number {
  return Number.isFinite(value) ? THREE.MathUtils.clamp(value, 0, 1) : 0
}

export function createMapOutwardGlowPipeline(
  renderer: THREE.WebGLRenderer,
  regionMeshes: THREE.Mesh[]
): MapOutwardGlowPipeline {
  const staticMaskScene = new THREE.Scene()
  const hoverMaskScene = new THREE.Scene()
  const staticMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff })
  const ownedMaterials: THREE.Material[] = [staticMaterial]
  const hoverStates = new Map<THREE.Mesh, HoverCloneState>()

  for (const source of regionMeshes) {
    const staticClone = new THREE.Mesh(source.geometry, staticMaterial)
    staticClone.matrixAutoUpdate = false
    staticClone.matrix.copy(source.matrixWorld)
    staticMaskScene.add(staticClone)

    const hoverMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 })
    const hoverClone = new THREE.Mesh(source.geometry, hoverMaterial)
    hoverClone.matrixAutoUpdate = false
    hoverClone.matrix.copy(source.matrixWorld)
    hoverClone.visible = false
    hoverMaskScene.add(hoverClone)
    ownedMaterials.push(hoverMaterial)
    hoverStates.set(source, { clone: hoverClone, material: hoverMaterial, progress: 0 })
  }

  const staticTargets = createChannelTargets()
  const hoverTargets = createChannelTargets()
  const pingTarget = createTarget()
  const ownedTargets = [
    staticTargets.mask,
    staticTargets.near,
    staticTargets.far,
    hoverTargets.mask,
    hoverTargets.near,
    hoverTargets.far,
    pingTarget
  ]
  const shaderResources = createGlowShaderResources()

  let config = snapshotConfig(MAP_EFFECT_DEFAULTS)
  let metrics: GlowTargetMetrics = computeGlowTargetMetrics(0, 0, 1, GLOW_TARGET_SCALE)
  let staticMaskDirty = true
  let staticBlurDirty = true
  let hoverMaskDirty = true
  let hoverBlurDirty = true
  let disposed = false

  function setAllDirty(): void {
    staticMaskDirty = true
    staticBlurDirty = true
    hoverMaskDirty = true
    hoverBlurDirty = true
  }

  function renderMask(
    scene: THREE.Scene,
    target: THREE.WebGLRenderTarget,
    camera: THREE.Camera
  ): void {
    renderer.setRenderTarget(target)
    renderer.clear()
    renderer.render(scene, camera)
  }

  function renderBlurredChannel(
    targets: ChannelTargets,
    radiusCssPx: number,
    opacity: number
  ): void {
    const profile = deriveB3GlowProfile(radiusCssPx, opacity, metrics)
    renderSeparableBlur(
      renderer,
      shaderResources,
      targets.mask.texture,
      pingTarget,
      targets.near,
      profile.nearRadiusTexels,
      2
    )
    renderSeparableBlur(
      renderer,
      shaderResources,
      targets.mask.texture,
      pingTarget,
      targets.far,
      profile.farRadiusTexels,
      4
    )
  }

  function hasVisibleHover(): boolean {
    for (const state of hoverStates.values()) {
      if (state.progress > HOVER_VISIBILITY_THRESHOLD) return true
    }
    return false
  }

  return {
    setSize(cssWidth, cssHeight, pixelRatio) {
      if (disposed) return
      const next = computeGlowTargetMetrics(
        cssWidth,
        cssHeight,
        pixelRatio,
        GLOW_TARGET_SCALE
      )
      if (next.width === metrics.width
        && next.height === metrics.height
        && next.pixelsPerCssPx === metrics.pixelsPerCssPx) return

      metrics = next
      for (const target of ownedTargets) target.setSize(metrics.width, metrics.height)
      setAllDirty()
    },

    setConfig(nextConfig) {
      if (disposed) return
      if (!Object.is(config.base.outerGlowWidth, nextConfig.base.outerGlowWidth)) {
        staticBlurDirty = true
      }
      if (!Object.is(config.hover.glowWidth, nextConfig.hover.glowWidth)) {
        hoverBlurDirty = true
      }
      config = snapshotConfig(nextConfig)
    },

    setRegionProgress(source, easedProgress) {
      if (disposed) return
      const state = hoverStates.get(source)
      if (!state) return

      const nextProgress = safeProgress(easedProgress)
      const matrixChanged = !state.clone.matrix.equals(source.matrixWorld)
      if (state.progress === nextProgress && !matrixChanged) return

      state.progress = nextProgress
      state.material.color.setRGB(nextProgress, nextProgress, nextProgress)
      state.clone.visible = nextProgress > HOVER_VISIBILITY_THRESHOLD
      state.clone.matrix.copy(source.matrixWorld)
      hoverMaskDirty = true
      hoverBlurDirty = true
    },

    markCameraDirty() {
      if (disposed) return
      setAllDirty()
    },

    render(mainScene, camera) {
      if (disposed) return
      const previousTarget = renderer.getRenderTarget()
      const previousAutoClear = renderer.autoClear
      const staticEnabled = isGlowEnabled(
        config.base.outerGlowWidth,
        config.base.outerGlowStrength
      )
      const hoverVisible = hasVisibleHover()
      const hoverEnabled = isGlowEnabled(
        config.hover.glowWidth,
        config.hover.glowStrength,
        hoverVisible ? 1 : 0
      )

      try {
        renderer.autoClear = false

        if (staticEnabled) {
          if (staticMaskDirty) {
            renderMask(staticMaskScene, staticTargets.mask, camera)
            staticMaskDirty = false
          }
          if (staticBlurDirty) {
            renderBlurredChannel(
              staticTargets,
              config.base.outerGlowWidth,
              config.base.outerGlowStrength
            )
            staticBlurDirty = false
          }
        }

        if (hoverEnabled) {
          if (hoverMaskDirty) {
            renderMask(hoverMaskScene, hoverTargets.mask, camera)
            hoverMaskDirty = false
          }
          if (hoverBlurDirty) {
            renderBlurredChannel(
              hoverTargets,
              config.hover.glowWidth,
              config.hover.glowStrength
            )
            hoverBlurDirty = false
          }
        }

        renderer.setRenderTarget(null)
        renderer.clear()
        renderer.render(mainScene, camera)

        if (staticEnabled) {
          const profile = deriveB3GlowProfile(
            config.base.outerGlowWidth,
            config.base.outerGlowStrength,
            metrics
          )
          renderOutwardComposite(renderer, shaderResources, {
            mask: staticTargets.mask.texture,
            near: staticTargets.near.texture,
            far: staticTargets.far.texture,
            color: config.base.outerColor,
            nearOpacity: profile.nearOpacity,
            farOpacity: profile.farOpacity
          })
        }

        if (hoverEnabled) {
          const profile = deriveB3GlowProfile(
            config.hover.glowWidth,
            config.hover.glowStrength,
            metrics
          )
          renderOutwardComposite(renderer, shaderResources, {
            mask: hoverTargets.mask.texture,
            near: hoverTargets.near.texture,
            far: hoverTargets.far.texture,
            color: config.hover.glowColor,
            nearOpacity: profile.nearOpacity,
            farOpacity: profile.farOpacity
          })
        }
      } finally {
        renderer.setRenderTarget(previousTarget)
        renderer.autoClear = previousAutoClear
      }
    },

    dispose() {
      if (disposed) return
      disposed = true
      for (const target of ownedTargets) target.dispose()
      for (const material of ownedMaterials) material.dispose()
      disposeGlowShaderResources(shaderResources)
      staticMaskScene.clear()
      hoverMaskScene.clear()
      hoverStates.clear()
    }
  }
}
