<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const scale = ref(1)
function update() {
  scale.value = Math.min(window.innerWidth / 1920, window.innerHeight / 1080)
}
onMounted(() => {
  update()
  window.addEventListener('resize', update)
})
onUnmounted(() => window.removeEventListener('resize', update))
</script>

<template>
  <div class="screen-wrapper">
    <div class="screen" :style="{ transform: `scale(${scale})` }">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.screen-wrapper {
  width: 100vw; height: 100vh; background: #000;
  overflow: hidden; display: flex; align-items: center; justify-content: center;
}
.screen {
  width: 1920px; height: 1080px; flex: none;
  transform-origin: center center; position: relative;
}
</style>
