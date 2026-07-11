# 地图外扩柔光 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用屏幕空间遮罩与 B3 多级模糊替换当前多宽线辉光，使常态外圈和 hover 区块产生主要向外扩散、近端柔和且远端长尾明显的真实柔光。

**Architecture:** 地图主体、内部区界和清晰亮芯继续在主场景渲染；新增 `mapOutwardGlowProfile` 负责纯参数换算，`mapOutwardGlowShaders` 负责低级模糊与合成通道，`mapOutwardGlowPipeline` 负责常态/hover 遮罩、dirty 状态、RenderTarget 生命周期和最终渲染顺序。每个区块共享原始几何创建离屏遮罩副本，常态使用初始化时的整体轮廓，hover 使用各区块 eased 进度生成灰度遮罩。

**Tech Stack:** Vue 3.5、TypeScript 5.7、Three.js 0.185、WebGLRenderTarget、ShaderMaterial、FullScreenQuad、Vite 6、Vitest 3.2.7、happy-dom

## Global Constraints

- 实施规格以 `docs/superpowers/specs/2026-07-11-outward-map-glow-design.md` 为准。
- 只修改主屏 `ChongqingMap3D`；详情页 ECharts 地图、柱状图、标记、tooltip 和点击下钻不变。
- 辉光主要向地图或区块轮廓外侧扩散，采用 B3“近端柔、远端长尾”衰减。
- 扩散半径单位固定为 CSS px；镜头、容器、DPR 和 `ScaleScreen` 变化时视觉半径保持稳定。
- 常态外圈和 hover 区块共用真实模糊能力，但颜色、半径和透明度相互独立。
- 配置继续使用 `MapEffectConfig` version 1 和存储键 `cq-map-effect-config-v1`；本次不修改已确认的零辉光默认值。
- `outerGlowWidth`、`hover.glowWidth` 的合法范围改为 0–120，步长 1；强度字段改称透明度，范围保持 0–1。
- 半径或透明度为 0 时跳过对应遮罩、模糊和合成步骤。
- Shader/RenderTarget 初始化失败时保留主场景、清晰亮芯、材质 hover、抬升、tooltip 和点击；不得回退到多宽线辉光。
- 默认模糊缓冲比例为 0.5；1920×1080 当前设备目标为常态不低于 55 FPS、连续 hover 不低于 50 FPS。
- 不新增运行时依赖；只使用当前 Three.js 与 examples 模块。
- 每个任务由独立实现 subagent 完成；随后依次执行规格符合性审查和代码质量审查，Critical/Important 问题修复并复审通过后才能进入下一任务。

## File Structure

- Create: `src/components/map/mapOutwardGlowProfile.ts` — B3 半径/透明度派生、目标尺寸和零值短路的纯函数。
- Create: `src/components/map/mapOutwardGlowProfile.test.ts` — CSS px、DPR、半分辨率和 B3 比例测试。
- Create: `src/components/map/mapOutwardGlowShaders.ts` — 遮罩模糊 Shader、外侧合成 Shader、全屏 pass 和共享资源释放。
- Create: `src/components/map/mapOutwardGlowShaders.test.ts` — uniforms、横纵模糊调用顺序与资源释放测试。
- Create: `src/components/map/mapOutwardGlowPipeline.ts` — 常态/hover 遮罩副本、dirty 状态、双层结果缓存、渲染与降级边界。
- Create: `src/components/map/mapOutwardGlowPipeline.test.ts` — 双通道短路、区块进度、Resize、相机 dirty、渲染顺序和 dispose 测试。
- Modify: `src/components/map/mapEffectConfig.ts` — 两个扩散半径字段的规范化上限改为 120。
- Modify: `src/components/map/mapEffectConfig.test.ts` — 新范围与零默认值回归测试。
- Modify: `src/components/debug/MapEffectControls.vue` — 控件文案、范围和步长改为真实扩散参数。
- Modify: `src/components/debug/MapEffectControls.test.ts` — 文案、max、step 和热更新测试。
- Modify: `src/components/map/mapGlow.ts` — 删除伪辉光宽线，只保留内部区界与常态/hover 清晰亮芯。
- Modify: `src/components/map/mapGlow.test.ts` — 验证只创建和更新清晰线层。
- Modify: `src/components/map/mapEffectRuntime.ts` — 继续只更新清晰线层。
- Modify: `src/components/map/mapEffectRuntime.test.ts` — 适配精简后的 line bundle。
- Modify: `src/components/map/ChongqingMap3D.vue` — 创建管线、同步配置/尺寸/相机/hover 进度、替换主渲染调用并释放资源。
- Modify: `src/components/map/ChongqingMap3D.test.ts` — 管线接线、失败降级、异步初始化和资源释放测试。

---

### Task 1: 更新配置语义与调试控件

**Files:**
- Modify: `src/components/map/mapEffectConfig.ts:140-155`
- Modify: `src/components/map/mapEffectConfig.test.ts`
- Modify: `src/components/debug/MapEffectControls.vue:29-60`
- Modify: `src/components/debug/MapEffectControls.test.ts`

**Interfaces:**
- Preserves: `MapEffectConfig` version 1、`MAP_EFFECT_STORAGE_KEY`、四个现有字段名。
- Produces: `outerGlowWidth` 与 `hover.glowWidth` 的规范化范围 0–120。
- Produces: 控件标签“外圈扩散半径”“外圈辉光透明度”“Hover 扩散半径”“Hover 辉光透明度”。

- [ ] **Step 1: 写配置范围失败测试**

在 `mapEffectConfig.test.ts` 增加：

```ts
it('把常态和 hover 扩散半径按屏幕像素裁剪到 0–120', () => {
  const high = normalizeMapEffectConfig({
    ...MAP_EFFECT_DEFAULTS,
    base: { ...MAP_EFFECT_DEFAULTS.base, outerGlowWidth: 999 },
    hover: { ...MAP_EFFECT_DEFAULTS.hover, glowWidth: 999 }
  })
  expect(high.base.outerGlowWidth).toBe(120)
  expect(high.hover.glowWidth).toBe(120)

  const low = normalizeMapEffectConfig({
    ...MAP_EFFECT_DEFAULTS,
    base: { ...MAP_EFFECT_DEFAULTS.base, outerGlowWidth: -1 },
    hover: { ...MAP_EFFECT_DEFAULTS.hover, glowWidth: -1 }
  })
  expect(low.base.outerGlowWidth).toBe(0)
  expect(low.hover.glowWidth).toBe(0)
  expect(MAP_EFFECT_DEFAULTS.base.outerGlowWidth).toBe(0)
  expect(MAP_EFFECT_DEFAULTS.hover.glowWidth).toBe(0)
})
```

- [ ] **Step 2: 写控件语义失败测试**

在 `MapEffectControls.test.ts` 增加：

```ts
it('exposes real glow radius and opacity controls', async () => {
  const { app, root } = await mountControls()
  const baseRadius = root.querySelector<HTMLInputElement>('#effect-base-outerGlowWidth-number')!
  const hoverRadius = root.querySelector<HTMLInputElement>('#effect-hover-glowWidth-number')!

  expect(root.querySelector('label[for="effect-base-outerGlowWidth-number"]')?.textContent)
    .toBe('外圈扩散半径')
  expect(root.querySelector('label[for="effect-base-outerGlowStrength-number"]')?.textContent)
    .toBe('外圈辉光透明度')
  expect(root.querySelector('label[for="effect-hover-glowWidth-number"]')?.textContent)
    .toBe('Hover 扩散半径')
  expect(root.querySelector('label[for="effect-hover-glowStrength-number"]')?.textContent)
    .toBe('Hover 辉光透明度')
  expect([baseRadius.max, baseRadius.step]).toEqual(['120', '1'])
  expect([hoverRadius.max, hoverRadius.step]).toEqual(['120', '1'])
  app.unmount()
})
```

- [ ] **Step 3: 运行失败测试**

Run:

```bash
npm test -- src/components/map/mapEffectConfig.test.ts src/components/debug/MapEffectControls.test.ts
```

Expected: 新范围断言收到旧上限 24/20；控件仍显示“辉光宽度/强度”。

- [ ] **Step 4: 修改规范化和控件定义**

在 `mapEffectConfig.ts` 使用：

```ts
outerGlowWidth: numberInRange(base.outerGlowWidth, MAP_EFFECT_DEFAULTS.base.outerGlowWidth, 0, 120),
// ...
glowWidth: numberInRange(hover.glowWidth, MAP_EFFECT_DEFAULTS.hover.glowWidth, 0, 120),
```

在 `MapEffectControls.vue` 使用：

```ts
{ section: 'base', key: 'outerGlowWidth', label: '外圈扩散半径', kind: 'number', min: 0, max: 120, step: 1 },
{ section: 'base', key: 'outerGlowStrength', label: '外圈辉光透明度', kind: 'number', min: 0, max: 1, step: 0.01 },
// ...
{ section: 'hover', key: 'glowWidth', label: 'Hover 扩散半径', kind: 'number', min: 0, max: 120, step: 1 },
{ section: 'hover', key: 'glowStrength', label: 'Hover 辉光透明度', kind: 'number', min: 0, max: 1, step: 0.01 },
```

- [ ] **Step 5: 运行聚焦验证**

Run:

```bash
npm test -- src/components/map/mapEffectConfig.test.ts src/components/debug/MapEffectControls.test.ts
npm run typecheck
```

Expected: 两个测试文件全部 PASS；`vue-tsc` 退出码 0。

- [ ] **Step 6: 提交并执行双阶段审查**

```bash
git add src/components/map/mapEffectConfig.ts src/components/map/mapEffectConfig.test.ts \
  src/components/debug/MapEffectControls.vue src/components/debug/MapEffectControls.test.ts
git commit -m "feat(map): expose outward glow radius controls"
```

Review gate: 先核对 version/storage/defaults 未变化，再审查控件可访问性与数值草稿行为。

---

### Task 2: 建立 B3 纯参数与像素换算模块

**Files:**
- Create: `src/components/map/mapOutwardGlowProfile.ts`
- Create: `src/components/map/mapOutwardGlowProfile.test.ts`

**Interfaces:**
- Produces: `GlowTargetMetrics { width, height, pixelsPerCssPx }`
- Produces: `GlowProfile { nearRadiusTexels, farRadiusTexels, nearOpacity, farOpacity }`
- Produces: `computeGlowTargetMetrics(cssWidth, cssHeight, pixelRatio, scale?): GlowTargetMetrics`
- Produces: `deriveB3GlowProfile(radiusCssPx, opacity, metrics): GlowProfile`
- Produces: `isGlowEnabled(radiusCssPx, opacity, progress?): boolean`

- [ ] **Step 1: 写纯函数失败测试**

Create `mapOutwardGlowProfile.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  computeGlowTargetMetrics,
  deriveB3GlowProfile,
  isGlowEnabled
} from './mapOutwardGlowProfile'

describe('mapOutwardGlowProfile', () => {
  it('uses DPR and half resolution while preserving CSS pixel scale', () => {
    expect(computeGlowTargetMetrics(680, 480, 2)).toEqual({
      width: 680,
      height: 480,
      pixelsPerCssPx: 1
    })
    expect(computeGlowTargetMetrics(680, 480, 1.25, 0.5)).toEqual({
      width: 425,
      height: 300,
      pixelsPerCssPx: 0.625
    })
  })

  it('derives B3 near-soft and far-long-tail layers', () => {
    const metrics = computeGlowTargetMetrics(680, 680, 2)
    expect(deriveB3GlowProfile(54, 0.23, metrics)).toEqual({
      nearRadiusTexels: 18.9,
      farRadiusTexels: 54,
      nearOpacity: 0.1909,
      farOpacity: 0.23
    })
  })

  it('skips zero radius, zero opacity, or invisible hover progress', () => {
    expect(isGlowEnabled(54, 0.23, 1)).toBe(true)
    expect(isGlowEnabled(0, 0.23, 1)).toBe(false)
    expect(isGlowEnabled(54, 0, 1)).toBe(false)
    expect(isGlowEnabled(54, 0.23, 0)).toBe(false)
  })
})
```

- [ ] **Step 2: 运行测试，确认模块不存在**

Run: `npm test -- src/components/map/mapOutwardGlowProfile.test.ts`

Expected: FAIL，包含 `Failed to resolve import "./mapOutwardGlowProfile"`。

- [ ] **Step 3: 实现纯函数**

Create `mapOutwardGlowProfile.ts`:

```ts
export interface GlowTargetMetrics {
  width: number
  height: number
  pixelsPerCssPx: number
}

export interface GlowProfile {
  nearRadiusTexels: number
  farRadiusTexels: number
  nearOpacity: number
  farOpacity: number
}

export function computeGlowTargetMetrics(
  cssWidth: number,
  cssHeight: number,
  pixelRatio: number,
  scale = 0.5
): GlowTargetMetrics {
  const safeScale = Math.min(1, Math.max(0.25, scale))
  const pixelsPerCssPx = Math.max(0.01, pixelRatio) * safeScale
  return {
    width: Math.max(1, Math.round(cssWidth * pixelsPerCssPx)),
    height: Math.max(1, Math.round(cssHeight * pixelsPerCssPx)),
    pixelsPerCssPx
  }
}

export function deriveB3GlowProfile(
  radiusCssPx: number,
  opacity: number,
  metrics: GlowTargetMetrics
): GlowProfile {
  const radius = Math.max(0, radiusCssPx) * metrics.pixelsPerCssPx
  const alpha = Math.min(1, Math.max(0, opacity))
  return {
    nearRadiusTexels: Number((radius * 0.35).toFixed(4)),
    farRadiusTexels: Number(radius.toFixed(4)),
    nearOpacity: Number((alpha * 0.83).toFixed(4)),
    farOpacity: Number(alpha.toFixed(4))
  }
}

export function isGlowEnabled(radiusCssPx: number, opacity: number, progress = 1): boolean {
  return radiusCssPx > 0 && opacity > 0 && progress > 0.001
}
```

- [ ] **Step 4: 运行聚焦测试和类型检查**

Run:

```bash
npm test -- src/components/map/mapOutwardGlowProfile.test.ts
npm run typecheck
```

Expected: 3 tests PASS；类型检查退出码 0。

- [ ] **Step 5: 提交并执行双阶段审查**

```bash
git add src/components/map/mapOutwardGlowProfile.ts src/components/map/mapOutwardGlowProfile.test.ts
git commit -m "feat(map): derive B3 glow profile in screen pixels"
```

Review gate: 规格审查确认 54 CSS px 在 DPR/scale 变化后视觉不变；质量审查确认纯函数无 Three.js 依赖且边界值有限。

---

### Task 3: 删除多宽线伪辉光并保留清晰亮芯

**Files:**
- Modify: `src/components/map/mapGlow.ts`
- Modify: `src/components/map/mapGlow.test.ts`
- Modify: `src/components/map/mapEffectRuntime.ts`
- Modify: `src/components/map/mapEffectRuntime.test.ts`

**Interfaces:**
- Changes: `StaticGlowBundle` 只包含 `inner`、`outerCore`。
- Changes: `HoverGlowBundle` 只包含 `core`。
- Preserves: `createStaticGlowLayers`、`createHoverGlowLayers`、`applyStaticGlowConfig`、`applyHoverGlowConfig`、`setHoverGlowProgress` 的调用名称。
- Removes: `outerNear`、`outerFar`、`glow` 宽线对象及其材质/几何资源。

- [ ] **Step 1: 把图层测试改成目标契约并确认失败**

在 `mapGlow.test.ts` 用以下断言替换伪辉光断言：

```ts
it('creates only inner lines and a crisp static outer core', () => {
  const boundaries: BoundarySegments = {
    inner: [[[0, 0], [10, 10]]],
    outer: [[[0, 0], [10, 10]]],
    byRegion: new Map()
  }
  const bundle = createStaticGlowLayers(boundaries, MAP_EFFECT_DEFAULTS, 0)
  expect(Object.keys(bundle).sort()).toEqual([
    'geometries', 'group', 'inner', 'materials', 'outerCore'
  ])
  expect(bundle.group.children).toHaveLength(2)
  expect(bundle.outerCore.line.visible).toBe(true)
})

it('creates only a crisp hover core and animates its opacity', () => {
  const bundle = createHoverGlowLayers([[[0, 0], [10, 10]]], MAP_EFFECT_DEFAULTS, 0)
  expect(Object.keys(bundle).sort()).toEqual(['core', 'geometries', 'group', 'materials'])
  setHoverGlowProgress(bundle, MAP_EFFECT_DEFAULTS, 0.5)
  expect(bundle.group.visible).toBe(true)
  expect(bundle.core.material.opacity).toBe(0.5)
  expect(bundle.core.line.visible).toBe(true)
})
```

Run: `npm test -- src/components/map/mapGlow.test.ts src/components/map/mapEffectRuntime.test.ts`

Expected: FAIL，因为 bundle 仍包含 `outerNear`、`outerFar` 和 hover `glow`。

- [ ] **Step 2: 精简类型与构建函数**

把公开 bundle 改为：

```ts
export interface StaticGlowBundle extends GlowBundleBase {
  inner: GlowLayer
  outerCore: GlowLayer
}

export interface HoverGlowBundle extends GlowBundleBase {
  core: GlowLayer
}
```

`createStaticGlowLayers` 只创建 `inner` 与 `outerCore`，materials 为二者材质，geometries 保留 inner/outer 两个共享几何。`createHoverGlowLayers` 只创建 `core`，初始化 opacity 0、group hidden。

- [ ] **Step 3: 精简参数应用和 hover 进度**

使用：

```ts
export function applyStaticGlowConfig(bundle: StaticGlowBundle, config: MapEffectConfig): void {
  applyLayer(bundle.inner, {
    color: config.base.innerColor,
    width: config.base.innerWidth,
    opacity: config.base.innerOpacity
  })
  applyLayer(bundle.outerCore, {
    color: config.base.outerColor,
    width: config.base.outerCoreWidth,
    opacity: 0.95
  })
}

export function applyHoverGlowConfig(bundle: HoverGlowBundle, config: MapEffectConfig): void {
  bundle.core.material.color.set(config.hover.outlineColor)
  bundle.core.material.linewidth = config.hover.outlineWidth
}

export function setHoverGlowProgress(
  bundle: HoverGlowBundle,
  config: MapEffectConfig,
  progress: number
): void {
  bundle.group.visible = progress > 0.001
  bundle.core.material.opacity = progress
  bundle.core.line.visible = bundle.group.visible && config.hover.outlineWidth > 0
}
```

删除只服务于伪辉光的派生字段和测试，保留动画纯函数、分辨率同步与 dispose 行为。

- [ ] **Step 4: 运行光层与运行时测试**

Run:

```bash
npm test -- src/components/map/mapGlow.test.ts src/components/map/mapEffectRuntime.test.ts
npm run typecheck
```

Expected: 两个测试文件全部 PASS；类型检查退出码 0。

- [ ] **Step 5: 提交并执行双阶段审查**

```bash
git add src/components/map/mapGlow.ts src/components/map/mapGlow.test.ts \
  src/components/map/mapEffectRuntime.ts src/components/map/mapEffectRuntime.test.ts
git commit -m "refactor(map): retain only crisp map outlines"
```

Review gate: 规格审查确认无宽线辉光回退；质量审查确认共享 geometry 只释放一次且现有 hover 动画端点不回归。

---

### Task 4: 实现共享模糊与外侧合成 Shader 通道

**Files:**
- Create: `src/components/map/mapOutwardGlowShaders.ts`
- Create: `src/components/map/mapOutwardGlowShaders.test.ts`

**Interfaces:**
- Produces: `GlowShaderResources`，包含 `blurMaterial`、`compositeMaterial`、`quad`。
- Produces: `createGlowShaderResources(): GlowShaderResources`
- Produces: `renderSeparableBlur(renderer, resources, source, ping, output, radiusTexels, passes): void`
- Produces: `renderOutwardComposite(renderer, resources, inputs): void`
- Produces: `disposeGlowShaderResources(resources): void`

- [ ] **Step 1: 写 Shader 资源与 pass 顺序失败测试**

Create `mapOutwardGlowShaders.test.ts`，用记录型 renderer（实现 `setRenderTarget`、`render`）验证：

```ts
function recordingRenderer() {
  const state = {
    targets: [] as Array<THREE.WebGLRenderTarget | null>,
    renders: [] as Array<[THREE.Object3D, THREE.Camera]>
  }
  return Object.assign({
    setRenderTarget(target: THREE.WebGLRenderTarget | null) {
      state.targets.push(target)
    },
    render(object: THREE.Object3D, camera: THREE.Camera) {
      state.renders.push([object, camera])
    }
  }, state) as typeof state & THREE.WebGLRenderer
}

it('runs horizontal and vertical blur passes without clearing the final screen', () => {
  const resources = createGlowShaderResources()
  const source = new THREE.Texture()
  const ping = new THREE.WebGLRenderTarget(32, 32)
  const output = new THREE.WebGLRenderTarget(32, 32)
  const renderer = recordingRenderer()

  renderSeparableBlur(renderer, resources, source, ping, output, 12, 2)

  expect(renderer.targets).toEqual([ping, output, ping, output])
  expect(renderer.renders).toHaveLength(4)
  expect(resources.blurMaterial.uniforms.uRadius.value).toBeCloseTo(12 / Math.sqrt(2))
})

it('binds mask, near, far, color and B3 opacity for outward composition', () => {
  const resources = createGlowShaderResources()
  const renderer = recordingRenderer()
  const mask = new THREE.Texture()
  const near = new THREE.Texture()
  const far = new THREE.Texture()

  renderOutwardComposite(renderer, resources, {
    mask,
    near,
    far,
    color: '#27a7ff',
    nearOpacity: 0.1909,
    farOpacity: 0.23
  })

  expect(resources.compositeMaterial.uniforms).toMatchObject({
    tMask: { value: mask },
    tNear: { value: near },
    tFar: { value: far },
    uNearOpacity: { value: 0.1909 },
    uFarOpacity: { value: 0.23 }
  })
  expect(renderer.targets.at(-1)).toBe(null)
  expect(renderer.renders).toHaveLength(1)
})
```

`recordingRenderer()` 返回可断言数组，并 cast 为 `THREE.WebGLRenderer`；不得创建真实 WebGL context。

- [ ] **Step 2: 运行测试，确认模块不存在**

Run: `npm test -- src/components/map/mapOutwardGlowShaders.test.ts`

Expected: FAIL，包含模块无法解析。

- [ ] **Step 3: 创建完整 Shader 资源**

`mapOutwardGlowShaders.ts` 使用 `FullScreenQuad`。顶点 Shader：

```glsl
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
```

模糊 fragment Shader 使用 9 taps：

```glsl
uniform sampler2D tDiffuse;
uniform vec2 uTexelSize;
uniform vec2 uDirection;
uniform float uRadius;
varying vec2 vUv;
void main() {
  vec2 stepUv = uTexelSize * uDirection * uRadius;
  float value = texture2D(tDiffuse, vUv).r * 0.227027;
  value += texture2D(tDiffuse, vUv + stepUv * 1.384615).r * 0.316216;
  value += texture2D(tDiffuse, vUv - stepUv * 1.384615).r * 0.316216;
  value += texture2D(tDiffuse, vUv + stepUv * 3.230769).r * 0.070270;
  value += texture2D(tDiffuse, vUv - stepUv * 3.230769).r * 0.070270;
  gl_FragColor = vec4(value, value, value, 1.0);
}
```

外侧合成 fragment Shader：

```glsl
uniform sampler2D tMask;
uniform sampler2D tNear;
uniform sampler2D tFar;
uniform vec3 uColor;
uniform float uNearOpacity;
uniform float uFarOpacity;
varying vec2 vUv;
void main() {
  float mask = texture2D(tMask, vUv).r;
  float outside = 1.0 - smoothstep(0.02, 0.98, mask);
  float nearGlow = texture2D(tNear, vUv).r * uNearOpacity;
  float farGlow = texture2D(tFar, vUv).r * uFarOpacity;
  float alpha = clamp((nearGlow + farGlow) * outside, 0.0, 1.0);
  gl_FragColor = vec4(uColor, alpha);
}
```

Composite material 设置 `transparent: true`、`depthTest: false`、`depthWrite: false`、`blending: THREE.AdditiveBlending`、`toneMapped: false`。

- [ ] **Step 4: 实现多 pass 半径分配与资源释放**

`renderSeparableBlur` 对 `passes` 次循环执行横向/纵向 pass，每次使用：

```ts
resources.blurMaterial.uniforms.uRadius.value = radiusTexels / Math.sqrt(passes)
resources.blurMaterial.uniforms.uTexelSize.value.set(1 / output.width, 1 / output.height)
```

第一次横向输入为 source，后续输入为 output.texture；每次横向输出 ping、纵向输出 output。`disposeGlowShaderResources` 对两个 material 和 `quad.dispose()` 各调用一次。

- [ ] **Step 5: 运行测试、类型检查和 Shader 字符串静态断言**

Run:

```bash
npm test -- src/components/map/mapOutwardGlowShaders.test.ts
npm run typecheck
```

Expected: 所有 Shader 测试 PASS；类型检查退出码 0；测试确认 composite 包含 `outside` 裁切而非对称直接合成。

- [ ] **Step 6: 提交并执行双阶段审查**

```bash
git add src/components/map/mapOutwardGlowShaders.ts src/components/map/mapOutwardGlowShaders.test.ts
git commit -m "feat(map): add outward blur and composite passes"
```

Review gate: 规格审查核对只保留外侧和 B3 双层；质量审查重点检查 renderer target 状态、uniform 更新、材质透明混合和 dispose。

---

### Task 5: 实现常态与 hover 共享的外扩柔光管线

**Files:**
- Create: `src/components/map/mapOutwardGlowPipeline.ts`
- Create: `src/components/map/mapOutwardGlowPipeline.test.ts`

**Interfaces:**
- Produces: `MapOutwardGlowPipeline`
- Produces: `createMapOutwardGlowPipeline(renderer, regionMeshes): MapOutwardGlowPipeline`
- Methods: `setSize(cssWidth, cssHeight, pixelRatio): void`
- Methods: `setConfig(config: MapEffectConfig): void`
- Methods: `setRegionProgress(source: THREE.Mesh, easedProgress: number): void`
- Methods: `markCameraDirty(): void`
- Methods: `render(mainScene: THREE.Scene, camera: THREE.Camera): void`
- Methods: `dispose(): void`

- [ ] **Step 1: 写管线状态与短路失败测试**

Create `mapOutwardGlowPipeline.test.ts`，使用两个简单 `THREE.Mesh` 和记录型 renderer：

```ts
const shaderMocks = vi.hoisted(() => ({
  renderBlur: vi.fn(),
  renderComposite: vi.fn(),
  dispose: vi.fn()
}))

vi.mock('./mapOutwardGlowShaders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./mapOutwardGlowShaders')>()
  return {
    ...actual,
    renderSeparableBlur: shaderMocks.renderBlur,
    renderOutwardComposite: shaderMocks.renderComposite,
    disposeGlowShaderResources: shaderMocks.dispose
  }
})

function fixture() {
  const renderer = {
    autoClear: true,
    getRenderTarget: vi.fn(() => null),
    setRenderTarget: vi.fn(),
    clear: vi.fn(),
    render: vi.fn()
  } as unknown as THREE.WebGLRenderer
  const meshes = [0, 20].map((x) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 2))
    mesh.position.x = x
    mesh.updateMatrixWorld(true)
    return mesh
  })
  const scene = new THREE.Scene()
  scene.add(...meshes)
  const camera = new THREE.PerspectiveCamera(40, 1, 1, 1000)
  const pipeline = createMapOutwardGlowPipeline(renderer, meshes)
  return { pipeline, renderer, meshes, scene, camera }
}

function configWith({ baseRadius = 54, baseOpacity = 0.23 } = {}) {
  return {
    ...MAP_EFFECT_DEFAULTS,
    base: {
      ...MAP_EFFECT_DEFAULTS.base,
      outerGlowWidth: baseRadius,
      outerGlowStrength: baseOpacity
    },
    hover: { ...MAP_EFFECT_DEFAULTS.hover }
  }
}

function enabledFixture() {
  const value = fixture()
  value.pipeline.setSize(680, 680, 2)
  value.pipeline.setConfig(configWith())
  return value
}

it('skips both glow channels when approved defaults keep radius and opacity at zero', () => {
  const { pipeline, renderer, scene, camera } = fixture()
  pipeline.setConfig(MAP_EFFECT_DEFAULTS)
  pipeline.render(scene, camera)
  expect(renderer.render).toHaveBeenCalledTimes(1)
  expect(renderer.render).toHaveBeenCalledWith(scene, camera)
  expect(shaderMocks.renderBlur).not.toHaveBeenCalled()
  expect(shaderMocks.renderComposite).not.toHaveBeenCalled()
})

it('keeps static and hover styles independent and combines fading regions', () => {
  const { pipeline, meshes, renderer, scene, camera } = fixture()
  pipeline.setSize(680, 680, 2)
  pipeline.setConfig({
    ...MAP_EFFECT_DEFAULTS,
    base: { ...MAP_EFFECT_DEFAULTS.base, outerGlowWidth: 54, outerGlowStrength: 0.23 },
    hover: { ...MAP_EFFECT_DEFAULTS.hover, glowWidth: 72, glowStrength: 0.31 }
  })
  pipeline.setRegionProgress(meshes[0], 0.75)
  pipeline.setRegionProgress(meshes[1], 0.25)
  pipeline.render(scene, camera)
  expect(shaderMocks.renderBlur).toHaveBeenCalled()
  expect(shaderMocks.renderComposite).toHaveBeenNthCalledWith(
    1,
    renderer,
    expect.any(Object),
    expect.objectContaining({ color: '#ffffff', farOpacity: 0.23 })
  )
  expect(shaderMocks.renderComposite).toHaveBeenNthCalledWith(
    2,
    renderer,
    expect.any(Object),
    expect.objectContaining({ color: '#27a7ff', farOpacity: 0.31 })
  )
})

it('reuses blur results for opacity-only changes and invalidates on radius or camera changes', () => {
  const { pipeline, renderer, scene, camera } = enabledFixture()
  pipeline.render(scene, camera)
  const firstBlurCount = shaderMocks.renderBlur.mock.calls.length
  pipeline.setConfig(configWith({ baseOpacity: 0.4 }))
  pipeline.render(scene, camera)
  expect(shaderMocks.renderBlur).toHaveBeenCalledTimes(firstBlurCount)
  pipeline.setConfig(configWith({ baseRadius: 80 }))
  pipeline.render(scene, camera)
  expect(shaderMocks.renderBlur.mock.calls.length).toBeGreaterThan(firstBlurCount)
  const afterRadius = shaderMocks.renderBlur.mock.calls.length
  pipeline.markCameraDirty()
  pipeline.render(scene, camera)
  expect(shaderMocks.renderBlur.mock.calls.length).toBeGreaterThan(afterRadius)
})
```

- [ ] **Step 2: 写 Resize、矩阵同步和释放失败测试**

增加：

```ts
it('resizes all targets in physical half-resolution pixels and disposes owned resources once', () => {
  const setSize = vi.spyOn(THREE.WebGLRenderTarget.prototype, 'setSize')
  const disposeTarget = vi.spyOn(THREE.WebGLRenderTarget.prototype, 'dispose')
  const disposeMaterial = vi.spyOn(THREE.Material.prototype, 'dispose')
  const { pipeline } = fixture()
  pipeline.setSize(680, 480, 1.25)
  expect(setSize).toHaveBeenCalledWith(425, 300)
  pipeline.dispose()
  const targetsAfterFirstDispose = disposeTarget.mock.calls.length
  const materialsAfterFirstDispose = disposeMaterial.mock.calls.length
  expect(targetsAfterFirstDispose).toBeGreaterThan(0)
  expect(materialsAfterFirstDispose).toBeGreaterThan(0)
  pipeline.dispose()
  expect(disposeTarget).toHaveBeenCalledTimes(targetsAfterFirstDispose)
  expect(disposeMaterial).toHaveBeenCalledTimes(materialsAfterFirstDispose)
})

it('freezes static clone matrices and refreshes hover clone matrices after lift', () => {
  const { pipeline, meshes, renderer, scene, camera } = fixture()
  pipeline.setSize(680, 680, 2)
  pipeline.setConfig({
    ...configWith(),
    hover: { ...MAP_EFFECT_DEFAULTS.hover, glowWidth: 54, glowStrength: 0.23 }
  })
  pipeline.setRegionProgress(meshes[0], 0.5)
  pipeline.render(scene, camera)
  const staticMaskScene = vi.mocked(renderer.render).mock.calls[0][0] as THREE.Scene
  const initialStaticMatrix = staticMaskScene.children[0].matrix.clone()

  meshes[0].position.y = 2
  meshes[0].updateMatrixWorld(true)
  pipeline.setRegionProgress(meshes[0], 0.75)
  vi.mocked(renderer.render).mockClear()
  pipeline.render(scene, camera)
  const hoverMaskScene = vi.mocked(renderer.render).mock.calls[0][0] as THREE.Scene
  expect(hoverMaskScene.children[0].matrix.equals(meshes[0].matrixWorld)).toBe(true)
  expect(staticMaskScene.children[0].matrix.equals(initialStaticMatrix)).toBe(true)
})
```

- [ ] **Step 3: 运行测试，确认模块不存在**

Run: `npm test -- src/components/map/mapOutwardGlowPipeline.test.ts`

Expected: FAIL，包含模块无法解析。

- [ ] **Step 4: 创建遮罩副本和共享资源**

实现结构：

```ts
const GLOW_TARGET_SCALE = 0.5

export interface MapOutwardGlowPipeline {
  setSize(cssWidth: number, cssHeight: number, pixelRatio: number): void
  setConfig(config: MapEffectConfig): void
  setRegionProgress(source: THREE.Mesh, easedProgress: number): void
  markCameraDirty(): void
  render(mainScene: THREE.Scene, camera: THREE.Camera): void
  dispose(): void
}
```

`setSize` 调用 `computeGlowTargetMetrics(cssWidth, cssHeight, pixelRatio, GLOW_TARGET_SCALE)`；Task 7 的性能降级只修改这一常量。

- 静态 mask scene 为每个 source mesh 创建共享 geometry 的 `THREE.Mesh`，使用白色 `MeshBasicMaterial`，在构造时复制 source `matrixWorld` 并设置 `matrixAutoUpdate = false`。
- hover mask scene 为每个 source mesh 创建独立灰度 `MeshBasicMaterial`；`setRegionProgress` 把 RGB 同时设为 easedProgress，0 时隐藏 clone，非 0 时复制 source 最新 `matrixWorld`。
- 不 dispose source geometry；只 dispose 管线拥有的 mask materials、RenderTargets、Shader resources。
- RenderTargets 使用 `LinearFilter`、`RGBAFormat`、`depthBuffer: false`、`stencilBuffer: false`。

- [ ] **Step 5: 实现 dirty 状态和配置更新**

内部状态至少包含：

```ts
let staticMaskDirty = true
let staticBlurDirty = true
let hoverMaskDirty = true
let hoverBlurDirty = true
let disposed = false
```

规则：

- `setSize` 改变尺寸时 resize 全部 target，四个 dirty 均为 true。
- `markCameraDirty` 设置四个 dirty 为 true。
- 常态/hover radius 改变只设置对应 blur dirty。
- color/opacity 改变不设置 mask 或 blur dirty。
- `setRegionProgress` 只有值或 matrix 改变时设置 hover mask/blur dirty。
- 所有 hover progress ≤0.001 时 hover channel disabled。

- [ ] **Step 6: 实现渲染顺序与状态恢复**

`render` 必须：

1. 保存 `renderer.getRenderTarget()` 和 `renderer.autoClear`。
2. 仅对 enabled 且 dirty 的通道渲染 mask，并调用 Task 4 的 near 2-pass、far 4-pass 模糊。
3. 设置 screen target，清理主画面并调用 `renderer.render(mainScene, camera)` 一次。
4. 依次调用常态、hover outward composite；composite 不清屏。
5. `finally` 恢复原 render target 和 autoClear。

`deriveB3GlowProfile` 的 near/far opacity 直接传给 composite；hover 灰度遮罩已经包含各区块 eased progress，不再额外乘统一 progress。

- [ ] **Step 7: 运行聚焦与全量测试**

Run:

```bash
npm test -- src/components/map/mapOutwardGlowProfile.test.ts \
  src/components/map/mapOutwardGlowShaders.test.ts \
  src/components/map/mapOutwardGlowPipeline.test.ts
npm test
npm run typecheck
```

Expected: 所有测试 PASS；全量测试无回归；类型检查退出码 0。

- [ ] **Step 8: 提交并执行双阶段审查**

```bash
git add src/components/map/mapOutwardGlowPipeline.ts src/components/map/mapOutwardGlowPipeline.test.ts
git commit -m "feat(map): build shared outward glow pipeline"
```

Review gate: 规格审查逐项核对外侧裁切、常态/hover 独立、dirty 和零值短路；质量审查重点检查 renderer 状态恢复、矩阵同步、资源所有权和重复 dispose。

---

### Task 6: 接入 ChongqingMap3D 渲染循环和 hover 动画

**Files:**
- Modify: `src/components/map/ChongqingMap3D.vue`
- Modify: `src/components/map/ChongqingMap3D.test.ts`

**Interfaces:**
- Consumes: `createMapOutwardGlowPipeline(renderer, regionMeshes)`。
- Consumes: Task 5 的 `setSize`、`setConfig`、`setRegionProgress`、`markCameraDirty`、`render`、`dispose`。
- Preserves: OrbitControls、tooltip、raycast、6px 点击阈值、材质 hover、lift、FPS HUD 和异步清理。

- [ ] **Step 1: 扩展组件 mock 并写失败接线测试**

在 `ChongqingMap3D.test.ts` mock `./mapOutwardGlowPipeline`：

```ts
const pipelineMocks = vi.hoisted(() => ({
  create: vi.fn(),
  instance: {
    setSize: vi.fn(),
    setConfig: vi.fn(),
    setRegionProgress: vi.fn(),
    markCameraDirty: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn()
  }
}))

vi.mock('./mapOutwardGlowPipeline', () => ({
  createMapOutwardGlowPipeline: pipelineMocks.create
}))

async function mountInitializedMap() {
  let resizeCallback: ResizeObserverCallback = () => undefined
  let frameCallback: FrameRequestCallback = () => undefined
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(680)
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(680)
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: ResizeObserverCallback) { resizeCallback = callback }
    observe = vi.fn()
    disconnect = vi.fn()
  })
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
    frameCallback = callback
    return 1
  }))
  const renderer = {
    domElement: document.createElement('canvas'),
    setSize: vi.fn(),
    setPixelRatio: vi.fn(),
    getPixelRatio: vi.fn(() => 2),
    render: vi.fn(),
    dispose: vi.fn()
  }
  threeMocks.createRenderer.mockReturnValue(renderer)
  pipelineMocks.create.mockReturnValue(pipelineMocks.instance)
  vi.mocked(fetch).mockResolvedValue({
    ok: true,
    status: 200,
    text: vi.fn().mockResolvedValue('<svg/>')
  } as unknown as Response)
  apiMocks.getDistrictMapData.mockResolvedValue([])
  geometryMocks.parseSvgRegions.mockReturnValue([{
    name: '渝中区',
    outers: [{ ring: [[0, 0], [100, 0], [0, 100]], holes: [] }]
  }])
  const texture = new THREE.Texture(document.createElement('img'))
  texture.image.width = 100
  texture.image.height = 100
  vi.mocked(THREE.TextureLoader.prototype.loadAsync).mockResolvedValue(texture)

  const { default: ChongqingMap3D } = await import('./ChongqingMap3D.vue')
  const root = document.createElement('div')
  const app = createApp(ChongqingMap3D)
  app.mount(root)
  await vi.waitFor(() => expect(requestAnimationFrame).toHaveBeenCalled())
  return {
    app,
    renderer,
    runFrame: (now = 16) => frameCallback(now),
    runResize: () => resizeCallback([], {} as ResizeObserver)
  }
}

it('wires config, camera, resize, render, and dispose to the pipeline', async () => {
  const mounted = await mountInitializedMap()
  expect(pipelineMocks.create).toHaveBeenCalledWith(
    mounted.renderer,
    expect.arrayContaining([expect.any(THREE.Mesh)])
  )
  const [, apply] = watchMapEffectConfig.mock.calls[0]
  apply()
  expect(pipelineMocks.instance.setConfig).toHaveBeenCalledWith(expect.any(Object))
  sceneSetupMocks.controlListeners.get('change')?.()
  expect(pipelineMocks.instance.markCameraDirty).toHaveBeenCalled()
  mounted.runResize()
  expect(pipelineMocks.instance.setSize).toHaveBeenLastCalledWith(680, 680, 2)
  mounted.runFrame()
  expect(pipelineMocks.instance.render)
    .toHaveBeenCalledWith(expect.any(THREE.Scene), expect.any(THREE.Camera))
  mounted.app.unmount()
  expect(pipelineMocks.instance.dispose).toHaveBeenCalledTimes(1)
})
```

把现有 OrbitControls mock 的 `addEventListener` 改为把 callback 保存到 `sceneSetupMocks.controlListeners: Map<string, () => void>`，`afterEach` 清空该 Map。

- [ ] **Step 2: 写 hover 进度和失败降级测试**

新增测试：

```ts
it('forwards each region eased progress to the outward glow pipeline', async () => {
  const mounted = await mountInitializedMap()
  const [, apply] = watchMapEffectConfig.mock.calls[0]
  apply()
  expect(pipelineMocks.instance.setRegionProgress)
    .toHaveBeenCalledWith(expect.any(THREE.Mesh), expect.any(Number))
  mounted.app.unmount()
})

it('keeps direct scene rendering when the glow pipeline cannot initialize', async () => {
  pipelineMocks.create.mockImplementationOnce(() => { throw new Error('shader unavailable') })
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  const mounted = await mountInitializedMap()
  mounted.runFrame()
  expect(console.warn).toHaveBeenCalledWith(
    '外扩柔光初始化失败，保留清晰边界',
    expect.any(Error)
  )
  expect(mounted.renderer.render)
    .toHaveBeenCalledWith(expect.any(THREE.Scene), expect.any(THREE.Camera))
  expect(warn).toHaveBeenCalledTimes(1)
  mounted.app.unmount()
})
```

- [ ] **Step 3: 运行组件测试确认失败**

Run: `npm test -- src/components/map/ChongqingMap3D.test.ts`

Expected: FAIL，因为组件尚未创建或调用 outward pipeline。

- [ ] **Step 4: 创建并配置管线**

在模块状态增加：

```ts
let outwardGlow: MapOutwardGlowPipeline | null = null
```

在 `setupScene` 中，scene 添加 mapGroup 并更新 matrix world 后：

```ts
try {
  mapGroup.updateMatrixWorld(true)
  outwardGlow = createMapOutwardGlowPipeline(renderer, regionMeshes)
  outwardGlow.setSize(el.clientWidth, el.clientHeight, renderer.getPixelRatio())
  outwardGlow.setConfig(effect)
} catch (cause) {
  outwardGlow = null
  console.warn('外扩柔光初始化失败，保留清晰边界', cause)
}
```

确保失败不进入 setupScene 外层 catch，不触发整张地图 cleanup。

- [ ] **Step 5: 同步配置、相机、Resize 和 hover**

- `applyEffectConfig()` 在清晰线更新后调用 `outwardGlow?.setConfig(effect)`。
- OrbitControls change callback 在同步 cameraView 后调用 `outwardGlow?.markCameraDirty()`。
- Resize 顺序固定为：`renderer.setSize` → `updatePixelRatio` → `outwardGlow.setSize(...renderer.getPixelRatio())` → camera projection；不得用 resize 前 pixel ratio。
- `renderRegionVisual` 在设置 lift/material/core 后调用 `outwardGlow?.setRegionProgress(visual.mesh, eased)`。
- 当 pipeline 在区块创建之后才初始化时，`applyEffectConfig()` 的 force-render 循环负责把当前所有 progress 同步进去。

- [ ] **Step 6: 替换渲染与清理路径**

渲染循环使用：

```ts
if (renderer && scene && camera) {
  if (outwardGlow) outwardGlow.render(scene, camera)
  else renderer.render(scene, camera)
}
```

`cleanupScene` 在 renderer dispose 前执行：

```ts
outwardGlow?.dispose()
outwardGlow = null
```

部分 setup 失败、正常 unmount 和异步取消都不得重复 dispose。

- [ ] **Step 7: 运行组件、全量测试、类型检查和构建**

Run:

```bash
npm test -- src/components/map/ChongqingMap3D.test.ts
npm test
npm run typecheck
npm run build
git diff --check
```

Expected: 全部测试 PASS；类型检查和生产构建退出码 0；只有既有 chunk-size warning；diff check 无输出。

- [ ] **Step 8: 提交并执行双阶段审查**

```bash
git add src/components/map/ChongqingMap3D.vue src/components/map/ChongqingMap3D.test.ts
git commit -m "feat(map): render static and hover outward glow"
```

Review gate: 规格审查确认所有现有交互和降级行为；质量审查重点检查初始化发布顺序、异步取消、Resize 顺序、RAF 与资源释放。

---

### Task 7: 真实页面视觉与性能验收

**Files:**
- Modify only if a verified defect requires it: files owned by Tasks 1–6 and their matching tests.
- Do not modify: `MAP_EFFECT_DEFAULTS` values in `src/components/map/mapEffectConfig.ts`。

**Interfaces:**
- Consumes: 调试抽屉实时参数和复制 JSON。
- Produces: 浏览器验证证据、性能记录和最终 clean worktree。

- [ ] **Step 1: 运行完整自动验证基线**

Run:

```bash
npm test
npm run typecheck
npm run build
git diff --check
```

Expected: 全部测试 PASS；typecheck/build 退出码 0；仅允许既有 bundle-size warning。

- [ ] **Step 2: 从目标 worktree 重启 LAN 服务**

先检查并停止 4173 的旧 listener，再从当前 worktree 启动：

```bash
npm run dev -- --host 0.0.0.0 --port 4173
```

验证：

```bash
lsof -nP -iTCP:4173 -sTCP:LISTEN
curl -I http://127.0.0.1:4173/
curl -I http://192.168.1.149:4173/
```

Expected: listener 为当前 worktree 的 Vite 进程，监听 `*:4173`；两个 URL 都返回 HTTP 200。

- [ ] **Step 3: 验证常态 B3 参考值**

在 `http://192.168.1.149:4173/#/` 打开“地图调试 → 效果”，临时设置：

```json
{
  "outerGlowWidth": 54,
  "outerGlowStrength": 0.23
}
```

检查：亮芯仍为 2px；扩散主要在外侧；远端尾光明显；地图内部没有同强度泛白；把半径 20→60 只扩大范围，把透明度 0.1→0.4 只改变强度。

- [ ] **Step 4: 验证 hover B3、动画和交互**

临时设置：

```json
{
  "glowWidth": 54,
  "glowStrength": 0.23
}
```

依次 hover 至少三个相邻区块并快速切换，检查进入/离开时长生效、旧区块平滑消失、新区块平滑出现、无残影；tooltip、抬升、材质高亮、拖拽旋转、点击下钻保持正常。

- [ ] **Step 5: 验证像素稳定、透明背景和性能**

- 使用 OrbitControls 拉近/拉远并旋转，柔光在屏幕上的扩散宽度保持约 54 px。
- 改变浏览器窗口尺寸和系统 DPR 可用档位，Resize 后无拉伸或偏移。
- 检查画布外透明背景、页面面板、内部区界、标记不被带入辉光。
- 观察 HUD：常态 ≥55 FPS，连续 hover ≥50 FPS。
- 若未达标，把 `GLOW_TARGET_SCALE` 从 0.5 降为 0.25，补充 profile 测试证明 CSS px 换算不变，再重新执行本任务全部验收。

- [ ] **Step 6: 验证复制/重载和默认值边界**

复制 JSON，刷新页面并确认临时参数从 localStorage 恢复且视觉一致。随后点击“恢复默认值”，确认四个辉光半径/透明度仍回到已批准的 0；本任务不提交 54/0.23 为默认值。

- [ ] **Step 7: 检查控制台和最终仓库状态**

浏览器控制台不得有持续 error；允许在主动模拟 Shader 初始化失败时出现一次指定 warning。运行：

```bash
npm test
npm run typecheck
npm run build
git diff --check
git status --short
```

Expected: 自动验证全部通过；工作区只允许计划外明确保留的 `.superpowers/` 对照目录，不允许未提交源码改动。

- [ ] **Step 8: 对验收修复执行双阶段终审并提交**

若 Task 7 未产生修复，不创建空提交。若产生修复：

```bash
git add -u -- src/components/map src/components/debug
git commit -m "fix(map): polish outward glow rendering"
```

终审必须覆盖从 Task 1 前一提交到当前 HEAD 的完整 diff，先做规格符合性审查，再做代码质量审查；两阶段均无 Critical/Important 后才交付。

## Final Verification Checklist

- [ ] `MAP_EFFECT_DEFAULTS` 与用户此前确认的 JSON 完全一致，四个辉光数值仍为 0。
- [ ] 常态外圈和 hover 区块都使用真实遮罩模糊，不存在 `outerNear` / `outerFar` / hover 宽线伪辉光。
- [ ] B3 profile 为 near radius 35%、near opacity 83%、far radius/opacity 100%。
- [ ] CSS px 在 DPR、ScaleScreen、半/四分之一缓冲下换算正确。
- [ ] 半径与透明度可独立调整，0 值短路真实执行。
- [ ] 主场景只渲染一次，composite 不清屏，renderer 状态在异常时也恢复。
- [ ] 常态和多个渐变中的 hover 区块正确组合且不残留。
- [ ] Shader 失败只关闭柔光，所有原有地图功能继续工作。
- [ ] 新增 WebGL 资源在 unmount 时释放且不重复释放 source geometry。
- [ ] 完整测试、typecheck、build、diff check、LAN 页面和双阶段终审全部通过。
