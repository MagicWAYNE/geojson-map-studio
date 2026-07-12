# 地图区级案件量发光柱状图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有重庆 3D 地图的 8 个区块上渲染案件量驱动、可调试的发光数据塔，同时保持现有地图光效、hover、tooltip 和下钻行为。

**Architecture:** 新增一个独立的 `mapDistrictBarLayer` Three.js 资源层，输入投影后的区块、区级数据和 `bars` 配置，输出每区柱体/底环资源及可更新的动画状态。地图组件只负责初始化、每帧更新、与区块 hover progress 接线和资源释放；v4 地图效果配置负责持久化、迁移与调试抽屉数据。

**Tech Stack:** Vue 3、TypeScript、Three.js r185、Vitest + happy-dom、Vite。

## Global Constraints

- 仅显示 `DistrictMapItem.aj`；`ztje` 和 `zzs` 继续由现有 tooltip 显示。
- 使用开方映射：`sqrtExponent` 默认 `0.5`，对有效案件量保持单调递增。
- SVG 目前有 8 个 `data-name` 区块；两江新区案件量必须继续使用江北区与渝北区之和。
- 柱体使用独立网格，不使用 HTML 覆盖层、`InstancedMesh` 或新增屏幕空间后处理。
- 柱体不得成为 raycast 目标；区块 mesh 仍是 hover、tooltip 和点击下钻的唯一命中对象。
- 柱体动画只更新已有对象的 scale、position 和 material 属性，不在动画帧创建 geometry/material。
- 配置升级为 v4，读取顺序为 `cq-map-effect-config-v4` → v3 → v2 → v1；v3 用户调好的外扩/内扩值必须原样保留。
- 所有新逻辑先添加失败测试，再实现最小代码；每个任务独立提交。

---

## File structure

| 文件 | 职责 |
| --- | --- |
| `src/components/map/mapEffectConfig.ts` | 定义 v4 `bars` 配置、默认值、clone/assign、归一化和 v3 迁移。 |
| `src/components/map/mapDistrictBarLayer.ts` | 纯 Three.js 柱体层：安全锚点、案件量高度映射、创建/更新/销毁资源。 |
| `src/components/map/ChongqingMap3D.vue` | 将柱体层挂入同一地图 group，转发配置和区块 hover progress，维护运行时状态。 |
| `src/composables/useMapDebug.ts` | 保存柱体运行状态供调试抽屉显示。 |
| `src/components/debug/MapDistrictBarControls.vue` | 与现有 `MapInwardGlowControls` 同样的受控字段编辑器。 |
| `src/components/debug/MapEffectControls.vue` | 在现有“效果”页嵌入柱状图分组、草稿与复制参数流。 |
| `*.test.ts` | 为配置、柱体层、调试组件与地图接线提供行为回归。 |

### Task 1: 引入 v4 柱体配置并保留存量用户参数

**Files:**

- Create: `src/components/map/mapDistrictBarConfig.ts`
- Create: `src/components/map/mapDistrictBarConfig.test.ts`
- Modify: `src/components/map/mapEffectConfig.ts`
- Modify: `src/components/map/mapEffectConfig.test.ts`
- Modify: `src/composables/useMapDebug.test.ts`

**Interfaces:**

- Produces `MapDistrictBarConfig`, `MAP_DISTRICT_BAR_DEFAULTS`, `cloneDistrictBarConfig()` and `normalizeDistrictBarConfig()`.
- Changes `MapEffectConfig` to `{ version: 4; base; hover; quality; bars: MapDistrictBarConfig }`.
- Consumes the existing v3 payload as the migration source and writes to `cq-map-effect-config-v4`.

- [ ] **Step 1: Write failing configuration tests**

Add focused tests in `mapDistrictBarConfig.test.ts` for exact defaults, lower-cased color, finite-number fallback and bounds. Use these proposed defaults and bounds:

```ts
expect(MAP_DISTRICT_BAR_DEFAULTS).toEqual({
  enabled: true, color: '#39c9ff', opacity: 0.72, width: 2.8,
  minHeight: 3, maxHeight: 20, sqrtExponent: 0.5, glowStrength: 0.8,
  baseRingRadius: 1.65, baseRingOpacity: 0.38,
  enterMs: 760, staggerMs: 90,
  hoverEmissiveIntensity: 1.35, hoverLift: 1.1
})

expect(normalizeDistrictBarConfig({
  color: '#ABCDEF', opacity: 9, width: -1, minHeight: 30,
  maxHeight: -2, sqrtExponent: Infinity, enterMs: -1
})).toMatchObject({
  color: '#abcdef', opacity: 1, width: 0.25,
  minHeight: 24, maxHeight: 24, sqrtExponent: 0.5, enterMs: 0
})
```

Set the explicit ranges in the implementation and assert them: `opacity 0..1`, `width 0.25..8`, `minHeight 0..24`, `maxHeight 0..24` followed by `maxHeight = Math.max(minHeight, maxHeight)`, `sqrtExponent 0.25..1`, `glowStrength 0..2`, `baseRingRadius 0..4`, `baseRingOpacity 0..1`, `enterMs 0..3000`, `staggerMs 0..1000`, `hoverEmissiveIntensity 0..3`, `hoverLift 0..4`.

In `mapEffectConfig.test.ts`, first assert that v4 defaults include `bars`, that it is frozen and deep-cloned, and that a valid v3 payload migrates without changing `base`, `hover`, or `quality` while injecting the exact bar defaults.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `npm test -- src/components/map/mapDistrictBarConfig.test.ts src/components/map/mapEffectConfig.test.ts`

Expected: FAIL because `mapDistrictBarConfig.ts`, v4 storage constants, and `bars` do not exist yet.

- [ ] **Step 3: Implement the v4 configuration contract**

Create `mapDistrictBarConfig.ts` with the following complete public surface:

```ts
export interface MapDistrictBarConfig {
  enabled: boolean
  color: string
  opacity: number
  width: number
  minHeight: number
  maxHeight: number
  sqrtExponent: number
  glowStrength: number
  baseRingRadius: number
  baseRingOpacity: number
  enterMs: number
  staggerMs: number
  hoverEmissiveIntensity: number
  hoverLift: number
}

export const MAP_DISTRICT_BAR_DEFAULTS: Readonly<MapDistrictBarConfig> = Object.freeze(/* exact defaults from Step 1 */)
export function cloneDistrictBarConfig(value: Readonly<MapDistrictBarConfig>): MapDistrictBarConfig
export function normalizeDistrictBarConfig(value: unknown): MapDistrictBarConfig
```

In `mapEffectConfig.ts`, import those helpers; create `MapEffectConfigV3` to describe the former schema; set `MapEffectConfig.version` to `4`; add `bars` to canonical defaults, clone, assign and freeze. Preserve `target.bars` identity in `assignMapEffectConfig`:

```ts
const bars = target.bars
Object.assign(target.base, source.base)
Object.assign(target.hover, source.hover)
Object.assign(target.quality, source.quality)
Object.assign(bars, source.bars)
target.bars = bars
target.version = 4
```

Add `MAP_EFFECT_STORAGE_KEY = 'cq-map-effect-config-v4'` and `MAP_EFFECT_STORAGE_KEY_V3 = 'cq-map-effect-config-v3'`. Add `migrateV3Config()` that normalizes v3 with the existing v3 normalization rules and returns its exact `base`, `hover`, `quality` plus `cloneDistrictBarConfig(MAP_DISTRICT_BAR_DEFAULTS)`. Keep v2/v1 migration behavior by routing their results through the v3-to-v4 builder. `normalizeMapEffectConfig()` must accept only v4 and normalize `bars`; `loadMapEffectConfig()` must try v4 first, then v3, v2 and v1.

Update `useMapDebug.test.ts` fixtures to use cloned v4 config and assert reset/persistence includes `bars`.

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `npm test -- src/components/map/mapDistrictBarConfig.test.ts src/components/map/mapEffectConfig.test.ts src/composables/useMapDebug.test.ts`

Expected: all selected files PASS; saved JSON has `"version": 4` and a `bars` object.

- [ ] **Step 5: Commit the configuration contract**

```bash
git add src/components/map/mapDistrictBarConfig.ts src/components/map/mapDistrictBarConfig.test.ts \
  src/components/map/mapEffectConfig.ts src/components/map/mapEffectConfig.test.ts \
  src/composables/useMapDebug.test.ts
git commit -m "feat(map): add district bar configuration"
```

### Task 2: 实现可测试的区内锚点与发光柱体资源层

**Files:**

- Create: `src/components/map/mapDistrictBarLayer.ts`
- Create: `src/components/map/mapDistrictBarLayer.test.ts`
- Modify: `src/components/map/mapGeometry.ts`
- Modify: `src/components/map/mapGeometry.test.ts`

**Interfaces:**

- Consumes `Region`, `DistrictMapItem` and `MapDistrictBarConfig`.
- Produces `findRegionInteriorPoint(region)`, `mapDistrictBarHeight(value, min, max, exponent)`, `createDistrictBarLayer()`, `applyDistrictBarConfig()`, `setDistrictBarHoverProgress()`, `updateDistrictBarLayer()` and `disposeDistrictBarLayer()`.
- Later consumed by `ChongqingMap3D.vue`; it must return the group plus `byName` visual lookup and immutable range metadata.

- [ ] **Step 1: Write failing geometry and layer tests**

Extend `mapGeometry.test.ts` with a concave outer ring and a region containing a hole. Assert `findRegionInteriorPoint()` returns a point inside the outer ring and outside every hole. In `mapDistrictBarLayer.test.ts`, assert:

```ts
expect(mapDistrictBarHeight(0, 3, 20, 0.5, 100)).toBe(3)
expect(mapDistrictBarHeight(25, 3, 20, 0.5, 100)).toBeCloseTo(11.5)
expect(mapDistrictBarHeight(100, 3, 20, 0.5, 100)).toBe(20)

const layer = createDistrictBarLayer(regions, new Map([
  ['A', { name: 'A', aj: 100, ztje: 0, zzs: 0 }],
  ['B', { name: 'B', aj: Number.NaN, ztje: 0, zzs: 0 }]
]), MAP_DISTRICT_BAR_DEFAULTS, 4)
expect(layer.group.children).toHaveLength(2) // A bar + A ring; B is skipped
expect(layer.byName.has('A')).toBe(true)
expect(layer.byName.has('B')).toBe(false)
```

Test a disabled config produces an empty group, `updateDistrictBarLayer()` does not allocate children, hover `1` makes only the named visual brighter/higher, and `disposeDistrictBarLayer()` disposes each unique geometry/material exactly once.

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `npm test -- src/components/map/mapGeometry.test.ts src/components/map/mapDistrictBarLayer.test.ts`

Expected: FAIL because no interior-point export or bar-layer module exists.

- [ ] **Step 3: Implement interior placement and the bar layer**

Export `pointInRegion(point, region)` from `mapGeometry.ts`, retaining the existing even-odd ring behavior. Implement `findRegionInteriorPoint(region)` with deterministic candidates in this order: all outer-ring vertex arithmetic means weighted by signed ring area, overall bounding-box center, then a fixed 9×9 grid scan of the bounding box. Return the first candidate for which `pointInRegion()` is true; return `null` only after all candidates fail.

Use this public contract in `mapDistrictBarLayer.ts`:

```ts
export interface DistrictBarRange { min: number; max: number }
export interface DistrictBarVisual {
  name: string
  group: THREE.Group
  column: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>
  ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>
  baseHeight: number
  delayMs: number
  hoverProgress: number
}
export interface DistrictBarLayer {
  group: THREE.Group
  byName: Map<string, DistrictBarVisual>
  range: DistrictBarRange | null
}

export function createDistrictBarLayer(
  regions: Region[], dataByName: ReadonlyMap<string, DistrictMapItem>,
  config: Readonly<MapDistrictBarConfig>, depth: number
): DistrictBarLayer
export function applyDistrictBarConfig(
  layer: DistrictBarLayer, config: Readonly<MapDistrictBarConfig>
): void
export function updateDistrictBarLayer(layer: DistrictBarLayer, config: Readonly<MapDistrictBarConfig>, elapsedMs: number): void
export function setDistrictBarHoverProgress(layer: DistrictBarLayer, name: string, progress: number): void
export function disposeDistrictBarLayer(layer: DistrictBarLayer): void
```

For valid data, derive range from finite `aj >= 0` values. Compute the mapped height as `minHeight + (maxHeight - minHeight) * Math.pow(value / max, exponent)`; when all valid values are zero, render every valid datum at `minHeight`. Build each column once with unit `CylinderGeometry(1, 1, 1, 20, 1, false)`, rotate the mesh `x = Math.PI / 2` so its local Y height follows map-local +Z, then set `scale.x` and `scale.z` to `config.width / 2`, set `scale.y` to current height, and position it at `depth + currentHeight / 2 + 0.08`. Build one unit `RingGeometry(0.45, 1, 32)` at `depth + 0.09` using transparent additive `MeshBasicMaterial`, scaling its local X/Y plane from `config.baseRingRadius`. Set `depthWrite: false` for both transparent materials.

Apply a smoothstep entrance progress `clamp((elapsedMs - delayMs) / enterMs, 0, 1)` and multiply it into the visible height/ring opacity. For hover, use `hoverProgress` supplied by the map: lerp emissive intensity from `glowStrength` to `hoverEmissiveIntensity`, and add `hoverLift * hoverProgress` to the column and ring local Z. `applyDistrictBarConfig()` updates color, opacity, dimensions, material strengths and visibility without replacing resources or resetting animation elapsed time; `updateDistrictBarLayer()` only advances entrance/hover state. Traverse and dispose geometries/materials once during teardown.

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `npm test -- src/components/map/mapGeometry.test.ts src/components/map/mapDistrictBarLayer.test.ts`

Expected: all selected tests PASS, including hole-safe placement, monotonic mapping, disabled/invalid-data fallback and disposal.

- [ ] **Step 5: Commit the reusable bar layer**

```bash
git add src/components/map/mapGeometry.ts src/components/map/mapGeometry.test.ts \
  src/components/map/mapDistrictBarLayer.ts src/components/map/mapDistrictBarLayer.test.ts
git commit -m "feat(map): render district bar layer"
```

### Task 3: 将柱体层接入地图初始化、hover 与资源生命周期

**Files:**

- Modify: `src/components/map/ChongqingMap3D.vue`
- Modify: `src/components/map/ChongqingMap3D.test.ts`
- Modify: `src/components/map/mapEffectWatcher.test.ts`
- Modify: `src/composables/useMapDebug.ts`
- Modify: `src/composables/useMapDebug.test.ts`

**Interfaces:**

- Consumes `DistrictBarLayer` and its creation/update/disposal API from Task 2.
- Produces `MapDistrictBarRuntimeStatus` through `useMapDebug()` with `renderedCount`, `dataMin`, `dataMax` and `degraded`.
- `renderRegionVisual()` forwards existing eased hover progress to the visual with the same region name.

- [ ] **Step 1: Write failing map integration tests**

Mock `./mapDistrictBarLayer` in `ChongqingMap3D.test.ts`. Extend `mountInitializedMap()` so its mock district data includes `江北区`, `渝北区` and a parsed `两江新区`. Assert:

```ts
expect(createDistrictBarLayer).toHaveBeenCalledWith(
  expect.any(Array),
  expect.any(Map),
  mapDebugMocks.effect!.bars,
  4
)
expect(setDistrictBarHoverProgress).toHaveBeenCalledWith(layer, '测试区0', expect.any(Number))
expect(updateDistrictBarLayer).toHaveBeenCalledWith(layer, mapDebugMocks.effect!.bars, expect.any(Number))
expect(disposeDistrictBarLayer).toHaveBeenCalledWith(layer)
```

Add a test confirming `raycaster.intersectObjects` still receives `regionMeshes` only, not bar meshes. Add composable tests for `DEFAULT_MAP_DISTRICT_BAR_RUNTIME_STATUS`, no-op equality updates, and reset to the default status on teardown.

Update the existing `mapEffectWatcher.test.ts` fixtures from version `3` to version `4`, including a cloned `bars` object, so the watcher continues to prove that deep bar edits invoke the configured apply callback without reintroducing stale-schema assertions.

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `npm test -- src/components/map/ChongqingMap3D.test.ts src/composables/useMapDebug.test.ts`

Expected: FAIL because no bar layer is initialized, updated, published or disposed.

- [ ] **Step 3: Wire the layer into the scene**

In `useMapDebug.ts`, add:

```ts
export interface MapDistrictBarRuntimeStatus {
  renderedCount: number
  dataMin: number | null
  dataMax: number | null
  degraded: boolean
}
export const DEFAULT_MAP_DISTRICT_BAR_RUNTIME_STATUS: MapDistrictBarRuntimeStatus = {
  renderedCount: 0, dataMin: null, dataMax: null, degraded: false
}
```

Expose reactive `districtBarRuntimeStatus` and identity-preserving `updateDistrictBarRuntimeStatus(next)`.

In `ChongqingMap3D.vue`, hold `let districtBars: DistrictBarLayer | null = null`. After the existing two-rivers data merge and after `projectRegions`, create the bar layer with the same projected regions and `DEPTH`; add `districtBars.group` to the map group before applying `mapGroup.rotation.x`. In `applyEffectConfig()`, call `applyDistrictBarConfig(districtBars, effect.bars)` so live tuning takes effect without replaying the entrance. In `renderRegionVisual()`, call `setDistrictBarHoverProgress(districtBars, visual.mesh.userData.name, eased)`. In the render loop call `updateDistrictBarLayer(districtBars, effect.bars, now - barAnimationStartedAt)` before render. Publish range/count after successful construction; catch creation/update errors once, set `degraded: true`, null the layer and retain the map. In `cleanupScene()`, dispose a non-null layer before clearing scene references and reset its runtime status.

Do not add bar meshes to `regionMeshes`; leave `pick()` unchanged.

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `npm test -- src/components/map/ChongqingMap3D.test.ts src/composables/useMapDebug.test.ts`

Expected: all selected tests PASS; the map test proves config watch, animation frame, hover and unmount invoke the layer without changing raycast input.

- [ ] **Step 5: Commit the scene integration**

```bash
git add src/components/map/ChongqingMap3D.vue src/components/map/ChongqingMap3D.test.ts src/components/map/mapEffectWatcher.test.ts \
  src/composables/useMapDebug.ts src/composables/useMapDebug.test.ts
git commit -m "feat(map): wire district bars into 3d scene"
```

### Task 4: 在地图调试抽屉提供柱体参数、状态与可复制 JSON

**Files:**

- Create: `src/components/debug/MapDistrictBarControls.vue`
- Create: `src/components/debug/MapDistrictBarControls.test.ts`
- Modify: `src/components/debug/MapEffectControls.vue`
- Modify: `src/components/debug/MapEffectControls.test.ts`
- Modify: `src/components/debug/MapDebugDrawer.test.ts`

**Interfaces:**

- Consumes `MapDistrictBarConfig`, `MAP_DISTRICT_BAR_DEFAULTS` and `MapDistrictBarRuntimeStatus`.
- Produces `update:modelValue` with a freshly cloned, field-normalized `MapDistrictBarConfig`.
- Existing `MapEffectControls` remains the owner of live-preview/draft/apply/discard/copy/reset semantics.

- [ ] **Step 1: Write failing debug UI tests**

Create `MapDistrictBarControls.test.ts` following the `MapInwardGlowControls.test.ts` mount pattern. Assert all stable IDs exist, including `effect-bars-enabled-checkbox`, `effect-bars-color-hex`, `effect-bars-minHeight-number`, `effect-bars-maxHeight-number`, `effect-bars-enterMs-number` and their range partners. Test invalid input falls back to current value, `maxHeight` cannot commit below `minHeight`, color normalizes to lowercase, and one committed input emits one cloned object.

In `MapEffectControls.test.ts`, assert the effect panel contains heading `区级案件量柱状图`, renders the live runtime string `有效柱体：8`, and its `.json-out` parses to a v4 config containing `bars`. Test draft mode changes `bars.width` without storage writes, then `应用参数` persists it; `恢复全部默认值` returns `bars` exactly to `MAP_DISTRICT_BAR_DEFAULTS`.

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `npm test -- src/components/debug/MapDistrictBarControls.test.ts src/components/debug/MapEffectControls.test.ts src/components/debug/MapDebugDrawer.test.ts`

Expected: FAIL because the bar control component, input IDs and runtime section are missing.

- [ ] **Step 3: Implement the contained editor and embed it**

Build `MapDistrictBarControls.vue` as a controlled child matching the inward-control contract:

```ts
const props = defineProps<{
  modelValue: MapDistrictBarConfig
  runtimeStatus: MapDistrictBarRuntimeStatus
}>()
const emit = defineEmits<{
  'update:modelValue': [value: MapDistrictBarConfig]
}>()
```

Use `cloneDistrictBarConfig(props.modelValue)` before every emit. Render controls for all configuration fields with number + range inputs, but make `enabled` a checkbox and `color` a color + hex pair. Use the exact bounds from Task 1 and include a `运行状态` block showing `有效柱体`, `案件量范围` (`—` when null), and `柱体层` (`正常`/`已降级关闭`).

In `MapEffectControls.vue`, import this child and `MapDistrictBarConfig`; add `replaceBars(value)` that performs `Object.assign(editTarget.value.bars, value)`. Insert the `区级案件量柱状图` section before `可复制参数`:

```vue
<MapDistrictBarControls
  :model-value="editTarget.bars"
  :runtime-status="districtBarRuntimeStatus"
  @update:model-value="replaceBars"
/>
```

Obtain `districtBarRuntimeStatus` from `useMapDebug()`. Keep the existing JSON/copy/reset flow; because `cloneMapEffectConfig`, `assignMapEffectConfig` and `formatMapEffectConfig` are v4-aware, no duplicate persistence path is allowed. Extend the performance warning only for `bars.glowStrength > 1.5 && bars.opacity > 0.8`; its message should ask the user to lower “柱体辉光或透明度”.

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `npm test -- src/components/debug/MapDistrictBarControls.test.ts src/components/debug/MapEffectControls.test.ts src/components/debug/MapDebugDrawer.test.ts`

Expected: all selected tests PASS; the copied JSON includes editable v4 `bars` parameters and draft edits do not leak into live storage.

- [ ] **Step 5: Commit the debug controls**

```bash
git add src/components/debug/MapDistrictBarControls.vue src/components/debug/MapDistrictBarControls.test.ts \
  src/components/debug/MapEffectControls.vue src/components/debug/MapEffectControls.test.ts \
  src/components/debug/MapDebugDrawer.test.ts
git commit -m "feat(debug): tune district bar chart"
```

### Task 5: 完整回归、生产构建与视觉验收

**Files:**

- Modify only if a test exposes a requirement mismatch in the files named by Tasks 1–4.

**Interfaces:**

- Consumes the finished v4 config, bar layer, map integration and debug UI.
- Produces verified build evidence; no new product interface.

- [ ] **Step 1: Run the complete automated suite**

Run: `npm test`

Expected: every existing and new Vitest file PASS; no existing inward/outward glow tests regress because their v4 config fixtures are migrated.

- [ ] **Step 2: Run static and production verification**

Run: `npm run typecheck && npm run build && git diff --check`

Expected: TypeScript exits `0`; Vite emits `dist/`; `git diff --check` emits no whitespace errors. Treat the known Vite large-chunk advisory as advisory only if the command exits `0`.

- [ ] **Step 3: Perform manual browser acceptance**

Run: `npm run dev -- --host 0.0.0.0 --port 4173`

Verify on the home route:

1. Eight blue translucent columns rise once above the map and remain aligned when rotating/zooming.
2. Taller columns correspond to larger `aj`; the two-rivers column uses the combined count.
3. Hovering a district changes only that column’s intensity/lift; tooltip and click-through remain unchanged.
4. Open “地图调试” → “效果” → “区级案件量柱状图”; change width, height, opacity, ring and timing; copied JSON contains `version: 4` and `bars`.
5. Refresh page; saved bar parameters reappear. Choose “恢复全部默认值”; the v4 defaults reappear without resetting other approved map values.

- [ ] **Step 4: Commit only any required corrective changes**

If Steps 1–3 require a correction, stage only the affected source/test files and commit with a narrow message such as:

```bash
git add <affected-files>
git commit -m "fix(map): stabilize district bar layer"
```

If all checks pass without corrections, do not create an empty commit.
