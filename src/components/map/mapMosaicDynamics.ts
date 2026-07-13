const UINT32_RANGE = 0x1_0000_0000
export const MOSAIC_RANDOM_X = 127.1
export const MOSAIC_RANDOM_Y = 311.7
export const MOSAIC_RANDOM_SEED = 74.7
export const MOSAIC_RANDOM_SCALE = 43758.5453123

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
}

function fract(value: number): number {
  return value - Math.floor(value)
}

export function hashMosaicStableId(stableId: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < stableId.length; index++) {
    hash ^= stableId.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

export function deriveMosaicActivationSeed(
  baseSeed: number,
  stableId: string,
  activationOrdinal: number
): number {
  let value = (Math.round(baseSeed) >>> 0)
    ^ hashMosaicStableId(stableId)
    ^ Math.imul((Math.max(0, Math.round(activationOrdinal)) + 1) >>> 0, 0x9e3779b1)
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d)
  value ^= value >>> 15
  value = Math.imul(value, 0x846ca68b)
  value ^= value >>> 16
  return (value >>> 0) / UINT32_RANGE
}

export function mosaicRandom(cellX: number, cellY: number, seed: number): number {
  const value = Math.sin(
    cellX * MOSAIC_RANDOM_X + cellY * MOSAIC_RANDOM_Y + seed * MOSAIC_RANDOM_SEED
  ) * MOSAIC_RANDOM_SCALE
  return fract(value)
}

export function isMosaicCluster(random: number, clusterChance: number): boolean {
  return clamp01(random) >= 1 - clamp01(clusterChance)
}

export function mosaicClusterInfluence(
  distanceInCells: number,
  clusterRadius: number,
  active: boolean
): number {
  if (!active) return 0
  const radius = Math.max(1, Number.isFinite(clusterRadius) ? clusterRadius : 1)
  return clamp01(1 - Math.max(0, distanceInCells) / (radius + 0.5))
}

export function mosaicClusterField(
  cellX: number,
  cellY: number,
  seed: number,
  clusterChance: number,
  clusterRadius: number
): number {
  const radius = Math.max(1, Number.isFinite(clusterRadius) ? clusterRadius : 1)
  const spacing = radius * 2 + 1
  const coarseX = Math.floor(cellX / spacing)
  const coarseY = Math.floor(cellY / spacing)
  let field = 0
  for (let offsetX = -1; offsetX <= 1; offsetX++) {
    for (let offsetY = -1; offsetY <= 1; offsetY++) {
      const candidateX = coarseX + offsetX
      const candidateY = coarseY + offsetY
      const active = isMosaicCluster(
        mosaicRandom(candidateX + 31.7, candidateY + 31.7, seed),
        clusterChance
      )
      const centerX = (candidateX + 0.5) * spacing
      const centerY = (candidateY + 0.5) * spacing
      const distance = Math.hypot(cellX - centerX, cellY - centerY)
      field = Math.max(field, mosaicClusterInfluence(distance, radius, active))
    }
  }
  return field
}

export function isMosaicAccent(
  random: number,
  accentRatio: number,
  clusterInfluence: number,
  accentClusterBias: number
): boolean {
  const baseRatio = clamp01(accentRatio)
  const threshold = baseRatio
    + clamp01(clusterInfluence) * clamp01(accentClusterBias) * (1 - baseRatio)
  return clamp01(random) < threshold
}

export function mosaicPulse(
  timeSeconds: number,
  phase: number,
  flickerHz: number,
  dutyCycle: number,
  sharpness: number
): number {
  const duty = clamp01(dutyCycle)
  if (duty <= 0 || !Number.isFinite(timeSeconds)) return 0
  const cycle = fract(timeSeconds * Math.max(0, flickerHz) + phase)
  if (cycle >= duty) return 0
  const normalized = 1 - cycle / duty
  return normalized ** Math.max(0.01, Number.isFinite(sharpness) ? sharpness : 1)
}

export function mosaicBurstEnvelope(ageMs: number, durationMs: number): number {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return 0
  if (!Number.isFinite(ageMs)) return 0
  const progress = clamp01(Math.max(0, ageMs) / durationMs)
  const eased = progress * progress * (3 - 2 * progress)
  return 1 - eased
}
