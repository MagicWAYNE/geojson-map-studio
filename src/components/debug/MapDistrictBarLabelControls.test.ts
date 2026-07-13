// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, reactive } from 'vue'
import {
  MAP_DISTRICT_BAR_LABEL_DEFAULTS,
  cloneDistrictBarLabelConfig,
  type MapDistrictBarLabelConfig
} from '@/components/map/mapDistrictBarLabelConfig'
import MapDistrictBarLabelControls from './MapDistrictBarLabelControls.vue'

async function mountControls() {
  const state = reactive({ value: cloneDistrictBarLabelConfig(MAP_DISTRICT_BAR_LABEL_DEFAULTS) })
  const root = document.createElement('div')
  const app = createApp({
    render: () => h(MapDistrictBarLabelControls, {
      modelValue: state.value,
      'onUpdate:modelValue': (value: MapDistrictBarLabelConfig) => (state.value = value)
    })
  })
  app.mount(root)
  await nextTick()
  return { app, root, state }
}

afterEach(() => document.body.replaceChildren())

describe('MapDistrictBarLabelControls', () => {
  it('exposes every approved tuning group and stable controls', async () => {
    const { app, root } = await mountControls()
    for (const title of ['显示与定位', '背景素材', '案件 ICON', '单行文字', '动画与布局保护']) {
      expect(root.textContent).toContain(title)
    }
    expect(root.querySelector('#effect-bars-label-enabled-checkbox')).not.toBeNull()
    expect(root.querySelector('#effect-bars-label-depthTest-checkbox')).not.toBeNull()
    expect(root.querySelector('#effect-bars-label-collisionEnabled-checkbox')).not.toBeNull()
    expect(root.querySelector('#effect-bars-label-tintColor-color')).not.toBeNull()
    expect(root.querySelector('#effect-bars-label-districtColor-hex')).not.toBeNull()
    expect(root.querySelector('#effect-bars-label-width-number')?.getAttribute('max')).toBe('420')
    expect(root.querySelector('#effect-bars-label-hoverBrightness-number')?.getAttribute('max')).toBe('2')
    expect(root.querySelector('#effect-bars-label-hueRotate-number')?.getAttribute('min')).toBe('-180')
    expect(root.querySelector('#effect-bars-label-valueDecimals-number')?.getAttribute('max')).toBe('2')
    expect(root.querySelector('#effect-bars-label-collisionMaxShift-number')?.getAttribute('max')).toBe('200')
    app.unmount()
  })

  it('normalizes and emits checkbox, color, and numeric edits immediately', async () => {
    const { app, root, state } = await mountControls()
    const width = root.querySelector<HTMLInputElement>('#effect-bars-label-width-number')!
    width.value = '300'
    width.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(state.value.width).toBe(300)

    const color = root.querySelector<HTMLInputElement>('#effect-bars-label-valueColor-hex')!
    color.value = '#ABCDEF'
    color.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(state.value.valueColor).toBe('#abcdef')

    const collision = root.querySelector<HTMLInputElement>('#effect-bars-label-collisionEnabled-checkbox')!
    collision.checked = true
    collision.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(state.value.collisionEnabled).toBe(true)
    app.unmount()
  })

  it('rejects an invalid hex draft without replacing the current tuned color', async () => {
    const { app, root, state } = await mountControls()
    state.value.valueColor = '#abcdef'
    await nextTick()
    const color = root.querySelector<HTMLInputElement>('#effect-bars-label-valueColor-hex')!

    color.value = 'invalid'
    color.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()

    expect(state.value.valueColor).toBe('#abcdef')
    expect(color.value).toBe('#abcdef')
    app.unmount()
  })
})
