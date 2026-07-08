<script setup lang="ts">
import HeaderBar from '@/components/layout/HeaderBar.vue'
import SectionTitle from '@/components/layout/SectionTitle.vue'
import KpiPanel from '@/components/panels/KpiPanel.vue'
import AmountTablePanel from '@/components/panels/AmountTablePanel.vue'
import QualityPanel from '@/components/panels/QualityPanel.vue'
import TechPanel from '@/components/panels/TechPanel.vue'
import OrgPanel from '@/components/panels/OrgPanel.vue'
import SocialPanel from '@/components/panels/SocialPanel.vue'
import InquiryPanel from '@/components/panels/InquiryPanel.vue'
import bgMain from '@/assets/images/bg-main.png'
import bgTerrain from '@/assets/images/bg-terrain.png'
</script>

<template>
  <div class="home">
    <img class="bg-main" :src="bgMain" alt="" />
    <img class="bg-terrain" :src="bgTerrain" alt="" />
    <HeaderBar />

    <!-- 槽位：Task 12 地图 <ChongqingMap class="pos-map" /> -->
    <KpiPanel class="pos-kpi" />
    <AmountTablePanel class="pos-amount" />

    <SectionTitle class="pos-quality-title" title="质效分析" />
    <QualityPanel class="pos-quality" />
    <TechPanel class="pos-tech" />
    <OrgPanel class="pos-org" />
    <SocialPanel class="pos-social" />

    <SectionTitle class="pos-inquiry-title" title="电询转办分析" />
    <InquiryPanel class="pos-inquiry" />
    <!-- 槽位：Task 11 <DisposalPanel class="pos-disposal" /> <TrainingPanel class="pos-training" /> -->

    <div class="footer">指导监督单位：南岸区人民法院 南岸区司法局</div>
  </div>
</template>

<style scoped>
.home { position: absolute; inset: 0; overflow: hidden; }
.bg-main { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; }
.bg-terrain { position: absolute; left: 0; top: 0; width: 1482px; height: 1080px; opacity: 0.9; }

/* —— 面板定位槽（后续任务直接使用这些 class）—— */
.pos-map { position: absolute; left: 40px; top: 320px; width: 800px; height: 680px; }
.pos-kpi { position: absolute; left: 36px; top: 143px; }
.pos-amount { position: absolute; left: 36px; top: 812px; }
.pos-quality-title { position: absolute; left: 868px; top: 129px; }
.pos-quality { position: absolute; left: 868px; top: 195px; }
.pos-tech { position: absolute; left: 868px; top: 580px; }
.pos-org { position: absolute; left: 868px; top: 684px; }
.pos-social { position: absolute; left: 868px; top: 776px; }
.pos-inquiry-title { position: absolute; left: 1394px; top: 129px; }
.pos-inquiry { position: absolute; left: 1394px; top: 195px; }
.pos-disposal { position: absolute; left: 1394px; top: 555px; }
.pos-training { position: absolute; left: 1394px; top: 871px; }

.footer {
  position: absolute; left: 0; top: 1052px; width: 1920px; text-align: center;
  font-family: 'YouSheBiaoTiHei'; font-size: 20px; letter-spacing: 2px;
  background: linear-gradient(180deg, #b8eaff, #ffffff);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
</style>
