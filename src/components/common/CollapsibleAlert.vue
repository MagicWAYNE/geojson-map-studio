<script setup lang="ts">
import { ref, useId, watch } from 'vue'

const props = withDefaults(defineProps<{
  title: string
  tone: 'success' | 'warning' | 'error'
  meta?: string
  defaultOpen?: boolean
  resetKey?: unknown
}>(), {
  meta: '',
  defaultOpen: false,
  resetKey: undefined
})

const open = ref(props.defaultOpen)
const bodyId = `collapsible-alert-${useId()}`

watch(
  [() => props.defaultOpen, () => props.resetKey],
  () => { open.value = props.defaultOpen }
)
</script>

<template>
  <section
    class="collapsible-alert"
    :class="`is-${tone}`"
    :data-tone="tone"
    :role="tone === 'error' ? 'alert' : 'status'"
  >
    <button
      type="button"
      class="collapsible-alert__toggle"
      :aria-expanded="open"
      :aria-controls="bodyId"
      @click="open = !open"
    >
      <span class="collapsible-alert__indicator" aria-hidden="true"></span>
      <span class="collapsible-alert__title">{{ title }}</span>
      <span v-if="meta" class="collapsible-alert__meta">{{ meta }}</span>
      <svg
        class="collapsible-alert__chevron"
        :class="{ 'is-open': open }"
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 16 16"
        fill="none"
      >
        <path d="m4 6 4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <div :id="bodyId" v-show="open" class="collapsible-alert__body" data-alert-body>
      <slot />
    </div>
  </section>
</template>

<style scoped>
.collapsible-alert {
  --alert-color: #73d8ff;
  --alert-rgb: 115, 216, 255;
  overflow: hidden;
  background: rgba(8, 38, 75, 0.72);
  border: 1px solid rgba(var(--alert-rgb), 0.45);
  border-radius: 5px;
}
.collapsible-alert.is-success { --alert-color: #48e0c2; --alert-rgb: 72, 224, 194; }
.collapsible-alert.is-warning { --alert-color: #ffd36a; --alert-rgb: 255, 211, 106; }
.collapsible-alert.is-error { --alert-color: #ff8f85; --alert-rgb: 255, 143, 133; }
.collapsible-alert__toggle {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 42px;
  padding: 9px 12px;
  color: #dcecff;
  text-align: left;
  background: rgba(var(--alert-rgb), 0.09);
  border: 0;
  cursor: pointer;
}
.collapsible-alert__toggle:hover,
.collapsible-alert__toggle:focus-visible {
  background: rgba(var(--alert-rgb), 0.15);
  outline: none;
}
.collapsible-alert__toggle:focus-visible { box-shadow: inset 0 0 0 1px var(--alert-color); }
.collapsible-alert__indicator {
  width: 7px;
  height: 7px;
  background: var(--alert-color);
  border-radius: 50%;
  box-shadow: 0 0 8px rgba(var(--alert-rgb), 0.75);
}
.collapsible-alert__title { color: var(--alert-color); font-size: 14px; font-weight: 700; }
.collapsible-alert__meta {
  overflow: hidden;
  color: #8fb2d5;
  font-size: 12px;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.collapsible-alert__chevron {
  width: 15px;
  height: 15px;
  color: var(--alert-color);
  transition: transform 160ms ease;
}
.collapsible-alert__chevron.is-open { transform: rotate(180deg); }
.collapsible-alert__body {
  padding: 11px 12px 12px;
  color: #9dbbdc;
  font-size: 13px;
  line-height: 1.6;
  border-top: 1px solid rgba(var(--alert-rgb), 0.25);
}
</style>
