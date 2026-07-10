<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMapDebug } from '@/composables/useMapDebug'

const { drawerOpen, layout, reset, cameraView } = useMapDebug()

const FIELDS = [
  { key: 'left', label: '水平位置 X', min: -400, max: 1400 },
  { key: 'top', label: '垂直位置 Y', min: -400, max: 900 },
  { key: 'width', label: '宽度 W', min: 200, max: 1920 },
  { key: 'height', label: '高度 H', min: 200, max: 1080 }
] as const

const css = computed(
  () =>
    `left: ${layout.left}px; top: ${layout.top}px; width: ${layout.width}px; height: ${layout.height}px;`
)

const copied = ref<'' | 'css' | 'cam'>('')
let copiedTimer = 0

async function copyText(text: string, tag: 'css' | 'cam') {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // 局域网 http 访问时 clipboard API 不可用，退化为 execCommand
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
  copied.value = tag
  clearTimeout(copiedTimer)
  copiedTimer = window.setTimeout(() => (copied.value = ''), 1500)
}
</script>

<template>
  <transition name="drawer">
    <aside v-if="drawerOpen" class="drawer">
      <div class="head">
        <span class="title">地图位置调试</span>
        <span class="close" @click="drawerOpen = false">✕</span>
      </div>

      <div v-for="f in FIELDS" :key="f.key" class="row">
        <div class="row-head">
          <label>{{ f.label }}</label>
          <input v-model.number="layout[f.key]" class="num" type="number" />
        </div>
        <input
          v-model.number="layout[f.key]"
          class="slider"
          type="range"
          :min="f.min"
          :max="f.max"
          step="1"
        />
      </div>

      <div class="row cam-row">
        <div class="row-head">
          <label>3D 视角 / 缩放</label>
          <button
            class="mini"
            :disabled="!cameraView"
            @click="copyText(cameraView, 'cam')"
          >{{ copied === 'cam' ? '已复制 ✓' : '复制' }}</button>
        </div>
        <div class="css-out">{{ cameraView || '拖动 / 缩放地图后在此显示' }}</div>
      </div>

      <div class="css-out">.pos-map { {{ css }} }</div>

      <div class="actions">
        <button class="btn" @click="copyText(css, 'css')">{{ copied === 'css' ? '已复制 ✓' : '复制 CSS' }}</button>
        <button class="btn ghost" @click="reset">重置</button>
      </div>
    </aside>
  </transition>
</template>

<style scoped>
.drawer {
  position: absolute; right: 0; top: 174px; bottom: 0; width: 320px; z-index: 30;
  box-sizing: border-box; padding: 20px 22px;
  display: flex; flex-direction: column; gap: 16px;
  background: rgba(6, 18, 40, 0.94);
  border-left: 1px solid rgba(36, 131, 255, 0.45);
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.45);
  font-family: 'OPPOSans-R', sans-serif; color: #cfe6ff;
}
.drawer-enter-active, .drawer-leave-active { transition: transform 0.25s ease; }
.drawer-enter-from, .drawer-leave-to { transform: translateX(100%); }

.head { display: flex; align-items: center; justify-content: space-between; }
.title { font-family: 'OPPOSans-M'; font-size: 18px; color: #fff; letter-spacing: 1px; }
.close { font-size: 16px; color: #7fa8d9; cursor: pointer; padding: 2px 6px; }
.close:hover { color: #00deff; }

.row { display: flex; flex-direction: column; gap: 8px; }
.row-head { display: flex; align-items: center; justify-content: space-between; font-size: 14px; }
.num {
  width: 76px; padding: 3px 6px; font-size: 14px; text-align: right;
  color: #00deff; background: rgba(36, 131, 255, 0.12);
  border: 1px solid rgba(36, 131, 255, 0.4); border-radius: 3px; outline: none;
}
.num:focus { border-color: #00deff; }
.slider { width: 100%; accent-color: #00deff; cursor: pointer; }

.cam-row { margin-top: auto; }
.mini {
  padding: 2px 10px; font-size: 12px; cursor: pointer;
  color: #7fa8d9; background: transparent;
  border: 1px solid rgba(36, 131, 255, 0.5); border-radius: 3px;
}
.mini:hover:enabled { color: #00deff; border-color: #00deff; }
.mini:disabled { opacity: 0.4; cursor: default; }

.css-out {
  padding: 10px 12px; font-size: 12px; line-height: 1.6;
  word-break: break-all; color: #8fd9ff;
  background: rgba(0, 0, 0, 0.35); border: 1px dashed rgba(36, 131, 255, 0.4); border-radius: 4px;
  user-select: text;
}

.actions { display: flex; gap: 12px; }
.btn {
  flex: 1; padding: 8px 0; font-size: 14px; font-family: 'OPPOSans-M'; cursor: pointer;
  color: #041020; background: linear-gradient(180deg, #00deff, #2483ff);
  border: none; border-radius: 4px;
}
.btn.ghost { color: #7fa8d9; background: transparent; border: 1px solid rgba(36, 131, 255, 0.5); }
.btn.ghost:hover { color: #00deff; border-color: #00deff; }
</style>
