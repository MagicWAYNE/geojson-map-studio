export interface GlowTargetMetrics {
  width: number
  height: number
  pixelsPerCssPx: number
}

export interface GlowProfile {
  nearRadiusTexels: number
  farRadiusTexels: number
  nearOpacity: number
  farOpacity: number
}

export interface GlowProfileInput {
  radiusCssPx: number
  opacity: number
  nearRadiusRatio: number
  nearOpacityRatio: number
  farRadiusRatio: number
  farOpacityRatio: number
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round4(value: number): number {
  return Number(value.toFixed(4))
}

export function computeGlowTargetMetrics(
  cssWidth: number,
  cssHeight: number,
  pixelRatio: number,
  scale = 0.5
): GlowTargetMetrics {
  const safeScale = Math.min(1, Math.max(0.25, finiteOr(scale, 0.5)))
  const pixelsPerCssPx = Math.max(0.01, finiteOr(pixelRatio, 1)) * safeScale
  return {
    width: Math.max(1, Math.round(finiteOr(finiteOr(cssWidth, 0) * pixelsPerCssPx, 0))),
    height: Math.max(1, Math.round(finiteOr(finiteOr(cssHeight, 0) * pixelsPerCssPx, 0))),
    pixelsPerCssPx
  }
}

function safeRatio(value: number): number {
  return clamp(finiteOr(value, 0), 0, 2)
}

export function deriveGlowProfile(
  input: GlowProfileInput,
  metrics: GlowTargetMetrics
): GlowProfile {
  const radius = finiteOr(
    Math.max(0, finiteOr(input.radiusCssPx, 0)) * Math.max(0, finiteOr(metrics.pixelsPerCssPx, 1)),
    0
  )
  const opacity = clamp(finiteOr(input.opacity, 0), 0, 1)
  const nearRadiusRatio = safeRatio(input.nearRadiusRatio)
  const nearOpacityRatio = safeRatio(input.nearOpacityRatio)
  const farRadiusRatio = safeRatio(input.farRadiusRatio)
  const farOpacityRatio = safeRatio(input.farOpacityRatio)
  return {
    nearRadiusTexels: round4(finiteOr(radius * nearRadiusRatio, 0)),
    farRadiusTexels: round4(finiteOr(radius * farRadiusRatio, 0)),
    nearOpacity: round4(opacity * nearOpacityRatio),
    farOpacity: round4(opacity * farOpacityRatio)
  }
}

const B3_GLOW_PROFILE_DEFAULTS: GlowProfileInput = {
  radiusCssPx: 54,
  opacity: 0.23,
  nearRadiusRatio: 0.35,
  nearOpacityRatio: 0.83,
  farRadiusRatio: 1,
  farOpacityRatio: 1
}

export function deriveB3GlowProfile(
  radiusCssPx: number,
  opacity: number,
  metrics: GlowTargetMetrics
): GlowProfile {
  return deriveGlowProfile({
    ...B3_GLOW_PROFILE_DEFAULTS,
    radiusCssPx,
    opacity
  }, metrics)
}

export function isGlowEnabled(
  enabled: boolean,
  radiusCssPx: number,
  opacity: number,
  progress?: number
): boolean
export function isGlowEnabled(
  radiusCssPx: number,
  opacity: number,
  progress?: number
): boolean
export function isGlowEnabled(
  enabledOrRadiusCssPx: boolean | number,
  radiusCssPxOrOpacity: number,
  opacityOrProgress?: number,
  progress = 1
): boolean {
  const enabled = typeof enabledOrRadiusCssPx === 'boolean' ? enabledOrRadiusCssPx : true
  const radiusCssPx = typeof enabledOrRadiusCssPx === 'boolean'
    ? radiusCssPxOrOpacity
    : enabledOrRadiusCssPx
  const opacity = typeof enabledOrRadiusCssPx === 'boolean'
    ? (opacityOrProgress ?? 0)
    : radiusCssPxOrOpacity
  const visibleProgress = typeof enabledOrRadiusCssPx === 'boolean'
    ? progress
    : (opacityOrProgress ?? 1)

  return enabled
    && Number.isFinite(radiusCssPx)
    && Number.isFinite(opacity)
    && Number.isFinite(visibleProgress)
    && radiusCssPx > 0
    && opacity > 0
    && visibleProgress > 0.001
}
