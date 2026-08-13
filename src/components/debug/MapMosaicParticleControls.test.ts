// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, reactive, type App } from 'vue'
import {
  BLUE_PURPLE_MOSAIC_PARTICLE_PRESET,
  HOVER_MOSAIC_PARTICLE_DEFAULTS,
  assignMosaicParticleConfig,
  cloneMosaicParticleConfig,
  type MapMosaicParticleConfig
} from '@/components/map/mapMosaicParticleConfig'
import MapMosaicParticleControls from './MapMosaicParticleControls.vue'
import { useMapVisualSettings } from '@/composables/useMapVisualSettings'

interface MountedControls {
  app: App
  root: HTMLDivElement
  state: { value: MapMosaicParticleConfig }
  original: MapMosaicParticleConfig
  updates: MapMosaicParticleConfig[]
}

async function mountControls(): Promise<MountedControls> {
  const original = cloneMosaicParticleConfig(HOVER_MOSAIC_PARTICLE_DEFAULTS)
  const state = reactive({ value: original })
  const updates: MapMosaicParticleConfig[] = []
  const root = document.createElement('div')
  const app = createApp({
    render: () => h(MapMosaicParticleControls, {
      modelValue: state.value,
      'onUpdate:modelValue': (value: MapMosaicParticleConfig) => {
        updates.push(value)
        assignMosaicParticleConfig(state.value, value)
      }
    })
  })
  app.mount(root)
  await nextTick()
  return { app, root, state, original, updates }
}

function input(root: HTMLElement, id: string): HTMLInputElement {
  return root.querySelector<HTMLInputElement>(`#${id}`)!
}

function button(root: HTMLElement, label: string): HTMLButtonElement {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
    .find((candidate) => candidate.textContent === label)!
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.replaceChildren()
})

describe('MapMosaicParticleControls', () => {
  it('renders an editor for every mosaic particle setting', async () => {
    const { app, root } = await mountControls()

    expect(input(root, 'effect-hover-mosaic-enabled-checkbox').type).toBe('checkbox')
    for (const key of ['primaryColor', 'accentColor', 'gapColor']) {
      expect(input(root, `effect-hover-mosaic-${key}-color`).type).toBe('color')
      expect(input(root, `effect-hover-mosaic-${key}-hex`).type).toBe('text')
    }
    expect(input(root, 'effect-hover-mosaic-reseedOnEnter-checkbox').type).toBe('checkbox')

    const ranges: Array<[keyof MapMosaicParticleConfig, string, string, string]> = [
      ['accentRatio', '0', '1', '0.01'],
      ['density', '0', '1', '0.01'],
      ['clusterChance', '0', '1', '0.01'],
      ['clusterRadius', '1', '6', '1'],
      ['clusterStrength', '0', '3', '0.05'],
      ['accentClusterBias', '0', '1', '0.01'],
      ['targetCellPx', '1', '32', '1'],
      ['minCellPx', '1', '16', '1'],
      ['maxCellPx', '4', '32', '1'],
      ['gapRatio', '0', '0.8', '0.01'],
      ['gapOpacity', '0', '1', '0.01'],
      ['opacity', '0', '1', '0.01'],
      ['brightness', '0', '3', '0.05'],
      ['flickerHz', '0.1', '12', '0.1'],
      ['dutyCycle', '0', '1', '0.01'],
      ['pulseSharpness', '0.25', '4', '0.05'],
      ['clusterFlickerScale', '0.1', '3', '0.05'],
      ['burstDurationMs', '0', '1500', '10'],
      ['burstStrength', '0', '3', '0.05'],
      ['burstDensityBoost', '0', '1', '0.01'],
      ['surfaceOffset', '0', '1', '0.01'],
      ['seed', '0', '9999', '1']
    ]
    for (const [key, min, max, step] of ranges) {
      const number = input(root, `effect-hover-mosaic-${key}-number`)
      expect([number.min, number.max, number.step]).toEqual([min, max, step])
      expect(input(root, `effect-hover-mosaic-${key}-range`).type).toBe('range')
    }

    app.unmount()
  })

  it('keeps numeric drafts and emits one normalized in-place-compatible update on commit', async () => {
    const { app, root, state, updates } = await mountControls()
    const modelReference = state.value
    const radius = input(root, 'effect-hover-mosaic-clusterRadius-number')

    radius.value = '4.6'
    radius.dispatchEvent(new InputEvent('input', { bubbles: true }))
    await nextTick()
    expect(radius.value).toBe('4.6')
    expect(state.value.clusterRadius).toBe(1)
    expect(updates).toHaveLength(0)

    radius.dispatchEvent(new Event('change', { bubbles: true }))
    radius.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
    await nextTick()

    expect(updates).toHaveLength(1)
    expect(updates[0]).not.toBe(modelReference)
    expect(state.value).toBe(modelReference)
    expect(state.value.clusterRadius).toBe(5)
    expect(radius.value).toBe('5')
    expect(input(root, 'effect-hover-mosaic-clusterRadius-range').value).toBe('5')

    const brightness = input(root, 'effect-hover-mosaic-brightness-number')
    brightness.value = '99'
    brightness.dispatchEvent(new InputEvent('input', { bubbles: true }))
    brightness.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(state.value.brightness).toBe(3)

    app.unmount()
  })

  it('normalizes colors and updates both boolean settings', async () => {
    const { app, root, state, updates } = await mountControls()
    const enabled = input(root, 'effect-hover-mosaic-enabled-checkbox')
    enabled.checked = false
    enabled.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(state.value.enabled).toBe(false)

    const reseed = input(root, 'effect-hover-mosaic-reseedOnEnter-checkbox')
    reseed.checked = false
    reseed.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(state.value.reseedOnEnter).toBe(false)

    const primaryHex = input(root, 'effect-hover-mosaic-primaryColor-hex')
    primaryHex.value = '#ABCDEF'
    primaryHex.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(state.value.primaryColor).toBe('#abcdef')
    expect(input(root, 'effect-hover-mosaic-primaryColor-color').value).toBe('#abcdef')
    expect(primaryHex.value).toBe('#abcdef')

    const updateCount = updates.length
    primaryHex.value = 'blue'
    primaryHex.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(updates).toHaveLength(updateCount)
    expect(primaryHex.value).toBe('#abcdef')

    const accentColor = input(root, 'effect-hover-mosaic-accentColor-color')
    accentColor.value = '#7654fe'
    accentColor.dispatchEvent(new InputEvent('input', { bubbles: true }))
    await nextTick()
    expect(state.value.accentColor).toBe('#7654fe')
    expect(input(root, 'effect-hover-mosaic-accentColor-hex').value).toBe('#7654fe')

    const gapColor = input(root, 'effect-hover-mosaic-gapColor-hex')
    gapColor.value = '#123456'
    gapColor.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(state.value.gapColor).toBe('#123456')

    app.unmount()
  })

  it('re-emits a slider value after an external in-place reset', async () => {
    const { app, root, state, updates } = await mountControls()
    const brightness = input(root, 'effect-hover-mosaic-brightness-range')

    brightness.value = '2'
    brightness.dispatchEvent(new InputEvent('input', { bubbles: true }))
    await nextTick()
    expect(updates).toHaveLength(1)
    expect(input(root, 'effect-hover-mosaic-brightness-number').value).toBe('2')

    assignMosaicParticleConfig(state.value, HOVER_MOSAIC_PARTICLE_DEFAULTS)
    await nextTick()
    expect(brightness.value).toBe('1.15')

    brightness.value = '2'
    brightness.dispatchEvent(new InputEvent('input', { bubbles: true }))
    await nextTick()
    expect(updates).toHaveLength(2)
    expect(updates.at(-1)?.brightness).toBe(2)

    app.unmount()
  })

  it('routes preset, randomize, and reset intentions through the visual session owner', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.4321)
    const { app, root, state, updates } = await mountControls()
    const session = useMapVisualSettings()
    session.resetVisualSession()
    state.value.primaryColor = '#111111'
    state.value.seed = 99
    session.replaceEffectMosaicParticles(state.value)
    await nextTick()

    button(root, '应用蓝紫参考预设').click()
    await nextTick()
    expect(session.effect.hover.mosaicParticles).toEqual(BLUE_PURPLE_MOSAIC_PARTICLE_PRESET)
    expect(updates).toHaveLength(0)

    button(root, '随机种子').click()
    await nextTick()
    expect(session.effect.hover.mosaicParticles.seed).toBe(4321)
    expect(session.effect.hover.mosaicParticles.primaryColor).toBe(
      HOVER_MOSAIC_PARTICLE_DEFAULTS.primaryColor
    )

    session.effect.hover.mosaicParticles.accentColor = '#222222'
    await nextTick()
    button(root, '恢复固化默认').click()
    await nextTick()
    expect(session.effect.hover.mosaicParticles).toEqual(HOVER_MOSAIC_PARTICLE_DEFAULTS)

    app.unmount()
  })
})
