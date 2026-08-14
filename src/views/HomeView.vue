<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import ChongqingMap3D from '@/components/map/ChongqingMap3D.vue'
import MapLoaderView from '@/views/MapLoaderView.vue'
import { activeMapSource } from '@/components/map/mapSource'
import type { ActiveMapLoadResult } from '@/components/map/activeMapSource'
import type { MapDocument } from '@/components/map/mapDocument'
import { useMapVisualSettings } from '@/composables/useMapVisualSettings'
import bgMain from '@/assets/images/bg-main.png'
import bgTerrain from '@/assets/images/bg-terrain.png'

const mapDocument = shallowRef<MapDocument | null>(null)
const initialLoad = shallowRef<ActiveMapLoadResult | null>(null)
const authoringFocus = ref('')
const loadError = ref('')
const visualSettings = useMapVisualSettings()
const { effectiveMapLayout } = visualSettings
const mapStyle = computed(() => ({
  left: `${effectiveMapLayout.value.left}px`,
  top: `${effectiveMapLayout.value.top}px`,
  width: `${effectiveMapLayout.value.width}px`,
  height: `${effectiveMapLayout.value.height}px`
}))
let mounted = true

onMounted(async () => {
  try {
    const result = await activeMapSource.load()
    if (mounted) {
      initialLoad.value = result
      mapDocument.value = result.document
    }
  } catch (cause) {
    if (mounted) loadError.value = cause instanceof Error ? cause.message : String(cause)
  }
})

onBeforeUnmount(() => {
  mounted = false
  visualSettings.resetVisualSession()
})
</script>

<template>
  <div class="home">
    <img
      v-if="visualSettings.backgroundImageUrl.value"
      class="bg-custom"
      :src="visualSettings.backgroundImageUrl.value"
      alt=""
    />
    <template v-else>
      <img class="bg-main" :src="bgMain" alt="" />
      <img class="bg-terrain" :src="bgTerrain" alt="" />
    </template>
    <ChongqingMap3D
      v-if="mapDocument"
      class="pos-map"
      :style="mapStyle"
      :document="mapDocument"
      :focus="authoringFocus"
    />
    <div v-else-if="loadError" class="map-load-error" role="alert">{{ loadError }}</div>
    <MapLoaderView
      v-if="initialLoad"
      :initial-load="initialLoad"
      @map-activated="mapDocument = $event"
      @authoring-focus="authoringFocus = $event ?? ''"
    />
  </div>
</template>

<style scoped>
.home { position: absolute; inset: 0; overflow: hidden; }
.bg-main { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; }
.bg-terrain { position: absolute; left: 0; top: 0; width: 1482px; height: 1080px; opacity: 0.9; }
.bg-custom {
  position: absolute;
  left: 0;
  top: 0;
  width: 1920px;
  height: 1080px;
  object-fit: cover;
}

.pos-map { position: absolute; z-index: 1; }
.map-load-error {
  position: absolute;
  z-index: 2;
  left: 50%;
  top: 50%;
  color: #ff9d7d;
  font-size: 18px;
  transform: translate(-50%, -50%);
}
</style>
