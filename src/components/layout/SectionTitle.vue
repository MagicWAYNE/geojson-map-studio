<script setup lang="ts">
import barImg from '@/assets/images/section-bar.png'

defineProps<{ title: string }>()
</script>

<template>
  <div class="section-title">
    <img :src="barImg" alt="" />
    <span>{{ title }}</span>
  </div>
</template>

<style scoped>
.section-title { position: relative; width: 492px; height: 60px; }
.section-title img { position: absolute; left: 0; top: 0; width: 492px; height: 60px; }
.section-title span {
  position: absolute; left: 43px; top: 4px;
  font-family: 'YouSheBiaoTiHei'; font-size: 28px; font-style: italic; letter-spacing: 2px;
  background: linear-gradient(180deg, #b0dbfa, #ffffff);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
</style>
