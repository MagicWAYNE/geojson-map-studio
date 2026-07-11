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

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback
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

export function deriveB3GlowProfile(
  radiusCssPx: number,
  opacity: number,
  metrics: GlowTargetMetrics
): GlowProfile {
  const radius = finiteOr(
    Math.max(0, finiteOr(radiusCssPx, 0)) * finiteOr(metrics.pixelsPerCssPx, 1),
    0
  )
  const alpha = Math.min(1, Math.max(0, finiteOr(opacity, 0)))
  return {
    nearRadiusTexels: Number((radius * 0.35).toFixed(4)),
    farRadiusTexels: Number(radius.toFixed(4)),
    nearOpacity: Number((alpha * 0.83).toFixed(4)),
    farOpacity: Number(alpha.toFixed(4))
  }
}

export function isGlowEnabled(radiusCssPx: number, opacity: number, progress = 1): boolean {
  return Number.isFinite(radiusCssPx)
    && Number.isFinite(opacity)
    && Number.isFinite(progress)
    && radiusCssPx > 0
    && opacity > 0
    && progress > 0.001
}
