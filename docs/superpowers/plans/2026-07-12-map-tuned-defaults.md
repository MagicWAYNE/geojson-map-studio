# Map Tuned Defaults Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将用户确认的地图效果、布局和 3D 视角参数固化为源码默认值，同时保留现有 v2 自定义缓存优先级和 v1 迁移行为。

**Architecture:** 仅修改三个现有默认值来源：`mapEffectConfig.ts` 负责效果配置 canonical defaults，`useMapDebug.ts` 负责布局默认值，`ChongqingMap3D.vue` 负责相机与 OrbitControls 初始值。所有持久化键、配置版本、加载优先级和渲染管线保持不变；测试直接覆盖默认值、重置、缓存兼容和场景初始化。

**Tech Stack:** Vue 3、TypeScript、Three.js、Vitest、Vite

## Global Constraints

- 效果配置版本保持 `version: 2`。
- 效果存储键保持 `cq-map-effect-config-v2`，布局存储键保持 `cq-map-debug-layout`。
- 合法已有 v2 缓存继续优先于源码默认值，不主动覆盖。
- 两代已知 v1 默认缓存迁移为完整的新 v2 默认值；自定义 v1 字段继续保留。
- 不增加相机视角 localStorage 持久化。
- 不修改地图数据、渲染管线、控件范围、交互和性能策略。
- 不提交未跟踪的 `.superpowers/`。

---

### Task 1: 固化效果配置默认值并验证缓存兼容

**Files:**
- Modify: `src/components/map/mapEffectConfig.test.ts`
- Modify: `src/components/map/mapEffectConfig.ts`

**Interfaces:**
- Consumes: `MAP_EFFECT_DEFAULTS`、`loadMapEffectConfig(storage)`、`normalizeMapEffectConfig(input)`。
- Produces: 完整、冻结且可深克隆的 v2 tuned defaults；现有调用方接口和存储键不变。

- [ ] **Step 1: 将测试期望改为用户确认的完整效果参数**

在 `mapEffectConfig.test.ts` 的 `V2_DEFAULTS` 中精确使用：

```ts
const V2_DEFAULTS = {
  version: 2,
  base: {
    innerColor: '#ffffff',
    innerWidth: 1.5,
    innerOpacity: 0.55,
    outerColor: '#ffffff',
    outerCoreWidth: 2,
    outerGlowEnabled: true,
    outerGlowColor: '#8ab7ff',
    outerGlowWidth: 72,
    outerGlowStrength: 0.48,
    outerGlowNearRadiusRatio: 0.35,
    outerGlowNearOpacityRatio: 1.25,
    outerGlowFarRadiusRatio: 0.7,
    outerGlowFarOpacityRatio: 0.75,
    outerGlowFalloff: 0.9,
    outerGlowEdgeSoftness: 0.96,
    outerGlowNearPasses: 4,
    outerGlowFarPasses: 4
  },
  hover: {
    surfaceColor: '#7fcbff',
    emissiveColor: '#22b4d8',
    emissiveIntensity: 0.5,
    outlineColor: '#d8f5ff',
    outlineWidth: 2.4,
    glowEnabled: false,
    glowColor: '#ffffff',
    glowWidth: 110,
    glowStrength: 0.15,
    glowNearRadiusRatio: 0.35,
    glowNearOpacityRatio: 0.83,
    glowFarRadiusRatio: 1,
    glowFarOpacityRatio: 1,
    glowFalloff: 1,
    glowEdgeSoftness: 0.96,
    glowNearPasses: 2,
    glowFarPasses: 4,
    lift: 2,
    enterMs: 400,
    leaveMs: 300
  },
  quality: { renderScale: 0.5, maxAlpha: 1 }
} as const
```

新增合法 v2 缓存不被覆盖的测试：

```ts
it('preserves a valid custom v2 cache instead of replacing it with tuned defaults', () => {
  const custom = {
    ...V2_DEFAULTS,
    base: { ...V2_DEFAULTS.base, outerGlowWidth: 91 },
    hover: { ...V2_DEFAULTS.hover, glowEnabled: true }
  }
  expect(loadMapEffectConfig({
    getItem: (key) => key === MAP_EFFECT_STORAGE_KEY ? JSON.stringify(custom) : null
  })).toEqual(custom)
})
```

- [ ] **Step 2: 运行聚焦测试并确认按预期失败**

Run: `npm test -- src/components/map/mapEffectConfig.test.ts`

Expected: FAIL；`MAP_EFFECT_DEFAULTS`、无缓存回退及两代 v1 默认迁移仍返回旧的 v2 参数，合法自定义 v2 缓存测试应通过。

- [ ] **Step 3: 最小修改 canonical v2 默认值**

在 `mapEffectConfig.ts` 中修改 `V2_BASE_DEFAULTS` 和 `V2_HOVER_DEFAULTS`，使用 Step 1 的精确值。`V2_QUALITY_DEFAULTS`、`B3_GLOW_PROFILE_DEFAULTS`、规范化范围、迁移检测、存储键与加载顺序均不修改。

- [ ] **Step 4: 运行聚焦测试并确认通过**

Run: `npm test -- src/components/map/mapEffectConfig.test.ts`

Expected: PASS；该文件全部测试通过，包括深克隆、冻结、无缓存回退、两代 v1 默认迁移、自定义 v1 保留、合法 v2 缓存保留和格式化往返。

- [ ] **Step 5: 提交效果默认值**

```bash
git add src/components/map/mapEffectConfig.ts src/components/map/mapEffectConfig.test.ts
git commit -m "feat(map): solidify tuned effect defaults"
```

---

### Task 2: 固化地图布局默认值和重置行为

**Files:**
- Modify: `src/composables/useMapDebug.test.ts`
- Modify: `src/composables/useMapDebug.ts`

**Interfaces:**
- Consumes: `MAP_LAYOUT_DEFAULT`、`useMapDebug().layout`、`useMapDebug().resetLayout()`。
- Produces: `{ left: 40, top: 230, width: 1000, height: 680 }` 的空缓存及重置默认布局；现有缓存读取逻辑不变。

- [ ] **Step 1: 增加布局默认值、空缓存、重置与缓存优先级测试**

在 `useMapDebug.test.ts` 增加独立 describe，使用模块重载隔离模块级单例：

```ts
describe('useMapDebug layout defaults', () => {
  it('uses the tuned layout when storage is empty and resetLayout restores it', async () => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    })
    const { MAP_LAYOUT_DEFAULT, useMapDebug } = await import('./useMapDebug')
    const expected = { left: 40, top: 230, width: 1000, height: 680 }
    const debug = useMapDebug()

    expect(MAP_LAYOUT_DEFAULT).toEqual(expected)
    expect(debug.layout).toEqual(expected)
    debug.layout.left = 480
    debug.layout.width = 720
    debug.resetLayout()
    expect(debug.layout).toEqual(expected)
  })

  it('keeps a valid saved layout ahead of tuned source defaults', async () => {
    const saved = { left: 88, top: 99, width: 777, height: 666 }
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => key === 'cq-map-debug-layout' ? JSON.stringify(saved) : null,
      setItem: vi.fn()
    })
    const { useMapDebug } = await import('./useMapDebug')
    expect(useMapDebug().layout).toEqual(saved)
  })
})
```

- [ ] **Step 2: 运行聚焦测试并确认按预期失败**

Run: `npm test -- src/composables/useMapDebug.test.ts`

Expected: FAIL；空缓存与 `resetLayout()` 仍得到 `{ left: 115, top: 230, width: 680, height: 680 }`，已有缓存优先级测试通过。

- [ ] **Step 3: 修改唯一布局默认值来源**

在 `useMapDebug.ts` 中改为：

```ts
export const MAP_LAYOUT_DEFAULT: MapLayout = { left: 40, top: 230, width: 1000, height: 680 }
```

保留 `loadLayout()`、watch 持久化和 `resetLayout()` 现有实现。

- [ ] **Step 4: 运行聚焦测试并确认通过**

Run: `npm test -- src/composables/useMapDebug.test.ts`

Expected: PASS；效果重置身份稳定性、布局缓存兼容与新布局默认值全部通过。

- [ ] **Step 5: 提交布局默认值**

```bash
git add src/composables/useMapDebug.ts src/composables/useMapDebug.test.ts
git commit -m "feat(map): solidify tuned layout defaults"
```

---

### Task 3: 固化 3D 初始视角并完成全量验证

**Files:**
- Modify: `src/components/map/ChongqingMap3D.test.ts`
- Modify: `src/components/map/ChongqingMap3D.vue`

**Interfaces:**
- Consumes: `THREE.PerspectiveCamera.position`、`OrbitControls.target.set(x, y, z)`。
- Produces: 初始 `pos = [-62.1, 94.9, 108.9]`、`target = [17.2, -3.5, 22.5]`；相机交互和实时复制格式不变。

- [ ] **Step 1: 捕获 controls target 并增加精确初始视角测试**

在 `sceneSetupMocks` 中新增 `controlsTargetSet: vi.fn()`，将 OrbitControls mock 改为：

```ts
target = { x: 0, y: 0, z: 0, set: sceneSetupMocks.controlsTargetSet }
```

在 `afterEach` 清理该 mock，并增加：

```ts
it('starts from the tuned camera position and controls target', async () => {
  const mounted = await mountInitializedMap()
  mounted.runFrame()
  const camera = pipelineMocks.instance.render.mock.calls.at(-1)![1] as THREE.PerspectiveCamera

  expect(camera.position.toArray()).toEqual([-62.1, 94.9, 108.9])
  expect(sceneSetupMocks.controlsTargetSet).toHaveBeenCalledWith(17.2, -3.5, 22.5)

  mounted.app.unmount()
})
```

- [ ] **Step 2: 运行聚焦测试并确认按预期失败**

Run: `npm test -- src/components/map/ChongqingMap3D.test.ts`

Expected: FAIL；相机仍为 `[-51.5, 121.2, 82]`，controls target 仍为 `[1.5, 2.1, 1.7]`。

- [ ] **Step 3: 修改场景初始化参数**

在 `ChongqingMap3D.vue` 的 `setupScene()` 中精确修改：

```ts
camera.position.set(-62.1, 94.9, 108.9)
// ...
controls.target.set(17.2, -3.5, 22.5)
```

保留 FOV、near/far、OrbitControls 阻尼和 `syncCamView()` 逻辑不变。

- [ ] **Step 4: 运行聚焦测试并确认通过**

Run: `npm test -- src/components/map/ChongqingMap3D.test.ts`

Expected: PASS；场景、柔光管线、hover、resize、异常降级与卸载测试全部通过。

- [ ] **Step 5: 运行完整质量门禁**

Run: `npm test`

Expected: PASS；全量 Vitest 测试无失败。

Run: `npm run typecheck`

Expected: PASS；`vue-tsc --noEmit` 退出码为 0。

Run: `npm run build`

Expected: PASS；生产构建完成，Vite 输出 `dist/`，退出码为 0。

- [ ] **Step 6: 检查最终差异并提交视角参数**

Run: `git diff --check && git status --short`

Expected: `git diff --check` 无输出；仅计划内文件和未跟踪 `.superpowers/` 可见，不暂存 `.superpowers/`。

```bash
git add src/components/map/ChongqingMap3D.vue src/components/map/ChongqingMap3D.test.ts
git commit -m "feat(map): solidify tuned camera defaults"
```

---

## Final Review Checklist

- [ ] 对照设计文档确认布局、视角和完整 v2 参数逐值一致。
- [ ] 确认合法 v2 缓存和合法布局缓存仍优先于新源码默认值。
- [ ] 确认两代已知 v1 默认迁移和自定义 v1 保留测试仍通过。
- [ ] 确认未修改任何 localStorage key、配置版本或相机持久化策略。
- [ ] 确认 `.superpowers/` 未进入任何提交。
