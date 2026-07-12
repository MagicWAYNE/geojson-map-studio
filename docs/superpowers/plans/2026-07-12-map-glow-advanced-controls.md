# Map Glow Advanced Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让地图在默认常态下以 `54px / 0.23` 显示外扩柔光，并在“地图调试”抽屉中提供常态与 hover 相互独立的安全高级参数、草稿预览、运行状态和完整 v2 参数复制能力。

**Architecture:** 将 v2 配置作为唯一持久化和复制的事实来源；profile 只负责把屏幕 CSS px 与近远端倍率派生为纹理参数，Shader 只负责安全合成，pipeline 根据参数类别执行重模糊或仅重合成，Vue composable 负责响应式配置、持久化和低频运行状态，抽屉负责实时/草稿两种编辑模式。保留当前双通道 RenderTarget、屏幕像素恒定、运行期一次性降级和主场景直渲染架构。

**Tech Stack:** Vue 3 Composition API、TypeScript、Three.js/WebGL Shader、Vitest + happy-dom、Vite、浏览器真实页面验收。

**Design source:** `docs/superpowers/specs/2026-07-12-map-glow-advanced-controls-design.md`

## Global Constraints

- 所有实现只在 `/Users/fei/cqbigscreen/.claude/worktrees/map-visual-effects` 和当前 `codex/map-visual-effects` 分支完成。
- 使用测试驱动开发：每个行为先增加失败测试，确认失败原因正确，再实现最小代码并跑绿。
- 每项任务完成后进行两阶段审查：先做需求符合性审查，再做代码质量审查；审查问题修复并重新验证后才能进入下一任务。
- 不开放 Gaussian 原始采样权重、采样表达式、纹理或 RenderTarget 对象。
- 不改变地图数据、柱状图、标记、tooltip、点击下钻、详情页，也不处理“两江新区”详情数据缺失。
- 半径始终表示屏幕 CSS px；`renderScale` 只能改变离屏纹理成本，不能改变肉眼半径。
- 保留运行期异常的“一次 warning、一次 dispose、后续直接渲染主场景”降级语义。
- 不覆盖 `.superpowers/` 下的会话编排和视觉对照产物，不提交无关文件。

## File Map and Interfaces

| File | Responsibility |
| --- | --- |
| `src/components/map/mapEffectConfig.ts` | v2 类型、默认值、范围规范化、v1 迁移、v2 读写和复制 JSON |
| `src/components/map/mapEffectConfig.test.ts` | v2 默认值、迁移、非法值、存储键、序列化测试 |
| `src/components/map/mapOutwardGlowProfile.ts` | CSS px 到近/远端纹理半径与透明度的纯函数派生 |
| `src/components/map/mapOutwardGlowProfile.test.ts` | 自定义倍率、精度、零值和有限值测试 |
| `src/components/map/mapOutwardGlowShaders.ts` | 固定 Gaussian blur 和可调 falloff/softness/maxAlpha 合成 |
| `src/components/map/mapOutwardGlowShaders.test.ts` | uniform 绑定、防御性 clamp、反馈安全测试 |
| `src/components/map/mapOutwardGlowPipeline.ts` | 双通道缓存、动态 passes/renderScale、dirty 分类、状态快照 |
| `src/components/map/mapOutwardGlowPipeline.test.ts` | 重模糊/仅合成/跳过/缓存复用/状态测试 |
| `src/composables/useMapDebug.ts` | v2 响应式状态、持久化、完整重置和低频运行状态发布 |
| `src/composables/useMapDebug.test.ts` | v2 保存、重置、状态去重测试 |
| `src/components/debug/MapEffectControls.vue` | 五组控件、B3/分组/全部重置、实时与草稿编辑、状态与复制区 |
| `src/components/debug/MapEffectControls.test.ts` | 字段元数据、独立编辑、草稿、预设、重置、状态可访问性测试 |
| `src/components/map/ChongqingMap3D.vue` | pipeline 状态映射、运行期降级状态、配置热更新 |
| `src/components/map/ChongqingMap3D.test.ts` | pipeline 状态低频发布和降级回归测试 |
| `src/components/map/mapEffectWatcher.test.ts` | v2 新增字段触发地图材质/管线同步的回归覆盖 |

核心接口采用以下形状，字段名不得在各层自行改写：

```ts
export interface MapEffectQualityConfig {
  renderScale: 0.25 | 0.5 | 0.75 | 1
  maxAlpha: number
}

export interface GlowProfileInput {
  radiusCssPx: number
  opacity: number
  nearRadiusRatio: number
  nearOpacityRatio: number
  farRadiusRatio: number
  farOpacityRatio: number
}

export interface MapOutwardGlowPipelineStatus {
  targetWidth: number
  targetHeight: number
  renderScale: number
  baseState: 'enabled' | 'zero' | 'disabled'
  hoverState: 'ready' | 'active' | 'zero' | 'disabled'
}

export interface MapEffectRuntimeStatus extends MapOutwardGlowPipelineStatus {
  degraded: boolean
}
```

`MapOutwardGlowPipeline#getStatus()` 返回普通只读快照。`ChongqingMap3D` 负责映射到 `useMapDebug().effectRuntimeStatus`，并使用字段比较去重后再写入 Vue 响应式状态；pipeline 不直接依赖 composable。

---

## Task 1: Upgrade the Config Contract to v2 and Migrate v1

**Files:**

- Modify: `src/components/map/mapEffectConfig.ts`
- Modify: `src/components/map/mapEffectConfig.test.ts`

- [ ] **Step 1: Add failing tests for the exact v2 defaults**

在 `mapEffectConfig.test.ts` 断言完整对象，不只抽查字段。必须覆盖：

```ts
expect(MAP_EFFECT_DEFAULTS).toEqual({
  version: 2,
  base: {
    innerColor: '#ffffff', innerWidth: 1.5, innerOpacity: 0.55,
    outerColor: '#ffffff', outerCoreWidth: 2,
    outerGlowEnabled: true, outerGlowColor: '#ffffff',
    outerGlowWidth: 54, outerGlowStrength: 0.23,
    outerGlowNearRadiusRatio: 0.35, outerGlowNearOpacityRatio: 0.83,
    outerGlowFarRadiusRatio: 1, outerGlowFarOpacityRatio: 1,
    outerGlowFalloff: 1, outerGlowEdgeSoftness: 0.96,
    outerGlowNearPasses: 2, outerGlowFarPasses: 4
  },
  hover: {
    surfaceColor: '#7fcbff', emissiveColor: '#22b4d8', emissiveIntensity: 0.5,
    outlineColor: '#d8f5ff', outlineWidth: 2.4,
    glowEnabled: true, glowColor: '#27a7ff', glowWidth: 0, glowStrength: 0,
    glowNearRadiusRatio: 0.35, glowNearOpacityRatio: 0.83,
    glowFarRadiusRatio: 1, glowFarOpacityRatio: 1,
    glowFalloff: 1, glowEdgeSoftness: 0.96,
    glowNearPasses: 2, glowFarPasses: 4,
    lift: 2, enterMs: 400, leaveMs: 300
  },
  quality: { renderScale: 0.5, maxAlpha: 1 }
})
```

Run: `npm test -- src/components/map/mapEffectConfig.test.ts`

Expected: FAIL，因为当前配置仍为 version 1 且常态柔光为 0。

- [ ] **Step 2: Add failing migration and normalization tests**

覆盖以下表格中的每一行：

| Input | Expected |
| --- | --- |
| 无 v2、无 v1 | 完整 v2 默认 |
| 合法 v2 | 按范围规范化后的 v2 |
| 精确等于当前已批准 v1 默认对象 | 完整 v2 新默认，常态 `54 / 0.23` |
| 自定义 v1，包括显式 `outerGlowWidth: 0` | 保留全部 v1 字段与 0，补齐 v2 高级默认 |
| v2 JSON 损坏、非对象、未知 version | 完整 v2 默认 |
| 越界、`NaN`/`Infinity`、非法颜色 | 单字段裁剪或回退 |
| passes 小数 | 裁剪到 1–8 后四舍五入为整数 |
| renderScale 非枚举值 | 回退 0.5，不做任意连续值裁剪 |

存储测试明确断言：

```ts
expect(MAP_EFFECT_STORAGE_KEY).toBe('cq-map-effect-config-v2')
expect(MAP_EFFECT_STORAGE_KEY_V1).toBe('cq-map-effect-config-v1')
expect(storage.setItem).toHaveBeenCalledWith(
  'cq-map-effect-config-v2',
  JSON.stringify(expectedV2)
)
```

Run: `npm test -- src/components/map/mapEffectConfig.test.ts`

Expected: FAIL，错误应集中在缺失 v2 类型、迁移和范围行为。

- [ ] **Step 3: Implement v2 types, constants, cloning and field normalization**

实现：

```ts
export const MAP_EFFECT_STORAGE_KEY = 'cq-map-effect-config-v2'
export const MAP_EFFECT_STORAGE_KEY_V1 = 'cq-map-effect-config-v1'

export const B3_GLOW_PROFILE_DEFAULTS = Object.freeze({
  nearRadiusRatio: 0.35,
  nearOpacityRatio: 0.83,
  farRadiusRatio: 1,
  farOpacityRatio: 1,
  falloff: 1,
  edgeSoftness: 0.96,
  nearPasses: 2,
  farPasses: 4
})
```

要求：

- `MapEffectConfig.version` 固定为 `2`。
- `defaults()` 深拷贝 `base`、`hover` 和 `quality`，任何调用者都不能修改常量。
- bool 仅接受真正的 boolean；颜色仅接受 `#rrggbb` 并转小写。
- 数字先检查有限值再裁剪；passes 裁剪后 `Math.round`。
- `renderScale` 只接受 `0.25 | 0.5 | 0.75 | 1`。
- 保留一份私有的“当前批准 v1 默认对象”用于精确迁移判定，不把旧版类型泄漏给新 UI。

- [ ] **Step 4: Implement read precedence and exact v1 migration**

读取顺序必须是：合法 v2 → v1 → 默认。v2 键存在但内容损坏时按设计直接回退默认，不再偷偷读取 v1，避免损坏的新配置被旧配置覆盖。

自定义 v1 迁移先用 v1 范围规范化已有字段，再合并 v2 新字段；“精确旧默认”判定在规范化前针对原始对象执行，确保用户自定义的 0 不被误判为旧默认。

- [ ] **Step 5: Run focused tests and commit**

Run:

```bash
npm test -- src/components/map/mapEffectConfig.test.ts
npm run typecheck
```

Expected: all pass.

Commit:

```bash
git add src/components/map/mapEffectConfig.ts src/components/map/mapEffectConfig.test.ts
git commit -m "feat(map): upgrade glow config to v2"
```

- [ ] **Step 6: Perform two-stage review**

Stage 1 specification review: verify every v2 field/default/range and all six migration rules against the design source. Stage 2 quality review: inspect deep-copy safety, exact-default detection, integer normalization and storage exception handling. Fix findings, rerun the focused tests and amend only if necessary.

---

## Task 2: Parameterize the B3 Glow Profile

**Files:**

- Modify: `src/components/map/mapOutwardGlowProfile.ts`
- Modify: `src/components/map/mapOutwardGlowProfile.test.ts`

- [ ] **Step 1: Replace fixed-B3 expectations with failing parameterized tests**

测试新的 `deriveGlowProfile(input, metrics)`：

```ts
expect(deriveGlowProfile({
  radiusCssPx: 54,
  opacity: 0.23,
  nearRadiusRatio: 0.35,
  nearOpacityRatio: 0.83,
  farRadiusRatio: 1,
  farOpacityRatio: 1
}, { width: 680, height: 680, pixelsPerCssPx: 1 })).toEqual({
  nearRadiusTexels: 18.9,
  farRadiusTexels: 54,
  nearOpacity: 0.1909,
  farOpacity: 0.23
})
```

另测：自定义倍率、`pixelsPerCssPx` 缩放、负值/非有限值、透明度倍率可到 2、输出保持有限。`isGlowEnabled` 增加显式 `enabled` 参数并验证关闭开关总是短路。

Run: `npm test -- src/components/map/mapOutwardGlowProfile.test.ts`

Expected: FAIL，因为只有 `deriveB3GlowProfile` 和无开关的 `isGlowEnabled`。

- [ ] **Step 2: Implement the pure parameterized profile**

使用：

```ts
nearRadiusTexels = radiusCssPx * pixelsPerCssPx * nearRadiusRatio
farRadiusTexels = radiusCssPx * pixelsPerCssPx * farRadiusRatio
nearOpacity = opacity * nearOpacityRatio
farOpacity = opacity * farOpacityRatio
```

profile 不读取全局默认、不知道 base/hover 字段名、不处理 passes/falloff/softness。输入先有限化与按公共范围裁剪，结果保留当前四位小数稳定性。

- [ ] **Step 3: Run tests and commit**

```bash
npm test -- src/components/map/mapOutwardGlowProfile.test.ts
git add src/components/map/mapOutwardGlowProfile.ts src/components/map/mapOutwardGlowProfile.test.ts
git commit -m "refactor(map): parameterize glow profile"
```

- [ ] **Step 4: Perform two-stage review**

Stage 1 checks CSS-pixel semantics and exact B3 values. Stage 2 checks pure-function boundaries, finite arithmetic and rounding. Fix, rerun, amend if needed.

---

## Task 3: Add Safe Composite Shader Controls

**Files:**

- Modify: `src/components/map/mapOutwardGlowShaders.ts`
- Modify: `src/components/map/mapOutwardGlowShaders.test.ts`

- [ ] **Step 1: Add failing uniform and shader-contract tests**

扩展 `OutwardCompositeInputs`：

```ts
falloff: number
edgeSoftness: number
maxAlpha: number
```

测试 `createGlowShaderResources()` 创建 `uFalloff`、`uEdgeSoftness`、`uMaxAlpha`；`renderOutwardComposite()` 绑定传入值；fragment shader 包含 `pow`、外侧裁切和上限，且 blur shader 的 Gaussian 固定权重完全不变。

Run: `npm test -- src/components/map/mapOutwardGlowShaders.test.ts`

Expected: FAIL，三个 uniforms 尚不存在。

- [ ] **Step 2: Implement a numerically safe composite sequence**

fragment shader 使用以下等价顺序：

```glsl
float mask = clamp(texture2D(tMask, vUv).r, 0.0, 1.0);
float softness = max(clamp(uEdgeSoftness, 0.0, 1.0), 0.001);
float halfBand = 0.49 * softness;
float outside = 1.0 - smoothstep(0.5 - halfBand, 0.5 + halfBand, mask);
float combined = clamp(
  texture2D(tNear, vUv).r * uNearOpacity
  + texture2D(tFar, vUv).r * uFarOpacity,
  0.0,
  1.0
);
float shaped = pow(max(combined, 0.000001), clamp(uFalloff, 0.25, 4.0));
float alpha = min(shaped * outside, clamp(uMaxAlpha, 0.1, 1.0));
gl_FragColor = vec4(uColor, alpha);
```

CPU 绑定前也要有限化和裁剪；颜色继续由 `THREE.Color#set` 处理。不得把 sampling weight 变成 uniform。

- [ ] **Step 3: Run tests and commit**

```bash
npm test -- src/components/map/mapOutwardGlowShaders.test.ts
git add src/components/map/mapOutwardGlowShaders.ts src/components/map/mapOutwardGlowShaders.test.ts
git commit -m "feat(map): add safe glow composite controls"
```

- [ ] **Step 4: Perform two-stage review**

Stage 1 checks the specified composition order and exposed controls. Stage 2 checks zero-alpha behavior, `smoothstep` edge separation, finite uniforms and feedback-loop safety. Fix and reverify.

---

## Task 4: Teach the Pipeline Dynamic Passes, Quality, Dirty Rules and Status

**Files:**

- Modify: `src/components/map/mapOutwardGlowPipeline.ts`
- Modify: `src/components/map/mapOutwardGlowPipeline.test.ts`

- [ ] **Step 1: Add failing default-render and dynamic-pass tests**

断言默认 v2 第一次 render：

- 常态 mask 渲染一次；
- 近端 blur 使用 2 passes、远端使用 4 passes；
- 常态合成颜色使用 `base.outerGlowColor` 而不是 `outerColor`；
- hover 因 `0 / 0` 不 blur、不 composite；
- RenderTarget 使用 `renderScale: 0.5`。

再设置 base `nearPasses: 3`、`farPasses: 7`，断言传给 `renderSeparableBlur` 的次数准确。

Run: `npm test -- src/components/map/mapOutwardGlowPipeline.test.ts`

Expected: FAIL，因为 pipeline 仍写死 2/4、0.5 和 B3 profile。

- [ ] **Step 2: Add a dirty-rule matrix as failing tests**

用 spy 统计 mask render、blur 和 composite 调用，逐一验证：

| Change | Expected |
| --- | --- |
| radius / nearRadiusRatio / farRadiusRatio / nearPasses / farPasses | 对应通道重新 blur |
| renderScale | 所有 target resize，两个通道缓存 dirty；启用通道在下次 render 重建 |
| color / strength / opacity ratios / falloff / softness / maxAlpha | 不 blur；下次 render 使用新 composite uniform |
| enabled true → false | 跳过通道，缓存不销毁 |
| enabled false → true，blur 参数和视图未变 | 复用 blur 缓存，只 composite |
| radius 或 opacity 为 0 | 状态为 zero 且跳过 |
| hover 有进度但手动关闭 | 不 blur、不 composite |
| camera/size/DPR/ScaleScreen dirty | 两通道 mask/blur dirty |

特别增加“只改 strength/opacity ratio 不重模糊”的回归测试，防止当前 `setConfig` 的粗粒度比较扩散。

- [ ] **Step 3: Add failing status snapshot tests**

`getStatus()` 必须返回新对象或不可变快照，并准确表达：

```ts
{
  targetWidth: 680,
  targetHeight: 680,
  renderScale: 0.5,
  baseState: 'enabled',
  hoverState: 'zero'
}
```

将 hover 设置为非零但未 hover 时是 `ready`，有可见 progress 时是 `active`，开关关闭时是 `disabled`。

- [ ] **Step 4: Implement channel adapters and explicit dirty comparison**

为 base/hover 分别提取内部 `GlowChannelConfig`，让共用函数只接收统一字段：

```ts
interface GlowChannelConfig {
  enabled: boolean
  color: string
  radius: number
  opacity: number
  nearRadiusRatio: number
  nearOpacityRatio: number
  farRadiusRatio: number
  farOpacityRatio: number
  falloff: number
  edgeSoftness: number
  nearPasses: number
  farPasses: number
}
```

实现 `blurSignature(channel)`，只包含 radius、两个 radius ratio 和两个 passes。不要用整对象 stringify。`setConfig` 比较旧新签名分别标记 static/hover blur dirty；quality renderScale 变化通过统一 `resizeTargets()` 重算 metrics 并 dirty 全部。

- [ ] **Step 5: Implement dynamic render and status**

- `renderBlurredChannel()` 调用 `deriveGlowProfile()`，并使用 channel 的 passes。
- 合成传入 channel 独立颜色、透明度、falloff、softness 和全局 maxAlpha。
- disabled/zero/hover ready 不执行无效 GPU 工作。
- `getStatus()` 只读当前 metrics、配置和 hover 可见性，不触发渲染或 Vue 写入。
- `setSize()` 使用当前 `quality.renderScale`；`setConfig()` 改 scale 时用最近一次 CSS width/height/DPR 重新分配尺寸。

- [ ] **Step 6: Run focused and adjacent tests, then commit**

```bash
npm test -- src/components/map/mapOutwardGlowPipeline.test.ts src/components/map/mapOutwardGlowProfile.test.ts src/components/map/mapOutwardGlowShaders.test.ts
npm run typecheck
git add src/components/map/mapOutwardGlowPipeline.ts src/components/map/mapOutwardGlowPipeline.test.ts
git commit -m "feat(map): parameterize glow pipeline quality"
```

- [ ] **Step 7: Perform two-stage review**

Stage 1 walks every dirty-rule row and status label against the spec. Stage 2 checks allocation reuse, no read/write texture feedback, renderer state restoration, disposal idempotence and no per-frame object churn beyond the requested status snapshot. Fix and reverify.

---

## Task 5: Persist v2 State and Publish Runtime Status Without Frame Churn

**Files:**

- Modify: `src/composables/useMapDebug.ts`
- Modify: `src/composables/useMapDebug.test.ts`

- [ ] **Step 1: Add failing persistence and reset tests**

测试模块首次加载读取 v2/v1 迁移结果，深层修改 `quality.maxAlpha`、base 高级字段和 hover 高级字段时只写 v2 key。`resetEffect()` 必须保持 `effect`、`effect.base`、`effect.hover`、`effect.quality` 的响应式对象身份，同时恢复完整默认值。

Run: `npm test -- src/composables/useMapDebug.test.ts`

Expected: FAIL，因为 composable 尚无 quality，也未替换嵌套 quality。

- [ ] **Step 2: Add failing runtime-status de-duplication tests**

新增：

```ts
const DEFAULT_MAP_EFFECT_RUNTIME_STATUS: MapEffectRuntimeStatus = {
  targetWidth: 1,
  targetHeight: 1,
  renderScale: 0.5,
  baseState: 'enabled',
  hoverState: 'zero',
  degraded: false
}
```

`updateEffectRuntimeStatus(next)` 只有字段发生变化才 `Object.assign`，并返回 boolean 表示是否发布。测试相同状态返回 false、对象身份不变；单字段变化返回 true。

- [ ] **Step 3: Implement v2 reactive state and status API**

watch 中规范化后分别 `Object.assign(effect.base, ...)`、`hover`、`quality`，然后保存 v2。返回：

```ts
return {
  drawerOpen, layout, effect, effectJson,
  effectRuntimeStatus, updateEffectRuntimeStatus,
  resetLayout, resetEffect, cameraView
}
```

不要把实时预览状态放进 composable；它是 `MapEffectControls` 单次挂载会话状态。

- [ ] **Step 4: Run tests and commit**

```bash
npm test -- src/composables/useMapDebug.test.ts src/components/map/mapEffectConfig.test.ts
npm run typecheck
git add src/composables/useMapDebug.ts src/composables/useMapDebug.test.ts
git commit -m "feat(debug): expose glow runtime status"
```

- [ ] **Step 5: Perform two-stage review**

Stage 1 checks v2 persistence/reset/status requirements. Stage 2 checks watcher recursion, nested reactive identity, storage exception behavior and status write de-duplication.

---

## Task 6: Build the Five Advanced Control Groups and Group Actions

**Files:**

- Modify: `src/components/debug/MapEffectControls.vue`
- Modify: `src/components/debug/MapEffectControls.test.ts`

- [ ] **Step 1: Add failing field-metadata tests**

按稳定 label/id 断言五个组：

1. 常态边界；
2. 常态外扩柔光；
3. Hover 表面；
4. Hover 外扩柔光；
5. 渲染质量与性能。

每个柔光组必须有 enable、color、radius、opacity、四个 ratio、falloff、softness、near/far passes。断言半径 max 改为 200、每个 min/max/step 与设计表一致；renderScale 用四项 select，不使用任意连续 range。

Run: `npm test -- src/components/debug/MapEffectControls.test.ts`

Expected: FAIL，因为现有 UI 只有三组、无 bool/select/quality。

- [ ] **Step 2: Refactor the typed field model and render controls**

字段联合类型增加：

```ts
type Field = ColorField | NumberField | BooleanField | SelectField
```

`valueOf`/`writeValue` 支持 `base | hover | quality`，但必须通过类型守卫写入，不使用 `as any`。enable 使用 checkbox/switch；renderScale 使用 `<select>`；数字输入继续保留 number + range 双控件并共享规范化逻辑。disabled 柔光组仍可编辑参数，以便重新开启时恢复。

- [ ] **Step 3: Add failing B3 preset and reset tests**

分别测试 base/hover：

- `应用 B3 参考预设` 只写入近远端倍率、falloff、softness、passes；
- 自定义颜色、radius、opacity、enabled 保持原值；
- `重置本组` 恢复该柔光组完整默认，但不改变其他组；
- `恢复全部默认值` 恢复完整 v2。

- [ ] **Step 4: Implement group actions against an explicit edit target**

先引入 `editTarget` 抽象，当前阶段指向 `effect`，下一任务可切换到 draft：

```ts
function applyB3Preset(channel: 'base' | 'hover', target: MapEffectConfig): void
function resetGlowGroup(channel: 'base' | 'hover', target: MapEffectConfig): void
function resetAll(target: MapEffectConfig): void
```

从 `mapEffectConfig.ts` 的导出默认常量深拷贝，不在组件重复手写 B3 数值。

- [ ] **Step 5: Run tests and commit**

```bash
npm test -- src/components/debug/MapEffectControls.test.ts
npm run typecheck
git add src/components/debug/MapEffectControls.vue src/components/debug/MapEffectControls.test.ts
git commit -m "feat(debug): add advanced glow controls"
```

- [ ] **Step 6: Perform two-stage review**

Stage 1 verifies every field, group, range and isolation rule. Stage 2 checks typed writes, accessible labels, keyboard operation, stable ids and duplicated metadata. Fix and reverify.

---

## Task 7: Add Session Draft Editing, Status UI and Component Integration

**Files:**

- Modify: `src/components/debug/MapEffectControls.vue`
- Modify: `src/components/debug/MapEffectControls.test.ts`
- Modify: `src/components/map/ChongqingMap3D.vue`
- Modify: `src/components/map/ChongqingMap3D.test.ts`
- Modify: `src/components/map/mapEffectWatcher.test.ts`

- [ ] **Step 1: Add failing live-preview and draft tests**

覆盖完整状态机：

- 初始 `livePreview === true`，编辑立即写 `effect` 并持久化；
- 切到 false 时深拷贝当前 effect 到 draft；
- false 时所有输入、B3 和分组重置只改 draft，页面生效配置与 localStorage 不变；
- `应用参数` 先 `normalizeMapEffectConfig(draft)`，再整体写回 effect；
- `放弃草稿` 用当前 effect 覆盖 draft；
- 从 false 切回 true 时默认放弃未应用草稿并同步当前 effect，不隐式应用；
- 外部 `resetEffect()` 或重新加载配置导致 effect 变化时，draft 同步到新生效值；
- copy 区在草稿模式复制草稿规范化后的完整 v2 JSON，在实时模式复制 effect JSON。

“切回实时预览会放弃未应用草稿”要在 UI 附近显示短提示，避免用户误认为自动应用。

Run: `npm test -- src/components/debug/MapEffectControls.test.ts`

Expected: FAIL，因为当前所有控件直接写 effect。

- [ ] **Step 2: Implement draft cloning without breaking reactivity**

使用 JSON-safe 配置克隆或显式嵌套 spread：

```ts
function cloneConfig(config: MapEffectConfig): MapEffectConfig {
  return {
    version: 2,
    base: { ...config.base },
    hover: { ...config.hover },
    quality: { ...config.quality }
  }
}
```

`editTarget` 为 computed/ref，所有已有写函数和组动作都接收它。同步 effect → draft 的 watcher 要有内部应用标记，避免 apply 时互相覆盖；不通过替换 `effect` 根对象更新。

- [ ] **Step 3: Add failing status and performance-warning UI tests**

断言页面展示：

- `RenderTarget: 680 × 680`；
- `离屏精度: 50%`；
- 常态/hover 的中文状态；
- `运行状态: 正常` 或 `外扩柔光已降级关闭`；
- `renderScale >= 0.75` 或任一 passes `>= 6` 时显示性能提示。

状态文本使用 `role="status"` 或可访问的静态文本，不能只靠颜色表达。

- [ ] **Step 4: Add failing component status-publication tests**

mock pipeline `getStatus()`，验证：

- 初始化、resize、配置改变、hover 状态改变和 render 后调用发布辅助函数；
- 相同快照不会重复执行响应式写入；
- pipeline 构造或运行失败后发布 `degraded: true`；
- 降级后仍维持一次 warning、一次 dispose 和主场景直接渲染；
- pipeline 重新创建成功时恢复 `degraded: false`。

`mapEffectWatcher.test.ts` 增加 v2 `quality` 和高级字段的深层 watch 回归，确保传给 pipeline 的是完整规范化配置。

- [ ] **Step 5: Wire low-frequency status publication**

在 `ChongqingMap3D.vue` 增加局部函数：

```ts
function publishGlowStatus(degraded = false): void {
  const status = glowPipeline?.getStatus()
  updateEffectRuntimeStatus(status
    ? { ...status, degraded }
    : { ...DEFAULT_MAP_EFFECT_RUNTIME_STATUS, degraded })
}
```

可以在 render loop 读取快照，但 `updateEffectRuntimeStatus` 必须去重，确保没有每帧 Vue mutation；更优先在 setSize/setConfig/setRegionProgress/render 完成后的状态可能变化点调用。降级 catch 中先 dispose/null pipeline，再发布 degraded。

- [ ] **Step 6: Render status, draft actions and copy source**

“渲染质量与性能”组展示状态和性能提示；“可复制参数”展示当前编辑目标的规范化 JSON。草稿模式显示 `应用参数`、`放弃草稿`；实时模式隐藏或禁用这两个按钮。全部默认按钮作用于当前 edit target，文案明确。

- [ ] **Step 7: Run focused and component tests, then commit**

```bash
npm test -- src/components/debug/MapEffectControls.test.ts src/components/map/ChongqingMap3D.test.ts src/components/map/mapEffectWatcher.test.ts src/composables/useMapDebug.test.ts
npm run typecheck
git add src/components/debug/MapEffectControls.vue src/components/debug/MapEffectControls.test.ts src/components/map/ChongqingMap3D.vue src/components/map/ChongqingMap3D.test.ts src/components/map/mapEffectWatcher.test.ts
git commit -m "feat(debug): add glow draft preview and status"
```

- [ ] **Step 8: Perform two-stage review**

Stage 1 walks the complete live/draft state machine, copy semantics and all runtime labels. Stage 2 checks watcher loops, timer cleanup, reactive identity, a11y, status churn and component teardown. Fix findings and rerun all focused tests.

---

## Task 8: Full Regression, Real Browser Acceptance and Performance Evidence

**Files:**

- Modify only if a verified defect is found in the files above.
- Do not add generated browser screenshots or `.superpowers/` artifacts to git.

- [ ] **Step 1: Run the complete automated verification suite**

```bash
npm test
npm run typecheck
npm run build
```

Expected: all tests pass, typecheck exits 0, Vite production build exits 0. Record exact test count and build result in the final handoff.

- [ ] **Step 2: Review the full branch diff before browser testing**

```bash
git status --short
git diff --check main...HEAD
git diff --stat main...HEAD
git diff main...HEAD -- src/components/map src/components/debug src/composables
```

Confirm no unrelated map data/UI changes and no tracked generated artifacts.

- [ ] **Step 3: Start a LAN-reachable production preview from the exact worktree**

Stop only the prior listener owned by this worktree, then run:

```bash
npm run build
npm run preview -- --host 0.0.0.0 --port 4173
```

Verify both endpoints, substituting the current LAN IP discovered with `ipconfig getifaddr en0` or the active interface:

```bash
curl -I http://127.0.0.1:4173/
curl -I http://<LAN-IP>:4173/
lsof -nP -iTCP:4173 -sTCP:LISTEN
```

Expected: HTTP 200 and listener bound for LAN access.

- [ ] **Step 4: Perform real-browser functional acceptance**

Use the browser-control skill against `http://127.0.0.1:4173/#/` and verify with clean localStorage plus migrated v1 fixtures:

1. Clean load and “恢复全部默认值” show visible static `54 / 0.23` outward glow without hover.
2. Exact old v1 default migrates to the same static glow; custom v1 zeros remain zero.
3. Every advanced field updates the intended base or hover channel only.
4. Enable switches skip and restore their own channel without losing values.
5. B3 preset preserves color/radius/overall opacity; group reset and full reset have correct scope.
6. Live preview off does not change the map; apply changes it once; discard restores the effective values.
7. Copied JSON is version 2, includes quality, reloads to the same visual state.
8. Runtime dimensions, scale, channel states and normal/degraded text match actual behavior.
9. Test renderScale 25/50/75/100% and passes 1/4/6/8; no black screen and no persistent console error.
10. Hover enter/leave, click drill-down and existing map interaction remain functional.

- [ ] **Step 5: Measure default performance**

With the production preview and default configuration, collect at least 10 seconds each after warm-up:

- static map: average FPS ≥ 55;
- continuous hover transitions: average FPS ≥ 50.

Record viewport, DPR, RenderTarget size and device/browser used. If thresholds fail, diagnose before changing defaults; do not hide a failure by reducing the agreed `54 / 0.23` visual default.

- [ ] **Step 6: Perform final two-stage branch review**

Use `superpowers:requesting-code-review`:

1. Specification reviewer checks every acceptance criterion and migration branch against the design.
2. Code-quality reviewer checks the complete `main...HEAD` diff for GPU lifecycle, dirty invalidation, migration safety, Vue watcher behavior, tests and accessibility.

Resolve every blocking finding, then rerun `npm test`, `npm run typecheck`, `npm run build`, and the affected browser cases.

- [ ] **Step 7: Commit any acceptance fixes and verify clean scope**

If fixes were required:

```bash
git add <only-the-reviewed-files>
git commit -m "fix(map): address advanced glow acceptance"
```

Final evidence:

```bash
git status --short
git log --oneline --decorate -8
git diff --check main...HEAD
```

Expected: only known untracked `.superpowers/` artifacts may remain; no unstaged implementation changes and no whitespace errors.

---

## Completion Checklist

- [ ] v2 defaults expose static `54 / 0.23` glow and independent zero-default hover glow.
- [ ] v1 exact-default and custom-value migrations both behave as designed.
- [ ] Every exposed control changes a real runtime parameter; no decorative controls.
- [ ] Static/hover B3 preset, group reset, enable, live preview, draft apply/discard and full reset are isolated correctly.
- [ ] Dirty rules prove blur work is only repeated when required.
- [ ] Runtime status changes do not cause per-frame Vue writes.
- [ ] Runtime failure fallback remains one warning, one dispose, then direct main rendering.
- [ ] Automated tests, typecheck, build, full diff review and browser acceptance pass.
- [ ] LAN preview URL and performance evidence are handed back to the user.
