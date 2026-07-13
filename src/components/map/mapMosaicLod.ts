import {
  MOSAIC_LOD_STEPS_PER_OCTAVE,
  normalizeMosaicParticleConfig,
  type MapMosaicParticleConfig
} from './mapMosaicParticleConfig'

export interface MosaicCellLod {
  cellWorldSize: number
  cellCssPx: number
  quantized: boolean
}

const MIN_MODEL_UNITS_PER_RENDER_PIXEL = 1e-6

function finitePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function rounded(value: number): number {
  return Number(value.toFixed(12))
}

export function selectMosaicCellLod(
  modelUnitsPerRenderPixel: number,
  renderPixelsPerScreenPixel: number,
  rawConfig: Readonly<MapMosaicParticleConfig>
): MosaicCellLod {
  const config = normalizeMosaicParticleConfig(rawConfig)
  const renderPixelWorld = finitePositive(
    modelUnitsPerRenderPixel,
    MIN_MODEL_UNITS_PER_RENDER_PIXEL
  )
  const cssPixelWorld = renderPixelWorld * finitePositive(renderPixelsPerScreenPixel, 1)
  const desiredWorld = Math.max(
    MIN_MODEL_UNITS_PER_RENDER_PIXEL,
    cssPixelWorld * config.targetCellPx
  )
  const steps = MOSAIC_LOD_STEPS_PER_OCTAVE
  const targetLevel = Math.round(Math.log2(desiredWorld) * steps)
  const minLevel = Math.ceil(
    Math.log2(cssPixelWorld * config.minCellPx) * steps - 1e-9
  )
  const maxLevel = Math.floor(
    Math.log2(cssPixelWorld * config.maxCellPx) * steps + 1e-9
  )
  const level = minLevel <= maxLevel
    ? Math.min(maxLevel, Math.max(minLevel, targetLevel))
    : targetLevel
  const cellWorldSize = 2 ** (level / steps)
  const cellCssPx = cellWorldSize / cssPixelWorld

  return {
    cellWorldSize: rounded(cellWorldSize),
    cellCssPx: rounded(cellCssPx),
    quantized: true
  }
}
