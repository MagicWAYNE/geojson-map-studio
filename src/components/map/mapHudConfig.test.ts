import { describe, expect, it } from 'vitest'
import {
  MAP_HUD_DEFAULTS,
  assignMapHudConfig,
  cloneMapHudConfig,
  formatMapHudConfig,
  normalizeMapHudConfig
} from './mapHudConfig'

describe('mapHudConfig', () => {
  it('uses the approved dual-disc defaults', () => {
    expect(MAP_HUD_DEFAULTS).toEqual({
      version: 1,
      anchor: { x: 1.7, z: 2.8, elevation: 0.1 },
      static: { enabled: true, diameter: 145, opacity: 0.4, phaseDeg: 0, elevationOffset: 0 },
      rotating: {
        enabled: true, diameter: 93, opacity: 0.5, phaseDeg: 0,
        elevationOffset: 0.05, speedDegPerSecond: 6
      }
    })
  })

  it('clones and assigns without replacing nested object identities', () => {
    const target = cloneMapHudConfig(MAP_HUD_DEFAULTS)
    const anchor = target.anchor
    const staticLayer = target.static
    const rotating = target.rotating
    const source = cloneMapHudConfig(MAP_HUD_DEFAULTS)
    source.anchor.x = 20
    source.rotating.speedDegPerSecond = -8

    assignMapHudConfig(target, source)

    expect(target).toEqual(source)
    expect(target.anchor).toBe(anchor)
    expect(target.static).toBe(staticLayer)
    expect(target.rotating).toBe(rotating)
  })

  it('normalizes invalid versions and clamps every adjustable number', () => {
    expect(normalizeMapHudConfig({ version: 9 })).toEqual(MAP_HUD_DEFAULTS)
    expect(normalizeMapHudConfig({
      version: 1,
      anchor: { x: -999, z: 999, elevation: Infinity },
      static: { enabled: 'yes', diameter: 2, opacity: 5, phaseDeg: -2, elevationOffset: -99 },
      rotating: { enabled: false, diameter: 999, opacity: -2, phaseDeg: 999, elevationOffset: 99, speedDegPerSecond: -99 }
    })).toEqual({
      version: 1,
      anchor: { x: -150, z: 150, elevation: 0.1 },
      static: { enabled: true, diameter: 20, opacity: 1, phaseDeg: 0, elevationOffset: -5 },
      rotating: { enabled: false, diameter: 300, opacity: 0, phaseDeg: 360, elevationOffset: 5, speedDegPerSecond: -30 }
    })
  })

  it('formats normalized version 1 JSON', () => {
    const value = cloneMapHudConfig(MAP_HUD_DEFAULTS)
    value.rotating.speedDegPerSecond = -6
    expect(JSON.parse(formatMapHudConfig(value))).toMatchObject({
      version: 1,
      rotating: { speedDegPerSecond: -6 }
    })
  })
})
