<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <div class="section-title">
    <div class="title-bg" aria-hidden="true" />
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
  position: absolute; left: 0; top: 5px; width: 100%; height: 44px;
  background:
    linear-gradient(90deg, rgba(36, 131, 255, 0.34), rgba(36, 131, 255, 0.04) 56%, transparent 82%),
    linear-gradient(90deg, rgba(0, 222, 255, 0.8), rgba(36, 131, 255, 0.25) 48%, transparent 90%) left bottom / 100% 1px no-repeat;
  clip-path: polygon(0 0, 46% 0, 51% 50%, 46% 100%, 0 100%, 3% 50%);
}
.title-bg::before {
  content: ''; position: absolute; left: 8px; top: 15px; width: 10px; height: 10px;
  background: #67c9ff; box-shadow: 0 0 12px rgba(0, 222, 255, 0.9);
  transform: rotate(45deg);
}
.section-title span {
  position: absolute; left: 36px; top: 4px;
  font-family: 'YouSheBiaoTiHei'; font-size: 28px; letter-spacing: 2px;
  background: linear-gradient(180deg, #b0dbfa, #ffffff);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
</style>
