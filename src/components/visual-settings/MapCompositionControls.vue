<script setup lang="ts">
import { computed, onMounted } from 'vue'
import {
  MAP_LAYOUT_FIELD_BOUNDS,
  useMapVisualSettings,
  type MapLayout
} from '@/composables/useMapVisualSettings'
import {
  DEFAULT_BACKGROUND_LAYERS,
  type DefaultBackgroundLayerId
} from '@/components/map/defaultBackgroundLayers'

const session = useMapVisualSettings()
const defaultBackgroundLayers = DEFAULT_BACKGROUND_LAYERS
const backgroundFileInputs: Partial<Record<DefaultBackgroundLayerId, HTMLInputElement>> = {}
const backgroundStatus = computed(() => {
  const { main, terrain } = session.backgroundLayerVisibility
  if (main && terrain) return '当前显示背景遮罩与背景底图'
  if (main) return '当前仅显示背景遮罩'
  if (terrain) return '当前仅显示背景底图'
  return '背景两层均已关闭'
})
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

function setBackgroundFileInput(layer: DefaultBackgroundLayerId, element: unknown): void {
  if (element instanceof HTMLInputElement) backgroundFileInputs[layer] = element
  else delete backgroundFileInputs[layer]
}

function openBackgroundUpload(layer: DefaultBackgroundLayerId): void {
  backgroundFileInputs[layer]?.click()
}

async function uploadBackground(layer: DefaultBackgroundLayerId, event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (file) await session.replaceBackgroundLayerImage(layer, file)
}

function updateBackgroundLayerVisibility(layer: DefaultBackgroundLayerId, event: Event): void {
  session.setBackgroundLayerVisibility(layer, (event.target as HTMLInputElement).checked)
}

onMounted(() => {
  for (const field of FIELDS) session.numericField(`layout.${field.key}`).sync(session.layout[field.key])
})
</script>

<template>
  <div class="composition-controls" data-visual-page-content="composition">
    <section class="setting-group">
      <h2>画布背景</h2>
      <p>背景遮罩与背景底图可以分别开关或替换文件。上传内容仅在当前创作会话生效，刷新页面后恢复内置源文件。</p>
      <div class="background-layer-list" aria-label="背景图层">
        <div
          v-for="layer in defaultBackgroundLayers"
          :key="layer.id"
          class="background-layer"
          :data-background-layer="layer.id"
        >
          <div class="background-layer__row">
            <div class="background-layer__identity">
              <label class="background-layer__toggle">
                <input
                  type="checkbox"
                  :checked="session.backgroundLayerVisibility[layer.id]"
                  :aria-label="`${layer.label}显示开关`"
                  @change="updateBackgroundLayerVisibility(layer.id, $event)"
                />
                <span>{{ layer.label }}</span>
              </label>
              <span
                v-if="layer.help"
                class="background-layer__help"
                role="img"
                tabindex="0"
                :title="layer.help"
                :aria-label="layer.help"
              >
                <svg
                  data-icon="info"
                  aria-hidden="true"
                  focusable="false"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <circle cx="8" cy="8" r="6.25" stroke="currentColor" stroke-width="1.5" />
                  <path d="M8 7.1V11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
                  <circle cx="8" cy="4.75" r=".8" fill="currentColor" />
                </svg>
              </span>
              <span aria-hidden="true">：</span>
              <a
                class="background-layer__filename"
                :href="session.backgroundLayerSources.value[layer.id].url"
                :download="session.backgroundLayerSources.value[layer.id].filename"
                :aria-label="`下载${layer.label}文件 ${session.backgroundLayerSources.value[layer.id].filename}`"
              >
                <span class="background-layer__filename-text">{{ session.backgroundLayerSources.value[layer.id].filename }}</span>
                <svg
                  data-icon="download"
                  aria-hidden="true"
                  focusable="false"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <path d="M8 2.25v7.5m0 0 2.75-2.75M8 9.75 5.25 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                  <path d="M3 11.25v1.5h10v-1.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </a>
            </div>
            <input
              :id="`background-layer-file-${layer.id}`"
              :ref="(element) => setBackgroundFileInput(layer.id, element)"
              class="background-layer__file-input"
              :data-background-upload="layer.id"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
              @change="uploadBackground(layer.id, $event)"
            />
            <button
              type="button"
              class="background-layer__upload"
              :data-action="`upload-background-${layer.id}`"
              @click="openBackgroundUpload(layer.id)"
            >上传背景文件</button>
          </div>
          <p v-if="session.backgroundLayerErrors[layer.id]" class="background-layer__error" role="alert">
            {{ session.backgroundLayerErrors[layer.id] }}
          </p>
        </div>
      </div>
      <p class="background-status" aria-live="polite">
        {{ backgroundStatus }}
      </p>
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
.background-layer-list { display: grid; gap: 8px; }
.background-layer {
  display: grid; gap: 9px; padding: 10px;
  background: rgba(36, 131, 255, 0.08); border: 1px solid rgba(36, 131, 255, 0.32); border-radius: 4px;
}
.background-layer__row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-width: 0; }
.background-layer__identity { display: flex; align-items: center; min-width: 0; color: #cfe6ff; font-size: 14px; }
.background-layer__toggle { display: inline-flex; align-items: center; gap: 8px; color: #cfe6ff; font-size: 14px; }
.background-layer__toggle input { width: 16px; height: 16px; accent-color: #00deff; }
.background-layer__help { display: inline-flex; margin-left: 4px; color: #67dcff; cursor: help; }
.background-layer__help svg { width: 15px; height: 15px; }
.background-layer__file-input { display: none; }
.background-layer__upload { flex: 0 0 auto; padding: 5px 9px; font-size: 13px; }
.background-layer__filename {
  display: inline-flex; align-items: center; gap: 4px; min-width: 0; color: #67dcff; font-size: 13px;
  text-decoration: none; white-space: nowrap;
}
.background-layer__filename-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.background-layer__filename svg { flex: 0 0 auto; width: 14px; height: 14px; }
.background-layer__filename:hover, .background-layer__filename:focus-visible { color: #fff; text-decoration: underline; }
.background-layer__error { color: #ffad99 !important; }
.background-status { overflow-wrap: anywhere; }
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
