<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import headerImg from '@/assets/images/header-bar.png'
import headerVideo from '@/assets/video/header-bg.webm'
import fsIn from '@/assets/images/fullscreen-in.png'
import fsOut from '@/assets/images/fullscreen-out.png'

const now = ref('')
const isFs = ref(false)
const WEEK = ['日', '一', '二', '三', '四', '五', '六']

function fmt() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  now.value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} 星期${WEEK[d.getDay()]}`
}

let timer = 0
onMounted(() => {
  fmt()
  timer = window.setInterval(fmt, 1000)
})
onBeforeUnmount(() => clearInterval(timer))

async function toggleFs() {
  if (document.fullscreenElement) {
    await document.exitFullscreen()
    isFs.value = false
  } else {
    await document.documentElement.requestFullscreen()
    isFs.value = true
  }
}
</script>

<template>
  <header class="header">
    <video class="layer" :src="headerVideo" autoplay loop muted playsinline />
    <img class="layer" :src="headerImg" alt="" />
    <div class="timer">{{ now }}</div>
    <img class="fs-btn" :src="isFs ? fsOut : fsIn" alt="全屏" @click="toggleFs" />
  </header>
</template>

<style scoped>
.header { position: absolute; left: 0; top: 0; width: 1920px; height: 174px; z-index: 20; pointer-events: none; }
.layer { position: absolute; left: 0; top: 0; width: 1920px; height: 174px; object-fit: cover; }
.timer {
  position: absolute; left: 1600px; top: 34px; width: 260px;
  font-family: 'OPPOSans-M'; font-size: 20px; color: #fff; letter-spacing: 1px;
}
.fs-btn { position: absolute; left: 1852px; top: 30px; width: 36px; height: 36px; cursor: pointer; pointer-events: auto; }
</style>
