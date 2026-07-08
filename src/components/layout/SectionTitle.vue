<script setup lang="ts">
import barImg from '@/assets/images/b571ad71f533861c910b290f714bd65f-1dc3fda187.png'

defineProps<{ title: string }>()
</script>

<template>
  <div class="section-title">
    <img class="title-bg" :src="barImg" alt="" />
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
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: left center;
}
.section-title span {
  position: absolute; left: 43px; top: 4px;
  font-family: 'YouSheBiaoTiHei'; font-size: 28px; font-style: italic; letter-spacing: 2px;
  background: linear-gradient(180deg, #b0dbfa, #ffffff);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
</style>
