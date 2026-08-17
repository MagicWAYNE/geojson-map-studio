import bgMain from '@/assets/images/bg-1.jpg'

export const DEFAULT_BACKGROUND_LAYERS = [
  {
    id: 'main',
    label: '背景底图',
    help: '',
    url: bgMain,
    filename: 'bg-1.jpg',
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
