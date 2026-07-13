import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { MAP_HUD_DEFAULTS, cloneMapHudConfig } from './mapHudConfig'
import { advanceMapHud, applyMapHudConfig, createMapHud } from './mapHud'

describe('mapHud', () => {
  function createBundle() {
    return createMapHud(new THREE.Texture(), new THREE.Texture())
  }

  it('creates horizontal transparent layers below the centered map anchor', () => {
    const bundle = createBundle()
    applyMapHudConfig(bundle, MAP_HUD_DEFAULTS)

    expect(bundle.group.name).toBe('map-hud')
    expect(bundle.group.position.toArray()).toEqual([1.7, 0.1, 2.8])
    expect(bundle.staticLayer.group.scale.x).toBe(145)
    expect(bundle.rotatingLayer.group.scale.x).toBe(93)
    expect(bundle.staticLayer.material.transparent).toBe(true)
    expect(bundle.staticLayer.material.depthWrite).toBe(false)
    expect(bundle.staticLayer.group.children[0].rotation.x).toBeCloseTo(-Math.PI / 2)
  })

  it('keeps the static layer fixed and advances the rotating layer in either direction', () => {
    const bundle = createBundle()
    const config = cloneMapHudConfig(MAP_HUD_DEFAULTS)
    config.static.phaseDeg = 15
    config.rotating.phaseDeg = 10
    applyMapHudConfig(bundle, config)
    const staticAngle = bundle.staticLayer.group.rotation.y

    advanceMapHud(bundle, config, 1000)
    expect(bundle.staticLayer.group.rotation.y).toBe(staticAngle)
    expect(bundle.rotatingAngleDeg).toBe(16)

    config.rotating.speedDegPerSecond = -30
    advanceMapHud(bundle, config, 1000)
    expect(bundle.rotatingAngleDeg).toBe(346)
  })

  it('updates visibility and placement without recreating the planes', () => {
    const bundle = createBundle()
    const staticPlane = bundle.staticLayer.group.children[0]
    const config = cloneMapHudConfig(MAP_HUD_DEFAULTS)
    config.anchor.x = 20
    config.anchor.z = -10
    config.rotating.enabled = false
    config.static.opacity = 0.2
    applyMapHudConfig(bundle, config)

    expect(bundle.group.position.toArray()).toEqual([20, 0.1, -10])
    expect(bundle.rotatingLayer.group.visible).toBe(false)
    expect(bundle.staticLayer.material.opacity).toBe(0.2)
    expect(bundle.staticLayer.group.children[0]).toBe(staticPlane)
  })
})
