<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import headerImg from '@/assets/images/header-bar.png'
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
    <img class="layer" :src="headerImg" alt="" />
    <h1 class="title">重庆金融调解中心</h1>
    <div class="scan" aria-hidden="true"></div>
    <div class="controls">
      <span class="timer">{{ now }}</span>
      <img class="fs-btn" :src="isFs ? fsOut : fsIn" alt="全屏" @click="toggleFs" />
    </div>
  </header>
</template>

<style scoped>
.header { position: absolute; left: 0; top: 0; width: 1920px; height: 174px; z-index: 20; pointer-events: none; }
.layer { position: absolute; left: 0; top: 0; width: 1920px; height: 174px; object-fit: cover; }
/* 标题：白→金渐变文字，复刻原图样式；置于 .scan 之前，扫光经过时随之点亮 */
.title {
  position: absolute; left: 60px; top: 22px; margin: 0;
  font-family: 'YouSheBiaoTiHei'; font-size: 48px; font-weight: normal;
  line-height: 66px; letter-spacing: 3px; white-space: nowrap;
  background: linear-gradient(180deg, #ffffff 30%, #ffedc8 65%, #f3cf95 95%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  /* Chromium 合成 bug：background-clip:text 的元素若留在 .scan(mix-blend-mode) 的背景组里，
     混合层整体不绘制；提升为独立合成层可规避 */
  transform: translateZ(0);
}
/* 扫光只在 header-bar.png 的可见像素上显形：容器用图自身做 mask，光带在容器内部平移 */
.scan {
  position: absolute; left: 0; top: 0; width: 1920px; height: 174px;
  overflow: hidden;
  -webkit-mask-image: url('@/assets/images/header-bar.png');
  mask-image: url('@/assets/images/header-bar.png');
  -webkit-mask-size: 100% 100%;
  mask-size: 100% 100%;
  mix-blend-mode: screen;
}
.scan::before, .scan::after {
  content: '';
  position: absolute; top: -20%; height: 140%;
  animation: header-scan 6.5s linear infinite;
}
/* 氛围光晕：宽而弱 */
.scan::before {
  left: -260px; width: 520px;
  background: linear-gradient(100deg,
    transparent 0%, rgba(90, 160, 255, 0.06) 35%,
    rgba(140, 200, 255, 0.16) 50%,
    rgba(90, 160, 255, 0.06) 65%, transparent 100%);
  filter: blur(14px);
  transform: skewX(-18deg);
}
/* 核心亮线：窄而柔 */
.scan::after {
  left: -110px; width: 220px;
  background: linear-gradient(100deg,
    transparent 0%, rgba(120, 180, 255, 0.10) 30%,
    rgba(200, 230, 255, 0.45) 50%,
    rgba(120, 180, 255, 0.14) 70%, transparent 100%);
  filter: blur(6px);
  transform: skewX(-18deg);
}
/* 5s 扫过全宽，其余 1.5s 停顿 */
@keyframes header-scan {
  /* 起点 -350px 保证光带（含 skew 偏移与 blur 扩散）完全在画面外，避免循环起始在左缘闪现 */
  0% { transform: translateX(-350px) skewX(-18deg); }
  76.923% { transform: translateX(2300px) skewX(-18deg); }
  100% { transform: translateX(2300px) skewX(-18deg); }
}
/* 右侧控制区：右缘锚定的 flex 行，时间向左伸展，与按钮保持固定间距不重叠 */
.controls {
  position: absolute; right: 32px; top: 30px; height: 36px;
  display: flex; align-items: center; gap: 16px;
}
.timer {
  white-space: nowrap;
  font-family: 'OPPOSans-M'; font-size: 20px; color: #fff; letter-spacing: 1px;
  font-variant-numeric: tabular-nums;
}
.fs-btn { width: 36px; height: 36px; cursor: pointer; pointer-events: auto; }
</style>
