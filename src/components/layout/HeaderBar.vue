<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import headerImg from '@/assets/images/header-bar.png'
import headerVideo from '@/assets/video/header-bg.webm'
import fsIn from '@/assets/images/fullscreen-in.png'
import fsOut from '@/assets/images/fullscreen-out.png'
import { useMapDebug } from '@/composables/useMapDebug'

defineProps<{ debug?: boolean }>()
const { drawerOpen } = useMapDebug()

const now = ref('')
const isFs = ref(false)
const WEEK = ['日', '一', '二', '三', '四', '五', '六']

function fmt() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  now.value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} 星期${WEEK[d.getDay()]}`
}

function syncFs() {
  isFs.value = !!document.fullscreenElement
}

let timer = 0
onMounted(() => {
  fmt()
  syncFs()
  timer = window.setInterval(fmt, 1000)
  document.addEventListener('fullscreenchange', syncFs)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  document.removeEventListener('fullscreenchange', syncFs)
})

async function toggleFs() {
  if (document.fullscreenElement) {
    await document.exitFullscreen()
  } else {
    await document.documentElement.requestFullscreen()
  }
}
</script>

<template>
  <header class="header">
    <video class="layer" :src="headerVideo" autoplay loop muted playsinline />
    <img class="layer" :src="headerImg" alt="" />
    <div class="timer">{{ now }}</div>
    <svg
      v-if="debug"
      class="debug-btn"
      :class="{ active: drawerOpen }"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      @click="drawerOpen = !drawerOpen"
    >
      <title>地图位置调试</title>
      <line x1="4" y1="7" x2="20" y2="7" />
      <circle cx="9" cy="7" r="2.4" fill="#061228" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <circle cx="15" cy="12" r="2.4" fill="#061228" />
      <line x1="4" y1="17" x2="20" y2="17" />
      <circle cx="7" cy="17" r="2.4" fill="#061228" />
    </svg>
    <img class="fs-btn" :src="isFs ? fsOut : fsIn" alt="全屏" @click="toggleFs" />
  </header>
</template>

<style scoped>
.header { position: absolute; left: 0; top: 0; width: 1920px; height: 174px; z-index: 20; pointer-events: none; }
.layer { position: absolute; left: 0; top: 0; width: 1920px; height: 174px; object-fit: cover; }
.timer {
  position: absolute; left: 1576px; top: 34px; width: 300px; white-space: nowrap;
  font-family: 'OPPOSans-M'; font-size: 20px; color: #fff; letter-spacing: 1px;
}
.fs-btn { position: absolute; left: 1852px; top: 30px; width: 36px; height: 36px; cursor: pointer; pointer-events: auto; }
.debug-btn {
  position: absolute; left: 1806px; top: 32px; width: 32px; height: 32px;
  cursor: pointer; pointer-events: auto; color: #fff;
}
.debug-btn:hover, .debug-btn.active { color: #00deff; }
</style>
