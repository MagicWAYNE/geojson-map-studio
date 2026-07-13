import * as THREE from 'three'
import {
  cloneMapEffectConfig,
  MAP_EFFECT_DEFAULTS,
  type MapEffectConfig
} from './mapEffectConfig'
import type { MapInwardGlowConfig } from './mapInwardGlowConfig'
import {
  createInwardGlowShaderResources,
  disposeInwardGlowShaderResources,
  renderInwardComposite,
  type InwardCompositeInputs,
  type InwardGlowShaderResources
} from './mapInwardGlowShaders'
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
export type MapOutwardGlowBaseInwardState = 'active' | 'zero' | 'disabled'
export type MapOutwardGlowHoverInwardState = 'ready' | 'active' | 'zero' | 'disabled'

export interface MapOutwardGlowPipelineStatus {
  targetWidth: number
  targetHeight: number
  renderScale: MapEffectConfig['quality']['renderScale']
  baseState: MapOutwardGlowBaseState
  hoverState: MapOutwardGlowHoverState
  baseInwardState: MapOutwardGlowBaseInwardState
  hoverInwardState: MapOutwardGlowHoverInwardState
}

export interface MapOutwardGlowPipeline {
  setSize(cssWidth: number, cssHeight: number, pixelRatio: number): void
  setConfig(config: MapEffectConfig): void
  setRegionProgress(source: THREE.Mesh, easedProgress: number): boolean
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

interface InwardChannelTargets {
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

interface CachedInwardChannel {
  profileSignature: string
  profile: GlowProfile
  composite: InwardCompositeInputs
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

function createInwardChannelTargets(
  create: () => THREE.WebGLRenderTarget
): InwardChannelTargets {
  return { near: create(), far: create() }
}

function snapshotConfig(config: MapEffectConfig): MapEffectConfig {
  return cloneMapEffectConfig(config)
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

function inwardBlurSignature(channel: MapInwardGlowConfig): string {
  return [
    channel.width,
    channel.nearRadiusRatio,
    channel.farRadiusRatio,
    channel.nearPasses,
    channel.farPasses
  ].join('|')
}

function inwardProfileSignature(channel: MapInwardGlowConfig): string {
  return [
    channel.width,
    channel.strength,
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
  let allocatedInwardShaderResources: InwardGlowShaderResources | null = null
  let disposed = false

  function disposeOwnedResources(): void {
    if (disposed) return
    disposed = true
    for (const target of ownedTargets) target.dispose()
    for (const material of ownedMaterials) material.dispose()
    if (allocatedShaderResources) disposeGlowShaderResources(allocatedShaderResources)
    if (allocatedInwardShaderResources) {
      disposeInwardGlowShaderResources(allocatedInwardShaderResources)
    }
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
  let staticInwardTargets!: InwardChannelTargets
  let hoverInwardTargets!: InwardChannelTargets
  let pingTarget!: THREE.WebGLRenderTarget
  let shaderResources!: GlowShaderResources
  let inwardShaderResources!: InwardGlowShaderResources
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
    staticInwardTargets = createInwardChannelTargets(createOwnedTarget)
    hoverInwardTargets = createInwardChannelTargets(createOwnedTarget)
    pingTarget = createOwnedTarget()
    shaderResources = createGlowShaderResources()
    allocatedShaderResources = shaderResources
    inwardShaderResources = createInwardGlowShaderResources()
    allocatedInwardShaderResources = inwardShaderResources
  } catch (cause) {
    disposeOwnedResources()
    throw cause
  }

  let config = snapshotConfig(MAP_EFFECT_DEFAULTS)
  let staticChannel = baseChannel(config)
  let currentHoverChannel = hoverChannel(config)
  let staticInwardChannel = config.base.inwardGlow
  let currentHoverInwardChannel = config.hover.inwardGlow
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
  let staticInwardBlurDirty = true
  let hoverMaskDirty = true
  let hoverBlurDirty = true
  let hoverInwardBlurDirty = true
  let staticCache!: CachedGlowChannel
  let hoverCache!: CachedGlowChannel
  let staticInwardCache!: CachedInwardChannel
  let hoverInwardCache!: CachedInwardChannel

  function setAllDirty(): void {
    staticMaskDirty = true
    staticBlurDirty = true
    staticInwardBlurDirty = true
    hoverMaskDirty = true
    hoverBlurDirty = true
    hoverInwardBlurDirty = true
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
    refreshInwardChannelCache(
      staticInwardCache,
      staticTargets.mask.texture,
      staticInwardTargets,
      staticInwardChannel,
      true
    )
    refreshInwardChannelCache(
      hoverInwardCache,
      hoverTargets.mask.texture,
      hoverInwardTargets,
      currentHoverInwardChannel,
      true
    )
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

  function inwardProfileFor(channel: MapInwardGlowConfig): GlowProfile {
    return deriveGlowProfile({
      radiusCssPx: channel.width,
      opacity: channel.strength,
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

  function createInwardChannelCache(
    mask: THREE.Texture,
    targets: InwardChannelTargets,
    channel: MapInwardGlowConfig
  ): CachedInwardChannel {
    const profile = inwardProfileFor(channel)
    return {
      profileSignature: inwardProfileSignature(channel),
      profile,
      composite: {
        mask,
        near: targets.near.texture,
        far: targets.far.texture,
        color: channel.color,
        nearOpacity: profile.nearOpacity,
        farOpacity: profile.farOpacity,
        falloff: channel.falloff,
        edgeSoftness: channel.edgeSoftness,
        maxAlpha: Math.min(channel.maxAlpha, config.quality.maxAlpha),
        baseRatio: channel.baseRatio
      }
    }
  }

  function refreshInwardChannelCache(
    cache: CachedInwardChannel,
    mask: THREE.Texture,
    targets: InwardChannelTargets,
    channel: MapInwardGlowConfig,
    metricsChanged = false
  ): void {
    const nextProfileSignature = inwardProfileSignature(channel)
    if (metricsChanged || cache.profileSignature !== nextProfileSignature) {
      cache.profileSignature = nextProfileSignature
      cache.profile = inwardProfileFor(channel)
    }
    const composite = cache.composite
    composite.mask = mask
    composite.near = targets.near.texture
    composite.far = targets.far.texture
    composite.color = channel.color
    composite.nearOpacity = cache.profile.nearOpacity
    composite.farOpacity = cache.profile.farOpacity
    composite.falloff = channel.falloff
    composite.edgeSoftness = channel.edgeSoftness
    composite.maxAlpha = Math.min(channel.maxAlpha, config.quality.maxAlpha)
    composite.baseRatio = channel.baseRatio
  }

  staticCache = createChannelCache(staticTargets, staticChannel)
  hoverCache = createChannelCache(hoverTargets, currentHoverChannel)
  staticInwardCache = createInwardChannelCache(
    staticTargets.mask.texture,
    staticInwardTargets,
    staticInwardChannel
  )
  hoverInwardCache = createInwardChannelCache(
    hoverTargets.mask.texture,
    hoverInwardTargets,
    currentHoverInwardChannel
  )

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

  function renderBlurredInwardChannel(
    mask: THREE.Texture,
    targets: InwardChannelTargets,
    cache: CachedInwardChannel,
    channel: MapInwardGlowConfig
  ): void {
    const { profile } = cache
    renderSeparableBlur(
      renderer, shaderResources, mask, pingTarget, targets.near,
      profile.nearRadiusTexels, channel.nearPasses
    )
    renderSeparableBlur(
      renderer, shaderResources, mask, pingTarget, targets.far,
      profile.farRadiusTexels, channel.farPasses
    )
  }

  function renderComposite(cache: CachedGlowChannel): void {
    renderOutwardComposite(renderer, shaderResources, cache.composite)
  }

  function renderInwardChannelComposite(cache: CachedInwardChannel): void {
    renderInwardComposite(renderer, inwardShaderResources, cache.composite)
  }

  function hasVisibleHover(): boolean {
    return visibleHoverCount > 0
  }

  function baseState(): MapOutwardGlowBaseState {
    if (!staticChannel.enabled) return 'disabled'
    return isGlowEnabled(true, staticChannel.radius, staticChannel.opacity)
      && (staticCache.profile.nearOpacity > 0 || staticCache.profile.farOpacity > 0)
      ? 'enabled'
      : 'zero'
  }

  function hoverState(): MapOutwardGlowHoverState {
    if (!currentHoverChannel.enabled) return 'disabled'
    if (!isGlowEnabled(true, currentHoverChannel.radius, currentHoverChannel.opacity)
      || (hoverCache.profile.nearOpacity <= 0 && hoverCache.profile.farOpacity <= 0)) return 'zero'
    return hasVisibleHover() ? 'active' : 'ready'
  }

  function inwardChannelIsEffective(
    channel: MapInwardGlowConfig,
    cache: CachedInwardChannel
  ): boolean {
    return isGlowEnabled(true, channel.width, channel.strength)
      && (cache.profile.nearOpacity > 0 || cache.profile.farOpacity > 0)
      && channel.baseRatio > 0
  }

  function baseInwardState(): MapOutwardGlowBaseInwardState {
    if (!staticInwardChannel.enabled) return 'disabled'
    return inwardChannelIsEffective(staticInwardChannel, staticInwardCache) ? 'active' : 'zero'
  }

  function hoverInwardState(): MapOutwardGlowHoverInwardState {
    if (!currentHoverInwardChannel.enabled) return 'disabled'
    if (!inwardChannelIsEffective(currentHoverInwardChannel, hoverInwardCache)) return 'zero'
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
      const nextStaticInwardChannel = next.base.inwardGlow
      const nextHoverInwardChannel = next.hover.inwardGlow
      const scaleChanged = !Object.is(config.quality.renderScale, next.quality.renderScale)
      if (blurSignature(staticChannel) !== blurSignature(nextStaticChannel)) staticBlurDirty = true
      if (blurSignature(currentHoverChannel) !== blurSignature(nextHoverChannel)) hoverBlurDirty = true
      if (inwardBlurSignature(staticInwardChannel)
        !== inwardBlurSignature(nextStaticInwardChannel)) staticInwardBlurDirty = true
      if (inwardBlurSignature(currentHoverInwardChannel)
        !== inwardBlurSignature(nextHoverInwardChannel)) hoverInwardBlurDirty = true
      config = next
      staticChannel = nextStaticChannel
      currentHoverChannel = nextHoverChannel
      staticInwardChannel = nextStaticInwardChannel
      currentHoverInwardChannel = nextHoverInwardChannel
      if (scaleChanged) resizeTargets(config.quality.renderScale, true)
      else {
        refreshChannelCache(staticCache, staticTargets, staticChannel)
        refreshChannelCache(hoverCache, hoverTargets, currentHoverChannel)
        refreshInwardChannelCache(
          staticInwardCache,
          staticTargets.mask.texture,
          staticInwardTargets,
          staticInwardChannel
        )
        refreshInwardChannelCache(
          hoverInwardCache,
          hoverTargets.mask.texture,
          hoverInwardTargets,
          currentHoverInwardChannel
        )
      }
    },

    setRegionProgress(source, easedProgress) {
      if (disposed) return false
      const state = hoverStates.get(source)
      if (!state) return false
      const nextProgress = safeProgress(easedProgress)
      const matrixChanged = !state.clone.matrix.equals(source.matrixWorld)
      if (state.progress === nextProgress && !matrixChanged) return false
      const hadVisibleHover = hasVisibleHover()
      const wasVisible = state.progress > HOVER_VISIBILITY_THRESHOLD
      const nextVisible = nextProgress > HOVER_VISIBILITY_THRESHOLD
      if (wasVisible !== nextVisible) visibleHoverCount += nextVisible ? 1 : -1
      state.progress = nextProgress
      state.material.color.setRGB(nextProgress, nextProgress, nextProgress)
      state.clone.visible = nextProgress > HOVER_VISIBILITY_THRESHOLD
      state.clone.matrix.copy(source.matrixWorld)
      hoverMaskDirty = true
      hoverBlurDirty = true
      hoverInwardBlurDirty = true
      return hadVisibleHover !== hasVisibleHover()
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
        hoverState: hoverState(),
        baseInwardState: baseInwardState(),
        hoverInwardState: hoverInwardState()
      }
    },

    render(mainScene, camera) {
      if (disposed) return
      const previousTarget = renderer.getRenderTarget()
      const previousAutoClear = renderer.autoClear
      const staticEnabled = baseState() === 'enabled'
      const hoverEnabled = hoverState() === 'active'
      const staticInwardEnabled = baseInwardState() === 'active'
      const hoverInwardEnabled = hoverInwardState() === 'active'
      try {
        renderer.autoClear = false
        if (staticEnabled || staticInwardEnabled) {
          if (staticMaskDirty) {
            renderMask(staticMaskScene, staticTargets.mask, camera)
            staticMaskDirty = false
          }
          if (staticEnabled && staticBlurDirty) {
            renderBlurredChannel(staticTargets, staticCache, staticChannel)
            staticBlurDirty = false
          }
          if (staticInwardEnabled && staticInwardBlurDirty) {
            renderBlurredInwardChannel(
              staticTargets.mask.texture,
              staticInwardTargets,
              staticInwardCache,
              staticInwardChannel
            )
            staticInwardBlurDirty = false
          }
        }
        if (hoverEnabled || hoverInwardEnabled) {
          if (hoverMaskDirty) {
            renderMask(hoverMaskScene, hoverTargets.mask, camera)
            hoverMaskDirty = false
          }
          if (hoverEnabled && hoverBlurDirty) {
            renderBlurredChannel(hoverTargets, hoverCache, currentHoverChannel)
            hoverBlurDirty = false
          }
          if (hoverInwardEnabled && hoverInwardBlurDirty) {
            renderBlurredInwardChannel(
              hoverTargets.mask.texture,
              hoverInwardTargets,
              hoverInwardCache,
              currentHoverInwardChannel
            )
            hoverInwardBlurDirty = false
          }
        }
        renderer.setRenderTarget(null)
        renderer.clear()
        renderer.render(mainScene, camera)
        if (staticEnabled) renderComposite(staticCache)
        if (staticInwardEnabled) renderInwardChannelComposite(staticInwardCache)
        if (hoverEnabled) renderComposite(hoverCache)
        if (hoverInwardEnabled) renderInwardChannelComposite(hoverInwardCache)
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
