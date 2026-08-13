<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import ChongqingMap3D from '@/components/map/ChongqingMap3D.vue'
import MapLoaderView from '@/views/MapLoaderView.vue'
import { activeMapSource } from '@/components/map/mapSource'
import type { MapDocument } from '@/components/map/mapDocument'
import bgMain from '@/assets/images/bg-main.png'
import bgTerrain from '@/assets/images/bg-terrain.png'

const mapDocument = shallowRef<MapDocument | null>(null)
const loadError = ref('')
let mounted = true

onMounted(async () => {
  try {
    const result = await activeMapSource.load()
    if (mounted) mapDocument.value = result.document
  } catch (cause) {
    if (mounted) loadError.value = cause instanceof Error ? cause.message : String(cause)
  }
})

onBeforeUnmount(() => {
  mounted = false
})
</script>

<template>
  <div class="home">
    <img class="bg-main" :src="bgMain" alt="" />
    <img class="bg-terrain" :src="bgTerrain" alt="" />
    <ChongqingMap3D v-if="mapDocument" class="pos-map" :document="mapDocument" />
    <div v-else-if="loadError" class="map-load-error" role="alert">{{ loadError }}</div>
    <MapLoaderView @map-activated="mapDocument = $event" />
  </div>
</template>

<style scoped>
.home { position: absolute; inset: 0; overflow: hidden; }
.bg-main { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; }
.bg-terrain { position: absolute; left: 0; top: 0; width: 1482px; height: 1080px; opacity: 0.9; }

/* 保留已固化的地图画布与相机构图，只横向左移给创作面板让出空间。 */
.pos-map { position: absolute; z-index: 1; left: 24px; top: 132px; width: 1120px; height: 948px; }
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
