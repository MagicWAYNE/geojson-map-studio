# Map Inward Glow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有屏幕空间外扩柔光管线上增加常态与 hover 独立的内扩双层底光和向内传播波，并提供完整的 v3 配置迁移、调试控制与运行状态。

**Architecture:** 静态/hover 内扩分别复用现有两张遮罩，新增四张 near/far 缓存纹理，并通过独立 inward composite shader 将能量严格裁切在遮罩内部。传播数学、内扩配置和内扩控件拆成独立单元；现有管线负责缓存、渲染顺序、hover 相位重置和统一降级。

**Tech Stack:** Vue 3、TypeScript、Three.js/WebGL GLSL、Vitest、Vite

## Global Constraints

- 配置升级为 `version: 3`，当前存储键必须为 `cq-map-effect-config-v3`。
- 旧 `cq-map-effect-config-v1`、`cq-map-effect-config-v2` 不删除；后续只写 v3。
- 合法 v2/v1 自定义字段必须保留并补入内扩默认值；损坏 v3 不回退旧缓存。
- 常态与 hover 内扩参数完全独立，并可与现有外扩同时启用。
- 常态默认颜色 `#ffffff`、宽度 `48`、透明度 `0.18`；hover 默认颜色 `#d8f5ff`、宽度 `64`、透明度 `0.22`。
- 常态和 hover 内扩默认开启；稳定底光与向内传播波默认同时开启。
- 内扩覆盖顶面和当前相机可见侧壁，遮罩外 alpha 恒为 `0`。
- 宽度保持屏幕 CSS 像素恒定，不随相机缩放变化。
- hover 每次进入区域时传播相位重置为 `0`，离开跟随现有 `leaveMs` 淡出。
- wave 相位变化只更新 composite uniform，不得重建 mask 或 blur。
- 不实现 SDF/JFA，不修改地图数据、相机默认值、布局默认值或现有边线宽度。
- 屏幕空间柔光任一步骤失败时执行现有统一降级，保留地图、边线和基础 hover，并只告警一次。
- 不提交 `.ssh/`、`.superpowers/` 或 `output/`。

---

## File Structure

- Create `src/components/map/mapInwardGlowConfig.ts`: 内扩配置类型、B1 默认值、深克隆/原位赋值和归一化。
- Create `src/components/map/mapInwardGlowConfig.test.ts`: 内扩默认值、范围、非法值和嵌套身份测试。
- Modify `src/components/map/mapEffectConfig.ts`: v3 顶层 schema、v1/v2 迁移、v3 存储和完整深拷贝。
- Modify `src/components/map/mapEffectConfig.test.ts`: v3 canonical defaults、迁移优先级和损坏缓存测试。
- Modify `src/composables/useMapDebug.ts`: 深层 watch/reset、v3 持久化和扩展运行状态。
- Modify `src/composables/useMapDebug.test.ts`: 嵌套身份稳定、写入收敛和运行状态测试。
- Create `src/components/map/mapInwardGlowMotion.ts`: easing、delay、循环 phase 和 hover reset 所需纯函数。
- Create `src/components/map/mapInwardGlowMotion.test.ts`: 确定性时间测试。
- Create `src/components/map/mapInwardGlowShaders.ts`: inward composite shader、uniform 绑定、有限值保护和释放。
- Create `src/components/map/mapInwardGlowShaders.test.ts`: 内部裁切公式、传播 uniform、异常输入和释放测试。
- Modify `src/components/map/mapOutwardGlowPipeline.ts`: 四通道目标、缓存、dirty rule、时间与状态。
- Modify `src/components/map/mapOutwardGlowPipeline.test.ts`: 内外共存、遮罩复用、相位重置、资源和渲染顺序。
- Modify `src/components/map/ChongqingMap3D.vue`: 帧时间转发、扩展状态发布和统一降级接线。
- Modify `src/components/map/ChongqingMap3D.test.ts`: 帧时间、hover reset、状态与降级集成测试。
- Create `src/components/debug/MapInwardGlowControls.vue`: 一组内扩通道的完整控件、B1 预设与分组重置。
- Create `src/components/debug/MapInwardGlowControls.test.ts`: 控件范围、草稿更新和预设/重置。
- Modify `src/components/debug/MapEffectControls.vue`: 两组内扩控件、深草稿、状态和性能提示。
- Modify `src/components/debug/MapEffectControls.test.ts`: v3 草稿隔离、复制、应用/撤销和全部重置。

---

### Task 1: 内扩配置独立模块

**Files:**
- Create: `src/components/map/mapInwardGlowConfig.ts`
- Create: `src/components/map/mapInwardGlowConfig.test.ts`

**Interfaces:**
- Produces: `InwardWaveEasing`、`MapInwardWaveConfig`、`MapInwardGlowConfig`、`BASE_INWARD_GLOW_DEFAULTS`、`HOVER_INWARD_GLOW_DEFAULTS`、`cloneInwardGlowConfig()`、`assignInwardGlowConfig()`、`normalizeInwardGlowConfig()`。
- Consumes: 无项目内依赖；该模块不能导入 `mapEffectConfig.ts`，避免循环依赖。

- [ ] **Step 1: 写默认值与深层身份的失败测试**

```ts
import { describe, expect, it } from 'vitest'
import {
  BASE_INWARD_GLOW_DEFAULTS,
  HOVER_INWARD_GLOW_DEFAULTS,
  cloneInwardGlowConfig
} from './mapInwardGlowConfig'

it('exports the exact B1 base and hover defaults', () => {
  expect(BASE_INWARD_GLOW_DEFAULTS).toEqual({
    enabled: true, color: '#ffffff', width: 48, strength: 0.18, maxAlpha: 0.5,
    nearRadiusRatio: 0.35, nearOpacityRatio: 0.83,
    farRadiusRatio: 1, farOpacityRatio: 1,
    falloff: 1, edgeSoftness: 0.96, nearPasses: 2, farPasses: 4,
    baseRatio: 0.7,
    wave: {
      enabled: true, widthRatio: 0.24, strength: 0.45,
      periodMs: 3600, delayMs: 0, travelRatio: 1,
      decay: 0.65, easing: 'ease-out'
    }
  })
  expect(HOVER_INWARD_GLOW_DEFAULTS).toMatchObject({
    enabled: true, color: '#d8f5ff', width: 64, strength: 0.22,
    maxAlpha: 0.6, baseRatio: 0.6,
    wave: { widthRatio: 0.22, strength: 0.65, periodMs: 1400, decay: 0.55 }
  })
})

it('deep-clones inward glow and wave objects', () => {
  const a = cloneInwardGlowConfig(BASE_INWARD_GLOW_DEFAULTS)
  const b = cloneInwardGlowConfig(BASE_INWARD_GLOW_DEFAULTS)
  expect(a).not.toBe(b)
  expect(a.wave).not.toBe(b.wave)
  a.wave.periodMs = 999
  expect(b.wave.periodMs).toBe(3600)
})
```

- [ ] **Step 2: 运行测试并确认 RED**

Run: `npm test -- src/components/map/mapInwardGlowConfig.test.ts`

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现类型、冻结默认值和深层复制/原位赋值**

```ts
export type InwardWaveEasing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'

export interface MapInwardWaveConfig {
  enabled: boolean
  widthRatio: number
  strength: number
  periodMs: number
  delayMs: number
  travelRatio: number
  decay: number
  easing: InwardWaveEasing
}

export interface MapInwardGlowConfig {
  enabled: boolean
  color: string
  width: number
  strength: number
  maxAlpha: number
  nearRadiusRatio: number
  nearOpacityRatio: number
  farRadiusRatio: number
  farOpacityRatio: number
  falloff: number
  edgeSoftness: number
  nearPasses: number
  farPasses: number
  baseRatio: number
  wave: MapInwardWaveConfig
}

export function cloneInwardGlowConfig(value: Readonly<MapInwardGlowConfig>): MapInwardGlowConfig {
  return { ...value, wave: { ...value.wave } }
}

export function assignInwardGlowConfig(
  target: MapInwardGlowConfig,
  source: Readonly<MapInwardGlowConfig>
): void {
  const wave = target.wave
  Object.assign(target, source)
  target.wave = wave
  Object.assign(wave, source.wave)
}
```

冻结两个默认对象时必须先冻结 `wave`，再冻结父对象。

- [ ] **Step 4: 写范围和非法值的失败测试**

```ts
it('normalizes every numeric range and invalid easing', () => {
  const value = normalizeInwardGlowConfig({
    color: '#ABCDEF', width: 999, strength: -1, maxAlpha: 2,
    nearRadiusRatio: 9, nearOpacityRatio: 9,
    farRadiusRatio: 0, farOpacityRatio: -1,
    falloff: 9, edgeSoftness: -1,
    nearPasses: 2.6, farPasses: 99, baseRatio: 2,
    wave: {
      enabled: true, widthRatio: 2, strength: 3,
      periodMs: 1, delayMs: 99999, travelRatio: 0,
      decay: 9, easing: 'bounce'
    }
  }, BASE_INWARD_GLOW_DEFAULTS)
  expect(value).toMatchObject({
    color: '#abcdef', width: 200, strength: 0, maxAlpha: 1,
    nearRadiusRatio: 1.5, nearOpacityRatio: 2,
    farRadiusRatio: 0.25, farOpacityRatio: 0,
    falloff: 4, edgeSoftness: 0,
    nearPasses: 3, farPasses: 8, baseRatio: 1,
    wave: {
      widthRatio: 1, strength: 2, periodMs: 250,
      delayMs: 5000, travelRatio: 0.25,
      decay: 4, easing: 'ease-out'
    }
  })
})
```

- [ ] **Step 5: 实现归一化并确认 GREEN**

实现 `normalizeInwardGlowConfig(value: unknown, defaults: Readonly<MapInwardGlowConfig>)`，严格使用规格中的范围、`#rrggbb` 颜色和四个 easing 枚举；非有限值回退默认值，passes 先裁切再四舍五入。

Run: `npm test -- src/components/map/mapInwardGlowConfig.test.ts`

Expected: PASS，默认值、深克隆、原位赋值、范围和非法值测试全部通过。

- [ ] **Step 6: 提交**

```bash
git add src/components/map/mapInwardGlowConfig.ts src/components/map/mapInwardGlowConfig.test.ts
git commit -m "feat(map): add inward glow configuration model"
```

---

### Task 2: v3 顶层配置、迁移和响应式持久化

**Files:**
- Modify: `src/components/map/mapEffectConfig.ts`
- Modify: `src/components/map/mapEffectConfig.test.ts`
- Modify: `src/composables/useMapDebug.ts`
- Modify: `src/composables/useMapDebug.test.ts`

**Interfaces:**
- Consumes: Task 1 的 `MapInwardGlowConfig`、默认值、clone/assign/normalize。
- Produces: `MapEffectConfig` version 3、`MAP_EFFECT_STORAGE_KEY_V2`、`cloneMapEffectConfig()`、`assignMapEffectConfig()`；后续所有任务只使用 v3 类型。

- [ ] **Step 1: 将 canonical defaults 测试升级到完整 v3**

修改测试常量为：

```ts
const V3_DEFAULTS = {
  version: 3,
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
    outerGlowFarPasses: 4,
    inwardGlow: BASE_INWARD_GLOW_DEFAULTS
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
    leaveMs: 300,
    inwardGlow: HOVER_INWARD_GLOW_DEFAULTS
  },
  quality: { renderScale: 0.5, maxAlpha: 1 }
} as const
```

断言：

```ts
expect(MAP_EFFECT_STORAGE_KEY).toBe('cq-map-effect-config-v3')
expect(MAP_EFFECT_STORAGE_KEY_V2).toBe('cq-map-effect-config-v2')
expect(MAP_EFFECT_STORAGE_KEY_V1).toBe('cq-map-effect-config-v1')
expect(MAP_EFFECT_DEFAULTS).toEqual(V3_DEFAULTS)
```

- [ ] **Step 2: 增加 v2/v1 迁移和损坏 v3 优先级测试**

```ts
it('preserves custom v2 fields and fills v3 inward defaults', () => {
  const customV2 = { ...V2_DEFAULTS, base: { ...V2_DEFAULTS.base, outerGlowWidth: 91 } }
  expect(loadMapEffectConfig({
    getItem: (key) => key === MAP_EFFECT_STORAGE_KEY_V2 ? JSON.stringify(customV2) : null
  })).toEqual({
    version: 3,
    base: { ...customV2.base, inwardGlow: BASE_INWARD_GLOW_DEFAULTS },
    hover: { ...customV2.hover, inwardGlow: HOVER_INWARD_GLOW_DEFAULTS },
    quality: customV2.quality
  })
})

it('does not fall back to v2 when v3 exists but is broken', () => {
  expect(loadMapEffectConfig({
    getItem: (key) => key === MAP_EFFECT_STORAGE_KEY
      ? '{broken-v3'
      : key === MAP_EFFECT_STORAGE_KEY_V2
        ? JSON.stringify(V2_DEFAULTS)
        : null
  })).toEqual(V3_DEFAULTS)
})
```

保留现有两代已知 v1 默认迁移和自定义 v1 测试，并将期望改为 v3。

- [ ] **Step 3: 运行聚焦测试并确认 RED**

Run: `npm test -- src/components/map/mapEffectConfig.test.ts src/composables/useMapDebug.test.ts`

Expected: FAIL，当前仍导出 version 2、v2 存储键且缺少嵌套内扩对象。

- [ ] **Step 4: 实现 v3 schema、深克隆和迁移优先级**

```ts
export interface MapEffectBaseConfigV3 extends MapEffectBaseConfigV2 {
  inwardGlow: MapInwardGlowConfig
}

export interface MapEffectHoverConfigV3 extends MapEffectHoverConfigV2 {
  inwardGlow: MapInwardGlowConfig
}

export interface MapEffectConfig {
  version: 3
  base: MapEffectBaseConfigV3
  hover: MapEffectHoverConfigV3
  quality: MapEffectQualityConfig
}

export const MAP_EFFECT_STORAGE_KEY = 'cq-map-effect-config-v3'
export const MAP_EFFECT_STORAGE_KEY_V2 = 'cq-map-effect-config-v2'
```

`loadMapEffectConfig()` 必须先读取 v3 原始字符串；只要 v3 key 存在，解析失败就返回 v3 defaults。仅当 v3 key 缺失时读取 v2，再缺失时读取 v1。

导出：

```ts
export function cloneMapEffectConfig(config: Readonly<MapEffectConfig>): MapEffectConfig
export function assignMapEffectConfig(target: MapEffectConfig, source: Readonly<MapEffectConfig>): void
```

两者必须深处理 `base.inwardGlow.wave` 和 `hover.inwardGlow.wave`；`assignMapEffectConfig` 保持 root、base、hover、quality、两个 inwardGlow 和两个 wave 的既有身份。

- [ ] **Step 5: 更新 useMapDebug 并验证嵌套身份与写入收敛**

将 watch/reset 改为统一调用 `assignMapEffectConfig()`：

```ts
watch(effect, (value) => {
  const normalized = normalizeMapEffectConfig(value)
  assignMapEffectConfig(effect, normalized)
  saveMapEffectConfig(storage(), normalized)
}, { deep: true })

function resetEffect(): void {
  assignMapEffectConfig(effect, cloneMapEffectConfig(MAP_EFFECT_DEFAULTS))
}
```

测试保存的 key 只能是 v3，并验证模块重载后嵌套 wave 参数恢复、reset 后所有对象身份稳定、连续两个 `nextTick()` 后写入次数不再增长。

- [ ] **Step 6: 运行聚焦测试并确认 GREEN**

Run: `npm test -- src/components/map/mapInwardGlowConfig.test.ts src/components/map/mapEffectConfig.test.ts src/composables/useMapDebug.test.ts`

Expected: PASS，v3 defaults、v1/v2 迁移、损坏 v3、深身份、保存和 reset 全部通过。

- [ ] **Step 7: 提交**

```bash
git add src/components/map/mapEffectConfig.ts src/components/map/mapEffectConfig.test.ts src/composables/useMapDebug.ts src/composables/useMapDebug.test.ts
git commit -m "feat(map): migrate effect settings to v3"
```

---

### Task 3: 传播 easing 与确定性 phase

**Files:**
- Create: `src/components/map/mapInwardGlowMotion.ts`
- Create: `src/components/map/mapInwardGlowMotion.test.ts`

**Interfaces:**
- Consumes: `MapInwardWaveConfig`。
- Produces: `easeInwardWave()`、`computeInwardWavePhase()` 和 `InwardWavePhase`，供管线每帧使用。

- [ ] **Step 1: 写 easing、delay、循环和非法时间测试**

```ts
it.each([
  ['linear', 0.5, 0.5],
  ['ease-in', 0.5, 0.25],
  ['ease-out', 0.5, 0.75],
  ['ease-in-out', 0.25, 0.125]
])('applies %s easing', (easing, input, expected) => {
  expect(easeInwardWave(input, easing as InwardWaveEasing)).toBeCloseTo(expected)
})

it('waits for delay, loops by period, and reports an eased phase', () => {
  const wave = { ...BASE_INWARD_GLOW_DEFAULTS.wave, delayMs: 200, periodMs: 1000 }
  expect(computeInwardWavePhase(1199, 1000, wave)).toEqual({ active: false, phase: 0 })
  expect(computeInwardWavePhase(1700, 1000, wave)).toEqual({ active: true, phase: 0.75 })
  expect(computeInwardWavePhase(2200, 1000, wave)).toEqual({ active: true, phase: 0 })
})
```

- [ ] **Step 2: 运行测试并确认 RED**

Run: `npm test -- src/components/map/mapInwardGlowMotion.test.ts`

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现纯函数**

```ts
export interface InwardWavePhase { active: boolean; phase: number }

export function easeInwardWave(value: number, easing: InwardWaveEasing): number {
  const t = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0
  if (easing === 'ease-in') return t * t
  if (easing === 'ease-out') return 1 - (1 - t) * (1 - t)
  if (easing === 'ease-in-out') return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  return t
}
```

`computeInwardWavePhase(nowMs, startMs, wave)` 对非有限时间返回 inactive；关闭 wave 返回 inactive；delay 未结束返回 inactive；其余使用 `(elapsed - delay) % period / period` 并执行 easing。

- [ ] **Step 4: 运行测试并确认 GREEN，然后提交**

Run: `npm test -- src/components/map/mapInwardGlowMotion.test.ts`

Expected: PASS。

```bash
git add src/components/map/mapInwardGlowMotion.ts src/components/map/mapInwardGlowMotion.test.ts
git commit -m "feat(map): add inward wave timing model"
```

---

### Task 4: 内扩 composite shader

**Files:**
- Create: `src/components/map/mapInwardGlowShaders.ts`
- Create: `src/components/map/mapInwardGlowShaders.test.ts`

**Interfaces:**
- Consumes: Three.js `FullScreenQuad`；near/far 纹理由现有 blur 函数生成。
- Produces: `InwardCompositeInputs`、`InwardGlowShaderResources`、`createInwardGlowShaderResources()`、`renderInwardComposite()`、`disposeInwardGlowShaderResources()`。

- [ ] **Step 1: 写 shader 结构和 uniform 绑定失败测试**

```ts
const inputs: InwardCompositeInputs = {
  mask, near, far, color: '#ffffff',
  nearOpacity: 0.15, farOpacity: 0.18,
  falloff: 1, edgeSoftness: 0.96, maxAlpha: 0.5,
  baseRatio: 0.7, waveActive: true, wavePhase: 0.75,
  waveWidthRatio: 0.24, waveStrength: 0.45,
  waveTravelRatio: 1, waveDecay: 0.65
}
renderInwardComposite(renderer, resources, inputs)
expect(resources.material.uniforms).toMatchObject({
  tMask: { value: mask }, tNear: { value: near }, tFar: { value: far },
  uBaseRatio: { value: 0.7 }, uWavePhase: { value: 0.75 },
  uWaveWidthRatio: { value: 0.24 }, uWaveStrength: { value: 0.45 }
})
```

同时断言 fragment shader 包含：

```glsl
float nearBand = max(mask - nearValue, 0.0);
float farBand = max(mask - farValue, 0.0);
float outsideGuard = step(0.0001, mask);
float alpha = min((baseAlpha + waveAlpha) * outsideGuard, uMaxAlpha);
```

并断言不存在外扩公式 `1.0 - smoothstep(0.5 - halfBand, 0.5 + halfBand, mask)`。

- [ ] **Step 2: 运行测试并确认 RED**

Run: `npm test -- src/components/map/mapInwardGlowShaders.test.ts`

Expected: FAIL，模块不存在。

- [ ] **Step 3: 实现 inward shader 和有限值绑定**

fragment shader 必须：

1. 采样并 clamp `mask/near/far`。
2. 用 `max(mask - blurred, 0)` 得到只在内部存在的 near/far band。
3. 用 `softThreshold = mix(0.0001, 0.25, clamp(uEdgeSoftness, 0.0, 1.0))` 和 `smoothstep(0.0, softThreshold, mask)` 生成内部柔度 gate。
4. 合成稳定底光，执行 falloff 与 baseRatio。
5. 用 `depth = clamp(1.0 - 2.0 * farBand / max(mask, 0.0001), 0.0, 1.0)` 估算边缘深度。
6. 用 `1.0 - smoothstep(0.0, halfWidth, abs(depth - center))` 生成传播波峰。
7. 用 `pow(max(1.0 - center, 0.0), uWaveDecay)` 衰减波峰。
8. 以原始 mask 的非零检测严格阻断地图外输出，并应用内部柔度 gate 和 `uMaxAlpha`。

所有 JS 入口标量按规格范围 finite-clamp；`waveActive=false` 时 wave alpha 为零。

- [ ] **Step 4: 增加异常输入、加法混合和幂等释放测试并确认 GREEN**

断言 material 为 `transparent: true`、`depthTest: false`、`depthWrite: false`、`THREE.AdditiveBlending`；NaN/Infinity 不进入 uniform；重复 dispose 只释放一次。

Run: `npm test -- src/components/map/mapInwardGlowShaders.test.ts`

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/components/map/mapInwardGlowShaders.ts src/components/map/mapInwardGlowShaders.test.ts
git commit -m "feat(map): add inward glow composite shader"
```

---

### Task 5: 四通道缓存与传播管线

**Files:**
- Modify: `src/components/map/mapOutwardGlowPipeline.ts`
- Modify: `src/components/map/mapOutwardGlowPipeline.test.ts`

**Interfaces:**
- Consumes: v3 `MapEffectConfig`、Task 3 phase、Task 4 inward shader、现有 blur/profile/shader。
- Produces: 扩展的 `MapOutwardGlowPipelineStatus`；`render(mainScene, camera, nowMs)` 接受确定性帧时间。

- [ ] **Step 1: 写四通道状态、资源数和共存顺序失败测试**

状态接口期望：

```ts
export interface MapOutwardGlowPipelineStatus {
  targetWidth: number
  targetHeight: number
  renderScale: MapEffectConfig['quality']['renderScale']
  baseState: 'enabled' | 'zero' | 'disabled'
  hoverState: 'ready' | 'active' | 'zero' | 'disabled'
  baseInwardState: 'active' | 'zero' | 'disabled'
  hoverInwardState: 'ready' | 'active' | 'zero' | 'disabled'
  baseWaveActive: boolean
  hoverWaveActive: boolean
}
```

测试同时开启四通道并传入 `render(scene, camera, 1000)`，断言顺序为：outward base、inward base、outward hover、inward hover。构造后 `WebGLRenderTarget` 总数从 7 增为 11，mask scene 仍只有 static/hover 两张。

- [ ] **Step 2: 运行聚焦测试并确认 RED**

Run: `npm test -- src/components/map/mapOutwardGlowPipeline.test.ts`

Expected: FAIL，缺少 inward 状态、四张 target 和 inward composite 调用。

- [ ] **Step 3: 增加 inward channel/target/cache 数据结构**

```ts
interface InwardChannelTargets {
  near: THREE.WebGLRenderTarget
  far: THREE.WebGLRenderTarget
}

interface CachedInwardChannel {
  profileSignature: string
  profile: GlowProfile
  composite: InwardCompositeInputs
}
```

常态 inward 使用 `staticTargets.mask.texture`，hover inward 使用 `hoverTargets.mask.texture`。新增 target 只能是两组 near/far，继续共用现有 `pingTarget`。

`snapshotConfig()` 必须改用 `cloneMapEffectConfig()`，不能浅拷贝 inward/wave。

- [ ] **Step 4: 实现 inward dirty rule 和共享 mask 调度**

mask 是否绘制由同状态的 outward 或 inward 任一有效通道决定。inward blur signature 仅包含 `width`、near/far radius ratio 和 passes；颜色、透明度、maxAlpha、falloff、softness、baseRatio 和 wave 只刷新 composite。

相机/viewport/DPR/renderScale 改变使共享 mask 与所有依赖 blur 失效；hover progress/world matrix 只使 hover mask、hover outward blur、hover inward blur 失效。

- [ ] **Step 5: 实现时间、hover reset 与 render 顺序**

接口改为：

```ts
render(mainScene: THREE.Scene, camera: THREE.Camera, nowMs: number): void
```

管线保存 `baseWaveStartMs`、`hoverWaveStartMs` 和 `hoverWaveResetPending`。首次有效 render 初始化 base start；任意 region 从不可见变为可见时设置 reset pending；下一次 render 用该帧 `nowMs` 重置 hover start。phase 变化只刷新 inward composite 的 wave uniform。

渲染顺序严格为：共享 static mask/各 blur → 共享 hover mask/各 blur → main scene → base outward → base inward → hover outward → hover inward。

- [ ] **Step 6: 增加缓存与动画回归测试**

覆盖：

- wave 时间前进时 mask render 和 blur 调用数不增加，只有 inward composite phase 变化。
- base/hover inward 的 width 变化只重建对应 inward near/far。
- inward color/baseRatio/wave 参数变化不重建 blur。
- outer disabled + inward enabled 仍绘制共享 mask。
- inward disabled + outer enabled 不执行 inward blur/composite。
- hover 进入 A、离开 A、进入 B 时 phase 都从 `0` 开始。
- resize 后 11 张 target 尺寸正确；dispose 释放 11 张 target、两套 shader 资源且不释放来源 geometry。
- 构造期 inward shader 分配失败释放已分配资源。

- [ ] **Step 7: 运行聚焦测试、类型检查并提交**

Run: `npm test -- src/components/map/mapInwardGlowMotion.test.ts src/components/map/mapInwardGlowShaders.test.ts src/components/map/mapOutwardGlowPipeline.test.ts`

Expected: PASS。

Run: `npm run typecheck`

Expected: PASS。

```bash
git add src/components/map/mapOutwardGlowPipeline.ts src/components/map/mapOutwardGlowPipeline.test.ts
git commit -m "feat(map): add inward channels to glow pipeline"
```

---

### Task 6: 3D 地图运行时接线与统一降级

**Files:**
- Modify: `src/components/map/ChongqingMap3D.vue`
- Modify: `src/components/map/ChongqingMap3D.test.ts`
- Modify: `src/composables/useMapDebug.ts`
- Modify: `src/composables/useMapDebug.test.ts`

**Interfaces:**
- Consumes: Task 5 的扩展 pipeline/status 和 `render(mainScene, camera, nowMs)`。
- Produces: 帧时间转发、扩展状态发布、默认 runtime status 和既有一次性降级行为。

- [ ] **Step 1: 写帧时间与扩展状态失败测试**

在组件测试中运行 `runFrame(1250)`，断言：

```ts
expect(pipelineMocks.instance.render)
  .toHaveBeenCalledWith(expect.any(THREE.Scene), expect.any(THREE.Camera), 1250)
expect(mapDebugMocks.updateEffectRuntimeStatus).toHaveBeenCalledWith({
  targetWidth: 680, targetHeight: 680, renderScale: 0.5,
  baseState: 'enabled', hoverState: 'disabled',
  baseInwardState: 'active', hoverInwardState: 'ready',
  baseWaveActive: true, hoverWaveActive: false,
  degraded: false
})
```

- [ ] **Step 2: 运行聚焦测试并确认 RED**

Run: `npm test -- src/components/map/ChongqingMap3D.test.ts src/composables/useMapDebug.test.ts`

Expected: FAIL，render 尚未接收 nowMs，runtime status 缺少 inward/wave 字段。

- [ ] **Step 3: 更新 runtime status 默认值、去重比较和 render 接线**

`DEFAULT_MAP_EFFECT_RUNTIME_STATUS` 使用 v3 默认语义：base outward enabled、hover outward disabled、base inward active、hover inward ready、base wave active、hover wave inactive。

`sameEffectRuntimeStatus()` 比较所有新增字段。`loop(now)` 将同一个 RAF 时间传入 `renderGlowFrame(scene, camera, now)`，再由包装函数传入 pipeline。

- [ ] **Step 4: 验证 hover reset、侧壁遮罩和异常降级**

组件测试使用真实 extrude mesh，确认传给 pipeline 的 source geometry 含顶面与侧壁 groups；快速 pointer move/leave/move 时按顺序转发 progress。让 inward composite mock 抛错，断言 pipeline 只 dispose 一次、当前帧和后续帧直接渲染主 scene、告警一次、状态 `degraded: true`。

- [ ] **Step 5: 运行聚焦测试和类型检查并提交**

Run: `npm test -- src/components/map/ChongqingMap3D.test.ts src/composables/useMapDebug.test.ts`

Expected: PASS。

Run: `npm run typecheck`

Expected: PASS。

```bash
git add src/components/map/ChongqingMap3D.vue src/components/map/ChongqingMap3D.test.ts src/composables/useMapDebug.ts src/composables/useMapDebug.test.ts
git commit -m "feat(map): wire inward glow runtime state"
```

---

### Task 7: 完整内扩调试控件与深草稿

**Files:**
- Create: `src/components/debug/MapInwardGlowControls.vue`
- Create: `src/components/debug/MapInwardGlowControls.test.ts`
- Modify: `src/components/debug/MapEffectControls.vue`
- Modify: `src/components/debug/MapEffectControls.test.ts`

**Interfaces:**
- Consumes: `MapInwardGlowConfig`、base/hover defaults、扩展 runtime status、`cloneMapEffectConfig()`、`assignMapEffectConfig()`。
- Produces: 可复用单通道控件 `modelValue`/`update:modelValue` 接口；父组件渲染常态与 hover 两组。

- [ ] **Step 1: 写子组件控件契约失败测试**

组件 props/emits：

```ts
defineProps<{
  channel: 'base' | 'hover'
  modelValue: MapInwardGlowConfig
  stateLabel: string
}>()
const emit = defineEmits<{
  'update:modelValue': [value: MapInwardGlowConfig]
}>()
```

测试必须查询稳定 id，例如：

```text
effect-base-inward-enabled-checkbox
effect-base-inward-color-color
effect-base-inward-width-number
effect-base-inward-nearPasses-number
effect-base-inward-wave-periodMs-number
effect-base-inward-wave-easing-select
```

逐项断言规格中的 min/max/step：width `0/200/1`、strength `0/1/0.01`、period `250/10000/50`、delay `0/5000/50`、passes `1/8/1`、easing 四项。

- [ ] **Step 2: 运行子组件测试并确认 RED**

Run: `npm test -- src/components/debug/MapInwardGlowControls.test.ts`

Expected: FAIL，组件不存在。

- [ ] **Step 3: 实现子组件、不可变更新、B1 和分组重置**

每次输入先 `cloneInwardGlowConfig(modelValue)`，只修改目标字段，再 emit；不得直接修改 prop。数值输入保留现有“键入草稿、blur/change 时裁切提交”的交互。

“应用 B1 预设”和“重置本组”都 emit 对应 channel 默认值的深克隆；B1 当前等于默认值，但保留独立按钮语义，便于后续默认值变化。

- [ ] **Step 4: 将两组控件接入父级深草稿**

父组件必须使用：

```ts
const draft = reactive<MapEffectConfig>(cloneMapEffectConfig(effect))

function replaceInwardGlow(channel: 'base' | 'hover', value: MapInwardGlowConfig): void {
  assignInwardGlowConfig(editTarget.value[channel].inwardGlow, value)
}

function applyDraft(): void {
  assignMapEffectConfig(effect, normalizeMapEffectConfig(draft))
}
```

渲染“常态内扩柔光”“Hover 内扩柔光”两个组，传入状态标签。复制区继续使用 `formatMapEffectConfig(editTarget)`，输出完整 v3。

性能警告在任一启用通道 passes ≥6、renderScale ≥0.75 或四通道同时启用时显示；文案明确建议先降低 renderScale/passes。

- [ ] **Step 5: 增加父级草稿隔离和重置测试**

覆盖：draft 模式修改 `base.inwardGlow.wave.periodMs` 不影响 effect/storage；应用后原位更新且嵌套身份稳定；撤销恢复 effect；外部 effect 更新同步草稿；复制 JSON 为 v3；分组重置不影响外扩和另一内扩组；全部重置恢复完整 v3。

- [ ] **Step 6: 运行聚焦测试、类型检查并提交**

Run: `npm test -- src/components/debug/MapInwardGlowControls.test.ts src/components/debug/MapEffectControls.test.ts src/composables/useMapDebug.test.ts`

Expected: PASS。

Run: `npm run typecheck`

Expected: PASS。

```bash
git add src/components/debug/MapInwardGlowControls.vue src/components/debug/MapInwardGlowControls.test.ts src/components/debug/MapEffectControls.vue src/components/debug/MapEffectControls.test.ts
git commit -m "feat(debug): add inward glow controls"
```

---

### Task 8: 全量回归、浏览器验收与性能证据

**Files:**
- Modify only if acceptance reveals a scoped defect: files named by the failing test or browser symptom.
- Evidence: `.superpowers/sdd/task-8-report.md` (untracked, never commit).

**Interfaces:**
- Consumes: Tasks 1–7 完整功能。
- Produces: 自动化、构建、HTTP、视觉和 FPS 验收证据；不增加新功能。

- [ ] **Step 1: 运行完整自动化门禁**

Run: `npm test`

Expected: 所有 Vitest 文件通过，零失败。

Run: `npm run typecheck`

Expected: `vue-tsc --noEmit` 退出码 0。

Run: `npm run build`

Expected: Vite 生产构建退出码 0；仅允许已知 large-chunk advisory。

- [ ] **Step 2: 从当前 worktree 启动 LAN 生产预览**

Run: `npm run preview -- --host 0.0.0.0 --port 4173`

另一个终端验证：

```bash
lsof -nP -iTCP:4173 -sTCP:LISTEN
curl -sS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4173/
```

Expected: `*:4173` 监听，HTTP `200`；同时记录实际局域网 URL。

- [ ] **Step 3: 用干净缓存验证 v3 默认视觉**

在 1920×1080 浏览器上下文清除 `cq-map-effect-config-v1/v2/v3`，刷新后确认：常态白色 B1 内扩开启、传播波循环、地图外无泄漏、边线清晰、顶面与可见侧壁受光。

- [ ] **Step 4: 验证 hover 与快速切区**

依次 hover 两江新区以外至少两个可命中区，记录：每次进入波从边缘重新开始；离开按 `leaveMs` 淡出；快速 A→B 切换不跳相、不残留前一区域；相机旋转/缩放和 resize 后宽度保持屏幕像素稳定。

- [ ] **Step 5: 验证抽屉与迁移**

手动调整常态/hover 的所有内扩字段，验证实时预览、草稿、应用、撤销、B1、分组重置、全部重置和复制 v3 JSON。分别注入合法自定义 v2、合法自定义 v1、损坏 v3，刷新确认符合迁移规则。

- [ ] **Step 6: 记录默认与高负载 FPS**

默认 B1 常态、hover 活动和四通道高 passes 三种场景各记录至少 10 秒 FPS。默认常态与 hover 目标约 55–60 FPS；若持续低于 55，先降低默认 renderScale 或 inward passes，并以测试固定最终值，不改变配置范围或传播语义。

- [ ] **Step 7: 最终检查与必要修复提交**

Run: `git diff --check && git status --short && git log --oneline --decorate -12`

Expected: 无 whitespace 错误；只允许 `.superpowers/` 和用户原有 `.ssh/`、`output/` 未跟踪；所有源码修改已按任务提交。

若验收发现缺陷，先新增能复现问题的失败测试，再做最小修复、重跑覆盖测试和全量门禁，提交：

```bash
git add src/components/map/mapInwardGlowConfig.ts \
  src/components/map/mapInwardGlowConfig.test.ts \
  src/components/map/mapEffectConfig.ts \
  src/components/map/mapEffectConfig.test.ts \
  src/composables/useMapDebug.ts \
  src/composables/useMapDebug.test.ts \
  src/components/map/mapInwardGlowMotion.ts \
  src/components/map/mapInwardGlowMotion.test.ts \
  src/components/map/mapInwardGlowShaders.ts \
  src/components/map/mapInwardGlowShaders.test.ts \
  src/components/map/mapOutwardGlowPipeline.ts \
  src/components/map/mapOutwardGlowPipeline.test.ts \
  src/components/map/ChongqingMap3D.vue \
  src/components/map/ChongqingMap3D.test.ts \
  src/components/debug/MapInwardGlowControls.vue \
  src/components/debug/MapInwardGlowControls.test.ts \
  src/components/debug/MapEffectControls.vue \
  src/components/debug/MapEffectControls.test.ts
git commit -m "fix(map): address inward glow acceptance findings"
```

若无源码修复，不创建空提交。

---

## Final Review Checklist

- [ ] v3 schema、默认值和 v1/v2 迁移逐项匹配设计规格。
- [ ] 两个 inwardGlow 和 wave 对象在 defaults、load、draft、apply、reset、copy 中无共享可变引用。
- [ ] 常态/hover 内扩与外扩可独立开关和同时合成。
- [ ] 内扩严格裁切地图内部，覆盖顶面与可见侧壁，边线保持清晰。
- [ ] stable base 与向内传播波参数完整，hover 每次进入重置 phase。
- [ ] wave 帧更新不触发 mask/blur；资源数、dirty rule 和 dispose 符合设计。
- [ ] 调试抽屉完整控制两条内扩通道，并正确显示状态与性能提示。
- [ ] 统一降级保留地图/边线/基础 hover，只告警一次且无资源泄漏。
- [ ] 全量测试、typecheck、build、LAN HTTP、浏览器迁移和 55–60 FPS 验收均有证据。
- [ ] `.ssh/`、`.superpowers/`、`output/` 未提交。
