<script setup lang="ts">
import { useMapVisualSettings, VISUAL_SETTINGS_PAGES } from '@/composables/useMapVisualSettings'
import MapEffectControls from '@/components/debug/MapEffectControls.vue'
import MapDataControls from '@/components/debug/MapDataControls.vue'
import MapHudControls from '@/components/debug/MapHudControls.vue'
import MapCompositionControls from './MapCompositionControls.vue'
import MapEngineeringInfo from './MapEngineeringInfo.vue'

const session = useMapVisualSettings()
</script>

<template>
  <div class="visual-settings" data-workspace-page="visual">
    <nav class="visual-settings__nav" aria-label="视觉样式页面">
      <button
        v-for="page in VISUAL_SETTINGS_PAGES"
        :key="page.id"
        type="button"
        :class="{ active: session.activeVisualPage.value === page.id }"
        :aria-current="session.activeVisualPage.value === page.id ? 'page' : undefined"
        :data-visual-page="page.id"
        @click="session.activeVisualPage.value = page.id"
      >
        {{ page.label }}
      </button>
    </nav>

    <div class="visual-settings__page" aria-live="polite">
      <MapCompositionControls v-show="session.activeVisualPage.value === 'composition'" />
      <MapEffectControls v-show="session.activeVisualPage.value === 'effects'" />
      <MapDataControls v-show="session.activeVisualPage.value === 'charts'" />
      <MapHudControls v-show="session.activeVisualPage.value === 'hud'" />
      <MapEngineeringInfo v-show="session.activeVisualPage.value === 'engineering'" />
    </div>
  </div>
</template>

<style scoped>
.visual-settings { display: flex; flex: 1; min-height: 0; flex-direction: column; gap: 14px; }
.visual-settings__nav { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 7px; }
.visual-settings__nav button { min-height: 44px; padding: 6px 4px; color: #7fa8d9; font-size: 13px; cursor: pointer; background: rgba(36, 131, 255, 0.08); border: 1px solid rgba(36, 131, 255, 0.35); border-radius: 4px; }
.visual-settings__nav button.active { color: #00deff; background: rgba(0, 222, 255, 0.1); border-color: #00deff; }
.visual-settings__page { flex: 1; min-height: 0; padding-right: 5px; overflow-y: auto; overscroll-behavior: contain; }
</style>
