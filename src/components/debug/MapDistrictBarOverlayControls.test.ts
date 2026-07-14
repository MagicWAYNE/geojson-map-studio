// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick, reactive, type App } from 'vue'
import {
  MAP_DISTRICT_BAR_OVERLAY_DEFAULTS,
  MAP_DISTRICT_BAR_OVERLAY_NUMBER_CONSTRAINTS,
  cloneDistrictBarOverlayConfig,
  type MapDistrictBarOverlayConfig
} from '@/components/map/mapDistrictBarOverlayConfig'
import MapDistrictBarOverlayControls, {
  MAP_DISTRICT_BAR_OVERLAY_CONTROL_GROUPS
} from './MapDistrictBarOverlayControls.vue'

interface MountedControls {
  app: App
  root: HTMLDivElement
  state: { value: MapDistrictBarOverlayConfig }
  updates: MapDistrictBarOverlayConfig[]
}

async function mountControls(): Promise<MountedControls> {
  const state = reactive({
    value: cloneDistrictBarOverlayConfig(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS)
  })
  const updates: MapDistrictBarOverlayConfig[] = []
  const root = document.createElement('div')
  const app = createApp({
    render: () => h(MapDistrictBarOverlayControls, {
      modelValue: state.value,
      'onUpdate:modelValue': (value: MapDistrictBarOverlayConfig) => {
        updates.push(value)
        state.value = value
      }
    })
  })
  app.mount(root)
  await nextTick()
  return { app, root, state, updates }
}

function leafPaths(value: unknown, prefix: string[] = []): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return [prefix.join('.')]
  }
  return Object.entries(value).flatMap(([key, child]) => leafPaths(child, [...prefix, key]))
}

const EXPECTED_NUMBER_METADATA: Record<string, readonly [number, number, number]> = {
  'badge.minWidth': [48, 180, 1],
  'badge.height': [24, 60, 1],
  'badge.paddingX': [0, 40, 1],
  'badge.gapY': [0, 80, 1],
  'badge.offsetX': [-200, 200, 1],
  'badge.offsetY': [-200, 200, 1],
  'badge.backgroundOpacity': [0, 1, 0.01],
  'badge.borderWidth': [0, 8, 0.1],
  'badge.borderRadius': [0, 40, 1],
  'badge.fontSize': [12, 40, 1],
  'badge.fontWeight': [100, 900, 100],
  'badge.shadowBlur': [0, 40, 1],
  'badge.shadowOpacity': [0, 1, 0.01],
  'badge.decimals': [0, 4, 1],
  'badge.enterDelayMs': [0, 1000, 10],
  'badge.enterMs': [0, 1000, 10],
  'badge.staggerMs': [0, 1000, 10],
  'panel.gapX': [0, 80, 1],
  'panel.offsetY': [-200, 200, 1],
  'panel.width': [240, 520, 1],
  'panel.minHeight': [90, 220, 1],
  'panel.viewportPadding': [0, 80, 1],
  'panel.backgroundOpacity': [0, 1, 0.01],
  'panel.borderWidth': [0, 8, 0.1],
  'panel.borderRadius': [0, 40, 1],
  'panel.paddingTop': [0, 80, 1],
  'panel.paddingRight': [0, 80, 1],
  'panel.paddingBottom': [0, 80, 1],
  'panel.paddingLeft': [0, 80, 1],
  'panel.rowGap': [0, 80, 1],
  'panel.titleAssetWidth': [80, 220, 1],
  'panel.titleAssetHeight': [24, 120, 1],
  'panel.titleOffsetX': [-80, 80, 1],
  'panel.titleOffsetY': [-80, 80, 1],
  'panel.titleTextOffsetX': [-80, 80, 1],
  'panel.titleTextOffsetY': [-80, 80, 1],
  'panel.titleFontSize': [12, 40, 1],
  'panel.titleFontWeight': [100, 900, 100],
  'panel.labelFontSize': [12, 40, 1],
  'panel.labelFontWeight': [100, 900, 100],
  'panel.valueFontSize': [12, 40, 1],
  'panel.valueFontWeight': [100, 900, 100],
  'panel.unitFontSize': [12, 40, 1],
  'panel.unitFontWeight': [100, 900, 100],
  'panel.caseDecimals': [0, 4, 1],
  'panel.amountDecimals': [0, 4, 1],
  'panel.enterMs': [0, 1000, 10],
  'panel.leaveMs': [0, 1000, 10],
  'panel.enterScale': [0.5, 1, 0.01],
  'collision.badgeCollisionGap': [0, 80, 1],
  'collision.badgeMaxShift': [0, 200, 1]
}

const EXPECTED_BOOL_PATHS = [
  'enabled',
  'badge.enabled',
  'badge.thousandsSeparator',
  'badge.hideOnHover',
  'panel.enabled',
  'panel.thousandsSeparator',
  'collision.badgeCollisionEnabled'
]

const EXPECTED_COLOR_PATHS = [
  'badge.backgroundColor',
  'badge.borderColor',
  'badge.textColor',
  'badge.shadowColor',
  'panel.backgroundColor',
  'panel.borderColor',
  'panel.titleColor',
  'panel.labelColor',
  'panel.valueColor',
  'panel.unitColor'
]

afterEach(() => document.body.replaceChildren())

describe('MapDistrictBarOverlayControls', () => {
  it('exposes every overlay leaf exactly once across the nine approved groups', async () => {
    const descriptorPaths = MAP_DISTRICT_BAR_OVERLAY_CONTROL_GROUPS.flatMap((group) =>
      group.fields.map((field) => field.path.join('.'))
    )
    const defaultPaths = leafPaths(MAP_DISTRICT_BAR_OVERLAY_DEFAULTS)

    expect(MAP_DISTRICT_BAR_OVERLAY_CONTROL_GROUPS.map((group) => group.id)).toEqual([
      'master',
      'badge-layout',
      'badge-appearance',
      'badge-format-animation',
      'panel-layout',
      'panel-box',
      'panel-title',
      'panel-format-animation',
      'collision'
    ])
    expect(descriptorPaths).toHaveLength(new Set(descriptorPaths).size)
    expect([...descriptorPaths].sort()).toEqual([...defaultPaths].sort())

    const { app, root } = await mountControls()
    for (const group of MAP_DISTRICT_BAR_OVERLAY_CONTROL_GROUPS) {
      expect(root.querySelector(`[data-testid="overlay-group-${group.id}"]`)).not.toBeNull()
    }
    app.unmount()
  })

  it('matches the complete approved kind and numeric metadata matrix', () => {
    const fields = MAP_DISTRICT_BAR_OVERLAY_CONTROL_GROUPS.flatMap((group) => group.fields)
    const fieldsByKind = (kind: string) => fields
      .filter((field) => field.kind === kind)
      .map((field) => field.path.join('.'))
      .sort()
    const numberMetadata = Object.fromEntries(fields
      .filter((field) => field.kind === 'number')
      .map((field) => [field.path.join('.'), [field.min, field.max, field.step]]))
    const sharedNumberMetadata = Object.fromEntries(Object.entries(
      MAP_DISTRICT_BAR_OVERLAY_NUMBER_CONSTRAINTS
    ).flatMap(([section, constraints]) => Object.entries(constraints).map(([key, value]) => [
      `${section}.${key}`,
      [value.min, value.max, value.step]
    ])))

    expect(fieldsByKind('bool')).toEqual([...EXPECTED_BOOL_PATHS].sort())
    expect(fieldsByKind('color')).toEqual([...EXPECTED_COLOR_PATHS].sort())
    expect(fieldsByKind('select')).toEqual(['panel.preferredSide'])
    expect(numberMetadata).toEqual(EXPECTED_NUMBER_METADATA)
    expect(sharedNumberMetadata).toEqual(EXPECTED_NUMBER_METADATA)

    const select = fields.find((field) => field.kind === 'select')
    expect(select).toMatchObject({
      path: ['panel', 'preferredSide'],
      options: [
        { value: 'right', label: '柱体右侧' },
        { value: 'left', label: '柱体左侧' }
      ]
    })
  })

  it('emits normalized deep clones for bool, color, and select controls', async () => {
    const { app, root, state, updates } = await mountControls()
    const original = state.value
    const originalBadge = original.badge
    const originalPanel = original.panel

    const enabled = root.querySelector<HTMLInputElement>(
      '#effect-bars-overlay-badge-enabled-checkbox'
    )!
    enabled.checked = false
    enabled.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(state.value.badge.enabled).toBe(false)
    expect(state.value).not.toBe(original)
    expect(state.value.badge).not.toBe(originalBadge)
    expect(state.value.panel).not.toBe(originalPanel)

    const color = root.querySelector<HTMLInputElement>(
      '#effect-bars-overlay-badge-textColor-hex'
    )!
    const beforeColor = updates.length
    color.value = '#ABCDEF'
    color.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(state.value.badge.textColor).toBe('#abcdef')
    expect(updates).toHaveLength(beforeColor + 1)

    const updateCount = updates.length
    color.value = 'cyan'
    color.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(color.value).toBe('#abcdef')
    expect(updates).toHaveLength(updateCount)

    const preferredSide = root.querySelector<HTMLSelectElement>(
      '#effect-bars-overlay-panel-preferredSide-select'
    )!
    preferredSide.value = 'left'
    preferredSide.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(state.value.panel.preferredSide).toBe('left')
    app.unmount()
  })

  it('uses normalizer bounds, restores invalid drafts, and deduplicates change plus blur', async () => {
    const { app, root, state, updates } = await mountControls()
    const minWidth = root.querySelector<HTMLInputElement>(
      '#effect-bars-overlay-badge-minWidth-number'
    )!

    minWidth.value = '999'
    minWidth.dispatchEvent(new InputEvent('input', { bubbles: true }))
    minWidth.dispatchEvent(new Event('change', { bubbles: true }))
    minWidth.dispatchEvent(new FocusEvent('blur', { bubbles: true }))
    await nextTick()

    expect(state.value.badge.minWidth).toBe(180)
    expect(minWidth.value).toBe('180')
    expect(updates).toHaveLength(1)

    minWidth.value = 'not-a-number'
    minWidth.dispatchEvent(new InputEvent('input', { bubbles: true }))
    minWidth.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(minWidth.value).toBe('180')
    expect(state.value.badge.minWidth).toBe(180)
    expect(updates).toHaveLength(1)

    const decimals = root.querySelector<HTMLInputElement>(
      '#effect-bars-overlay-panel-amountDecimals-number'
    )!
    decimals.value = '3.6'
    decimals.dispatchEvent(new Event('change', { bubbles: true }))
    await nextTick()
    expect(state.value.panel.amountDecimals).toBe(4)
    app.unmount()
  })
})
