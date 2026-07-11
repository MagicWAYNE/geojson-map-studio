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

export function computeGlowTargetMetrics(
  cssWidth: number,
  cssHeight: number,
  pixelRatio: number,
  scale = 0.5
): GlowTargetMetrics {
  const safeScale = Math.min(1, Math.max(0.25, scale))
  const pixelsPerCssPx = Math.max(0.01, pixelRatio) * safeScale
  return {
    width: Math.max(1, Math.round(cssWidth * pixelsPerCssPx)),
    height: Math.max(1, Math.round(cssHeight * pixelsPerCssPx)),
    pixelsPerCssPx
  }
}

export function deriveB3GlowProfile(
  radiusCssPx: number,
  opacity: number,
  metrics: GlowTargetMetrics
): GlowProfile {
  const radius = Math.max(0, radiusCssPx) * metrics.pixelsPerCssPx
  const alpha = Math.min(1, Math.max(0, opacity))
  return {
    nearRadiusTexels: Number((radius * 0.35).toFixed(4)),
    farRadiusTexels: Number(radius.toFixed(4)),
    nearOpacity: Number((alpha * 0.83).toFixed(4)),
    farOpacity: Number(alpha.toFixed(4))
  }
}

export function isGlowEnabled(radiusCssPx: number, opacity: number, progress = 1): boolean {
  return radiusCssPx > 0 && opacity > 0 && progress > 0.001
}
