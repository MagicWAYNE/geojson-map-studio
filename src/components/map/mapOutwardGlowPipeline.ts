import * as THREE from 'three'
import { MAP_EFFECT_DEFAULTS, type MapEffectConfig } from './mapEffectConfig'
import {
  computeGlowTargetMetrics,
  deriveGlowProfile,
  isGlowEnabled,
  type GlowProfile,
  type GlowTargetMetrics
} from './mapOutwardGlowProfile'
import {
  createGlowShaderResources,
  disposeGlowShaderResources,
  renderOutwardComposite,
  renderSeparableBlur,
  type OutwardCompositeInputs,
  type GlowShaderResources
} from './mapOutwardGlowShaders'

const HOVER_VISIBILITY_THRESHOLD = 0.001

export type MapOutwardGlowBaseState = 'enabled' | 'zero' | 'disabled'
export type MapOutwardGlowHoverState = 'ready' | 'active' | 'zero' | 'disabled'

export interface MapOutwardGlowPipelineStatus {
  targetWidth: number
  targetHeight: number
  renderScale: MapEffectConfig['quality']['renderScale']
  baseState: MapOutwardGlowBaseState
  hoverState: MapOutwardGlowHoverState
}

export interface MapOutwardGlowPipeline {
  setSize(cssWidth: number, cssHeight: number, pixelRatio: number): void
  setConfig(config: MapEffectConfig): void
  setRegionProgress(source: THREE.Mesh, easedProgress: number): void
  markCameraDirty(): void
  getStatus(): MapOutwardGlowPipelineStatus
  render(mainScene: THREE.Scene, camera: THREE.Camera): void
  dispose(): void
}

interface GlowChannelConfig {
  enabled: boolean
  color: string
  radius: number
  opacity: number
  nearRadiusRatio: number
  nearOpacityRatio: number
  farRadiusRatio: number
  farOpacityRatio: number
  falloff: number
  edgeSoftness: number
  nearPasses: number
  farPasses: number
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

interface CachedGlowChannel {
  profileSignature: string
  profile: GlowProfile
  composite: OutwardCompositeInputs
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

function createChannelTargets(create: () => THREE.WebGLRenderTarget): ChannelTargets {
  return { mask: create(), near: create(), far: create() }
}

function snapshotConfig(config: MapEffectConfig): MapEffectConfig {
  return {
    version: config.version,
    base: { ...config.base },
    hover: { ...config.hover },
    quality: { ...config.quality }
  }
}

function baseChannel(config: MapEffectConfig): GlowChannelConfig {
  const { base } = config
  return {
    enabled: base.outerGlowEnabled,
    color: base.outerGlowColor,
    radius: base.outerGlowWidth,
    opacity: base.outerGlowStrength,
    nearRadiusRatio: base.outerGlowNearRadiusRatio,
    nearOpacityRatio: base.outerGlowNearOpacityRatio,
    farRadiusRatio: base.outerGlowFarRadiusRatio,
    farOpacityRatio: base.outerGlowFarOpacityRatio,
    falloff: base.outerGlowFalloff,
    edgeSoftness: base.outerGlowEdgeSoftness,
    nearPasses: base.outerGlowNearPasses,
    farPasses: base.outerGlowFarPasses
  }
}

function hoverChannel(config: MapEffectConfig): GlowChannelConfig {
  const { hover } = config
  return {
    enabled: hover.glowEnabled,
    color: hover.glowColor,
    radius: hover.glowWidth,
    opacity: hover.glowStrength,
    nearRadiusRatio: hover.glowNearRadiusRatio,
    nearOpacityRatio: hover.glowNearOpacityRatio,
    farRadiusRatio: hover.glowFarRadiusRatio,
    farOpacityRatio: hover.glowFarOpacityRatio,
    falloff: hover.glowFalloff,
    edgeSoftness: hover.glowEdgeSoftness,
    nearPasses: hover.glowNearPasses,
    farPasses: hover.glowFarPasses
  }
}

function blurSignature(channel: GlowChannelConfig): string {
  return [
    channel.radius,
    channel.nearRadiusRatio,
    channel.farRadiusRatio,
    channel.nearPasses,
    channel.farPasses
  ].join('|')
}

function profileSignature(channel: GlowChannelConfig): string {
  return [
    channel.radius,
    channel.opacity,
    channel.nearRadiusRatio,
    channel.nearOpacityRatio,
    channel.farRadiusRatio,
    channel.farOpacityRatio
  ].join('|')
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
  const ownedMaterials: THREE.Material[] = []
  const ownedTargets: THREE.WebGLRenderTarget[] = []
  const hoverStates = new Map<THREE.Mesh, HoverCloneState>()
  let visibleHoverCount = 0
  let allocatedShaderResources: GlowShaderResources | null = null
  let disposed = false

  function disposeOwnedResources(): void {
    if (disposed) return
    disposed = true
    for (const target of ownedTargets) target.dispose()
    for (const material of ownedMaterials) material.dispose()
    if (allocatedShaderResources) disposeGlowShaderResources(allocatedShaderResources)
    staticMaskScene.clear()
    hoverMaskScene.clear()
    hoverStates.clear()
    visibleHoverCount = 0
  }

  function createOwnedTarget(): THREE.WebGLRenderTarget {
    const target = createTarget()
    ownedTargets.push(target)
    return target
  }

  let staticTargets!: ChannelTargets
  let hoverTargets!: ChannelTargets
  let pingTarget!: THREE.WebGLRenderTarget
  let shaderResources!: GlowShaderResources
  try {
    const staticMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff })
    ownedMaterials.push(staticMaterial)
    for (const source of regionMeshes) {
      const staticClone = new THREE.Mesh(source.geometry, staticMaterial)
      staticClone.matrixAutoUpdate = false
      staticClone.matrix.copy(source.matrixWorld)
      staticMaskScene.add(staticClone)

      const hoverMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 })
      ownedMaterials.push(hoverMaterial)
      const hoverClone = new THREE.Mesh(source.geometry, hoverMaterial)
      hoverClone.matrixAutoUpdate = false
      hoverClone.matrix.copy(source.matrixWorld)
      hoverClone.visible = false
      hoverMaskScene.add(hoverClone)
      hoverStates.set(source, { clone: hoverClone, material: hoverMaterial, progress: 0 })
    }
    staticTargets = createChannelTargets(createOwnedTarget)
    hoverTargets = createChannelTargets(createOwnedTarget)
    pingTarget = createOwnedTarget()
    shaderResources = createGlowShaderResources()
    allocatedShaderResources = shaderResources
  } catch (cause) {
    disposeOwnedResources()
    throw cause
  }

  let config = snapshotConfig(MAP_EFFECT_DEFAULTS)
  let staticChannel = baseChannel(config)
  let currentHoverChannel = hoverChannel(config)
  let cssWidth = 0
  let cssHeight = 0
  let pixelRatio = 1
  let metrics: GlowTargetMetrics = computeGlowTargetMetrics(
    cssWidth,
    cssHeight,
    pixelRatio,
    config.quality.renderScale
  )
  let staticMaskDirty = true
  let staticBlurDirty = true
  let hoverMaskDirty = true
  let hoverBlurDirty = true
  let staticCache!: CachedGlowChannel
  let hoverCache!: CachedGlowChannel

  function setAllDirty(): void {
    staticMaskDirty = true
    staticBlurDirty = true
    hoverMaskDirty = true
    hoverBlurDirty = true
  }

  function resizeTargets(scale: MapEffectConfig['quality']['renderScale'], force = false): boolean {
    const next = computeGlowTargetMetrics(cssWidth, cssHeight, pixelRatio, scale)
    if (!force && next.width === metrics.width
      && next.height === metrics.height
      && next.pixelsPerCssPx === metrics.pixelsPerCssPx) return false
    metrics = next
    for (const target of ownedTargets) target.setSize(metrics.width, metrics.height)
    refreshChannelCache(staticCache, staticTargets, staticChannel, true)
    refreshChannelCache(hoverCache, hoverTargets, currentHoverChannel, true)
    setAllDirty()
    return true
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

  function profileFor(channel: GlowChannelConfig) {
    return deriveGlowProfile({
      radiusCssPx: channel.radius,
      opacity: channel.opacity,
      nearRadiusRatio: channel.nearRadiusRatio,
      nearOpacityRatio: channel.nearOpacityRatio,
      farRadiusRatio: channel.farRadiusRatio,
      farOpacityRatio: channel.farOpacityRatio
    }, metrics)
  }

  function createChannelCache(
    targets: ChannelTargets,
    channel: GlowChannelConfig
  ): CachedGlowChannel {
    const profile = profileFor(channel)
    return {
      profileSignature: profileSignature(channel),
      profile,
      composite: {
        mask: targets.mask.texture,
        near: targets.near.texture,
        far: targets.far.texture,
        color: channel.color,
        nearOpacity: profile.nearOpacity,
        farOpacity: profile.farOpacity,
        falloff: channel.falloff,
        edgeSoftness: channel.edgeSoftness,
        maxAlpha: config.quality.maxAlpha
      }
    }
  }

  function refreshChannelCache(
    cache: CachedGlowChannel,
    targets: ChannelTargets,
    channel: GlowChannelConfig,
    metricsChanged = false
  ): void {
    const nextProfileSignature = profileSignature(channel)
    if (metricsChanged || cache.profileSignature !== nextProfileSignature) {
      cache.profileSignature = nextProfileSignature
      cache.profile = profileFor(channel)
    }
    const composite = cache.composite
    composite.mask = targets.mask.texture
    composite.near = targets.near.texture
    composite.far = targets.far.texture
    composite.color = channel.color
    composite.nearOpacity = cache.profile.nearOpacity
    composite.farOpacity = cache.profile.farOpacity
    composite.falloff = channel.falloff
    composite.edgeSoftness = channel.edgeSoftness
    composite.maxAlpha = config.quality.maxAlpha
  }

  staticCache = createChannelCache(staticTargets, staticChannel)
  hoverCache = createChannelCache(hoverTargets, currentHoverChannel)

  function renderBlurredChannel(
    targets: ChannelTargets,
    cache: CachedGlowChannel,
    channel: GlowChannelConfig
  ): void {
    const { profile } = cache
    renderSeparableBlur(
      renderer, shaderResources, targets.mask.texture, pingTarget, targets.near,
      profile.nearRadiusTexels, channel.nearPasses
    )
    renderSeparableBlur(
      renderer, shaderResources, targets.mask.texture, pingTarget, targets.far,
      profile.farRadiusTexels, channel.farPasses
    )
  }

  function renderComposite(cache: CachedGlowChannel): void {
    renderOutwardComposite(renderer, shaderResources, cache.composite)
  }

  function hasVisibleHover(): boolean {
    return visibleHoverCount > 0
  }

  function baseState(): MapOutwardGlowBaseState {
    if (!staticChannel.enabled) return 'disabled'
    return isGlowEnabled(true, staticChannel.radius, staticChannel.opacity) ? 'enabled' : 'zero'
  }

  function hoverState(): MapOutwardGlowHoverState {
    if (!currentHoverChannel.enabled) return 'disabled'
    if (!isGlowEnabled(true, currentHoverChannel.radius, currentHoverChannel.opacity)) return 'zero'
    return hasVisibleHover() ? 'active' : 'ready'
  }

  return {
    setSize(nextCssWidth, nextCssHeight, nextPixelRatio) {
      if (disposed) return
      const viewportChanged = !Object.is(cssWidth, nextCssWidth)
        || !Object.is(cssHeight, nextCssHeight)
        || !Object.is(pixelRatio, nextPixelRatio)
      cssWidth = nextCssWidth
      cssHeight = nextCssHeight
      pixelRatio = nextPixelRatio
      const targetsResized = resizeTargets(config.quality.renderScale)
      if (viewportChanged && !targetsResized) setAllDirty()
    },

    setConfig(nextConfig) {
      if (disposed) return
      const next = snapshotConfig(nextConfig)
      const nextStaticChannel = baseChannel(next)
      const nextHoverChannel = hoverChannel(next)
      const scaleChanged = !Object.is(config.quality.renderScale, next.quality.renderScale)
      if (blurSignature(staticChannel) !== blurSignature(nextStaticChannel)) staticBlurDirty = true
      if (blurSignature(currentHoverChannel) !== blurSignature(nextHoverChannel)) hoverBlurDirty = true
      config = next
      staticChannel = nextStaticChannel
      currentHoverChannel = nextHoverChannel
      if (scaleChanged) resizeTargets(config.quality.renderScale, true)
      else {
        refreshChannelCache(staticCache, staticTargets, staticChannel)
        refreshChannelCache(hoverCache, hoverTargets, currentHoverChannel)
      }
    },

    setRegionProgress(source, easedProgress) {
      if (disposed) return
      const state = hoverStates.get(source)
      if (!state) return
      const nextProgress = safeProgress(easedProgress)
      const matrixChanged = !state.clone.matrix.equals(source.matrixWorld)
      if (state.progress === nextProgress && !matrixChanged) return
      const wasVisible = state.progress > HOVER_VISIBILITY_THRESHOLD
      const nextVisible = nextProgress > HOVER_VISIBILITY_THRESHOLD
      if (wasVisible !== nextVisible) visibleHoverCount += nextVisible ? 1 : -1
      state.progress = nextProgress
      state.material.color.setRGB(nextProgress, nextProgress, nextProgress)
      state.clone.visible = nextProgress > HOVER_VISIBILITY_THRESHOLD
      state.clone.matrix.copy(source.matrixWorld)
      hoverMaskDirty = true
      hoverBlurDirty = true
    },

    markCameraDirty() {
      if (!disposed) setAllDirty()
    },

    getStatus() {
      return {
        targetWidth: metrics.width,
        targetHeight: metrics.height,
        renderScale: config.quality.renderScale,
        baseState: baseState(),
        hoverState: hoverState()
      }
    },

    render(mainScene, camera) {
      if (disposed) return
      const previousTarget = renderer.getRenderTarget()
      const previousAutoClear = renderer.autoClear
      const staticEnabled = baseState() === 'enabled'
      const hoverEnabled = hoverState() === 'active'
      try {
        renderer.autoClear = false
        if (staticEnabled) {
          if (staticMaskDirty) {
            renderMask(staticMaskScene, staticTargets.mask, camera)
            staticMaskDirty = false
          }
          if (staticBlurDirty) {
            renderBlurredChannel(staticTargets, staticCache, staticChannel)
            staticBlurDirty = false
          }
        }
        if (hoverEnabled) {
          if (hoverMaskDirty) {
            renderMask(hoverMaskScene, hoverTargets.mask, camera)
            hoverMaskDirty = false
          }
          if (hoverBlurDirty) {
            renderBlurredChannel(hoverTargets, hoverCache, currentHoverChannel)
            hoverBlurDirty = false
          }
        }
        renderer.setRenderTarget(null)
        renderer.clear()
        renderer.render(mainScene, camera)
        if (staticEnabled) renderComposite(staticCache)
        if (hoverEnabled) renderComposite(hoverCache)
      } finally {
        renderer.setRenderTarget(previousTarget)
        renderer.autoClear = previousAutoClear
      }
    },

    dispose() {
      disposeOwnedResources()
    }
  }
}
