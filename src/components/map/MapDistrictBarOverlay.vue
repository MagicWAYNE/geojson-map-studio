<script setup lang="ts">
import {
  onBeforeUnmount,
  onMounted,
  reactive,
  type ComponentPublicInstance,
  type CSSProperties
} from 'vue'
import titleAssetUrl from '@/assets/images/map-district-bar-hover-title.svg'
import type { MapDistrictBarOverlayConfig } from './mapDistrictBarOverlayConfig'
import type {
  DistrictBarBadgeOverlayLayout,
  DistrictBarOverlayLayout,
  DistrictBarOverlayMeasuredSizes
} from './mapDistrictBarOverlayLayout'

const props = defineProps<{
  layout: Readonly<DistrictBarOverlayLayout>
  config: Readonly<MapDistrictBarOverlayConfig>
}>()

const emit = defineEmits<{
  'sizes-change': [sizes: DistrictBarOverlayMeasuredSizes]
}>()

type StyleWithVariables = CSSProperties & Record<`--${string}`, string>
type TemplateElement = Element | ComponentPublicInstance | null

const badgeElements = new Map<string, HTMLElement>()
const badgeRefCallbacks = new Map<string, (element: TemplateElement) => void>()
const measuredBadges = new Map<string, { width: number, height: number }>()
const enteredBadgeNames = reactive(new Set<string>())
let measuredPanel: { width: number, height: number } | undefined
let currentPanelElement: HTMLElement | null = null
let resizeObserver: ResizeObserver | null = null
let sizesChangeScheduled = false
let isUnmounting = false

function emitMeasuredSizes(): void {
  if (isUnmounting) return
  emit('sizes-change', {
    badgeByName: new Map(measuredBadges),
    ...(measuredPanel ? { panel: { ...measuredPanel } } : {})
  })
}

function scheduleSizesChange(): void {
  if (isUnmounting || sizesChangeScheduled) return
  sizesChangeScheduled = true
  queueMicrotask(() => {
    sizesChangeScheduled = false
    emitMeasuredSizes()
  })
}

function htmlElement(value: TemplateElement): HTMLElement | null {
  return value instanceof HTMLElement ? value : null
}

function badgeElementRef(name: string): (element: TemplateElement) => void {
  const existing = badgeRefCallbacks.get(name)
  if (existing) return existing
  const callback = (value: TemplateElement) => {
    const next = htmlElement(value)
    const previous = badgeElements.get(name)
    if (previous === next) return
    if (previous) {
      resizeObserver?.unobserve(previous)
      if (measuredBadges.delete(name)) scheduleSizesChange()
    }
    if (next) {
      badgeElements.set(name, next)
      resizeObserver?.observe(next)
    } else {
      badgeElements.delete(name)
      if (!props.layout.badges.some((badge) => badge.name === name)) {
        enteredBadgeNames.delete(name)
      }
    }
  }
  badgeRefCallbacks.set(name, callback)
  return callback
}

function panelElementRef(value: TemplateElement): void {
  const next = htmlElement(value)
  if (currentPanelElement === next) return
  if (currentPanelElement) resizeObserver?.unobserve(currentPanelElement)
  const clearedMeasuredPanel = measuredPanel !== undefined
  currentPanelElement = next
  measuredPanel = undefined
  if (clearedMeasuredPanel) scheduleSizesChange()
  if (next) resizeObserver?.observe(next)
}

function entrySize(entry: ResizeObserverEntry): { width: number, height: number } {
  const borderBoxes = entry.borderBoxSize as unknown as
    | ResizeObserverSize
    | readonly ResizeObserverSize[]
    | undefined
  const borderBox = Array.isArray(borderBoxes) ? borderBoxes[0] : borderBoxes
  if (
    borderBox &&
    Number.isFinite(borderBox.inlineSize) &&
    Number.isFinite(borderBox.blockSize)
  ) {
    return { width: borderBox.inlineSize, height: borderBox.blockSize }
  }
  const element = entry.target as HTMLElement
  return { width: element.offsetWidth, height: element.offsetHeight }
}

function sizeChanged(
  previous: { width: number, height: number } | undefined,
  next: { width: number, height: number }
): boolean {
  return previous === undefined ||
    Math.abs(previous.width - next.width) > 0.25 ||
    Math.abs(previous.height - next.height) > 0.25
}

function handleResize(entries: ResizeObserverEntry[]): void {
  if (isUnmounting) return
  let changed = false
  for (const entry of entries) {
    const target = entry.target as HTMLElement
    const name = target.dataset.badgeName
    if (name && badgeElements.get(name) === target) {
      const next = entrySize(entry)
      if (sizeChanged(measuredBadges.get(name), next)) {
        measuredBadges.set(name, next)
        changed = true
      }
      continue
    }
    if (target === currentPanelElement) {
      const next = entrySize(entry)
      if (sizeChanged(measuredPanel, next)) {
        measuredPanel = next
        changed = true
      }
    }
  }
  if (!changed) return
  emitMeasuredSizes()
}

onMounted(() => {
  if (typeof ResizeObserver === 'undefined') return
  resizeObserver = new ResizeObserver(handleResize)
  for (const element of badgeElements.values()) resizeObserver.observe(element)
  if (currentPanelElement) resizeObserver.observe(currentPanelElement)
})

onBeforeUnmount(() => {
  isUnmounting = true
  resizeObserver?.disconnect()
  resizeObserver = null
})

function pixels(value: number): string {
  return `${value}px`
}

function milliseconds(value: number): string {
  return `${value}ms`
}

function rgba(color: string, opacity: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(color)
  if (!match) return color
  const channels = [0, 2, 4].map((offset) => Number.parseInt(match[1].slice(offset, offset + 2), 16))
  return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${opacity})`
}

function badgeStyle(badge: DistrictBarBadgeOverlayLayout): StyleWithVariables {
  const config = props.config.badge
  const delayMs = config.enterDelayMs + badge.order * config.staggerMs
  const style: StyleWithVariables = {
    '--district-bar-badge-min-width': pixels(config.minWidth),
    '--district-bar-badge-height': pixels(config.height),
    '--district-bar-badge-padding-x': pixels(config.paddingX),
    '--district-bar-badge-background': rgba(config.backgroundColor, config.backgroundOpacity),
    '--district-bar-badge-border-color': config.borderColor,
    '--district-bar-badge-border-width': pixels(config.borderWidth),
    '--district-bar-badge-radius': pixels(config.borderRadius),
    '--district-bar-badge-text-color': config.textColor,
    '--district-bar-badge-font-size': pixels(config.fontSize),
    '--district-bar-badge-font-weight': String(config.fontWeight),
    '--district-bar-badge-shadow': `0 0 ${pixels(config.shadowBlur)} ${rgba(config.shadowColor, config.shadowOpacity)}`,
    '--district-bar-badge-enter-ms': milliseconds(config.enterMs),
    '--district-bar-badge-delay': milliseconds(
      enteredBadgeNames.has(badge.name)
        ? 0
        : delayMs
    )
  }
  if (badge.rect) {
    style.left = pixels(badge.rect.left)
    style.top = pixels(badge.rect.top)
  }
  return style
}

function badgeIsEntering(badge: DistrictBarBadgeOverlayLayout): boolean {
  return badge.visible && badge.rect !== null && !enteredBadgeNames.has(badge.name)
}

function handleBadgeAnimationEnd(
  badge: DistrictBarBadgeOverlayLayout,
  event: AnimationEvent
): void {
  if (event.target !== event.currentTarget) return
  const element = event.currentTarget
  if (!(element instanceof HTMLElement)) return
  if (element.dataset.badgeName !== badge.name || badgeElements.get(badge.name) !== element) return
  if (enteredBadgeNames.has(badge.name)) return
  const current = props.layout.badges.find((candidate) => candidate.name === badge.name)
  if (!current?.visible || current.rect === null) return
  enteredBadgeNames.add(badge.name)
}

function panelStyle(): StyleWithVariables {
  const panel = props.layout.panel!
  const config = props.config.panel
  return {
    left: pixels(panel.rect.left),
    top: pixels(panel.rect.top),
    transformOrigin: panel.side === 'left' ? 'right center' : 'left center',
    '--district-bar-panel-width': pixels(config.width),
    '--district-bar-panel-min-height': pixels(config.minHeight),
    '--district-bar-panel-background': rgba(config.backgroundColor, config.backgroundOpacity),
    '--district-bar-panel-border-color': config.borderColor,
    '--district-bar-panel-border-width': pixels(config.borderWidth),
    '--district-bar-panel-radius': pixels(config.borderRadius),
    '--district-bar-panel-padding-top': pixels(config.paddingTop),
    '--district-bar-panel-padding-right': pixels(config.paddingRight),
    '--district-bar-panel-padding-bottom': pixels(config.paddingBottom),
    '--district-bar-panel-padding-left': pixels(config.paddingLeft),
    '--district-bar-panel-row-gap': pixels(config.rowGap),
    '--district-bar-panel-title-width': pixels(config.titleAssetWidth),
    '--district-bar-panel-title-height': pixels(config.titleAssetHeight),
    '--district-bar-panel-title-x': pixels(config.titleOffsetX),
    '--district-bar-panel-title-y': pixels(config.titleOffsetY),
    '--district-bar-panel-title-text-x': pixels(config.titleTextOffsetX),
    '--district-bar-panel-title-text-y': pixels(config.titleTextOffsetY),
    '--district-bar-panel-title-color': config.titleColor,
    '--district-bar-panel-title-font-size': pixels(config.titleFontSize),
    '--district-bar-panel-title-font-weight': String(config.titleFontWeight),
    '--district-bar-panel-label-color': config.labelColor,
    '--district-bar-panel-label-font-size': pixels(config.labelFontSize),
    '--district-bar-panel-label-font-weight': String(config.labelFontWeight),
    '--district-bar-panel-value-color': config.valueColor,
    '--district-bar-panel-value-font-size': pixels(config.valueFontSize),
    '--district-bar-panel-value-font-weight': String(config.valueFontWeight),
    '--district-bar-panel-unit-color': config.unitColor,
    '--district-bar-panel-unit-font-size': pixels(config.unitFontSize),
    '--district-bar-panel-unit-font-weight': String(config.unitFontWeight),
    '--district-bar-panel-enter-ms': milliseconds(config.enterMs),
    '--district-bar-panel-leave-ms': milliseconds(config.leaveMs),
    '--district-bar-panel-enter-scale': String(config.enterScale)
  }
}

</script>

<template>
  <div class="map-district-bar-overlay" aria-hidden="true">
    <div
      v-for="badge in layout.badges"
      :key="badge.name"
      :ref="badgeElementRef(badge.name)"
      class="district-bar-badge"
      :class="{
        'is-visible': badge.visible && badge.rect !== null,
        'is-entering': badgeIsEntering(badge)
      }"
      :data-badge-name="badge.name"
      :style="badgeStyle(badge)"
      @animationend="handleBadgeAnimationEnd(badge, $event)"
    >
      {{ badge.text }}
    </div>

    <Transition
      name="district-bar-panel"
      :duration="{ enter: config.panel.enterMs, leave: config.panel.leaveMs }"
    >
      <section
        v-if="layout.panel"
        :key="layout.panel.name"
        :ref="panelElementRef"
        class="district-bar-panel"
        :data-panel-name="layout.panel.name"
        :style="panelStyle()"
      >
        <img
          class="district-bar-panel-title-image"
          :src="titleAssetUrl"
          alt=""
          :draggable="false"
        >
        <span class="district-bar-panel-title-text">{{ layout.panel.titleText }}</span>
        <div class="district-bar-panel-row">
          <span class="district-bar-panel-label">案件量：</span><span class="district-bar-panel-value">{{ layout.panel.caseText }}</span><span class="district-bar-panel-unit"> 件</span>
        </div>
        <div class="district-bar-panel-row">
          <span class="district-bar-panel-label">在调金额：</span><span class="district-bar-panel-value">{{ layout.panel.amountText }}</span><span class="district-bar-panel-unit"> 万元</span>
        </div>
      </section>
    </Transition>
  </div>
</template>

<style scoped>
.map-district-bar-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  overflow: hidden;
}

.map-district-bar-overlay,
.map-district-bar-overlay * {
  pointer-events: none;
}

.district-bar-badge,
.district-bar-panel {
  position: absolute;
  box-sizing: border-box;
}

.district-bar-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: var(--district-bar-badge-min-width);
  height: var(--district-bar-badge-height);
  padding: 0 var(--district-bar-badge-padding-x);
  color: var(--district-bar-badge-text-color);
  font-family: Bebas, 'Microsoft Yahei', sans-serif;
  font-size: var(--district-bar-badge-font-size);
  font-weight: var(--district-bar-badge-font-weight);
  white-space: nowrap;
  background: var(--district-bar-badge-background);
  border: var(--district-bar-badge-border-width) solid var(--district-bar-badge-border-color);
  border-radius: var(--district-bar-badge-radius);
  box-shadow: var(--district-bar-badge-shadow);
  opacity: 0;
  visibility: hidden;
  transform: translateY(4px);
  transition:
    opacity var(--district-bar-badge-enter-ms) ease 0ms,
    transform var(--district-bar-badge-enter-ms) ease 0ms,
    visibility 0s linear var(--district-bar-badge-enter-ms);
}

.district-bar-badge.is-visible {
  opacity: 1;
  visibility: visible;
  transform: none;
  transition:
    opacity var(--district-bar-badge-enter-ms) ease 0ms,
    transform var(--district-bar-badge-enter-ms) ease 0ms,
    visibility 0s linear 0ms;
}

.district-bar-badge.is-visible.is-entering {
  animation-name: district-bar-badge-enter;
  animation-duration: var(--district-bar-badge-enter-ms);
  animation-timing-function: ease;
  animation-delay: var(--district-bar-badge-delay);
  animation-fill-mode: both;
}

@keyframes district-bar-badge-enter {
  from {
    opacity: 0;
    transform: translateY(4px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

.district-bar-panel {
  display: flex;
  flex-direction: column;
  width: var(--district-bar-panel-width);
  min-height: var(--district-bar-panel-min-height);
  padding:
    var(--district-bar-panel-padding-top)
    var(--district-bar-panel-padding-right)
    var(--district-bar-panel-padding-bottom)
    var(--district-bar-panel-padding-left);
  gap: var(--district-bar-panel-row-gap);
  background: var(--district-bar-panel-background);
  border: var(--district-bar-panel-border-width) solid var(--district-bar-panel-border-color);
  border-radius: var(--district-bar-panel-radius);
}

.district-bar-panel-title-image {
  position: absolute;
  left: calc(50% + var(--district-bar-panel-title-x));
  top: var(--district-bar-panel-title-y);
  width: var(--district-bar-panel-title-width);
  height: var(--district-bar-panel-title-height);
  pointer-events: none;
  transform: translateX(-50%);
}

.district-bar-panel-title-text {
  position: absolute;
  left: calc(50% + var(--district-bar-panel-title-x) + var(--district-bar-panel-title-text-x));
  top: calc(var(--district-bar-panel-title-y) + var(--district-bar-panel-title-text-y));
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--district-bar-panel-title-width);
  height: var(--district-bar-panel-title-height);
  color: var(--district-bar-panel-title-color);
  font-size: var(--district-bar-panel-title-font-size);
  font-weight: var(--district-bar-panel-title-font-weight);
  text-align: center;
  pointer-events: none;
  transform: translateX(-50%);
}

.district-bar-panel-row {
  display: flex;
  align-items: baseline;
  pointer-events: none;
}

.district-bar-panel-label {
  color: var(--district-bar-panel-label-color);
  font-size: var(--district-bar-panel-label-font-size);
  font-weight: var(--district-bar-panel-label-font-weight);
}

.district-bar-panel-value {
  color: var(--district-bar-panel-value-color);
  font-family: Bebas, 'Microsoft Yahei', sans-serif;
  font-size: var(--district-bar-panel-value-font-size);
  font-weight: var(--district-bar-panel-value-font-weight);
}

.district-bar-panel-unit {
  color: var(--district-bar-panel-unit-color);
  font-size: var(--district-bar-panel-unit-font-size);
  font-weight: var(--district-bar-panel-unit-font-weight);
}

.district-bar-panel-enter-active {
  transition:
    opacity var(--district-bar-panel-enter-ms) ease,
    transform var(--district-bar-panel-enter-ms) ease;
}

.district-bar-panel-leave-active {
  transition:
    opacity var(--district-bar-panel-leave-ms) ease,
    transform var(--district-bar-panel-leave-ms) ease;
}

.district-bar-panel-enter-from,
.district-bar-panel-leave-to {
  opacity: 0;
  transform: scale(var(--district-bar-panel-enter-scale));
}
</style>
