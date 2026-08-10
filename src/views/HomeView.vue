<script setup lang="ts">
import ChongqingMap3D from '@/components/map/ChongqingMap3D.vue'
import HeaderBar from '@/components/layout/HeaderBar.vue'
import SectionTitle from '@/components/layout/SectionTitle.vue'
import KpiPanel from '@/components/panels/KpiPanel.vue'
import AmountTablePanel from '@/components/panels/AmountTablePanel.vue'
import QualityPanel from '@/components/panels/QualityPanel.vue'
import TechPanel from '@/components/panels/TechPanel.vue'
import OrgPanel from '@/components/panels/OrgPanel.vue'
import SocialPanel from '@/components/panels/SocialPanel.vue'
import InquiryPanel from '@/components/panels/InquiryPanel.vue'
import DisposalPanel from '@/components/panels/DisposalPanel.vue'
import TrainingPanel from '@/components/panels/TrainingPanel.vue'
import MapDebugDrawer from '@/components/debug/MapDebugDrawer.vue'
import { useMapDebug } from '@/composables/useMapDebug'
import bgMain from '@/assets/images/bg-main.png'
import bgTerrain from '@/assets/images/bg-terrain.png'

const { layout: mapLayout } = useMapDebug()
</script>

<template>
  <div class="home">
    <img class="bg-main" :src="bgMain" alt="" />
    <img class="bg-terrain" :src="bgTerrain" alt="" />
    <HeaderBar debug />

    <ChongqingMap3D
      class="pos-map"
      :style="{
        left: mapLayout.left + 'px',
        top: mapLayout.top + 'px',
        width: mapLayout.width + 'px',
        height: mapLayout.height + 'px'
      }"
    />

    <aside class="side-rail left-rail" aria-label="创业扶持核心数据">
      <KpiPanel />
      <SectionTitle title="扶持成效分析" />
      <QualityPanel />
      <TechPanel />
      <OrgPanel />
      <DisposalPanel />
    </aside>

    <aside class="side-rail right-rail" aria-label="创业服务运营数据">
      <SectionTitle title="创业服务分析" />
      <InquiryPanel />
      <SocialPanel />
      <TrainingPanel />
      <AmountTablePanel class="right-amount" />
    </aside>

    <MapDebugDrawer />
  </div>
</template>

<style scoped>
.home { position: absolute; inset: 0; overflow: hidden; }
.bg-main { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; }
.bg-terrain { position: absolute; left: 0; top: 0; width: 1482px; height: 1080px; opacity: 0.9; }

/* 地图容器与相机目标都以画布中心为基准，左右轨道仅承载数据面板。 */
.pos-map { position: absolute; z-index: 1; left: 400px; top: 82px; width: 1120px; height: 998px; }
.side-rail {
  position: absolute; top: 112px; z-index: 10; width: 492px;
  display: flex; flex-direction: column; gap: 8px;
  transform: scale(0.82); transform-origin: left top;
}
.left-rail { left: 24px; }
.right-rail { left: 1493px; }
.right-amount { align-self: flex-end; }
</style>
