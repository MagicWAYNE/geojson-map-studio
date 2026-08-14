import bgMain from '@/assets/images/bg-main.png'
import bgTerrain from '@/assets/images/bg-terrain.png'

export const DEFAULT_BACKGROUND_LAYERS = [
  {
    id: 'main',
    label: '背景遮罩',
    help: '建议为带透明度的PNG文件',
    url: bgMain,
    filename: 'bg-main.png',
    defaultVisible: true
  },
  {
    id: 'terrain',
    label: '背景底图',
    help: '',
    url: bgTerrain,
    filename: 'bg-terrain.png',
    defaultVisible: true
  }
] as const

export type DefaultBackgroundLayerId = typeof DEFAULT_BACKGROUND_LAYERS[number]['id']
export type DefaultBackgroundLayer = typeof DEFAULT_BACKGROUND_LAYERS[number]

export function createDefaultBackgroundLayerRecord<Value>(
  createValue: (layer: DefaultBackgroundLayer) => Value
): Record<DefaultBackgroundLayerId, Value> {
  return Object.fromEntries(
    DEFAULT_BACKGROUND_LAYERS.map((layer) => [layer.id, createValue(layer)])
  ) as Record<DefaultBackgroundLayerId, Value>
}

export function createBackgroundLayerVisibility(): Record<DefaultBackgroundLayerId, boolean> {
  return createDefaultBackgroundLayerRecord((layer) => layer.defaultVisible)
}
