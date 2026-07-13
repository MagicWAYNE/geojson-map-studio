// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, reactive, type App } from 'vue'
import {
  MAP_DISTRICT_BAR_DEFAULTS,
  cloneDistrictBarConfig,
  type MapDistrictBarConfig
} from '@/components/map/mapDistrictBarConfig'
import type { MapDistrictBarRuntimeStatus } from '@/composables/useMapDebug'
import MapDistrictBarControls from './MapDistrictBarControls.vue'

interface MountedControls {
  app: App
  root: HTMLDivElement
  state: { value: MapDistrictBarConfig }
  updates: MapDistrictBarConfig[]
}

async function mountControls(): Promise<MountedControls> {
  const state = reactive({ value: cloneDistrictBarConfig(MAP_DISTRICT_BAR_DEFAULTS) })
  const updates: MapDistrictBarConfig[] = []
  const runtimeStatus: MapDistrictBarRuntimeStatus = {
    renderedCount: 8,
    dataMin: 10,
    dataMax: 80,
    degraded: false
  }
  const root = document.createElement('div')
  const app = createApp({
    render: () => h(MapDistrictBarControls, {
      modelValue: state.value,
      runtimeStatus,
      'onUpdate:modelValue': (value: MapDistrictBarConfig) => {
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

afterEach(() => document.body.replaceChildren())

describe('MapDistrictBarControls', () => {
  it('renders every bar parameter with stable ids and Task 1 bounds', async () => {
    const { app, root } = await mountControls()

    expect(input(root, 'effect-bars-enabled-checkbox').type).toBe('checkbox')
    expect(input(root, 'effect-bars-color-color').type).toBe('color')
    expect(input(root, 'effect-bars-color-hex').type).toBe('text')
    expect(input(root, 'effect-bars-pulseEnabled-checkbox').type).toBe('checkbox')
    expect(input(root, 'effect-bars-pulseColor-color').type).toBe('color')
    expect(input(root, 'effect-bars-pulseColor-hex').type).toBe('text')
    expect(root.textContent).toContain('有效柱体：8')
    expect(root.textContent).toContain('案件量范围：10–80')
    expect(root.textContent).toContain('柱体主体：不透明')
    expect(root.textContent).toContain('脉冲环：启用')
    expect(root.textContent).toContain('柱体层：正常')

    const ranges: Array<[keyof Omit<MapDistrictBarConfig, 'enabled' | 'color'>, string, string]> = [
      ['width', '0.25', '8'],
      ['anchorOffsetX', '-20', '20'],
      ['anchorOffsetY', '-20', '20'],
      ['baseOffset', '-2', '6'],
      ['minHeight', '0', '24'],
      ['maxHeight', '0', '24'],
      ['sqrtExponent', '0.25', '1'],
      ['glowStrength', '0', '2'],
      ['baseRingRadius', '0', '4'],
      ['baseRingOpacity', '0', '1'],
      ['pulseWidth', '0.02', '0.5'],
      ['pulseOuterRadiusRatio', '0.05', '5'],
      ['pulseInnerRadiusRatio', '0.05', '5'],
      ['pulseOuterOpacity', '0', '1'],
      ['pulseInnerOpacity', '0', '1'],
      ['pulseDurationMs', '200', '6000'],
      ['pulseStaggerMs', '0', '1000'],
      ['enterMs', '0', '3000'],
      ['staggerMs', '0', '1000'],
      ['hoverEmissiveIntensity', '0', '3'],
      ['hoverLift', '0', '4']
    ]
    for (const [key, min, max] of ranges) {
      const number = input(root, `effect-bars-${key}-number`)
      expect([number.min, number.max]).toEqual([min, max])
      expect(input(root, `effect-bars-${key}-range`).type).toBe('range')
      expect(root.querySelector(`label[for="effect-bars-${key}-number"]`)?.textContent).not.toBe('')
    }
    expect(root.querySelector('#effect-bars-opacity-number')).toBeNull()
    app.unmount()
  })

  it('keeps invalid number input at the current value and prevents maxHeight below minHeight', async () => {
    const { app, root, state, updates } = await mountControls()
    const width = input(root, 'effect-bars-width-number')
    width.value = 'invalid'
    width.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(width.value).toBe(String(MAP_DISTRICT_BAR_DEFAULTS.width))
    expect(state.value.width).toBe(MAP_DISTRICT_BAR_DEFAULTS.width)
    expect(updates).toHaveLength(0)

    const maxHeight = input(root, 'effect-bars-maxHeight-number')
    maxHeight.value = '1'
    maxHeight.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(maxHeight.value).toBe(String(state.value.minHeight))
    expect(state.value.maxHeight).toBe(state.value.minHeight)
    app.unmount()
  })

  it('normalizes colors and emits one freshly cloned config for a committed number', async () => {
    const { app, root, state, updates } = await mountControls()
    const original = state.value
    const color = input(root, 'effect-bars-color-hex')
    color.value = '#ABCDEF'
    color.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(state.value.color).toBe('#abcdef')

    updates.length = 0
    const width = input(root, 'effect-bars-width-number')
    width.value = '4.5'
    width.dispatchEvent(new InputEvent('input', { bubbles: true }))
    width.dispatchEvent(new Event('change', { bubbles: true }))
    width.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
    await nextTick()

    expect(updates).toHaveLength(1)
    expect(updates[0]).not.toBe(original)
    expect(updates[0].width).toBe(4.5)
    app.unmount()
  })
})
