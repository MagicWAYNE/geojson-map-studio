import * as THREE from 'three'
import type { MapHudConfig } from './mapHudConfig'

interface HudLayer {
  group: THREE.Group
  material: THREE.MeshBasicMaterial
}

export interface MapHudBundle {
  group: THREE.Group
  staticLayer: HudLayer
  rotatingLayer: HudLayer
  rotatingAngleDeg: number
}

function createLayer(texture: THREE.Texture): HudLayer {
  const geometry = new THREE.PlaneGeometry(1, 1)
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    depthTest: true,
    toneMapped: false,
    side: THREE.FrontSide
  })
  const mesh = new THREE.Mesh(geometry, material)
  // PlaneGeometry 默认位于 XY 平面，旋转后与地图的 XZ 平面共面。
  mesh.rotation.x = -Math.PI / 2
  const group = new THREE.Group()
  group.add(mesh)
  return { group, material }
}

function degreesToRadians(value: number): number {
  return value * Math.PI / 180
}

function normalizeDegrees(value: number): number {
  const normalized = value % 360
  return normalized < 0 ? normalized + 360 : normalized
}

export function createMapHud(staticTexture: THREE.Texture, rotatingTexture: THREE.Texture): MapHudBundle {
  const group = new THREE.Group()
  group.name = 'map-hud'
  const staticLayer = createLayer(staticTexture)
  staticLayer.group.name = 'map-hud-static'
  const rotatingLayer = createLayer(rotatingTexture)
  rotatingLayer.group.name = 'map-hud-rotating'
  group.add(staticLayer.group, rotatingLayer.group)
  return { group, staticLayer, rotatingLayer, rotatingAngleDeg: 0 }
}

export function applyMapHudConfig(bundle: MapHudBundle, config: Readonly<MapHudConfig>): void {
  bundle.group.position.set(config.anchor.x, config.anchor.elevation, config.anchor.z)

  bundle.staticLayer.group.visible = config.static.enabled
  bundle.staticLayer.group.position.y = config.static.elevationOffset
  bundle.staticLayer.group.scale.setScalar(config.static.diameter)
  bundle.staticLayer.group.rotation.y = degreesToRadians(config.static.phaseDeg)
  bundle.staticLayer.material.opacity = config.static.opacity

  bundle.rotatingLayer.group.visible = config.rotating.enabled
  bundle.rotatingLayer.group.position.y = config.rotating.elevationOffset
  bundle.rotatingLayer.group.scale.setScalar(config.rotating.diameter)
  bundle.rotatingLayer.material.opacity = config.rotating.opacity
  bundle.rotatingAngleDeg = config.rotating.phaseDeg
  bundle.rotatingLayer.group.rotation.y = degreesToRadians(bundle.rotatingAngleDeg)
}

export function advanceMapHud(bundle: MapHudBundle, config: Readonly<MapHudConfig>, deltaMs: number): void {
  if (!config.rotating.enabled || config.rotating.speedDegPerSecond === 0 || deltaMs <= 0) return
  bundle.rotatingAngleDeg = normalizeDegrees(
    bundle.rotatingAngleDeg + config.rotating.speedDegPerSecond * deltaMs / 1000
  )
  bundle.rotatingLayer.group.rotation.y = degreesToRadians(bundle.rotatingAngleDeg)
}
