<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useMapDebug } from '@/composables/useMapDebug'
import { copyTextToClipboard } from '@/utils/copyText'
import MapEffectControls from './MapEffectControls.vue'
import MapHudControls from './MapHudControls.vue'

const activeTab = ref<'layout' | 'effect' | 'hud'>('layout')
const { drawerOpen, layout, resetLayout, cameraView } = useMapDebug()

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

type CopyTag = 'css' | 'cam'
const copyResult = ref<{ tag: CopyTag; success: boolean } | null>(null)
let copiedTimer = 0

async function copyText(text: string, tag: CopyTag): Promise<void> {
  copyResult.value = { tag, success: await copyTextToClipboard(text) }
  clearTimeout(copiedTimer)
  copiedTimer = window.setTimeout(() => (copyResult.value = null), 1500)
}

function copyLabel(tag: CopyTag, idle: string): string {
  if (copyResult.value?.tag !== tag) return idle
  return copyResult.value.success ? '已复制 ✓' : '复制失败，请重试'
}

onBeforeUnmount(() => clearTimeout(copiedTimer))
</script>

<template>
  <transition name="drawer">
    <aside v-if="drawerOpen" class="drawer">
      <div class="head">
        <span class="title">地图调试</span>
        <span class="close" @click="drawerOpen = false">✕</span>
      </div>

      <div class="tabs">
        <button :class="{ active: activeTab === 'layout' }" @click="activeTab = 'layout'">布局</button>
        <button :class="{ active: activeTab === 'effect' }" @click="activeTab = 'effect'">效果</button>
        <button :class="{ active: activeTab === 'hud' }" @click="activeTab = 'hud'">HUD</button>
      </div>

      <div v-if="activeTab === 'layout'" class="panel-scroll layout-panel">
        <div v-for="field in FIELDS" :key="field.key" class="row">
          <div class="row-head">
            <label>{{ field.label }}</label>
            <input v-model.number="layout[field.key]" class="num" type="number" />
          </div>
          <input
            v-model.number="layout[field.key]"
            class="slider"
            type="range"
            :min="field.min"
            :max="field.max"
            step="1"
          />
        </div>

        <div class="row cam-row">
          <div class="row-head">
            <label>3D 视角 / 缩放</label>
            <button class="mini" :disabled="!cameraView" @click="copyText(cameraView, 'cam')">
              {{ copyLabel('cam', '复制') }}
            </button>
          </div>
          <div class="css-out">{{ cameraView || '拖动 / 缩放地图后在此显示' }}</div>
        </div>

        <div class="css-out">.pos-map { {{ css }} }</div>
        <div class="actions">
          <button class="btn" @click="copyText(css, 'css')">
            {{ copyLabel('css', '复制 CSS') }}
          </button>
          <button class="btn ghost" @click="resetLayout">重置</button>
        </div>
      </div>

      <div v-else-if="activeTab === 'effect'" class="panel-scroll">
        <MapEffectControls />
      </div>

      <div v-else class="panel-scroll">
        <MapHudControls />
      </div>
    </aside>
  </transition>
</template>

<style scoped>
.drawer {
  position: absolute; right: 0; top: 174px; bottom: 0; width: 320px; z-index: 30;
  box-sizing: border-box; padding: 20px 22px;
  display: flex; flex-direction: column; gap: 16px; overflow: hidden;
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

.tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.tabs button {
  padding: 7px 0; color: #7fa8d9; cursor: pointer;
  background: rgba(36, 131, 255, 0.08);
  border: 1px solid rgba(36, 131, 255, 0.35); border-radius: 3px;
}
.tabs button.active { color: #00deff; border-color: #00deff; background: rgba(0, 222, 255, 0.1); }
.panel-scroll { flex: 1; min-height: 0; overflow-y: auto; padding-right: 4px; }
.layout-panel { display: flex; flex-direction: column; gap: 16px; }

.row { display: flex; flex-direction: column; gap: 8px; }
.row-head { display: flex; align-items: center; justify-content: space-between; font-size: 14px; }
.num {
  width: 76px; padding: 3px 6px; font-size: 14px; text-align: right;
  color: #00deff; background: rgba(36, 131, 255, 0.12);
  border: 1px solid rgba(36, 131, 255, 0.4); border-radius: 3px; outline: none;
}
.num:focus { border-color: #00deff; }
.slider { width: 100%; accent-color: #00deff; cursor: pointer; }

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
