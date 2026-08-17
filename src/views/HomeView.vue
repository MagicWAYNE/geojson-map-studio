<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import ChongqingMap3D from '@/components/map/ChongqingMap3D.vue'
import MapLoaderView from '@/views/MapLoaderView.vue'
import { activeMapSource } from '@/components/map/mapSource'
import type { ActiveMapLoadResult } from '@/components/map/activeMapSource'
import type { MapDocument } from '@/components/map/mapDocument'
import { DEFAULT_BACKGROUND_LAYERS } from '@/components/map/defaultBackgroundLayers'
import { useMapVisualSettings } from '@/composables/useMapVisualSettings'
import { useLocalImagery } from '@/composables/useLocalImagery'

const mapDocument = shallowRef<MapDocument | null>(null)
const initialLoad = shallowRef<ActiveMapLoadResult | null>(null)
const authoringFocus = ref('')
const loadError = ref('')
const visualSettings = useMapVisualSettings()
const localImagery = useLocalImagery()
const defaultBackgroundLayers = DEFAULT_BACKGROUND_LAYERS
const { effectiveMapLayout } = visualSettings
const mapStyle = computed(() => ({
  left: `${effectiveMapLayout.value.left}px`,
  top: `${effectiveMapLayout.value.top}px`,
  width: `${effectiveMapLayout.value.width}px`,
  height: `${effectiveMapLayout.value.height}px`
}))
const renderedMapDocument = computed<MapDocument | null>(() => {
  if (!mapDocument.value || !localImagery.appearance.value) return mapDocument.value
  return { ...mapDocument.value, appearance: localImagery.appearance.value }
})
let mounted = true

function activateMapDocument(document: MapDocument): void {
  mapDocument.value = document
  localImagery.setDocument(document)
}

onMounted(async () => {
  try {
    const result = await activeMapSource.load()
    if (mounted) {
      initialLoad.value = result
      activateMapDocument(result.document)
    }
  } catch (cause) {
    if (mounted) loadError.value = cause instanceof Error ? cause.message : String(cause)
  }
})

onBeforeUnmount(() => {
  mounted = false
  localImagery.reset()
  visualSettings.resetVisualSession()
})
</script>

<template>
  <div class="home">
    <template v-for="layer in defaultBackgroundLayers" :key="layer.id">
      <img
        v-if="visualSettings.backgroundLayerVisibility[layer.id]"
        :class="`bg-${layer.id}`"
        :src="visualSettings.backgroundLayerSources.value[layer.id].url"
        alt=""
      />
    </template>
    <ChongqingMap3D
      v-if="renderedMapDocument"
      class="pos-map"
      :style="mapStyle"
      :document="renderedMapDocument"
      :focus="authoringFocus"
    />
    <div v-else-if="loadError" class="map-load-error" role="alert">{{ loadError }}</div>
    <MapLoaderView
      v-if="initialLoad"
      :initial-load="initialLoad"
      @map-activated="activateMapDocument"
      @authoring-focus="authoringFocus = $event ?? ''"
    />
  </div>
</template>

<style scoped>
.home { position: absolute; inset: 0; overflow: hidden; }
.bg-main { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; }
.bg-terrain { position: absolute; left: 0; top: 0; width: 1482px; height: 1080px; opacity: 0.9; }

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
