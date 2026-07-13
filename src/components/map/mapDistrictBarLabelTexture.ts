import * as THREE from 'three'
import labelBackgroundUrl from '@/assets/images/map-bar-label.png'
import caseIconUrl from '@/assets/images/icon-kpi-case.png'
import type { MapDistrictBarLabelConfig } from './mapDistrictBarLabelConfig'

export interface DistrictBarLabelAssets {
  background: CanvasImageSource
  icon: CanvasImageSource
}

export interface DistrictBarLabelData {
  name: string
  value: number
}

const TEXTURE_SCALE = 2

function normalizedDecimals(value: number): number {
  return Math.min(2, Math.max(0, Math.round(Number.isFinite(value) ? value : 0)))
}

function trimFixed(value: number, decimals: number): string {
  return value.toFixed(decimals).replace(/\.?0+$/, '')
}

export function formatDistrictCaseCount(value: number, decimals: number): string {
  const total = Number.isFinite(value) ? Math.max(0, value) : 0
  const places = normalizedDecimals(decimals)
  if (total >= 1_000_000) return `${trimFixed(total / 1_000_000, places)}m`
  if (total >= 1_000) {
    const thousands = Number((total / 1_000).toFixed(places))
    if (thousands >= 1_000) return `${trimFixed(total / 1_000_000, places)}m`
    return `${trimFixed(total / 1_000, places)}k`
  }
  return Math.round(total).toLocaleString('en-US')
}

export function districtBarLabelTextureKey(
  data: Readonly<DistrictBarLabelData>,
  config: Readonly<MapDistrictBarLabelConfig>
): string {
  return JSON.stringify([
    data.name, data.value,
    config.width, config.height,
    config.backgroundOpacity, config.hueRotate, config.saturation, config.brightness,
    config.contrast, config.tintColor, config.tintStrength, config.backgroundInsetY,
    config.iconSize, config.iconOffsetX, config.iconOffsetY, config.iconOpacity,
    config.iconBrightness, config.iconSaturation, config.iconTextGap,
    config.districtFontSize, config.districtColor, config.districtWeight,
    config.metricFontSize, config.metricColor, config.metricWeight,
    config.valueFontSize, config.valueColor, config.valueWeight,
    config.districtMetricGap, config.metricValueGap, config.valueDecimals
  ])
}

function fontFamily(weight: number): string {
  return weight >= 500 ? "'OPPOSans-M', sans-serif" : "'OPPOSans-R', sans-serif"
}

function drawTextRun(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  weight: number,
  color: string,
  family: string
): number {
  context.font = `${weight} ${size}px ${family}`
  context.fillStyle = color
  context.fillText(text, x, y)
  return context.measureText(text).width
}

export function renderDistrictBarLabelCanvas(
  canvas: HTMLCanvasElement,
  assets: Readonly<DistrictBarLabelAssets>,
  data: Readonly<DistrictBarLabelData>,
  config: Readonly<MapDistrictBarLabelConfig>
): HTMLCanvasElement {
  const scale = TEXTURE_SCALE
  canvas.width = Math.max(1, Math.round(config.width * scale))
  canvas.height = Math.max(1, Math.round(config.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('柱体标签 Canvas 2D 上下文不可用')

  const backgroundY = config.backgroundInsetY * scale
  const backgroundHeight = Math.max(1, (config.height - config.backgroundInsetY * 2) * scale)
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.save()
  context.globalAlpha = config.backgroundOpacity
  context.filter = `hue-rotate(${config.hueRotate}deg) saturate(${config.saturation}) brightness(${config.brightness}) contrast(${config.contrast})`
  context.drawImage(assets.background, 0, backgroundY, canvas.width, backgroundHeight)
  context.restore()

  if (config.tintStrength > 0) {
    context.save()
    context.globalAlpha = config.tintStrength
    context.globalCompositeOperation = 'source-atop'
    context.fillStyle = config.tintColor
    context.fillRect(0, backgroundY, canvas.width, backgroundHeight)
    context.restore()
  }

  const iconSize = config.iconSize * scale
  const iconX = config.iconOffsetX * scale
  const iconY = ((config.height - config.iconSize) / 2 + config.iconOffsetY) * scale
  context.save()
  context.globalAlpha = config.iconOpacity
  context.filter = `saturate(${config.iconSaturation}) brightness(${config.iconBrightness})`
  context.drawImage(assets.icon, iconX, iconY, iconSize, iconSize)
  context.restore()

  context.save()
  context.globalAlpha = 1
  context.textAlign = 'left'
  context.textBaseline = 'middle'
  const baseline = config.height * scale / 2
  let textX = (config.iconOffsetX + config.iconSize + config.iconTextGap) * scale
  textX += drawTextRun(
    context,
    data.name,
    textX,
    baseline,
    config.districtFontSize * scale,
    config.districtWeight,
    config.districtColor,
    fontFamily(config.districtWeight)
  )
  textX += config.districtMetricGap * scale
  textX += drawTextRun(
    context,
    '案件量',
    textX,
    baseline,
    config.metricFontSize * scale,
    config.metricWeight,
    config.metricColor,
    fontFamily(config.metricWeight)
  )
  textX += config.metricValueGap * scale
  drawTextRun(
    context,
    formatDistrictCaseCount(data.value, config.valueDecimals),
    textX,
    baseline,
    config.valueFontSize * scale,
    config.valueWeight,
    config.valueColor,
    "'Bebas', sans-serif"
  )
  context.restore()
  return canvas
}

export function createDistrictBarLabelTexture(
  assets: Readonly<DistrictBarLabelAssets>,
  data: Readonly<DistrictBarLabelData>,
  config: Readonly<MapDistrictBarLabelConfig>
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  renderDistrictBarLabelCanvas(canvas, assets, data, config)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = false
  texture.needsUpdate = true
  return texture
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`柱体标签素材加载失败：${url}`))
    image.src = url
  })
}

let assetPromise: Promise<DistrictBarLabelAssets> | null = null

export function loadDistrictBarLabelAssets(): Promise<DistrictBarLabelAssets> {
  if (!assetPromise) {
    assetPromise = Promise.all([
      loadImage(labelBackgroundUrl),
      loadImage(caseIconUrl),
      typeof document !== 'undefined' && document.fonts ? document.fonts.ready : Promise.resolve()
    ]).then(([background, icon]) => ({ background, icon })).catch((cause) => {
      assetPromise = null
      throw cause
    })
  }
  return assetPromise
}
