<script setup lang="ts">
import titleBackgroundImage from '@/assets/images/b571ad71f533861c910b290f714bd65f-1dc3fda187.png'

defineProps<{ title: string }>()
</script>

<template>
  <div class="section-title">
    <img class="title-bg" :src="titleBackgroundImage" alt="" />
    <div class="watermark-mask" aria-hidden="true" />
    <div class="title-scan" aria-hidden="true" />
    <span>{{ title }}</span>
  </div>
</template>

<style scoped>
.section-title {
  position: relative;
  width: 492px;
  height: 60px;
  overflow: hidden;
}
.title-bg {
  position: absolute; inset: 0; width: 100%; height: 100%;
  /* 保留原组件的 cover 构图：完整使用左侧折角主体，并让横向引导线铺满标题槽。 */
  object-fit: cover; object-position: left center;
  animation: title-breathe 4.8s ease-in-out infinite;
}
.watermark-mask {
  position: absolute; left: 248px; top: 14px; z-index: 4;
  width: 164px; height: 28px;
  background: linear-gradient(90deg, rgba(9, 22, 49, 0.98), rgba(11, 25, 55, 0.94) 78%, rgba(11, 25, 55, 0) 100%);
  clip-path: polygon(8% 0, 100% 0, 92% 100%, 0 100%);
}
.title-scan {
  position: absolute; inset: 0; z-index: 3; overflow: hidden;
  -webkit-mask-image: url('@/assets/images/b571ad71f533861c910b290f714bd65f-1dc3fda187.png');
  mask-image: url('@/assets/images/b571ad71f533861c910b290f714bd65f-1dc3fda187.png');
  -webkit-mask-size: 100% 100%; mask-size: 100% 100%;
  pointer-events: none;
}
.title-scan::before {
  content: ''; position: absolute; left: -120px; top: -10%; width: 110px; height: 120%;
  background: linear-gradient(100deg, transparent, rgba(169, 226, 255, 0.55), transparent);
  filter: blur(5px); transform: skewX(-18deg);
  animation: title-scan 5.2s ease-in-out infinite;
}
.section-title span {
  position: absolute; left: 43px; top: 4px; z-index: 5;
  font-family: 'YouSheBiaoTiHei'; font-size: 28px; letter-spacing: 2px;
  background: linear-gradient(180deg, #b0dbfa, #ffffff);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
@keyframes title-breathe {
  0%, 100% { opacity: 0.9; filter: brightness(0.92); }
  50% { opacity: 1; filter: brightness(1.12); }
}
@keyframes title-scan {
  0%, 12% { transform: translateX(0) skewX(-18deg); opacity: 0; }
  20% { opacity: 1; }
  62% { transform: translateX(650px) skewX(-18deg); opacity: 0.8; }
  63%, 100% { transform: translateX(650px) skewX(-18deg); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .title-bg, .title-scan::before { animation: none; }
}
</style>
