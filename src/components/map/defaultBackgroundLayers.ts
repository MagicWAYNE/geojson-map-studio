import bgMain from '@/assets/images/bg-main.png'
import bgTerrain from '@/assets/images/bg-terrain.png'

export const DEFAULT_BACKGROUND_LAYERS = [
  {
    id: 'main',
    label: '主背景',
    url: bgMain,
    filename: 'bg-main.png',
    defaultVisible: true
  },
  {
    id: 'terrain',
    label: '地形纹理',
    url: bgTerrain,
    filename: 'bg-terrain.png',
    defaultVisible: true
  }
] as const

export type DefaultBackgroundLayerId = typeof DEFAULT_BACKGROUND_LAYERS[number]['id']

export function createDefaultBackgroundVisibility(): Record<DefaultBackgroundLayerId, boolean> {
  return Object.fromEntries(
    DEFAULT_BACKGROUND_LAYERS.map((layer) => [layer.id, layer.defaultVisible])
  ) as Record<DefaultBackgroundLayerId, boolean>
}
