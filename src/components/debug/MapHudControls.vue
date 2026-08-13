<script setup lang="ts">
import { watch } from 'vue'
import type {
  MapHudAnchorConfig,
  MapHudConfig,
  MapHudRotatingLayerConfig,
  MapHudStaticLayerConfig
} from '@/components/map/mapHudConfig'
import {
  useMapVisualSettings,
  type VisualNumericFieldId
} from '@/composables/useMapVisualSettings'

type KeysMatching<Config, Value> = {
  [Key in keyof Config]-?: Config[Key] extends Value ? Key : never
}[keyof Config]
type NumberField<Section extends string, Config> = {
  section: Section
  key: KeysMatching<Config, number>
  label: string
  kind: 'number'
  min: number
  max: number
  step: number
}
type BooleanField<Section extends string, Config> = {
  section: Section
  key: KeysMatching<Config, boolean>
  label: string
  kind: 'boolean'
}
type Field =
  | NumberField<'anchor', MapHudAnchorConfig>
  | NumberField<'static', MapHudStaticLayerConfig>
  | BooleanField<'static', MapHudStaticLayerConfig>
  | NumberField<'rotating', MapHudRotatingLayerConfig>
  | BooleanField<'rotating', MapHudRotatingLayerConfig>

interface Group {
  title: string
  fields: readonly Field[]
}

const GROUPS: readonly Group[] = [
  {
    title: '总体锚点（地图几何中心）',
    fields: [
      { section: 'anchor', key: 'x', label: '水平偏移 X', kind: 'number', min: -150, max: 150, step: 0.1 },
      { section: 'anchor', key: 'z', label: '纵深偏移 Z', kind: 'number', min: -150, max: 150, step: 0.1 },
      { section: 'anchor', key: 'elevation', label: '距模型底面高度', kind: 'number', min: -20, max: 20, step: 0.05 }
    ]
  },
  {
    title: '静态方位底盘',
    fields: [
      { section: 'static', key: 'enabled', label: '显示静态盘', kind: 'boolean' },
      { section: 'static', key: 'diameter', label: '静态盘直径', kind: 'number', min: 20, max: 300, step: 1 },
      { section: 'static', key: 'opacity', label: '静态盘透明度', kind: 'number', min: 0, max: 1, step: 0.01 },
      { section: 'static', key: 'phaseDeg', label: '静态盘朝向角 °', kind: 'number', min: 0, max: 360, step: 1 },
      { section: 'static', key: 'elevationOffset', label: '静态盘层高偏移', kind: 'number', min: -5, max: 5, step: 0.01 }
    ]
  },
  {
    title: '旋转分段环',
    fields: [
      { section: 'rotating', key: 'enabled', label: '显示旋转盘', kind: 'boolean' },
      { section: 'rotating', key: 'diameter', label: '旋转盘直径', kind: 'number', min: 20, max: 300, step: 1 },
      { section: 'rotating', key: 'opacity', label: '旋转盘透明度', kind: 'number', min: 0, max: 1, step: 0.01 },
      { section: 'rotating', key: 'phaseDeg', label: '旋转盘初始角 °', kind: 'number', min: 0, max: 360, step: 1 },
      { section: 'rotating', key: 'elevationOffset', label: '旋转盘层高偏移', kind: 'number', min: -5, max: 5, step: 0.01 },
      { section: 'rotating', key: 'speedDegPerSecond', label: '旋转速度 °/s', kind: 'number', min: -30, max: 30, step: 0.1 }
    ]
  }
]

const visualSettings = useMapVisualSettings()
const {
  hudEditTarget: editTarget,
  hudLivePreview: livePreview
} = visualSettings

function fieldId(field: Field, control: 'checkbox' | 'number' | 'range'): string {
  return `map-hud-${field.section}-${field.key}-${control}`
}

function fieldName(field: Field): string {
  return `${field.section}-${field.key}`
}

function draftKey(field: Field): VisualNumericFieldId {
  if (field.section === 'anchor') return `hud.anchor.${field.key}`
  if (field.section === 'static' && field.kind === 'number') return `hud.static.${field.key}`
  if (field.section === 'rotating' && field.kind === 'number') return `hud.rotating.${field.key}`
  throw new Error('Boolean HUD fields do not have numeric drafts')
}

function valueOf(field: Field): number | boolean {
  if (field.section === 'anchor') return editTarget.value.anchor[field.key]
  if (field.section === 'static') return editTarget.value.static[field.key]
  return editTarget.value.rotating[field.key]
}

function changeLivePreview(event: Event): void {
  visualSettings.setHudLivePreview((event.target as HTMLInputElement).checked)
}

function applyDraft(): void {
  visualSettings.applyHudDraft()
}

function discardDraft(): void {
  visualSettings.discardHudDraft()
}

function numberDraft(field: Field): string {
  return visualSettings.numericField(draftKey(field)).read(Number(valueOf(field)))
}

function updateNumberDraft(field: Field, event: Event): void {
  visualSettings.numericField(draftKey(field)).edit((event.target as HTMLInputElement).value)
}

function commitNumber(field: Field, event: Event): void {
  if (field.kind !== 'number') return
  const current = Number(valueOf(field))
  const result = visualSettings.numericField(draftKey(field)).commit(
    (event.target as HTMLInputElement).value,
    current,
    field
  )
  if (!result.changed) return
  if (field.section === 'anchor') {
    visualSettings.setHudField({ section: 'anchor', key: field.key, value: result.value })
  } else if (field.section === 'static') {
    visualSettings.setHudField({ section: 'static', key: field.key, value: result.value })
  } else {
    visualSettings.setHudField({ section: 'rotating', key: field.key, value: result.value })
  }
}

function updateRange(field: Field, event: Event): void {
  commitNumber(field, event)
}

function updateBoolean(field: Field, event: Event): void {
  if (field.kind !== 'boolean') return
  const value = (event.target as HTMLInputElement).checked
  if (field.section === 'static') {
    visualSettings.setHudField({ section: 'static', key: field.key, value })
  } else {
    visualSettings.setHudField({ section: 'rotating', key: field.key, value })
  }
}

function resetCurrentTarget(): void {
  visualSettings.resetEditableHud()
}

const editableJson = visualSettings.editableHudJson

async function copyHud(): Promise<void> {
  await visualSettings.copyVisualText('hud', editableJson.value)
}

function copyLabel(): string {
  return visualSettings.copyLabel('hud', '复制 HUD 参数')
}

watch(editTarget, () => {
  for (const group of GROUPS) {
    for (const field of group.fields) {
      if (field.kind !== 'number') continue
      visualSettings.numericField(draftKey(field)).sync(Number(valueOf(field)))
    }
  }
}, { deep: true, immediate: true })
</script>

<template>
  <div class="hud-controls" data-visual-page-content="hud">
    <section class="session-editing">
      <div class="field-head">
        <label for="map-hud-live-preview">实时预览</label>
        <input
          id="map-hud-live-preview"
          data-visual-action="hud.live-preview"
          class="checkbox"
          type="checkbox"
          :checked="livePreview"
          @change="changeLivePreview"
        />
      </div>
      <p v-if="!livePreview" class="editing-hint">草稿模式：切回实时预览会放弃未应用草稿。</p>
      <div v-if="!livePreview" class="actions">
        <button class="btn" data-visual-action="hud.apply" @click="applyDraft">应用参数</button>
        <button class="btn ghost" data-visual-action="hud.discard" @click="discardDraft">放弃草稿</button>
      </div>
    </section>

    <section v-for="group in GROUPS" :key="group.title" class="hud-group">
      <h3>{{ group.title }}</h3>
      <div v-for="field in group.fields" :key="fieldName(field)" class="field" :data-control-path="`hud.${field.section}.${field.key}`">
        <div class="field-head">
          <label :for="fieldId(field, field.kind === 'boolean' ? 'checkbox' : 'number')">{{ field.label }}</label>
          <input
            v-if="field.kind === 'boolean'"
            :id="fieldId(field, 'checkbox')"
            class="checkbox"
            type="checkbox"
            :checked="Boolean(valueOf(field))"
            @change="updateBoolean(field, $event)"
          />
          <input
            v-else
            :id="fieldId(field, 'number')"
            class="num"
            type="number"
            :value="numberDraft(field)"
            :min="field.min"
            :max="field.max"
            :step="field.step"
            @input="updateNumberDraft(field, $event)"
            @change="commitNumber(field, $event)"
            @blur="commitNumber(field, $event)"
          />
        </div>
        <input
          v-if="field.kind === 'number'"
          :id="fieldId(field, 'range')"
          class="slider"
          type="range"
          :value="valueOf(field)"
          :min="field.min"
          :max="field.max"
          :step="field.step"
          :aria-label="field.label + '滑块'"
          @input="updateRange(field, $event)"
        />
      </div>
    </section>

    <section class="hud-group">
      <h3>可复制参数</h3>
      <pre class="json-out">{{ editableJson }}</pre>
      <div class="actions">
        <button class="btn" data-visual-action="hud.copy" @click="copyHud">{{ copyLabel() }}</button>
        <button class="btn ghost" data-visual-action="hud.reset" @click="resetCurrentTarget">恢复 HUD 默认值</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.hud-controls { display: flex; flex-direction: column; gap: 14px; padding-bottom: 4px; }
.hud-group, .session-editing {
  display: flex; flex-direction: column; gap: 10px; padding: 12px;
  border: 1px solid rgba(36, 131, 255, 0.28); border-radius: 4px;
  background: rgba(36, 131, 255, 0.05);
}
.hud-group h3 { margin: 0; font-size: 14px; font-weight: normal; color: #fff; }
.editing-hint { margin: 0; font-size: 11px; line-height: 1.5; color: #edd892; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field-head { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.field-head label { flex: 1; }
.num {
  box-sizing: border-box; width: 76px; height: 26px; padding: 2px 6px; text-align: right;
  color: #00deff; background: rgba(36, 131, 255, 0.12);
  border: 1px solid rgba(36, 131, 255, 0.4); border-radius: 3px; outline: none;
}
.checkbox { width: 18px; height: 18px; accent-color: #00deff; cursor: pointer; }
.slider { width: 100%; accent-color: #00deff; cursor: pointer; }
.json-out {
  box-sizing: border-box; max-height: 220px; margin: 0; padding: 10px;
  overflow: auto; user-select: text; white-space: pre; font-size: 11px; line-height: 1.45;
  color: #8fd9ff; background: rgba(0, 0, 0, 0.35);
  border: 1px dashed rgba(36, 131, 255, 0.4); border-radius: 4px;
}
.actions { display: flex; gap: 8px; }
.btn {
  flex: 1; padding: 8px 4px; font-size: 12px; font-family: 'OPPOSans-M'; cursor: pointer;
  color: #041020; background: linear-gradient(180deg, #00deff, #2483ff);
  border: none; border-radius: 4px;
}
.btn.ghost { color: #7fa8d9; background: transparent; border: 1px solid rgba(36, 131, 255, 0.5); }
.btn.ghost:hover { color: #00deff; border-color: #00deff; }
</style>
