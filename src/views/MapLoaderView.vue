<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import { activeMapSource } from '@/components/map/mapSource'
import {
  inspectGeoJsonMap,
  MapImportError,
  prefillMapVisualizationDraft,
  prepareGeoJsonMapPackage,
  type GeoJsonInspection,
  type MapDocument,
  type MapMetricsSummary,
  type PreparedMapPackage
} from '@/components/map/mapDocument'
import type { ActiveMapLoadResult, MapSourceWarning } from '@/components/map/activeMapSource'
import {
  createMapAuthoringSession,
  type MapAuthoringGeometryIntent,
  type MapAuthoringCommitResult,
  type MapAuthoringSnapshot,
} from '@/components/map/mapAuthoringWorkspace'
import { useMapVisualSettings, type VisualWorkspaceMode } from '@/composables/useMapVisualSettings'
import VisualSettingsPanel from '@/components/visual-settings/VisualSettingsPanel.vue'

const emit = defineEmits<{
  mapActivated: [document: MapDocument]
  authoringFocus: [regionKey: string | null]
}>()
const props = defineProps<{
  initialLoad: ActiveMapLoadResult
}>()
const visualSettings = useMapVisualSettings()
const authoringSession = createMapAuthoringSession(props.initialLoad, {
  activateGeometry(nextPrepared, options) {
    return activeMapSource.activate(nextPrepared, undefined, options)
  },
  publishVisualization(nextPrepared, nextVisualization) {
    return activeMapSource.updateVisualization(nextPrepared, nextVisualization)
  },
  resetGeometry(options) {
    return activeMapSource.resetToBuiltin(options)
  }
})
const geometryText = ref<string>()
const geometryFileName = ref('')
const nameProperty = ref('')
const inspection = shallowRef<GeoJsonInspection>()
const prepared = shallowRef<PreparedMapPackage>()
const workspaceSnapshot = shallowRef<MapAuthoringSnapshot>()
const visualization = computed(() => workspaceSnapshot.value?.editable)
const prefillSummary = shallowRef<MapMetricsSummary>()
const warnings = ref<MapSourceWarning[]>([])
const validationError = ref('')
const metricsValidationError = ref('')
const busy = ref(false)
const metricsReading = ref(false)
let geometryReadGeneration = 0
let metricsReadGeneration = 0
let activationGeneration = 0

function switchWorkspace(mode: VisualWorkspaceMode): void {
  visualSettings.workspaceMode.value = mode
}

const enabledRegionCount = computed(() =>
  visualization.value?.regions.filter((region) => region.enabled).length ?? 0
)

function errorMessage(cause: unknown, fileName = ''): string {
  const message = cause instanceof MapImportError
    ? `${cause.userMessage}（${cause.path}）`
    : cause instanceof Error && cause.message ? cause.message : String(cause)
  return fileName ? `${fileName}：${message}` : message
}

function refreshWorkspace(): void {
  workspaceSnapshot.value = authoringSession.read().workspace
}

interface GeometryCandidate {
  text: string
  fileName: string
  nameProperty: string
  inspection: GeoJsonInspection
  prepared: PreparedMapPackage
}

interface GeometryActivationRequest {
  generation: number
  intent: MapAuthoringGeometryIntent
}

function beginGeometryActivation(): GeometryActivationRequest {
  return {
    generation: ++activationGeneration,
    intent: authoringSession.beginGeometryLoad()
  }
}

async function activateGeometry(
  candidate: GeometryCandidate,
  request = beginGeometryActivation()
): Promise<void> {
  const { generation, intent } = request
  busy.value = true
  validationError.value = ''
  try {
    const document = await authoringSession.loadGeometry(candidate.prepared, intent)
    if (generation !== activationGeneration) return
    geometryText.value = candidate.text
    geometryFileName.value = candidate.fileName
    inspection.value = candidate.inspection
    nameProperty.value = candidate.nameProperty
    prepared.value = candidate.prepared
    refreshWorkspace()
    prefillSummary.value = undefined
    metricsValidationError.value = ''
    emit('authoringFocus', authoringSession.read().authoringFocus)
    emit('mapActivated', document)
  } catch (cause) {
    if (generation === activationGeneration) {
      validationError.value = errorMessage(cause, candidate.fileName)
    }
  } finally {
    if (generation === activationGeneration) busy.value = false
  }
}

function prepareCandidate(input: {
  text: string
  fileName: string
  nameProperty: string
  inspection: GeoJsonInspection
}): GeometryCandidate {
  return {
    ...input,
    prepared: prepareGeoJsonMapPackage({
      geometryText: input.text,
      geometryFileName: input.fileName,
      nameProperty: input.nameProperty
    })
  }
}

async function handleGeometryFile(event: Event): Promise<void> {
  const generation = ++geometryReadGeneration
  const activationRequest = beginGeometryActivation()
  let activationStarted = false
  metricsReadGeneration += 1
  metricsReading.value = false
  metricsValidationError.value = ''
  const file = (event.target as HTMLInputElement).files?.[0]
  validationError.value = ''
  if (!file) return
  busy.value = true
  try {
    const text = await file.text()
    if (generation !== geometryReadGeneration) return
    const nextInspection = inspectGeoJsonMap(text)
    const nextNameProperty = nextInspection.usableNameProperties.includes('name')
      ? 'name'
      : nextInspection.usableNameProperties[0] ?? ''
    if (!nextNameProperty) {
      inspection.value = nextInspection
      validationError.value = '没有可用的唯一名称字段'
      return
    }
    activationStarted = true
    await activateGeometry(prepareCandidate({
      text,
      fileName: file.name,
      nameProperty: nextNameProperty,
      inspection: nextInspection
    }), activationRequest)
  } catch (cause) {
    if (generation === geometryReadGeneration) validationError.value = errorMessage(cause, file.name)
  } finally {
    if (generation === geometryReadGeneration && !activationStarted) busy.value = false
  }
}

async function handleMetricsFile(event: Event): Promise<void> {
  const generation = ++metricsReadGeneration
  const file = (event.target as HTMLInputElement).files?.[0]
  metricsValidationError.value = ''
  if (!file) {
    metricsReading.value = false
    prefillSummary.value = undefined
    return
  }
  if (!prepared.value) {
    metricsValidationError.value = '请先上传并校验 GeoJSON 边界文件'
    return
  }
  metricsReading.value = true
  try {
    const text = await file.text()
    if (generation !== metricsReadGeneration) return
    const prefill = prefillMapVisualizationDraft(prepared.value.document, text)
    authoringSession.prefill(prefill.visualization)
    refreshWorkspace()
    prefillSummary.value = prefill.summary
  } catch (cause) {
    if (generation === metricsReadGeneration) {
      metricsValidationError.value = errorMessage(cause, file.name)
    }
  } finally {
    if (generation === metricsReadGeneration) metricsReading.value = false
  }
}

async function handleNameProperty(): Promise<void> {
  if (!geometryText.value || !geometryFileName.value || !inspection.value || !nameProperty.value) return
  const requestedNameProperty = nameProperty.value
  try {
    await activateGeometry(prepareCandidate({
      text: geometryText.value,
      fileName: geometryFileName.value,
      nameProperty: requestedNameProperty,
      inspection: inspection.value
    }))
    if (prepared.value?.persisted.nameProperty !== requestedNameProperty) {
      nameProperty.value = prepared.value?.persisted.nameProperty ?? ''
    }
  } catch (cause) {
    validationError.value = errorMessage(cause, geometryFileName.value)
  }
}

function editMetric(
  metric: 'primary' | 'secondary',
  field: 'label' | 'unit',
  event: Event
): void {
  authoringSession.editMetric(metric, { [field]: (event.target as HTMLInputElement).value })
  refreshWorkspace()
}

function editRegion(
  regionKey: string,
  field: 'enabled' | 'displayName' | 'primary' | 'secondary',
  event: Event
): void {
  const input = event.target as HTMLInputElement
  authoringSession.editRegion(regionKey, {
    [field]: field === 'enabled' ? input.checked : input.value
  })
  refreshWorkspace()
}

function publishCommit(result: MapAuthoringCommitResult): void {
  refreshWorkspace()
  if (result.ok) {
    validationError.value = ''
    emit('mapActivated', result.document)
  } else {
    validationError.value = result.error
  }
}

function commitRegion(regionKey: string): void {
  publishCommit(authoringSession.commitRegion(regionKey))
}

function commitMetrics(): void {
  publishCommit(authoringSession.commitMetrics())
}

function commitAll(): void {
  publishCommit(authoringSession.commitAll())
}

function focusRegion(regionKey: string): void {
  authoringSession.focusRegion(regionKey)
  refreshWorkspace()
  emit('authoringFocus', authoringSession.read().authoringFocus)
}

function leaveRegion(event: FocusEvent): void {
  const row = event.currentTarget as HTMLElement
  const next = event.relatedTarget
  if (next instanceof Node && row.contains(next)) return
  authoringSession.focusRegion(null)
  refreshWorkspace()
  emit('authoringFocus', authoringSession.read().authoringFocus)
}

async function resetMap(): Promise<void> {
  if (busy.value) return
  busy.value = true
  validationError.value = ''
  try {
    activationGeneration += 1
    const document = await authoringSession.reset()
    geometryText.value = undefined
    geometryFileName.value = ''
    nameProperty.value = ''
    inspection.value = undefined
    prepared.value = undefined
    workspaceSnapshot.value = undefined
    prefillSummary.value = undefined
    metricsValidationError.value = ''
    emit('authoringFocus', null)
    emit('mapActivated', document)
  } catch (cause) {
    validationError.value = errorMessage(cause)
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  warnings.value = props.initialLoad.warnings
  if (props.initialLoad.custom) {
    const restored = props.initialLoad.custom
    geometryText.value = restored.prepared.persisted.geometryText
    geometryFileName.value = restored.prepared.persisted.geometryFileName
    nameProperty.value = restored.prepared.persisted.nameProperty
    inspection.value = inspectGeoJsonMap(restored.prepared.persisted.geometryText)
    prepared.value = restored.prepared
    refreshWorkspace()
  }
})
</script>

<template>
  <aside
    class="map-loader"
    :class="{ 'is-collapsed': visualSettings.sidebarCollapsed.value }"
    aria-label="GeoJSON 地图创作面板"
  >
    <button
      type="button"
      class="map-loader__collapse-toggle"
      data-action="toggle-sidebar"
      :aria-expanded="!visualSettings.sidebarCollapsed.value"
      :aria-label="visualSettings.sidebarCollapsed.value ? '展开右侧栏' : '收起右侧栏'"
      @click="visualSettings.toggleSidebar"
    >
      <span aria-hidden="true">{{ visualSettings.sidebarCollapsed.value ? '‹' : '›' }}</span>
    </button>
    <section
      v-show="!visualSettings.sidebarCollapsed.value"
      class="map-loader__card"
      aria-labelledby="map-loader-title"
    >
      <nav class="map-loader__workspace-nav" aria-label="创作工作区功能">
        <button
          type="button"
          data-workspace-mode="data"
          :class="{ active: visualSettings.workspaceMode.value === 'data' }"
          :aria-current="visualSettings.workspaceMode.value === 'data' ? 'page' : undefined"
          @click="switchWorkspace('data')"
        >
          数据配置
        </button>
        <button
          type="button"
          data-workspace-mode="visual"
          :class="{ active: visualSettings.workspaceMode.value === 'visual' }"
          :aria-current="visualSettings.workspaceMode.value === 'visual' ? 'page' : undefined"
          @click="switchWorkspace('visual')"
        >
          视觉样式
        </button>
      </nav>

      <div
        v-show="visualSettings.workspaceMode.value === 'data'"
        class="map-loader__page map-loader__data-page"
        data-workspace-page="data"
      >
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
            :disabled="!prepared || metricsReading"
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
        <p v-if="prefillSummary" data-summary="metrics">
          业务数据：匹配 {{ prefillSummary.matchedNames.length }} ·
          缺失 {{ prefillSummary.missingNames.length }} ·
          多余 {{ prefillSummary.extraNames.length }}
        </p>
        <dl v-if="prefillSummary" class="map-loader__prefill-details">
          <div data-prefill="matched">
            <dt>匹配</dt>
            <dd>{{ prefillSummary.matchedNames.join('、') || '无' }}</dd>
          </div>
          <div data-prefill="missing">
            <dt>缺失</dt>
            <dd>{{ prefillSummary.missingNames.join('、') || '无' }}</dd>
          </div>
          <div data-prefill="extra">
            <dt>多余</dt>
            <dd>{{ prefillSummary.extraNames.join('、') || '无' }}</dd>
          </div>
        </dl>
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
          <label for="primary-label" :data-dirty="workspaceSnapshot?.dirtyMetrics || undefined">
            <span>主指标名称</span>
            <input id="primary-label" :value="visualization.labels.primary.label" @input="editMetric('primary', 'label', $event)" />
          </label>
          <label for="primary-unit">
            <span>主指标单位</span>
            <input id="primary-unit" :value="visualization.labels.primary.unit" @input="editMetric('primary', 'unit', $event)" />
          </label>
          <label for="secondary-label">
            <span>次指标名称</span>
            <input id="secondary-label" :value="visualization.labels.secondary.label" @input="editMetric('secondary', 'label', $event)" />
          </label>
          <label for="secondary-unit">
            <span>次指标单位</span>
            <input id="secondary-unit" :value="visualization.labels.secondary.unit" @input="editMetric('secondary', 'unit', $event)" />
          </label>
          <button type="button" data-action="update-metrics" @click="commitMetrics">更新指标</button>
        </div>
        <p v-if="workspaceSnapshot?.metricError" class="map-loader__inline-error" role="alert">
          {{ workspaceSnapshot.metricError }}
        </p>

        <div class="map-loader__region-table" role="table" aria-label="已识别地图分块">
          <div class="map-loader__region-head" role="row">
            <span>可视化</span>
            <span>原始标识</span>
            <span>展示名称</span>
            <span>主数值</span>
            <span>次数值</span>
            <span>更新</span>
          </div>
          <div class="map-loader__region-scroll">
            <div
              v-for="region in visualization.regions"
              :key="region.regionKey"
              class="map-loader__region-row"
              role="row"
              data-region-row
              :data-region-key="region.regionKey"
              :data-dirty="workspaceSnapshot?.dirtyRegionKeys.includes(region.regionKey) || undefined"
              @focusin="focusRegion(region.regionKey)"
              @focusout="leaveRegion"
            >
              <label class="map-loader__enable">
                <input
                  type="checkbox"
                  data-field="enabled"
                  :checked="region.enabled"
                  :aria-label="`启用 ${region.regionKey} 可视化`"
                  @change="editRegion(region.regionKey, 'enabled', $event)"
                />
              </label>
              <span class="map-loader__region-key" data-original-key :title="region.regionKey">
                {{ region.regionKey }}
              </span>
              <input
                type="text"
                data-field="display-name"
                :value="region.displayName"
                :aria-label="`${region.regionKey} 展示名称`"
                @input="editRegion(region.regionKey, 'displayName', $event)"
              />
              <input
                type="text"
                inputmode="decimal"
                data-field="primary"
                :disabled="!region.enabled"
                :value="region.primary"
                :aria-label="`${region.regionKey} 主数值`"
                @input="editRegion(region.regionKey, 'primary', $event)"
              />
              <input
                type="text"
                inputmode="decimal"
                data-field="secondary"
                :disabled="!region.enabled"
                :value="region.secondary"
                :aria-label="`${region.regionKey} 次数值`"
                @input="editRegion(region.regionKey, 'secondary', $event)"
              />
              <button
                type="button"
                data-action="update-region"
                :aria-label="`更新 ${region.regionKey}`"
                @click="commitRegion(region.regionKey)"
              >
                更新此分块
              </button>
              <p
                v-if="workspaceSnapshot?.regionErrors[region.regionKey]"
                class="map-loader__row-error"
                role="alert"
              >
                {{ workspaceSnapshot.regionErrors[region.regionKey] }}
              </p>
            </div>
          </div>
        </div>
      </section>

      <p v-if="metricsValidationError || validationError" class="map-loader__error" role="alert">
        {{ metricsValidationError || validationError }}
      </p>

      <footer class="map-loader__actions">
        <button type="button" data-action="reset" class="is-secondary" :disabled="busy" @click="resetMap">
          恢复内置重庆地图
        </button>
        <button type="button" data-action="update-all" :disabled="busy || !prepared" @click="commitAll">
          全部更新
        </button>
      </footer>
      </div>

      <VisualSettingsPanel v-show="visualSettings.workspaceMode.value === 'visual'" />
    </section>
  </aside>
</template>

<style scoped>
.map-loader {
  position: absolute;
  z-index: 3;
  top: 24px;
  right: 24px;
  bottom: 24px;
  box-sizing: border-box;
  width: 720px;
  overflow: visible;
  color: #dcecff;
  overscroll-behavior: contain;
}

.map-loader.is-collapsed {
  top: 24px;
  bottom: auto;
  width: 44px;
  height: 44px;
}

.map-loader__collapse-toggle {
  position: absolute;
  z-index: 2;
  top: 18px;
  left: -44px;
  width: 36px;
  height: 56px;
  padding: 0;
  color: #8feeff;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  background: linear-gradient(145deg, rgba(8, 28, 63, 0.96), rgba(5, 18, 44, 0.94));
  border: 1px solid rgba(63, 169, 255, 0.62);
  border-right: 0;
  border-radius: 8px 0 0 8px;
  box-shadow: -8px 0 28px rgba(25, 119, 229, 0.24);
}

.map-loader.is-collapsed .map-loader__collapse-toggle {
  top: 0;
  left: 0;
  width: 44px;
  height: 44px;
  border-right: 1px solid rgba(63, 169, 255, 0.62);
  border-radius: 8px;
}

.map-loader__card {
  position: relative;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 24px 26px 26px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: linear-gradient(145deg, rgba(8, 28, 63, 0.96), rgba(5, 18, 44, 0.94));
  border: 1px solid rgba(63, 169, 255, 0.62);
  border-radius: 10px;
  box-shadow: 0 0 56px rgba(25, 119, 229, 0.32), inset 0 0 40px rgba(17, 87, 171, 0.16);
}

.map-loader__workspace-nav {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.map-loader__workspace-nav button {
  min-height: 46px;
  color: #7fa8d9;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  background: rgba(36, 131, 255, 0.08);
  border: 1px solid rgba(36, 131, 255, 0.35);
  border-radius: 5px;
}

.map-loader__workspace-nav button.active {
  color: #00deff;
  background: rgba(0, 222, 255, 0.1);
  border-color: #00deff;
}

.map-loader__page {
  flex: 1;
  min-height: 0;
  padding-right: 5px;
  overflow-y: auto;
  overscroll-behavior: contain;
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
.map-loader__fields { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 22px; }
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
.map-loader__prefill-details { margin: 9px 0 0; }
.map-loader__prefill-details div { display: grid; grid-template-columns: 46px 1fr; gap: 8px; }
.map-loader__prefill-details dt { color: #6cdff8; }
.map-loader__prefill-details dd { margin: 0; color: #98b6d8; overflow-wrap: anywhere; }
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
  grid-template-columns: 2fr 1fr;
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

.map-loader__metric-fields button {
  grid-column: 1 / -1;
  min-height: 36px;
}

.map-loader__metric-fields [data-dirty='true'] span,
.map-loader__region-row[data-dirty='true'] .map-loader__region-key {
  color: #ffe27a;
}

.map-loader__region-table { margin-top: 16px; }
.map-loader__region-head,
.map-loader__region-row {
  display: grid;
  grid-template-columns: 68px minmax(80px, 0.8fr) minmax(112px, 1.2fr) minmax(70px, 0.7fr) minmax(70px, 0.7fr) 92px;
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
.map-loader__enable { display: flex; align-items: center; justify-content: center; }
.map-loader__enable input { width: 16px; height: 16px; margin: 0; accent-color: #2edcff; }
.map-loader__region-key {
  overflow: hidden;
  color: #bcd7f2;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.map-loader__region-row input:disabled { opacity: 0.42; }
.map-loader__region-row button,
.map-loader__metric-fields button {
  padding: 7px 9px;
  color: #dff9ff;
  background: rgba(22, 111, 180, 0.58);
  border: 1px solid rgba(75, 203, 255, 0.58);
  border-radius: 4px;
  cursor: pointer;
}
.map-loader__row-error {
  grid-column: 1 / -1;
  color: #ffad99 !important;
  font-size: 13px !important;
}
.map-loader__inline-error { margin-top: 8px !important; color: #ffad99 !important; }

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
