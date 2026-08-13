<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { activeMapSource } from '@/components/map/mapSource'
import {
  composeMapVisualization,
  inspectGeoJsonMap,
  MapImportError,
  prepareGeoJsonMapPackage,
  type GeoJsonInspection,
  type MapVisualizationDraft,
  type PreparedMapPackage
} from '@/components/map/mapDocument'
import type { MapSourceWarning } from '@/components/map/activeMapSource'
import bgMain from '@/assets/images/bg-main.png'

const router = useRouter()
const geometryText = ref<string>()
const geometryFileName = ref('')
const metricsText = ref<string>()
const metricsFileName = ref('')
const nameProperty = ref('')
const inspection = shallowRef<GeoJsonInspection>()
const prepared = shallowRef<PreparedMapPackage>()
const visualization = ref<MapVisualizationDraft>()
const warnings = ref<MapSourceWarning[]>([])
const validationError = ref('')
const busy = ref(false)
const metricsReading = ref(false)
let geometryReadGeneration = 0
let metricsReadGeneration = 0

const enabledRegionCount = computed(() =>
  visualization.value?.regions.filter((region) => region.enabled).length ?? 0
)
const canApply = computed(() =>
  prepared.value !== undefined &&
  visualization.value !== undefined &&
  !busy.value &&
  !metricsReading.value &&
  !validationError.value
)

function errorMessage(cause: unknown, fileName = ''): string {
  const message = cause instanceof MapImportError
    ? `${cause.userMessage}（${cause.path}）`
    : cause instanceof Error && cause.message ? cause.message : String(cause)
  return fileName ? `${fileName}：${message}` : message
}

function validationFileName(cause: unknown): string {
  if (
    cause instanceof MapImportError &&
    (
      cause.code === 'invalid-metrics' ||
      (metricsText.value !== undefined && ['invalid-json', 'file-too-large'].includes(cause.code))
    )
  ) return metricsFileName.value
  return geometryFileName.value
}

function visualizationErrorMessage(cause: unknown): string {
  if (cause instanceof MapImportError) {
    const match = /^regions\[(\d+)]/.exec(cause.path)
    const region = match && visualization.value?.regions[Number(match[1])]
    if (region) return `${region.regionKey}：${cause.userMessage}`
  }
  return errorMessage(cause)
}

function validateVisualization(): void {
  validationError.value = ''
  if (!prepared.value || !visualization.value) return
  try {
    composeMapVisualization(prepared.value.document, visualization.value)
  } catch (cause) {
    validationError.value = visualizationErrorMessage(cause)
  }
}

function validatePackage(): void {
  prepared.value = undefined
  visualization.value = undefined
  validationError.value = ''
  if (geometryText.value === undefined) return
  if (!nameProperty.value) {
    validationError.value = '没有可用的唯一名称字段'
    return
  }
  try {
    const nextPrepared = prepareGeoJsonMapPackage({
      geometryText: geometryText.value,
      geometryFileName: geometryFileName.value,
      nameProperty: nameProperty.value,
      ...(metricsText.value === undefined ? {} : { metricsText: metricsText.value })
    })
    prepared.value = nextPrepared
    visualization.value = nextPrepared.visualization
    validateVisualization()
  } catch (cause) {
    validationError.value = errorMessage(cause, validationFileName(cause))
  }
}

async function handleGeometryFile(event: Event): Promise<void> {
  const generation = ++geometryReadGeneration
  metricsReadGeneration += 1
  metricsReading.value = false
  metricsText.value = undefined
  metricsFileName.value = ''
  const file = (event.target as HTMLInputElement).files?.[0]
  geometryText.value = undefined
  geometryFileName.value = ''
  inspection.value = undefined
  nameProperty.value = ''
  prepared.value = undefined
  visualization.value = undefined
  validationError.value = ''
  if (!file) return
  geometryFileName.value = file.name
  try {
    const text = await file.text()
    if (generation !== geometryReadGeneration) return
    const nextInspection = inspectGeoJsonMap(text)
    geometryText.value = text
    inspection.value = nextInspection
    nameProperty.value = nextInspection.usableNameProperties.includes('name')
      ? 'name'
      : nextInspection.usableNameProperties[0] ?? ''
    validatePackage()
  } catch (cause) {
    if (generation === geometryReadGeneration) validationError.value = errorMessage(cause, file.name)
  }
}

async function handleMetricsFile(event: Event): Promise<void> {
  const generation = ++metricsReadGeneration
  const file = (event.target as HTMLInputElement).files?.[0]
  metricsText.value = undefined
  metricsFileName.value = file?.name ?? ''
  prepared.value = undefined
  visualization.value = undefined
  validationError.value = ''
  if (!file) {
    metricsReading.value = false
    validatePackage()
    return
  }
  metricsReading.value = true
  try {
    const text = await file.text()
    if (generation !== metricsReadGeneration) return
    metricsText.value = text
    validatePackage()
  } catch (cause) {
    if (generation === metricsReadGeneration) validationError.value = errorMessage(cause, file.name)
  } finally {
    if (generation === metricsReadGeneration) metricsReading.value = false
  }
}

function handleNameProperty(): void {
  validatePackage()
}

function setRegionNumber(
  regionIndex: number,
  field: 'primary' | 'secondary',
  event: Event
): void {
  const region = visualization.value?.regions[regionIndex]
  if (!region) return
  const value = (event.target as HTMLInputElement).value
  region[field] = value === '' ? null : Number(value)
  validateVisualization()
}

async function applyMap(): Promise<void> {
  if (!prepared.value || !visualization.value || busy.value) return
  busy.value = true
  validationError.value = ''
  try {
    await activeMapSource.activate(prepared.value, visualization.value)
    await router.push('/')
  } catch (cause) {
    validationError.value = errorMessage(cause)
  } finally {
    busy.value = false
  }
}

async function resetMap(): Promise<void> {
  if (busy.value) return
  busy.value = true
  validationError.value = ''
  try {
    await activeMapSource.resetToBuiltin()
    await router.push('/')
  } catch (cause) {
    validationError.value = errorMessage(cause)
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  try {
    const result = await activeMapSource.load()
    warnings.value = result.warnings
    if (result.custom) {
      const restored = result.custom
      geometryText.value = restored.prepared.persisted.geometryText
      geometryFileName.value = restored.prepared.persisted.geometryFileName
      nameProperty.value = restored.prepared.persisted.nameProperty
      inspection.value = inspectGeoJsonMap(restored.prepared.persisted.geometryText)
      prepared.value = restored.prepared
      visualization.value = restored.visualization
      validateVisualization()
    }
  } catch (cause) {
    warnings.value = [{ code: 'storage-read-failed', message: errorMessage(cause) }]
  }
})
</script>

<template>
  <main class="map-loader">
    <img class="map-loader__background" :src="bgMain" alt="" />
    <section class="map-loader__card" aria-labelledby="map-loader-title">
      <header>
        <p class="map-loader__eyebrow">LOCAL MAP PACKAGE</p>
        <h1 id="map-loader-title">导入 GeoJSON 地图</h1>
        <p>上传区域边界，可选附加业务数据。校验成功前不会替换当前地图。</p>
      </header>

      <ul v-if="warnings.length" class="map-loader__warnings" aria-label="存储提醒">
        <li v-for="warning in warnings" :key="`${warning.code}:${warning.message}`">
          {{ warning.message }}
        </li>
      </ul>

      <div class="map-loader__fields">
        <label class="map-loader__field" for="geometry-file">
          <span>GeoJSON 边界文件 <strong>必需</strong></span>
          <input
            id="geometry-file"
            type="file"
            accept=".geojson,.json,application/geo+json,application/json"
            @change="handleGeometryFile"
          />
        </label>

        <label class="map-loader__field" for="metrics-file">
          <span>业务数据 JSON <em>可选</em></span>
          <input
            id="metrics-file"
            type="file"
            accept=".json,application/json"
            @change="handleMetricsFile"
          />
        </label>

        <label
          v-if="inspection?.usableNameProperties.length"
          class="map-loader__field"
          for="name-property"
        >
          <span>区域名称字段</span>
          <select id="name-property" v-model="nameProperty" @change="handleNameProperty">
            <option
              v-for="property in inspection.usableNameProperties"
              :key="property"
              :value="property"
            >
              {{ property }}
            </option>
          </select>
        </label>
      </div>

      <ul
        v-if="inspection?.namePropertyConflicts.length"
        class="map-loader__name-conflicts"
        data-name-conflicts
        aria-label="名称字段冲突"
      >
        <li
          v-for="conflict in inspection.namePropertyConflicts"
          :key="conflict.property"
        >
          {{ conflict.property }}：{{ conflict.duplicateValues.join('、') }}
        </li>
      </ul>

      <section v-if="prepared" class="map-loader__summary" aria-label="校验摘要">
        <h2>校验通过</h2>
        <p data-summary="geometry">
          {{ prepared.summary.geometryFileName }} · {{ prepared.summary.featureCount }} 个区域 ·
          {{ prepared.summary.totalPositionCount }} 个坐标点 · Polygon
          {{ prepared.summary.polygonCount }} / MultiPolygon {{ prepared.summary.multiPolygonCount }} ·
          名称字段 {{ prepared.summary.nameProperty }}
        </p>
        <p v-if="prepared.summary.metrics" data-summary="metrics">
          业务数据：匹配 {{ prepared.summary.metrics.matchedNames.length }} ·
          缺失 {{ prepared.summary.metrics.missingNames.length }} ·
          多余 {{ prepared.summary.metrics.extraNames.length }}
        </p>
        <p v-else data-summary="metrics">
          已启用 {{ enabledRegionCount }} / {{ visualization?.regions.length ?? 0 }} 个分块；
          未启用分块只显示地图效果。
        </p>
      </section>

      <section v-if="prepared && visualization" class="map-loader__editor" aria-labelledby="editor-title">
        <header class="map-loader__editor-heading">
          <div>
            <h2 id="editor-title">分块数据配置</h2>
            <p>原始标识用于数据绑定，展示名称仅用于地图与悬浮窗呈现。</p>
          </div>
          <span>{{ enabledRegionCount }} / {{ visualization.regions.length }} 已启用</span>
        </header>

        <div class="map-loader__metric-fields">
          <label for="primary-label">
            <span>主指标名称</span>
            <input id="primary-label" v-model="visualization.labels.primary.label" maxlength="20" @input="validateVisualization" />
          </label>
          <label for="primary-unit">
            <span>主指标单位</span>
            <input id="primary-unit" v-model="visualization.labels.primary.unit" maxlength="8" @input="validateVisualization" />
          </label>
          <label for="secondary-label">
            <span>次指标名称</span>
            <input id="secondary-label" v-model="visualization.labels.secondary.label" maxlength="20" @input="validateVisualization" />
          </label>
          <label for="secondary-unit">
            <span>次指标单位</span>
            <input id="secondary-unit" v-model="visualization.labels.secondary.unit" maxlength="8" @input="validateVisualization" />
          </label>
        </div>

        <div class="map-loader__region-table" role="table" aria-label="已识别地图分块">
          <div class="map-loader__region-head" role="row">
            <span>可视化</span>
            <span>原始标识</span>
            <span>展示名称</span>
            <span>主数值</span>
            <span>次数值</span>
          </div>
          <div class="map-loader__region-scroll">
            <div
              v-for="(region, regionIndex) in visualization.regions"
              :key="region.regionKey"
              class="map-loader__region-row"
              role="row"
              data-region-row
              :data-region-key="region.regionKey"
            >
              <label class="map-loader__enable">
                <input
                  v-model="region.enabled"
                  type="checkbox"
                  data-field="enabled"
                  :aria-label="`启用 ${region.regionKey} 可视化`"
                  @change="validateVisualization"
                />
                <span>{{ region.enabled ? '启用' : '关闭' }}</span>
              </label>
              <span class="map-loader__region-key" data-original-key :title="region.regionKey">
                {{ region.regionKey }}
              </span>
              <input
                v-model="region.displayName"
                type="text"
                maxlength="40"
                data-field="display-name"
                :aria-label="`${region.regionKey} 展示名称`"
                @input="validateVisualization"
              />
              <input
                type="number"
                min="0"
                step="any"
                data-field="primary"
                :disabled="!region.enabled"
                :value="region.primary ?? ''"
                :aria-label="`${region.regionKey} 主数值`"
                @input="setRegionNumber(regionIndex, 'primary', $event)"
              />
              <input
                type="number"
                min="0"
                step="any"
                data-field="secondary"
                :disabled="!region.enabled"
                :value="region.secondary ?? ''"
                :aria-label="`${region.regionKey} 次数值`"
                @input="setRegionNumber(regionIndex, 'secondary', $event)"
              />
            </div>
          </div>
        </div>
      </section>

      <p v-if="validationError" class="map-loader__error" role="alert">
        {{ validationError }}
      </p>

      <footer class="map-loader__actions">
        <button type="button" data-action="reset" class="is-secondary" :disabled="busy" @click="resetMap">
          恢复内置重庆地图
        </button>
        <button type="button" data-action="apply" :disabled="!canApply" @click="applyMap">
          {{ busy ? '处理中…' : '应用并查看地图' }}
        </button>
      </footer>
    </section>
  </main>
</template>

<style scoped>
.map-loader {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  overflow: hidden;
  color: #dcecff;
}

.map-loader__background {
  position: absolute;
  inset: 0;
  width: 1920px;
  height: 1080px;
}

.map-loader__card {
  position: relative;
  box-sizing: border-box;
  width: 1480px;
  max-height: 980px;
  padding: 30px 38px 28px;
  overflow: auto;
  background: linear-gradient(145deg, rgba(8, 28, 63, 0.96), rgba(5, 18, 44, 0.94));
  border: 1px solid rgba(63, 169, 255, 0.62);
  border-radius: 10px;
  box-shadow: 0 0 56px rgba(25, 119, 229, 0.32), inset 0 0 40px rgba(17, 87, 171, 0.16);
}

.map-loader__card h1 { margin: 4px 0 8px; color: #fff; font-size: 32px; }
.map-loader__card h2 { margin: 0 0 8px; color: #7de7ff; font-size: 18px; }
.map-loader__card p { margin: 0; color: #98b6d8; font-size: 16px; line-height: 1.7; }
.map-loader__eyebrow { color: #2edcff !important; font-family: monospace; letter-spacing: 0.18em; }

.map-loader__warnings,
.map-loader__name-conflicts,
.map-loader__error {
  margin: 20px 0 0;
  padding: 12px 16px;
  color: #ffd39c !important;
  background: rgba(109, 67, 16, 0.26);
  border: 1px solid rgba(255, 186, 91, 0.42);
  border-radius: 6px;
}

.map-loader__warnings { list-style: none; }
.map-loader__name-conflicts { list-style-position: inside; }
.map-loader__error { color: #ffad99 !important; background: rgba(116, 33, 25, 0.28); }
.map-loader__fields { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 18px; margin-top: 22px; }
.map-loader__field { display: grid; gap: 9px; color: #c9dff8; font-size: 16px; }
.map-loader__field strong { color: #4ee7ff; font-weight: 500; }
.map-loader__field em { color: #89a8ca; font-style: normal; }
.map-loader__field input,
.map-loader__field select {
  box-sizing: border-box;
  width: 100%;
  min-height: 44px;
  padding: 9px 12px;
  color: #e9f5ff;
  background: rgba(8, 37, 77, 0.86);
  border: 1px solid rgba(66, 151, 236, 0.55);
  border-radius: 5px;
}

.map-loader__summary {
  margin-top: 24px;
  padding: 18px 20px;
  background: rgba(8, 66, 104, 0.34);
  border-left: 3px solid #2edcff;
}

.map-loader__summary p + p { margin-top: 5px; }
.map-loader__editor {
  margin-top: 20px;
  padding: 18px 20px 20px;
  background: rgba(4, 25, 57, 0.6);
  border: 1px solid rgba(55, 139, 226, 0.38);
  border-radius: 6px;
}

.map-loader__editor-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.map-loader__editor-heading > span {
  flex: 0 0 auto;
  color: #57e5ff;
  font-family: monospace;
  font-size: 15px;
}

.map-loader__metric-fields {
  display: grid;
  grid-template-columns: 2fr 1fr 2fr 1fr;
  gap: 12px;
  margin-top: 16px;
}

.map-loader__metric-fields label {
  display: grid;
  gap: 6px;
  color: #9dbbdc;
  font-size: 14px;
}

.map-loader__metric-fields input,
.map-loader__region-row input[type='text'],
.map-loader__region-row input[type='number'] {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 38px;
  padding: 7px 10px;
  color: #ecf7ff;
  background: rgba(8, 37, 77, 0.86);
  border: 1px solid rgba(66, 151, 236, 0.5);
  border-radius: 4px;
}

.map-loader__region-table { margin-top: 16px; }
.map-loader__region-head,
.map-loader__region-row {
  display: grid;
  grid-template-columns: 96px minmax(180px, 1fr) minmax(210px, 1.2fr) minmax(130px, 0.7fr) minmax(130px, 0.7fr);
  align-items: center;
  gap: 12px;
}

.map-loader__region-head {
  padding: 0 12px 9px;
  color: #73a9d7;
  font-size: 13px;
}

.map-loader__region-scroll {
  max-height: 326px;
  overflow: auto;
  border-top: 1px solid rgba(69, 145, 221, 0.32);
  border-bottom: 1px solid rgba(69, 145, 221, 0.32);
}

.map-loader__region-row {
  min-height: 54px;
  padding: 7px 12px;
  border-bottom: 1px solid rgba(53, 112, 175, 0.2);
}

.map-loader__region-row:last-child { border-bottom: 0; }
.map-loader__enable { display: flex; align-items: center; gap: 7px; color: #9fb9d5; font-size: 13px; }
.map-loader__enable input { accent-color: #2edcff; }
.map-loader__region-key {
  overflow: hidden;
  color: #bcd7f2;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.map-loader__region-row input:disabled { opacity: 0.42; }

.map-loader__actions { display: flex; justify-content: flex-end; gap: 14px; margin-top: 22px; }
.map-loader__actions button {
  min-width: 178px;
  min-height: 46px;
  padding: 0 20px;
  color: #02162d;
  font-size: 16px;
  font-weight: 700;
  background: linear-gradient(90deg, #36dff8, #4c9cff);
  border: 0;
  border-radius: 5px;
  cursor: pointer;
}

.map-loader__actions button.is-secondary {
  color: #bcd7f2;
  background: transparent;
  border: 1px solid rgba(87, 155, 224, 0.62);
}

.map-loader__actions button:disabled { cursor: not-allowed; opacity: 0.42; }
</style>
