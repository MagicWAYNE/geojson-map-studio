<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  MAP_LAYOUT_FIELD_BOUNDS,
  useMapVisualSettings,
  type MapLayout
} from '@/composables/useMapVisualSettings'

const session = useMapVisualSettings()
const backgroundFileInput = ref<HTMLInputElement>()
const FIELDS: ReadonlyArray<{
  key: keyof MapLayout
  label: string
}> = [
  { key: 'left', label: '水平位置 X' },
  { key: 'top', label: '垂直位置 Y' },
  { key: 'width', label: '地图宽度 W' },
  { key: 'height', label: '地图高度 H' }
]

function rawValue(key: keyof MapLayout): string {
  return session.numericField(`layout.${key}`).read(session.layout[key])
}

function editField(key: keyof MapLayout, event: Event): void {
  session.numericField(`layout.${key}`).edit((event.target as HTMLInputElement).value)
}

function commitField(key: keyof MapLayout, event: Event): void {
  const input = event.target as HTMLInputElement
  input.value = String(session.commitLayoutField(key, input.value))
}

function updateRange(key: keyof MapLayout, event: Event): void {
  const input = event.target as HTMLInputElement
  session.commitLayoutField(key, input.value)
}

function rangeMin(field: typeof FIELDS[number]): number {
  return Math.min(MAP_LAYOUT_FIELD_BOUNDS[field.key].rangeMin, session.layout[field.key])
}

function rangeMax(field: typeof FIELDS[number]): number {
  return Math.max(MAP_LAYOUT_FIELD_BOUNDS[field.key].rangeMax, session.layout[field.key])
}

async function uploadBackground(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) await session.replaceBackgroundImage(file)
}

function resetBackground(): void {
  session.resetBackgroundImage()
  if (backgroundFileInput.value) backgroundFileInput.value.value = ''
}

onMounted(() => {
  for (const field of FIELDS) session.numericField(`layout.${field.key}`).sync(session.layout[field.key])
})
</script>

<template>
  <div class="composition-controls" data-visual-page-content="composition">
    <section class="setting-group">
      <h2>画布背景</h2>
      <p>默认背景由底层主背景与地形纹理两层叠加。上传一张图片后将整体替换这两层，刷新页面后恢复默认。</p>
      <label class="background-upload" for="background-image-file">
        <span>背景图片</span>
        <input
          id="background-image-file"
          ref="backgroundFileInput"
          data-background-upload
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
          @change="uploadBackground"
        />
      </label>
      <p class="background-status" aria-live="polite">
        {{ session.backgroundImageName.value || '当前使用默认双层科技背景' }}
      </p>
      <p v-if="session.backgroundImageError.value" class="background-error" role="alert">
        {{ session.backgroundImageError.value }}
      </p>
      <button
        type="button"
        data-action="reset-background"
        :disabled="!session.backgroundImageUrl.value"
        @click="resetBackground"
      >
        恢复默认背景
      </button>
    </section>

    <section class="setting-group">
      <h2>画布构图</h2>
      <p>数字框用于精确输入，滑杆用于快速调节。工程值允许越界或遮挡，系统只给出风险提示。</p>
      <div v-for="field in FIELDS" :key="field.key" class="composition-field" :data-control-path="`layout.${field.key}`">
        <div class="field-heading">
          <label :for="`composition-${field.key}-number`">{{ field.label }}</label>
          <input
            :id="`composition-${field.key}-number`"
            class="number-input"
            type="number"
            :value="rawValue(field.key)"
            :min="MAP_LAYOUT_FIELD_BOUNDS[field.key].rangeMin"
            :max="MAP_LAYOUT_FIELD_BOUNDS[field.key].rangeMax"
            step="1"
            @input="editField(field.key, $event)"
            @change="commitField(field.key, $event)"
            @blur="commitField(field.key, $event)"
          />
        </div>
        <input
          :id="`composition-${field.key}-range`"
          class="range-input"
          type="range"
          :min="rangeMin(field)"
          :max="rangeMax(field)"
          :value="session.layout[field.key]"
          step="1"
          :aria-label="`${field.label}滑杆`"
          @input="updateRange(field.key, $event)"
        />
      </div>
    </section>

    <ul v-if="session.compositionWarnings.value.length" class="composition-warning" role="status">
      <li v-for="warning in session.compositionWarnings.value" :key="warning">{{ warning }}</li>
    </ul>

    <section class="setting-group">
      <div class="group-heading">
        <h2>当前 CSS</h2>
        <button type="button" data-visual-action="layout.copy-css" @click="session.copyVisualText('composition-css', session.compositionCss.value)">
          {{ session.copyLabel('composition-css', '复制 CSS') }}
        </button>
      </div>
      <pre>{{ session.compositionCss.value }}</pre>
    </section>

    <section class="setting-group">
      <div class="group-heading">
        <h2>OrbitControls 视角</h2>
        <button type="button" data-visual-action="layout.copy-camera" @click="session.copyVisualText('camera', session.cameraView.value)">
          {{ session.copyLabel('camera', '复制相机参数') }}
        </button>
      </div>
      <p>相机仍由地图拖动与缩放控制，本页只读取和复制当前参数。</p>
      <pre>{{ session.cameraView.value }}</pre>
    </section>

    <button type="button" class="reset-button" data-action="reset-composition" data-visual-action="layout.reset" @click="session.resetLayout">
      恢复当前工具构图
    </button>
  </div>
</template>

<style scoped>
.composition-controls { display: flex; flex-direction: column; gap: 16px; padding-bottom: 18px; }
.setting-group { display: flex; flex-direction: column; gap: 12px; padding: 14px; background: rgba(36, 131, 255, 0.05); border: 1px solid rgba(36, 131, 255, 0.28); border-radius: 6px; }
.setting-group h2 { margin: 0; color: #fff; font-size: 16px; }
.setting-group p { margin: 0; color: #8fd9ff; font-size: 13px; line-height: 1.6; }
.background-upload { display: grid; gap: 8px; color: #cfe6ff; font-size: 14px; }
.background-upload input {
  box-sizing: border-box; width: 100%; min-height: 40px; padding: 7px 9px;
  color: #dff9ff; background: rgba(36, 131, 255, 0.12);
  border: 1px solid rgba(36, 131, 255, 0.5); border-radius: 4px;
}
.background-status { overflow-wrap: anywhere; }
.background-error { color: #ffad99 !important; }
.composition-field { display: flex; flex-direction: column; gap: 7px; }
.field-heading, .group-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #cfe6ff; font-size: 14px; }
.number-input { width: 96px; padding: 5px 8px; color: #00deff; text-align: right; background: rgba(36, 131, 255, 0.12); border: 1px solid rgba(36, 131, 255, 0.5); border-radius: 4px; }
.range-input { width: 100%; accent-color: #00deff; }
.composition-warning { margin: 0; padding: 12px 14px 12px 32px; color: #ffd39c; font-size: 13px; line-height: 1.6; background: rgba(109, 67, 16, 0.26); border: 1px solid rgba(255, 186, 91, 0.42); border-radius: 6px; }
pre { margin: 0; padding: 10px 12px; overflow: auto; color: #8fd9ff; white-space: pre-wrap; overflow-wrap: anywhere; background: rgba(0, 0, 0, 0.35); border: 1px dashed rgba(36, 131, 255, 0.4); border-radius: 4px; }
button { padding: 7px 11px; color: #dff9ff; cursor: pointer; background: rgba(22, 111, 180, 0.58); border: 1px solid rgba(75, 203, 255, 0.58); border-radius: 4px; }
button:disabled { cursor: not-allowed; opacity: 0.42; }
.reset-button { min-height: 40px; }
</style>
