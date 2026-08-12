<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { activeMapSource } from '@/components/map/mapSource'
import {
  inspectGeoJsonMap,
  MapImportError,
  prepareGeoJsonMapPackage,
  type GeoJsonInspection,
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
const warnings = ref<MapSourceWarning[]>([])
const validationError = ref('')
const busy = ref(false)
let geometryReadGeneration = 0
let metricsReadGeneration = 0

const canApply = computed(() => prepared.value !== undefined && !busy.value)

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

function validatePackage(): void {
  prepared.value = undefined
  validationError.value = ''
  if (geometryText.value === undefined) return
  if (!nameProperty.value) {
    validationError.value = '没有可用的唯一名称字段'
    return
  }
  try {
    prepared.value = prepareGeoJsonMapPackage({
      geometryText: geometryText.value,
      geometryFileName: geometryFileName.value,
      nameProperty: nameProperty.value,
      ...(metricsText.value === undefined ? {} : { metricsText: metricsText.value })
    })
  } catch (cause) {
    validationError.value = errorMessage(cause, validationFileName(cause))
  }
}

async function handleGeometryFile(event: Event): Promise<void> {
  const generation = ++geometryReadGeneration
  const file = (event.target as HTMLInputElement).files?.[0]
  geometryText.value = undefined
  geometryFileName.value = ''
  inspection.value = undefined
  nameProperty.value = ''
  prepared.value = undefined
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
  validationError.value = ''
  if (!file) {
    validatePackage()
    return
  }
  try {
    const text = await file.text()
    if (generation !== metricsReadGeneration) return
    metricsText.value = text
    validatePackage()
  } catch (cause) {
    if (generation === metricsReadGeneration) validationError.value = errorMessage(cause, file.name)
  }
}

function handleNameProperty(): void {
  validatePackage()
}

async function applyMap(): Promise<void> {
  if (!prepared.value || busy.value) return
  busy.value = true
  validationError.value = ''
  try {
    await activeMapSource.activate(prepared.value)
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
    warnings.value = (await activeMapSource.load()).warnings
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
        <p v-else data-summary="metrics">未附加业务数据；地图不会生成柱体或数值浮层。</p>
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
  width: 760px;
  padding: 44px 48px 40px;
  background: linear-gradient(145deg, rgba(8, 28, 63, 0.96), rgba(5, 18, 44, 0.94));
  border: 1px solid rgba(63, 169, 255, 0.62);
  border-radius: 10px;
  box-shadow: 0 0 56px rgba(25, 119, 229, 0.32), inset 0 0 40px rgba(17, 87, 171, 0.16);
}

.map-loader__card h1 { margin: 4px 0 12px; color: #fff; font-size: 34px; }
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
.map-loader__fields { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; margin-top: 28px; }
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
.map-loader__actions { display: flex; justify-content: flex-end; gap: 14px; margin-top: 30px; }
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
