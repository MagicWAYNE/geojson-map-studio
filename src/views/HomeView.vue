<script setup lang="ts">
import ChongqingMap3D from '@/components/map/ChongqingMap3D.vue'
import bgMain from '@/assets/images/bg-main.png'
import bgTerrain from '@/assets/images/bg-terrain.png'
</script>

<template>
  <div class="home">
    <img class="bg-main" :src="bgMain" alt="" />
    <img class="bg-terrain" :src="bgTerrain" alt="" />
    <ChongqingMap3D class="pos-map" />
  </div>
</template>

<style scoped>
.home { position: absolute; inset: 0; overflow: hidden; }
.bg-main { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; }
.bg-terrain { position: absolute; left: 0; top: 0; width: 1482px; height: 1080px; opacity: 0.9; }

/* 保留已固化的地图画布与相机构图，页面其余区域仅作为地图背景。 */
.pos-map { position: absolute; z-index: 1; left: 400px; top: 132px; width: 1120px; height: 948px; }
</style>
