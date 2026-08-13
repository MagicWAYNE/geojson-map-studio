// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, reactive, type App } from 'vue'
import {
  BASE_INWARD_GLOW_DEFAULTS,
  HOVER_INWARD_GLOW_DEFAULTS,
  cloneInwardGlowConfig,
  type MapInwardGlowConfig
} from '@/components/map/mapInwardGlowConfig'
import MapInwardGlowControls from './MapInwardGlowControls.vue'
import { useMapVisualSettings } from '@/composables/useMapVisualSettings'

type Channel = 'base' | 'hover'

interface MountedControls {
  app: App
  root: HTMLDivElement
  state: { value: MapInwardGlowConfig }
  updates: MapInwardGlowConfig[]
}

async function mountControls(channel: Channel = 'base'): Promise<MountedControls> {
  const defaults = channel === 'base' ? BASE_INWARD_GLOW_DEFAULTS : HOVER_INWARD_GLOW_DEFAULTS
  const state = reactive({ value: cloneInwardGlowConfig(defaults) })
  const updates: MapInwardGlowConfig[] = []
  const root = document.createElement('div')
  const app = createApp({
    render: () => h(MapInwardGlowControls, {
      channel,
      modelValue: state.value,
      stateLabel: channel === 'base' ? '已启用' : '等待 Hover',
      'onUpdate:modelValue': (value: MapInwardGlowConfig) => {
        updates.push(value)
        state.value = value
      }
    })
  })
  app.mount(root)
  await nextTick()
  return { app, root, state, updates }
}

function input(root: HTMLElement, id: string): HTMLInputElement {
  return root.querySelector<HTMLInputElement>(`#${id}`)!
}

function button(root: HTMLElement, label: string): HTMLButtonElement {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('button'))
    .find((candidate) => candidate.textContent === label)!
}

afterEach(() => document.body.replaceChildren())

describe('MapInwardGlowControls', () => {
  it('renders every stable inward parameter and no retired wave controls', async () => {
    const { app, root } = await mountControls()

    expect(root.querySelector('#effect-base-inward-enabled-checkbox')).not.toBeNull()
    expect(root.querySelector('#effect-base-inward-color-color')).not.toBeNull()
    expect(root.querySelector('#effect-base-inward-color-hex')).not.toBeNull()
    expect(root.textContent).toContain('已启用')

    const ranges: Array<[string, string, string, string]> = [
      ['width', '0', '200', '1'],
      ['strength', '0', '1', '0.01'],
      ['maxAlpha', '0.1', '1', '0.01'],
      ['nearRadiusRatio', '0', '1.5', '0.01'],
      ['nearOpacityRatio', '0', '2', '0.01'],
      ['farRadiusRatio', '0.25', '2', '0.01'],
      ['farOpacityRatio', '0', '2', '0.01'],
      ['falloff', '0.25', '4', '0.05'],
      ['edgeSoftness', '0', '1', '0.01'],
      ['nearPasses', '1', '8', '1'],
      ['farPasses', '1', '8', '1'],
      ['baseRatio', '0', '1', '0.01']
    ]
    for (const [key, min, max, step] of ranges) {
      const number = input(root, `effect-base-inward-${key}-number`)
      expect([number.min, number.max, number.step]).toEqual([min, max, step])
      expect(root.querySelector(`#effect-base-inward-${key}-range`)).not.toBeNull()
    }

    expect(root.textContent).not.toContain('向内传播波')
    expect(root.querySelector('[id*="wave"]')).toBeNull()
    app.unmount()
  })

  it('emits immutable stable-light updates without mutating the model prop', async () => {
    const { app, root, state, updates } = await mountControls()
    const original = state.value

    const enabled = input(root, 'effect-base-inward-enabled-checkbox')
    enabled.checked = false
    enabled.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()

    expect(original.enabled).toBe(true)
    expect(updates[0]).not.toBe(original)
    expect(updates[0].enabled).toBe(false)
    app.unmount()
  })

  it('keeps numeric typing as a draft and clamps only on blur or change', async () => {
    const { app, root, state, updates } = await mountControls('hover')
    const width = input(root, 'effect-hover-inward-width-number')

    width.value = '999'
    width.dispatchEvent(new InputEvent('input', { bubbles: true }))
    await nextTick()
    expect(width.value).toBe('999')
    expect(state.value.width).toBe(HOVER_INWARD_GLOW_DEFAULTS.width)
    expect(updates).toHaveLength(0)

    width.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
    await nextTick()
    expect(width.value).toBe('200')
    expect(state.value.width).toBe(200)

    const passes = input(root, 'effect-hover-inward-nearPasses-number')
    passes.value = '6.6'
    passes.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(passes.value).toBe('7')
    expect(state.value.nearPasses).toBe(7)
    app.unmount()
  })

  it('emits once when a number input changes and then blurs', async () => {
    const { app, root, updates } = await mountControls()
    const width = input(root, 'effect-base-inward-width-number')

    width.value = '96'
    width.dispatchEvent(new InputEvent('input', { bubbles: true }))
    width.dispatchEvent(new Event('change', { bubbles: true }))
    width.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
    await nextTick()

    expect(updates).toHaveLength(1)
    expect(updates[0].width).toBe(96)
    app.unmount()
  })

  it('re-emits a slider value after an external model reset', async () => {
    const { app, root, state, updates } = await mountControls()
    const width = input(root, 'effect-base-inward-width-range')

    width.value = '96'
    width.dispatchEvent(new InputEvent('input', { bubbles: true }))
    await nextTick()
    expect(updates).toHaveLength(1)

    state.value = cloneInwardGlowConfig(BASE_INWARD_GLOW_DEFAULTS)
    await nextTick()
    width.value = '96'
    width.dispatchEvent(new InputEvent('input', { bubbles: true }))
    await nextTick()

    expect(updates).toHaveLength(2)
    expect(updates.at(-1)?.width).toBe(96)
    app.unmount()
  })

  it('routes B1 and group reset intentions through the visual session owner', async () => {
    const { app, root, state, updates } = await mountControls('hover')
    const session = useMapVisualSettings()
    session.resetVisualSession()
    state.value.width = 111
    session.setEffectHoverField('emissiveIntensity', 1.2)
    session.replaceEffectInwardGlow('hover', state.value)
    await nextTick()

    button(root, '应用 B1 预设').click()
    await nextTick()
    expect(session.effect.hover.inwardGlow).toEqual(HOVER_INWARD_GLOW_DEFAULTS)
    expect(session.effect.hover.emissiveIntensity).toBe(1.2)
    expect(updates).toHaveLength(0)

    session.effect.hover.inwardGlow.width = 99
    button(root, '重置本组').click()
    await nextTick()
    expect(session.effect.hover.inwardGlow).toEqual(HOVER_INWARD_GLOW_DEFAULTS)
    app.unmount()
  })
})
