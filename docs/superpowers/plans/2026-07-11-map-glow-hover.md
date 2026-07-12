# 地图常驻光效、Hover 动效与调试控制 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为主屏 Three.js 八区地图增加稳定常亮的分层外轮廓辉光、保留卫星纹理的轻抬 hover 动效，以及可实时调参、持久化和复制 JSON 的地图调试抽屉。

**Architecture:** 将 SVG 解析、投影和共享边分类提取为纯几何模块；用 Three.js `LineSegments2` 分别渲染内部区界、外轮廓亮芯与两层辉光，并为每个区块预建 hover 轮廓。效果配置作为独立、可校验的响应式契约存放在 `useMapDebug`，地图原位更新材质，抽屉通过“布局 / 效果”页签编辑同一份配置。

**Tech Stack:** Vue 3.5、TypeScript 5.7、Three.js 0.185、Vite 6、Vitest 3.2.4、Three.js examples `LineSegments2` / `LineSegmentsGeometry` / `LineMaterial`

## Global Constraints

- 只修改主屏 `ChongqingMap3D`；详情页 ECharts 地图不变。
- 柱状标记、排名标签、呼吸动画、流动追光、Bloom 后处理和自定义顶面 Shader 不在范围内。
- 常态外轮廓稳定常亮；hover 保留卫星纹理、轻抬 1 world unit，进入 180ms、离开 220ms。
- tooltip、OrbitControls、地图布局、点击下钻和拖拽超过 6px 不触发点击的行为不得改变。
- 宽线使用屏幕像素；1920×1080 下当前机器常态目标不低于 55 FPS，连续 hover 不低于 50 FPS。
- 配置复制格式固定为 `MapEffectConfig` version 1；不实现 JSON 粘贴导入。

## File Structure

- Create: `src/components/map/mapEffectConfig.ts` — 效果类型、默认值、规范化、存储和 JSON 格式化。
- Create: `src/components/map/mapEffectConfig.test.ts` — 配置边界与损坏缓存测试。
- Create: `src/components/map/mapGeometry.ts` — SVG 路径解析、投影、无向边归并和区块边界索引。
- Create: `src/components/map/mapGeometry.test.ts` — 共享边、外轮廓、孔洞和投影测试。
- Create: `src/components/map/mapGlow.ts` — 宽线层构建、参数应用、分辨率同步和 hover 进度函数。
- Create: `src/components/map/mapGlow.test.ts` — 派生光层参数和动画进度测试。
- Create: `src/components/debug/MapEffectControls.vue` — 效果分组控件、JSON 展示、复制和效果重置。
- Modify: `src/components/map/ChongqingMap3D.vue` — 接入几何模块、常驻辉光、hover 状态机和实时配置。
- Modify: `src/composables/useMapDebug.ts` — 持久化效果配置并暴露独立重置/JSON。
- Modify: `src/components/debug/MapDebugDrawer.vue` — 改为“布局 / 效果”双页签。
- Modify: `src/components/layout/HeaderBar.vue` — 调试入口文案改为“地图调试”。
- Modify: `package.json`, `package-lock.json` — 增加 Vitest 与 `npm test`。

---

### Task 1: 建立效果配置契约与测试基线

**Files:**
- Create: `src/components/map/mapEffectConfig.ts`
- Create: `src/components/map/mapEffectConfig.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `MapEffectConfig`, `MAP_EFFECT_DEFAULTS`, `MAP_EFFECT_STORAGE_KEY`
- Produces: `normalizeMapEffectConfig(value: unknown): MapEffectConfig`
- Produces: `loadMapEffectConfig(storage?: StorageReader | null): MapEffectConfig`
- Produces: `saveMapEffectConfig(storage: StorageWriter | null | undefined, config: MapEffectConfig): void`
- Produces: `formatMapEffectConfig(config: MapEffectConfig): string`

- [ ] **Step 1: 安装并注册测试运行器**

Run:

```bash
npm install --save-dev vitest@3.2.4
npm pkg set scripts.test="vitest run"
```

Expected: `package.json` 出现 `"test": "vitest run"`，`package-lock.json` 记录 Vitest 3.2.4。

- [ ] **Step 2: 写配置规范化的失败测试**

Create `src/components/map/mapEffectConfig.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  MAP_EFFECT_DEFAULTS,
  MAP_EFFECT_STORAGE_KEY,
  formatMapEffectConfig,
  loadMapEffectConfig,
  normalizeMapEffectConfig,
  saveMapEffectConfig
} from './mapEffectConfig'

describe('mapEffectConfig', () => {
  it('逐字段补默认值、规范化颜色并裁剪数值', () => {
    const value = normalizeMapEffectConfig({
      version: 1,
      base: {
        innerColor: '#ABCDEF',
        innerWidth: 99,
        innerOpacity: -2
      },
      hover: {
        emissiveIntensity: 9,
        lift: -1,
        enterMs: 1200,
        leaveMs: 160
      }
    })

    expect(value.base.innerColor).toBe('#abcdef')
    expect(value.base.innerWidth).toBe(4)
    expect(value.base.innerOpacity).toBe(0)
    expect(value.base.outerColor).toBe(MAP_EFFECT_DEFAULTS.base.outerColor)
    expect(value.hover.emissiveIntensity).toBe(2)
    expect(value.hover.lift).toBe(0)
    expect(value.hover.enterMs).toBe(1000)
    expect(value.hover.leaveMs).toBe(160)
  })

  it('非法字段逐项回退，版本不支持时整份回退', () => {
    const partial = normalizeMapEffectConfig({
      version: 1,
      base: { innerColor: 'blue' },
      hover: { glowColor: '#12zz00' }
    })
    expect(partial.base.innerColor).toBe(MAP_EFFECT_DEFAULTS.base.innerColor)
    expect(partial.hover.glowColor).toBe(MAP_EFFECT_DEFAULTS.hover.glowColor)

    expect(normalizeMapEffectConfig({ version: 2, base: {}, hover: {} }))
      .toEqual(MAP_EFFECT_DEFAULTS)
  })

  it('损坏缓存安全回退，保存失败不抛错', () => {
    const brokenReader = { getItem: () => '{broken-json' }
    expect(loadMapEffectConfig(brokenReader)).toEqual(MAP_EFFECT_DEFAULTS)

    const writes: Array<[string, string]> = []
    saveMapEffectConfig({ setItem: (key, value) => writes.push([key, value]) }, MAP_EFFECT_DEFAULTS)
    expect(writes[0][0]).toBe(MAP_EFFECT_STORAGE_KEY)
    expect(JSON.parse(writes[0][1])).toEqual(MAP_EFFECT_DEFAULTS)

    expect(() => saveMapEffectConfig({ setItem: () => { throw new Error('denied') } }, MAP_EFFECT_DEFAULTS))
      .not.toThrow()
  })

  it('复制 JSON 可重新解析且保持规范化值', () => {
    const text = formatMapEffectConfig(MAP_EFFECT_DEFAULTS)
    expect(text).toContain('\n  "version": 1')
    expect(normalizeMapEffectConfig(JSON.parse(text))).toEqual(MAP_EFFECT_DEFAULTS)
  })
})
```

- [ ] **Step 3: 运行测试，确认因模块不存在而失败**

Run: `npm test -- src/components/map/mapEffectConfig.test.ts`

Expected: FAIL，包含 `Failed to resolve import "./mapEffectConfig"`。

- [ ] **Step 4: 实现配置模块**

Create `src/components/map/mapEffectConfig.ts`:

```ts
export interface MapEffectBaseConfig {
  innerColor: string
  innerWidth: number
  innerOpacity: number
  outerColor: string
  outerCoreWidth: number
  outerGlowWidth: number
  outerGlowStrength: number
}

export interface MapEffectHoverConfig {
  surfaceColor: string
  emissiveColor: string
  emissiveIntensity: number
  outlineColor: string
  outlineWidth: number
  glowColor: string
  glowWidth: number
  glowStrength: number
  lift: number
  enterMs: number
  leaveMs: number
}

export interface MapEffectConfig {
  version: 1
  base: MapEffectBaseConfig
  hover: MapEffectHoverConfig
}

export interface StorageReader {
  getItem(key: string): string | null
}

export interface StorageWriter {
  setItem(key: string, value: string): void
}

export const MAP_EFFECT_STORAGE_KEY = 'cq-map-effect-config-v1'

export const MAP_EFFECT_DEFAULTS: MapEffectConfig = {
  version: 1,
  base: {
    innerColor: '#4da3ff',
    innerWidth: 1,
    innerOpacity: 0.55,
    outerColor: '#7fcbff',
    outerCoreWidth: 1.8,
    outerGlowWidth: 10,
    outerGlowStrength: 0.3
  },
  hover: {
    surfaceColor: '#7fcbff',
    emissiveColor: '#168dff',
    emissiveIntensity: 0.8,
    outlineColor: '#d8f5ff',
    outlineWidth: 2.4,
    glowColor: '#27a7ff',
    glowWidth: 7,
    glowStrength: 0.35,
    lift: 1,
    enterMs: 180,
    leaveMs: 220
  }
}

type UnknownRecord = Record<string, unknown>
const HEX_COLOR = /^#[0-9a-f]{6}$/i

function record(value: unknown): UnknownRecord {
  return value !== null && typeof value === 'object' ? value as UnknownRecord : {}
}

function color(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value.toLowerCase() : fallback
}

function numberInRange(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback
}

function defaults(): MapEffectConfig {
  return {
    version: 1,
    base: { ...MAP_EFFECT_DEFAULTS.base },
    hover: { ...MAP_EFFECT_DEFAULTS.hover }
  }
}

export function normalizeMapEffectConfig(value: unknown): MapEffectConfig {
  const root = record(value)
  if (root.version !== 1) return defaults()
  const base = record(root.base)
  const hover = record(root.hover)
  return {
    version: 1,
    base: {
      innerColor: color(base.innerColor, MAP_EFFECT_DEFAULTS.base.innerColor),
      innerWidth: numberInRange(base.innerWidth, MAP_EFFECT_DEFAULTS.base.innerWidth, 0, 4),
      innerOpacity: numberInRange(base.innerOpacity, MAP_EFFECT_DEFAULTS.base.innerOpacity, 0, 1),
      outerColor: color(base.outerColor, MAP_EFFECT_DEFAULTS.base.outerColor),
      outerCoreWidth: numberInRange(base.outerCoreWidth, MAP_EFFECT_DEFAULTS.base.outerCoreWidth, 0, 6),
      outerGlowWidth: numberInRange(base.outerGlowWidth, MAP_EFFECT_DEFAULTS.base.outerGlowWidth, 0, 24),
      outerGlowStrength: numberInRange(base.outerGlowStrength, MAP_EFFECT_DEFAULTS.base.outerGlowStrength, 0, 1)
    },
    hover: {
      surfaceColor: color(hover.surfaceColor, MAP_EFFECT_DEFAULTS.hover.surfaceColor),
      emissiveColor: color(hover.emissiveColor, MAP_EFFECT_DEFAULTS.hover.emissiveColor),
      emissiveIntensity: numberInRange(hover.emissiveIntensity, MAP_EFFECT_DEFAULTS.hover.emissiveIntensity, 0, 2),
      outlineColor: color(hover.outlineColor, MAP_EFFECT_DEFAULTS.hover.outlineColor),
      outlineWidth: numberInRange(hover.outlineWidth, MAP_EFFECT_DEFAULTS.hover.outlineWidth, 0, 8),
      glowColor: color(hover.glowColor, MAP_EFFECT_DEFAULTS.hover.glowColor),
      glowWidth: numberInRange(hover.glowWidth, MAP_EFFECT_DEFAULTS.hover.glowWidth, 0, 20),
      glowStrength: numberInRange(hover.glowStrength, MAP_EFFECT_DEFAULTS.hover.glowStrength, 0, 1),
      lift: numberInRange(hover.lift, MAP_EFFECT_DEFAULTS.hover.lift, 0, 3),
      enterMs: numberInRange(hover.enterMs, MAP_EFFECT_DEFAULTS.hover.enterMs, 0, 1000),
      leaveMs: numberInRange(hover.leaveMs, MAP_EFFECT_DEFAULTS.hover.leaveMs, 0, 1000)
    }
  }
}

export function loadMapEffectConfig(storage?: StorageReader | null): MapEffectConfig {
  if (!storage) return defaults()
  try {
    const raw = storage.getItem(MAP_EFFECT_STORAGE_KEY)
    return raw ? normalizeMapEffectConfig(JSON.parse(raw)) : defaults()
  } catch {
    return defaults()
  }
}

export function saveMapEffectConfig(
  storage: StorageWriter | null | undefined,
  config: MapEffectConfig
): void {
  try {
    storage?.setItem(MAP_EFFECT_STORAGE_KEY, JSON.stringify(normalizeMapEffectConfig(config)))
  } catch {
    // 存储被浏览器禁用时保留本次会话状态。
  }
}

export function formatMapEffectConfig(config: MapEffectConfig): string {
  return JSON.stringify(normalizeMapEffectConfig(config), null, 2)
}
```

- [ ] **Step 5: 运行配置测试和类型检查**

Run:

```bash
npm test -- src/components/map/mapEffectConfig.test.ts
npm run typecheck
```

Expected: 4 tests PASS；`vue-tsc` 退出码 0。

- [ ] **Step 6: 提交配置契约**

```bash
git add package.json package-lock.json src/components/map/mapEffectConfig.ts src/components/map/mapEffectConfig.test.ts
git commit -m "test: 建立地图光效配置契约"
```

---

### Task 2: 提取并验证地图几何与边界分类

**Files:**
- Create: `src/components/map/mapGeometry.ts`
- Create: `src/components/map/mapGeometry.test.ts`
- Modify: `src/components/map/ChongqingMap3D.vue:20-181`

**Interfaces:**
- Produces: `parseSvgRegions(svgText: string): Region[]`
- Produces: `projectRegions(regions: Region[], planeMax: number): ProjectionResult`
- Produces: `classifyBoundarySegments(regions: Region[]): BoundarySegments`
- Produces: `BoundarySegments.outer`, `.inner`, `.byRegion`

- [ ] **Step 1: 写共享边、孔洞和投影的失败测试**

Create `src/components/map/mapGeometry.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  classifyBoundarySegments,
  parsePathD,
  projectRegions,
  type Region
} from './mapGeometry'

const adjacent: Region[] = [
  { name: 'A', outers: [{ ring: [[0, 0], [1, 0], [1, 1], [0, 1]], holes: [] }] },
  { name: 'B', outers: [{ ring: [[1, 1], [1, 0], [2, 0], [2, 1]], holes: [] }] }
]

describe('mapGeometry', () => {
  it('解析 M/L/Z 多环路径', () => {
    expect(parsePathD('M0 0 L2 0 L2 2 L0 2 Z M.5 .5 L1 .5 L1 1 L.5 1 Z'))
      .toEqual([
        [[0, 0], [2, 0], [2, 2], [0, 2]],
        [[0.5, 0.5], [1, 0.5], [1, 1], [0.5, 1]]
      ])
  })

  it('把反向共享边归并为一条内部区界', () => {
    const result = classifyBoundarySegments(adjacent)
    expect(result.inner).toHaveLength(1)
    expect(result.outer).toHaveLength(6)
    expect(result.byRegion.get('A')).toHaveLength(4)
    expect(result.byRegion.get('B')).toHaveLength(4)
  })

  it('保留单一区块的孔洞边界', () => {
    const withHole: Region[] = [{
      name: 'A',
      outers: [{
        ring: [[0, 0], [4, 0], [4, 4], [0, 4]],
        holes: [[[1, 1], [1, 2], [2, 2], [2, 1]]]
      }]
    }]
    const result = classifyBoundarySegments(withHole)
    expect(result.outer).toHaveLength(8)
    expect(result.inner).toHaveLength(0)
  })

  it('按最长边等比投影并返回纹理映射参数', () => {
    const result = projectRegions(adjacent, 10)
    expect(result.scale).toBe(5)
    expect(result.center).toEqual([1, 0.5])
    expect(result.regions[0].outers[0].ring[0]).toEqual([-5, 2.5])
  })
})
```

- [ ] **Step 2: 运行测试，确认模块不存在**

Run: `npm test -- src/components/map/mapGeometry.test.ts`

Expected: FAIL，包含 `Failed to resolve import "./mapGeometry"`。

- [ ] **Step 3: 实现纯几何模块**

Create `src/components/map/mapGeometry.ts`:

```ts
export type Point2 = [number, number]
export type Ring = Point2[]
export type Segment = [Point2, Point2]

export interface RegionOuter {
  ring: Ring
  holes: Ring[]
}

export interface Region {
  name: string
  outers: RegionOuter[]
}

export interface ProjectionResult {
  regions: Region[]
  scale: number
  center: Point2
}

export interface BoundarySegments {
  outer: Segment[]
  inner: Segment[]
  byRegion: Map<string, Segment[]>
}

export function parsePathD(d: string): Ring[] {
  const rings: Ring[] = []
  let current: Ring = []
  for (const match of d.matchAll(/([MLZ])([^MLZ]*)/g)) {
    if (match[1] === 'Z') {
      if (current.length) rings.push(current)
      current = []
      continue
    }
    const nums = match[2].trim().split(/[\s,]+/).filter(Boolean).map(Number)
    const points: Ring = []
    for (let i = 0; i + 1 < nums.length; i += 2) points.push([nums[i], nums[i + 1]])
    if (match[1] === 'M') {
      if (current.length) rings.push(current)
      current = points
    } else {
      current.push(...points)
    }
  }
  if (current.length) rings.push(current)
  return rings
}

function pointInRing([x, y]: Point2, ring: Ring): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[j]
    if (y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) {
      inside = !inside
    }
  }
  return inside
}

export function parseSvgRegions(svgText: string): Region[] {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  return Array.from(doc.querySelectorAll('path[data-name]')).map((path) => {
    const rings = parsePathD(path.getAttribute('d') ?? '')
    const outerRings = rings.filter((ring) =>
      !rings.some((candidate) => candidate !== ring && pointInRing(ring[0], candidate))
    )
    const holeRings = rings.filter((ring) => !outerRings.includes(ring))
    return {
      name: path.getAttribute('data-name') ?? '',
      outers: outerRings.map((ring) => ({
        ring,
        holes: holeRings.filter((hole) => pointInRing(hole[0], ring))
      }))
    }
  }).filter((region) => region.name && region.outers.length)
}

export function projectRegions(regions: Region[], planeMax: number): ProjectionResult {
  const points = regions.flatMap((region) =>
    region.outers.flatMap((outer) => [outer.ring, ...outer.holes].flat())
  )
  if (!points.length) throw new Error('地图轮廓为空')

  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const scale = planeMax / Math.max(maxX - minX, maxY - minY)
  const center: Point2 = [(minX + maxX) / 2, (minY + maxY) / 2]
  const project = ([x, y]: Point2): Point2 => [
    (x - center[0]) * scale,
    (center[1] - y) * scale
  ]

  return {
    scale,
    center,
    regions: regions.map((region) => ({
      name: region.name,
      outers: region.outers.map((outer) => ({
        ring: outer.ring.map(project),
        holes: outer.holes.map((hole) => hole.map(project))
      }))
    }))
  }
}

function ringSegments(ring: Ring): Segment[] {
  return ring.map((point, index) => [point, ring[(index + 1) % ring.length]])
}

function pointKey([x, y]: Point2): string {
  return `${x},${y}`
}

function segmentKey([start, end]: Segment): string {
  const a = pointKey(start)
  const b = pointKey(end)
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

export function classifyBoundarySegments(regions: Region[]): BoundarySegments {
  const buckets = new Map<string, { segment: Segment; count: number }>()
  const byRegion = new Map<string, Segment[]>()

  for (const region of regions) {
    const segments = region.outers.flatMap((outer) =>
      [outer.ring, ...outer.holes].flatMap(ringSegments)
    )
    byRegion.set(region.name, segments)
    for (const segment of segments) {
      const key = segmentKey(segment)
      const bucket = buckets.get(key)
      if (bucket) bucket.count += 1
      else buckets.set(key, { segment, count: 1 })
    }
  }

  const outer: Segment[] = []
  const inner: Segment[] = []
  for (const bucket of buckets.values()) {
    if (bucket.count === 1) outer.push(bucket.segment)
    else inner.push(bucket.segment)
  }
  return { outer, inner, byRegion }
}
```

- [ ] **Step 4: 让 3D 组件消费新的解析与投影接口，同时保持当前视觉不变**

In `src/components/map/ChongqingMap3D.vue`:

```ts
import {
  parseSvgRegions,
  projectRegions,
  type Region
} from './mapGeometry'
```

删除组件内的 `Ring`、`Region`、`parsePathD`、`pointInRing`、`parseSvgRegions` 和手写 bbox/project 代码。`buildRegions` 开头改为：

```ts
const projected = projectRegions(regions, PLANE_MAX)
const [cx, cy] = projected.center
const scale = projected.scale

const texImg = terrainTex.image as { width: number; height: number }
terrainTex.repeat.set(1 / (scale * texImg.width), 1 / (scale * texImg.height))
terrainTex.offset.set(cx / texImg.width, 1 - cy / texImg.height)
```

区块循环改为直接消费投影结果：

```ts
for (const region of projected.regions) {
  const name = region.name
  const shapes: THREE.Shape[] = []
  const rings: Array<Array<[number, number]>> = []
  for (const outer of region.outers) {
    const shape = new THREE.Shape(outer.ring.map(([x, y]) => new THREE.Vector2(x, y)))
    rings.push(outer.ring)
    for (const holeRing of outer.holes) {
      shape.holes.push(new THREE.Path(holeRing.map(([x, y]) => new THREE.Vector2(x, y))))
      rings.push(holeRing)
    }
    shapes.push(shape)
  }

  const geometry = new THREE.ExtrudeGeometry(shapes, { depth: DEPTH, bevelEnabled: false })
  const topMat = new THREE.MeshStandardMaterial({
    map: terrainTex,
    color: TOP_COLOR,
    roughness: 0.42,
    metalness: 0.35,
    emissive: TOP_EMISSIVE,
    emissiveIntensity: 0.35
  })
  const mesh = new THREE.Mesh(geometry, [topMat, sideMat])
  mesh.userData = { name, item: byName.get(name) }
  regionMeshes.push(mesh)
  group.add(mesh)

  for (const ring of rings) {
    const points = ring.map(([x, y]) => new THREE.Vector3(x, y, DEPTH + 0.05))
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points)
    group.add(new THREE.LineLoop(lineGeometry, lineMat))
  }
}
```

- [ ] **Step 5: 验证纯函数与当前地图无回归**

Run:

```bash
npm test -- src/components/map/mapGeometry.test.ts
npm run typecheck
npm run build
```

Verify the tracked SVG still has the expected exact edge multiplicities:

```bash
node --input-type=module -e 'import fs from "node:fs"; const svg=fs.readFileSync("public/maps/chongqing-selected-districts-tianditu-imagery-z12.svg","utf8"); const edges=new Map(); for(const match of svg.matchAll(/<path id="district-[^"]+" data-name="[^"]+" d="([^"]+)"[^>]*>/g)){ for(const ring of match[1].matchAll(/M([^Z]+)Z/g)){ const nums=ring[1].trim().split(/[ L,]+/).filter(Boolean).map(Number); const points=[]; for(let i=0;i+1<nums.length;i+=2) points.push([nums[i],nums[i+1]]); for(let i=0;i<points.length;i++){ const a=points[i].join(","), b=points[(i+1)%points.length].join(","); const key=a<b?a+"|"+b:b+"|"+a; edges.set(key,(edges.get(key)??0)+1); } } } const counts=[...edges.values()]; console.log(JSON.stringify({outer:counts.filter(v=>v===1).length,inner:counts.filter(v=>v>1).length}));'
```

Expected: 4 tests PASS；类型检查和生产构建退出码 0；edge command prints `{"outer":2895,"inner":4532}`；本地页面地图形状、纹理、tooltip 与 hover 和改造前一致。

- [ ] **Step 6: 提交几何拆分**

```bash
git add src/components/map/mapGeometry.ts src/components/map/mapGeometry.test.ts src/components/map/ChongqingMap3D.vue
git commit -m "refactor: 提取地图边界几何模块"
```

---

### Task 3: 实现常驻分层宽线辉光

**Files:**
- Create: `src/components/map/mapGlow.ts`
- Create: `src/components/map/mapGlow.test.ts`
- Modify: `src/components/map/ChongqingMap3D.vue:104-243, 374-398`

**Interfaces:**
- Consumes: `BoundarySegments`, `MapEffectConfig`
- Produces: `StaticGlowBundle`, `HoverGlowBundle`
- Produces: `createStaticGlowLayers`, `createHoverGlowLayers`
- Produces: `applyStaticGlowConfig`, `applyHoverGlowConfig`, `setHoverGlowProgress`
- Produces: `setGlowResolution`, `disposeGlowBundle`

- [ ] **Step 1: 写派生光层参数的失败测试**

Create `src/components/map/mapGlow.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { MAP_EFFECT_DEFAULTS } from './mapEffectConfig'
import { deriveHoverLayerValues, deriveStaticLayerValues } from './mapGlow'

describe('mapGlow layer values', () => {
  it('从一个外圈宽度派生近端和远端两层辉光', () => {
    const values = deriveStaticLayerValues(MAP_EFFECT_DEFAULTS)
    expect(values.outerNear.width).toBe(5)
    expect(values.outerNear.opacity).toBe(0.3)
    expect(values.outerFar.width).toBe(10)
    expect(values.outerFar.opacity).toBeCloseTo(0.105)
    expect(values.outerCore.opacity).toBe(0.95)
  })

  it('hover 亮芯和辉光使用独立颜色、宽度与强度', () => {
    const values = deriveHoverLayerValues(MAP_EFFECT_DEFAULTS)
    expect(values.core).toEqual({ color: '#d8f5ff', width: 2.4, opacity: 1 })
    expect(values.glow).toEqual({ color: '#27a7ff', width: 7, opacity: 0.35 })
  })
})
```

- [ ] **Step 2: 运行测试，确认模块不存在**

Run: `npm test -- src/components/map/mapGlow.test.ts`

Expected: FAIL，包含 `Failed to resolve import "./mapGlow"`。

- [ ] **Step 3: 实现宽线光层模块**

Create `src/components/map/mapGlow.ts`:

```ts
import * as THREE from 'three'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import type { MapEffectConfig } from './mapEffectConfig'
import type { BoundarySegments, Segment } from './mapGeometry'

interface LayerValue {
  color: string
  width: number
  opacity: number
}

interface GlowLayer {
  line: LineSegments2
  material: LineMaterial
}

interface GlowBundleBase {
  group: THREE.Group
  materials: LineMaterial[]
  geometries: LineSegmentsGeometry[]
}

export interface StaticGlowBundle extends GlowBundleBase {
  inner: GlowLayer
  outerFar: GlowLayer
  outerNear: GlowLayer
  outerCore: GlowLayer
}

export interface HoverGlowBundle extends GlowBundleBase {
  glow: GlowLayer
  core: GlowLayer
}

export function deriveStaticLayerValues(config: MapEffectConfig) {
  return {
    inner: {
      color: config.base.innerColor,
      width: config.base.innerWidth,
      opacity: config.base.innerOpacity
    },
    outerFar: {
      color: config.base.outerColor,
      width: config.base.outerGlowWidth,
      opacity: config.base.outerGlowStrength * 0.35
    },
    outerNear: {
      color: config.base.outerColor,
      width: config.base.outerGlowWidth * 0.5,
      opacity: config.base.outerGlowStrength
    },
    outerCore: {
      color: config.base.outerColor,
      width: config.base.outerCoreWidth,
      opacity: 0.95
    }
  } satisfies Record<string, LayerValue>
}

export function deriveHoverLayerValues(config: MapEffectConfig) {
  return {
    glow: {
      color: config.hover.glowColor,
      width: config.hover.glowWidth,
      opacity: config.hover.glowStrength
    },
    core: {
      color: config.hover.outlineColor,
      width: config.hover.outlineWidth,
      opacity: 1
    }
  } satisfies Record<string, LayerValue>
}

function positions(segments: Segment[], z: number): number[] {
  return segments.flatMap(([[x1, y1], [x2, y2]]) => [x1, y1, z, x2, y2, z])
}

function geometryFor(segments: Segment[], z: number): LineSegmentsGeometry {
  return new LineSegmentsGeometry().setPositions(positions(segments, z))
}

function layer(geometry: LineSegmentsGeometry, value: LayerValue, renderOrder: number): GlowLayer {
  const material = new LineMaterial({
    color: value.color,
    linewidth: value.width,
    opacity: value.opacity,
    transparent: true,
    worldUnits: false,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  })
  const line = new LineSegments2(geometry, material)
  line.frustumCulled = false
  line.renderOrder = renderOrder
  line.visible = value.width > 0 && value.opacity > 0
  return { line, material }
}

function applyLayer(target: GlowLayer, value: LayerValue): void {
  target.material.color.set(value.color)
  target.material.linewidth = value.width
  target.material.opacity = value.opacity
  target.line.visible = value.width > 0 && value.opacity > 0
}

export function createStaticGlowLayers(
  boundaries: BoundarySegments,
  config: MapEffectConfig,
  z: number
): StaticGlowBundle {
  const innerGeometry = geometryFor(boundaries.inner, z)
  const outerGeometry = geometryFor(boundaries.outer, z + 0.01)
  const values = deriveStaticLayerValues(config)
  const inner = layer(innerGeometry, values.inner, 10)
  const outerFar = layer(outerGeometry, values.outerFar, 11)
  const outerNear = layer(outerGeometry, values.outerNear, 12)
  const outerCore = layer(outerGeometry, values.outerCore, 13)
  const group = new THREE.Group()
  group.add(inner.line, outerFar.line, outerNear.line, outerCore.line)
  return {
    group,
    inner,
    outerFar,
    outerNear,
    outerCore,
    materials: [inner.material, outerFar.material, outerNear.material, outerCore.material],
    geometries: [innerGeometry, outerGeometry]
  }
}

export function createHoverGlowLayers(
  segments: Segment[],
  config: MapEffectConfig,
  z: number
): HoverGlowBundle {
  const geometry = geometryFor(segments, z)
  const values = deriveHoverLayerValues(config)
  const glow = layer(geometry, { ...values.glow, opacity: 0 }, 20)
  const core = layer(geometry, { ...values.core, opacity: 0 }, 21)
  const group = new THREE.Group()
  group.visible = false
  group.add(glow.line, core.line)
  return {
    group,
    glow,
    core,
    materials: [glow.material, core.material],
    geometries: [geometry]
  }
}

export function applyStaticGlowConfig(bundle: StaticGlowBundle, config: MapEffectConfig): void {
  const values = deriveStaticLayerValues(config)
  applyLayer(bundle.inner, values.inner)
  applyLayer(bundle.outerFar, values.outerFar)
  applyLayer(bundle.outerNear, values.outerNear)
  applyLayer(bundle.outerCore, values.outerCore)
}

export function applyHoverGlowConfig(bundle: HoverGlowBundle, config: MapEffectConfig): void {
  const values = deriveHoverLayerValues(config)
  bundle.glow.material.color.set(values.glow.color)
  bundle.glow.material.linewidth = values.glow.width
  bundle.core.material.color.set(values.core.color)
  bundle.core.material.linewidth = values.core.width
}

export function setHoverGlowProgress(
  bundle: HoverGlowBundle,
  config: MapEffectConfig,
  progress: number
): void {
  const values = deriveHoverLayerValues(config)
  bundle.group.visible = progress > 0.001
  bundle.glow.material.opacity = values.glow.opacity * progress
  bundle.core.material.opacity = values.core.opacity * progress
  bundle.glow.line.visible = bundle.group.visible && values.glow.width > 0 && values.glow.opacity > 0
  bundle.core.line.visible = bundle.group.visible && values.core.width > 0
}

export function setGlowResolution(
  bundle: GlowBundleBase,
  width: number,
  height: number
): void {
  for (const material of bundle.materials) material.resolution.set(width, height)
}

export function disposeGlowBundle(bundle: GlowBundleBase): void {
  new Set(bundle.geometries).forEach((geometry) => geometry.dispose())
  new Set(bundle.materials).forEach((material) => material.dispose())
}
```

- [ ] **Step 4: 接入常驻内线、外圈双层柔光和亮芯**

In `src/components/map/ChongqingMap3D.vue`, import:

```ts
import { MAP_EFFECT_DEFAULTS } from './mapEffectConfig'
import { classifyBoundarySegments } from './mapGeometry'
import {
  createStaticGlowLayers,
  setGlowResolution,
  type StaticGlowBundle
} from './mapGlow'
```

新增组件级引用：

```ts
let staticGlow: StaticGlowBundle | null = null
```

在 `buildRegions` 得到 `projected.regions` 后分类边界；删除默认路径中逐环创建 `THREE.LineLoop` 的代码，改为：

```ts
const boundaries = classifyBoundarySegments(projected.regions)
try {
  staticGlow = createStaticGlowLayers(boundaries, MAP_EFFECT_DEFAULTS, DEPTH + 0.06)
  group.add(staticGlow.group)
} catch (cause) {
  console.warn('宽线光效初始化失败，回退 1px 区界', cause)
  const fallbackMaterial = new THREE.LineBasicMaterial({
    color: 0x3fa9ff,
    transparent: true,
    opacity: 0.85
  })
  for (const region of projected.regions) {
    for (const outer of region.outers) {
      for (const ring of [outer.ring, ...outer.holes]) {
        const geometry = new THREE.BufferGeometry().setFromPoints(
          ring.map(([x, y]) => new THREE.Vector3(x, y, DEPTH + 0.05))
        )
        group.add(new THREE.LineLoop(geometry, fallbackMaterial))
      }
    }
  }
}
```

在 renderer 初始化和 ResizeObserver 中调用：

```ts
function updateGlowResolution(): void {
  const el = container.value
  if (el && staticGlow) setGlowResolution(staticGlow, el.clientWidth, el.clientHeight)
}
```

在 `renderer.setSize` 后调用 `updateGlowResolution()`。用以下去重函数替换当前卸载阶段逐对象直接释放资源的逻辑：

```ts
function disposeSceneResources(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()

  root.traverse((object) => {
    const renderable = object as THREE.Object3D & {
      geometry?: THREE.BufferGeometry
      material?: THREE.Material | THREE.Material[]
    }
    if (renderable.geometry) geometries.add(renderable.geometry)
    if (!renderable.material) return
    const objectMaterials = Array.isArray(renderable.material)
      ? renderable.material
      : [renderable.material]
    for (const material of objectMaterials) {
      materials.add(material)
      const map = (material as THREE.MeshStandardMaterial).map
      if (map) textures.add(map)
    }
  })

  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
  textures.forEach((texture) => texture.dispose())
}
```

在 `onBeforeUnmount` 中执行 `if (scene) disposeSceneResources(scene)`，删除原 `scene?.traverse` 释放块，并在清空 renderer/camera/controls 时增加 `staticGlow = null`。

- [ ] **Step 5: 验证默认静态光层**

Run:

```bash
npm test -- src/components/map/mapGlow.test.ts
npm run typecheck
npm run build
```

Expected: 2 tests PASS；构建退出码 0。浏览器 1920×1080 默认态显示细内部区界、两层柔光和清晰外圈亮芯，透明背景及卫星纹理不变，控制台无错误。

- [ ] **Step 6: 提交常驻辉光**

```bash
git add src/components/map/mapGlow.ts src/components/map/mapGlow.test.ts src/components/map/ChongqingMap3D.vue
git commit -m "feat: 增加地图常驻分层轮廓光"
```

---

### Task 4: 实现可逆的轻抬 Hover 动画

**Files:**
- Modify: `src/components/map/mapGlow.ts`
- Modify: `src/components/map/mapGlow.test.ts`
- Modify: `src/components/map/ChongqingMap3D.vue:104-181, 245-331`

**Interfaces:**
- Produces: `advanceHoverProgress(current, active, deltaMs, enterMs, leaveMs): number`
- Produces: `easeOutCubic(progress: number): number`
- Consumes: `createHoverGlowLayers`, `applyHoverGlowConfig`, `setHoverGlowProgress`

- [ ] **Step 1: 为动画进度写失败测试**

Replace the existing `./mapGlow` import with:

```ts
import {
  advanceHoverProgress,
  deriveHoverLayerValues,
  deriveStaticLayerValues,
  easeOutCubic
} from './mapGlow'
```

Then append:

```ts
describe('mapGlow hover animation', () => {
  it('分别使用进入和离开时长推进进度', () => {
    expect(advanceHoverProgress(0, true, 90, 180, 220)).toBe(0.5)
    expect(advanceHoverProgress(0.5, false, 110, 180, 220)).toBe(0)
    expect(advanceHoverProgress(0.9, true, 90, 180, 220)).toBe(1)
  })

  it('使用 cubic ease-out 且固定端点', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(0.5)).toBe(0.875)
    expect(easeOutCubic(1)).toBe(1)
  })
})
```

- [ ] **Step 2: 运行测试，确认导出不存在**

Run: `npm test -- src/components/map/mapGlow.test.ts`

Expected: FAIL，明确指出 `./mapGlow` 尚未导出 `advanceHoverProgress`。

- [ ] **Step 3: 实现动画纯函数**

Append to `src/components/map/mapGlow.ts`:

```ts
export function advanceHoverProgress(
  current: number,
  active: boolean,
  deltaMs: number,
  enterMs: number,
  leaveMs: number
): number {
  const duration = active ? enterMs : leaveMs
  if (duration <= 0) return active ? 1 : 0
  const next = current + (active ? deltaMs / duration : -deltaMs / duration)
  return THREE.MathUtils.clamp(next, 0, 1)
}

export function easeOutCubic(progress: number): number {
  const value = THREE.MathUtils.clamp(progress, 0, 1)
  return 1 - Math.pow(1 - value, 3)
}
```

- [ ] **Step 4: 为八个区块预建 hover 光层和视觉状态**

In `src/components/map/ChongqingMap3D.vue`, extend imports and state:

```ts
import {
  advanceHoverProgress,
  applyHoverGlowConfig,
  createHoverGlowLayers,
  easeOutCubic,
  setHoverGlowProgress,
  type HoverGlowBundle
} from './mapGlow'

interface RegionVisual {
  mesh: THREE.Mesh
  group: THREE.Group
  topMaterial: THREE.MeshStandardMaterial
  hoverGlow: HoverGlowBundle | null
  progress: number
  active: boolean
}

const regionVisuals: RegionVisual[] = []
const visualByMesh = new Map<THREE.Mesh, RegionVisual>()
const baseTopColor = new THREE.Color(TOP_COLOR)
const baseTopEmissive = new THREE.Color(TOP_EMISSIVE)
const hoverSurfaceColor = new THREE.Color(MAP_EFFECT_DEFAULTS.hover.surfaceColor)
const hoverEmissiveColor = new THREE.Color(MAP_EFFECT_DEFAULTS.hover.emissiveColor)
```

在每个区块创建 mesh 后，用局部容器替代直接 `group.add(mesh)`：

```ts
const regionGroup = new THREE.Group()
regionGroup.add(mesh)
let hoverGlow: HoverGlowBundle | null = null
try {
  hoverGlow = createHoverGlowLayers(
    boundaries.byRegion.get(name) ?? [],
    MAP_EFFECT_DEFAULTS,
    DEPTH + 0.12
  )
  regionGroup.add(hoverGlow.group)
} catch (cause) {
  console.warn(`区块 ${name} 的 hover 宽线初始化失败，保留材质高亮和轻抬`, cause)
}
const visual: RegionVisual = {
  mesh,
  group: regionGroup,
  topMaterial: topMat,
  hoverGlow,
  progress: 0,
  active: false
}
regionVisuals.push(visual)
visualByMesh.set(mesh, visual)
group.add(regionGroup)
```

- [ ] **Step 5: 用状态切换替换瞬时材质修改，并在渲染循环插值**

Delete the old `let hovered: THREE.Mesh | null` declaration and replace `setHover` with:

```ts
let hoveredVisual: RegionVisual | null = null

function setHover(mesh: THREE.Mesh | null): void {
  const next = mesh ? visualByMesh.get(mesh) ?? null : null
  if (next === hoveredVisual) return
  if (hoveredVisual) hoveredVisual.active = false
  hoveredVisual = next
  if (hoveredVisual) hoveredVisual.active = true
  if (container.value) container.value.style.cursor = next ? 'pointer' : 'default'
}
```

Add animation update:

```ts
function updateRegionVisuals(deltaMs: number): void {
  const config = MAP_EFFECT_DEFAULTS
  for (const visual of regionVisuals) {
    visual.progress = advanceHoverProgress(
      visual.progress,
      visual.active,
      deltaMs,
      config.hover.enterMs,
      config.hover.leaveMs
    )
    const eased = easeOutCubic(visual.progress)
    visual.group.position.z = config.hover.lift * eased
    visual.topMaterial.color.copy(baseTopColor).lerp(hoverSurfaceColor, eased)
    visual.topMaterial.emissive.copy(baseTopEmissive).lerp(hoverEmissiveColor, eased)
    visual.topMaterial.emissiveIntensity = THREE.MathUtils.lerp(0.35, config.hover.emissiveIntensity, eased)
    if (visual.hoverGlow) {
      applyHoverGlowConfig(visual.hoverGlow, config)
      setHoverGlowProgress(visual.hoverGlow, config, eased)
    }
  }
}
```

Update render loop:

```ts
let lastFrameAt = 0

function loop(now: number) {
  raf = requestAnimationFrame(loop)
  const deltaMs = lastFrameAt ? Math.min(now - lastFrameAt, 50) : 0
  lastFrameAt = now
  updateRegionVisuals(deltaMs)
  controls?.update()
  if (renderer && scene && camera) renderer.render(scene, camera)
  frames++
  if (now - lastFpsAt >= 1000) {
    fps.value = frames
    frames = 0
    lastFpsAt = now
  }
}
```

Replace `updateGlowResolution` with:

```ts
function updateGlowResolution(): void {
  const el = container.value
  if (!el) return
  if (staticGlow) setGlowResolution(staticGlow, el.clientWidth, el.clientHeight)
  for (const visual of regionVisuals) {
    if (visual.hoverGlow) setGlowResolution(visual.hoverGlow, el.clientWidth, el.clientHeight)
  }
}
```

卸载时执行 `regionVisuals.length = 0`、`visualByMesh.clear()`、`hoveredVisual = null` 和 `lastFrameAt = 0`。

- [ ] **Step 6: 验证 hover 行为与现有交互**

Run:

```bash
npm test -- src/components/map/mapGlow.test.ts
npm run typecheck
npm run build
```

Expected: 4 tests PASS；浏览器中依次与快速跨越八个区块时，新区平滑抬升、旧区同时回落，卫星纹理可见，tooltip 立即切换；旋转后点击仍只在位移不超过 6px 时下钻。

- [ ] **Step 7: 提交 hover 动画**

```bash
git add src/components/map/mapGlow.ts src/components/map/mapGlow.test.ts src/components/map/ChongqingMap3D.vue
git commit -m "feat: 增加地图轻抬 hover 动效"
```

---

### Task 5: 增加效果调试页签、持久化与实时联动

**Files:**
- Create: `src/components/debug/MapEffectControls.vue`
- Modify: `src/composables/useMapDebug.ts`
- Modify: `src/components/debug/MapDebugDrawer.vue`
- Modify: `src/components/layout/HeaderBar.vue`
- Modify: `src/components/map/ChongqingMap3D.vue`

**Interfaces:**
- `useMapDebug()` additionally produces `effect`, `effectJson`, `resetEffect`
- `useMapDebug()` renames layout reset to `resetLayout`
- `MapEffectControls.vue` consumes and mutates the shared effect state

- [ ] **Step 1: 扩展调试状态并持久化效果配置**

Replace `src/composables/useMapDebug.ts` with:

```ts
import { computed, reactive, ref, watch } from 'vue'
import {
  MAP_EFFECT_DEFAULTS,
  formatMapEffectConfig,
  loadMapEffectConfig,
  normalizeMapEffectConfig,
  saveMapEffectConfig
} from '@/components/map/mapEffectConfig'

export interface MapLayout {
  left: number
  top: number
  width: number
  height: number
}

export const MAP_LAYOUT_DEFAULT: MapLayout = { left: 115, top: 230, width: 680, height: 680 }
const LAYOUT_KEY = 'cq-map-debug-layout'

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function loadLayout(): MapLayout {
  try {
    const raw = storage()?.getItem(LAYOUT_KEY)
    if (raw) {
      const value = JSON.parse(raw) as Record<string, unknown>
      if ((['left', 'top', 'width', 'height'] as const).every((key) => typeof value[key] === 'number')) {
        return value as unknown as MapLayout
      }
    }
  } catch {
    // 回退默认布局。
  }
  return { ...MAP_LAYOUT_DEFAULT }
}

const drawerOpen = ref(false)
const layout = reactive<MapLayout>(loadLayout())
const effect = reactive(loadMapEffectConfig(storage()))
const cameraView = ref('')
const effectJson = computed(() => formatMapEffectConfig(effect))

watch(layout, (value) => {
  try {
    storage()?.setItem(LAYOUT_KEY, JSON.stringify(value))
  } catch {
    // 本次会话继续可用。
  }
})
watch(effect, (value) => saveMapEffectConfig(storage(), value), { deep: true })

function resetLayout(): void {
  Object.assign(layout, MAP_LAYOUT_DEFAULT)
}

function resetEffect(): void {
  const value = normalizeMapEffectConfig(MAP_EFFECT_DEFAULTS)
  Object.assign(effect.base, value.base)
  Object.assign(effect.hover, value.hover)
}

export function useMapDebug() {
  return { drawerOpen, layout, effect, effectJson, resetLayout, resetEffect, cameraView }
}
```

- [ ] **Step 2: 创建分组效果控件和复制区域**

Create `src/components/debug/MapEffectControls.vue`:

```vue
<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { useMapDebug } from '@/composables/useMapDebug'

const GROUPS = [
  {
    title: '常态边界',
    fields: [
      { section: 'base', key: 'innerColor', label: '内部线颜色', kind: 'color' },
      { section: 'base', key: 'innerWidth', label: '内部线宽', kind: 'number', min: 0, max: 4, step: 0.1 },
      { section: 'base', key: 'innerOpacity', label: '内部线透明度', kind: 'number', min: 0, max: 1, step: 0.01 },
      { section: 'base', key: 'outerColor', label: '外圈颜色', kind: 'color' },
      { section: 'base', key: 'outerCoreWidth', label: '外圈亮芯宽度', kind: 'number', min: 0, max: 6, step: 0.1 },
      { section: 'base', key: 'outerGlowWidth', label: '外圈辉光宽度', kind: 'number', min: 0, max: 24, step: 0.5 },
      { section: 'base', key: 'outerGlowStrength', label: '外圈辉光强度', kind: 'number', min: 0, max: 1, step: 0.01 }
    ]
  },
  {
    title: 'Hover 表面',
    fields: [
      { section: 'hover', key: 'surfaceColor', label: '顶面颜色', kind: 'color' },
      { section: 'hover', key: 'emissiveColor', label: '自发光颜色', kind: 'color' },
      { section: 'hover', key: 'emissiveIntensity', label: '自发光强度', kind: 'number', min: 0, max: 2, step: 0.05 },
      { section: 'hover', key: 'lift', label: '抬升高度', kind: 'number', min: 0, max: 3, step: 0.1 }
    ]
  },
  {
    title: 'Hover 轮廓与动效',
    fields: [
      { section: 'hover', key: 'outlineColor', label: '亮芯颜色', kind: 'color' },
      { section: 'hover', key: 'outlineWidth', label: '亮芯宽度', kind: 'number', min: 0, max: 8, step: 0.1 },
      { section: 'hover', key: 'glowColor', label: '辉光颜色', kind: 'color' },
      { section: 'hover', key: 'glowWidth', label: '辉光宽度', kind: 'number', min: 0, max: 20, step: 0.5 },
      { section: 'hover', key: 'glowStrength', label: '辉光强度', kind: 'number', min: 0, max: 1, step: 0.01 },
      { section: 'hover', key: 'enterMs', label: '进入时长 ms', kind: 'number', min: 0, max: 1000, step: 10 },
      { section: 'hover', key: 'leaveMs', label: '离开时长 ms', kind: 'number', min: 0, max: 1000, step: 10 }
    ]
  }
] as const

const { effect, effectJson, resetEffect } = useMapDebug()
const copied = ref(false)
const HEX = /^#[0-9a-f]{6}$/i
let copiedTimer = 0

type Section = 'base' | 'hover'
type Field = (typeof GROUPS)[number]['fields'][number]

function sectionRecord(section: Section): Record<string, string | number> {
  return effect[section] as unknown as Record<string, string | number>
}

function valueOf(field: Field): string | number {
  return sectionRecord(field.section)[field.key]
}

function updateNumber(field: Field, event: Event): void {
  if (field.kind !== 'number') return
  const input = event.target as HTMLInputElement
  const value = Number(input.value)
  if (!Number.isFinite(value)) {
    input.value = String(valueOf(field))
    return
  }
  sectionRecord(field.section)[field.key] = Math.min(field.max, Math.max(field.min, value))
}

function updateColor(field: Field, event: Event): void {
  if (field.kind !== 'color') return
  const input = event.target as HTMLInputElement
  if (HEX.test(input.value)) sectionRecord(field.section)[field.key] = input.value.toLowerCase()
  else input.value = String(valueOf(field))
}

async function copyEffect(): Promise<void> {
  try {
    await navigator.clipboard.writeText(effectJson.value)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = effectJson.value
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    textarea.remove()
  }
  copied.value = true
  clearTimeout(copiedTimer)
  copiedTimer = window.setTimeout(() => (copied.value = false), 1500)
}

onBeforeUnmount(() => clearTimeout(copiedTimer))
</script>

<template>
  <div class="effect-controls">
    <section v-for="group in GROUPS" :key="group.title" class="effect-group">
      <h3>{{ group.title }}</h3>
      <div v-for="field in group.fields" :key="field.key" class="field">
        <div class="field-head">
          <label>{{ field.label }}</label>
          <template v-if="field.kind === 'color'">
            <input
              class="color"
              type="color"
              :value="valueOf(field)"
              @input="updateColor(field, $event)"
            />
            <input
              class="hex"
              type="text"
              :value="valueOf(field)"
              @change="updateColor(field, $event)"
            />
          </template>
          <input
            v-else
            class="num"
            type="number"
            :value="valueOf(field)"
            :min="field.min"
            :max="field.max"
            :step="field.step"
            @change="updateNumber(field, $event)"
          />
        </div>
        <input
          v-if="field.kind === 'number'"
          class="slider"
          type="range"
          :value="valueOf(field)"
          :min="field.min"
          :max="field.max"
          :step="field.step"
          @input="updateNumber(field, $event)"
        />
      </div>
    </section>

    <section class="effect-group">
      <h3>可复制参数</h3>
      <pre class="json-out">{{ effectJson }}</pre>
      <div class="effect-actions">
        <button class="btn" @click="copyEffect">{{ copied ? '已复制 ✓' : '复制效果参数' }}</button>
        <button class="btn ghost" @click="resetEffect">恢复默认值</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.effect-controls { display: flex; flex-direction: column; gap: 14px; padding-bottom: 4px; }
.effect-group {
  display: flex; flex-direction: column; gap: 10px; padding: 12px;
  border: 1px solid rgba(36, 131, 255, 0.28); border-radius: 4px;
  background: rgba(36, 131, 255, 0.05);
}
.effect-group h3 { margin: 0; font-size: 14px; font-weight: normal; color: #fff; }
.field { display: flex; flex-direction: column; gap: 6px; }
.field-head { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.field-head label { flex: 1; }
.num, .hex {
  box-sizing: border-box; height: 26px; padding: 2px 6px; text-align: right;
  color: #00deff; background: rgba(36, 131, 255, 0.12);
  border: 1px solid rgba(36, 131, 255, 0.4); border-radius: 3px; outline: none;
}
.num { width: 76px; }
.hex { width: 82px; font-family: monospace; }
.color { width: 30px; height: 26px; padding: 1px; border: 1px solid rgba(36, 131, 255, 0.4); background: transparent; }
.slider { width: 100%; accent-color: #00deff; cursor: pointer; }
.json-out {
  box-sizing: border-box; max-height: 220px; margin: 0; padding: 10px;
  overflow: auto; user-select: text; white-space: pre; font-size: 11px; line-height: 1.45;
  color: #8fd9ff; background: rgba(0, 0, 0, 0.35);
  border: 1px dashed rgba(36, 131, 255, 0.4); border-radius: 4px;
}
.effect-actions { display: flex; gap: 8px; }
.btn {
  flex: 1; padding: 8px 4px; font-size: 12px; font-family: 'OPPOSans-M'; cursor: pointer;
  color: #041020; background: linear-gradient(180deg, #00deff, #2483ff);
  border: none; border-radius: 4px;
}
.btn.ghost { color: #7fa8d9; background: transparent; border: 1px solid rgba(36, 131, 255, 0.5); }
.btn.ghost:hover { color: #00deff; border-color: #00deff; }
</style>
```

- [ ] **Step 3: 把抽屉改为布局 / 效果页签**

In `src/components/debug/MapDebugDrawer.vue`:

```ts
import MapEffectControls from './MapEffectControls.vue'

const activeTab = ref<'layout' | 'effect'>('layout')
const { drawerOpen, layout, resetLayout, cameraView } = useMapDebug()
```

Replace the existing template with:

```vue
<template>
  <transition name="drawer">
    <aside v-if="drawerOpen" class="drawer">
      <div class="head">
        <span class="title">地图调试</span>
        <span class="close" @click="drawerOpen = false">✕</span>
      </div>

      <div class="tabs">
        <button :class="{ active: activeTab === 'layout' }" @click="activeTab = 'layout'">布局</button>
        <button :class="{ active: activeTab === 'effect' }" @click="activeTab = 'effect'">效果</button>
      </div>

      <div v-if="activeTab === 'layout'" class="panel-scroll layout-panel">
        <div v-for="field in FIELDS" :key="field.key" class="row">
          <div class="row-head">
            <label>{{ field.label }}</label>
            <input v-model.number="layout[field.key]" class="num" type="number" />
          </div>
          <input
            v-model.number="layout[field.key]"
            class="slider"
            type="range"
            :min="field.min"
            :max="field.max"
            step="1"
          />
        </div>

        <div class="row cam-row">
          <div class="row-head">
            <label>3D 视角 / 缩放</label>
            <button class="mini" :disabled="!cameraView" @click="copyText(cameraView, 'cam')">
              {{ copied === 'cam' ? '已复制 ✓' : '复制' }}
            </button>
          </div>
          <div class="css-out">{{ cameraView || '拖动 / 缩放地图后在此显示' }}</div>
        </div>

        <div class="css-out">.pos-map { {{ css }} }</div>
        <div class="actions">
          <button class="btn" @click="copyText(css, 'css')">
            {{ copied === 'css' ? '已复制 ✓' : '复制 CSS' }}
          </button>
          <button class="btn ghost" @click="resetLayout">重置</button>
        </div>
      </div>

      <div v-else class="panel-scroll">
        <MapEffectControls />
      </div>
    </aside>
  </transition>
</template>
```

Add exact layout rules:

```css
.drawer { overflow: hidden; }
.tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.tabs button {
  padding: 7px 0; color: #7fa8d9; cursor: pointer;
  background: rgba(36, 131, 255, 0.08);
  border: 1px solid rgba(36, 131, 255, 0.35); border-radius: 3px;
}
.tabs button.active { color: #00deff; border-color: #00deff; background: rgba(0, 222, 255, 0.1); }
.panel-scroll { flex: 1; min-height: 0; overflow-y: auto; padding-right: 4px; }
.layout-panel { display: flex; flex-direction: column; gap: 16px; }
```

Remove `margin-top: auto` from `.cam-row`; layout spacing is owned by `.layout-panel`.

- [ ] **Step 4: 让地图实时消费调试配置**

In `src/components/map/ChongqingMap3D.vue`, import `watch`, add `applyStaticGlowConfig` to the existing `./mapGlow` import, consume `effect`, delete the Task 4 `hoverSurfaceColor` / `hoverEmissiveColor` constants, and replace them with configurable targets:

```ts
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

const { cameraView, effect } = useMapDebug()
const hoverSurfaceTarget = new THREE.Color(effect.hover.surfaceColor)
const hoverEmissiveTarget = new THREE.Color(effect.hover.emissiveColor)

function applyEffectConfig(): void {
  hoverSurfaceTarget.set(effect.hover.surfaceColor)
  hoverEmissiveTarget.set(effect.hover.emissiveColor)
  if (staticGlow) applyStaticGlowConfig(staticGlow, effect)
  for (const visual of regionVisuals) {
    if (visual.hoverGlow) applyHoverGlowConfig(visual.hoverGlow, effect)
  }
}

const stopEffectWatch = watch(effect, applyEffectConfig, { deep: true, immediate: true })
```

Replace `updateRegionVisuals` with:

```ts
function updateRegionVisuals(deltaMs: number): void {
  const hover = effect.hover
  for (const visual of regionVisuals) {
    visual.progress = advanceHoverProgress(
      visual.progress,
      visual.active,
      deltaMs,
      hover.enterMs,
      hover.leaveMs
    )
    const eased = easeOutCubic(visual.progress)
    visual.group.position.z = hover.lift * eased
    visual.topMaterial.color.copy(baseTopColor).lerp(hoverSurfaceTarget, eased)
    visual.topMaterial.emissive.copy(baseTopEmissive).lerp(hoverEmissiveTarget, eased)
    visual.topMaterial.emissiveIntensity = THREE.MathUtils.lerp(0.35, hover.emissiveIntensity, eased)
    if (visual.hoverGlow) setHoverGlowProgress(visual.hoverGlow, effect, eased)
  }
}
```

Immediately after `setupScene(buildRegions(regions, byName, terrainTex))` in `init`, add `applyEffectConfig()`. At the beginning of `onBeforeUnmount`, add `stopEffectWatch()`.

- [ ] **Step 5: 更新调试入口文案并做浏览器验收**

In `src/components/layout/HeaderBar.vue`, change SVG `<title>` from `地图位置调试` to `地图调试`.

Run dev server:

```bash
npm run dev -- --host 127.0.0.1 --port 4173
```

At 1920×1080 verify:

1. “布局”页签仍能调整位置、复制 CSS/相机参数和重置布局；
2. “效果”页签的 18 个控件全部实时改变地图；
3. 将 `outerGlowWidth` 调为 16、`lift` 调为 2、`enterMs` 调为 400 后刷新，值和地图效果保持；
4. “恢复默认值”只恢复效果，不改变地图位置和相机；
5. “复制效果参数”所得 JSON 可 `JSON.parse`，与界面当前值一致；
6. 快速 hover、pointer leave、旋转、缩放、点击下钻无回归；
7. 控制台无新增 error/warn，稳定后常态 ≥55 FPS、连续 hover ≥50 FPS。

- [ ] **Step 6: 运行全量验证**

Run:

```bash
npm test
npm run typecheck
npm run build
git diff --check
```

Expected: 全部测试 PASS；类型检查和生产构建退出码 0；`git diff --check` 无输出。保存默认态和 hover 态浏览器截图用于交付核验。

- [ ] **Step 7: 提交调试控制与实时联动**

```bash
git add src/components/debug/MapEffectControls.vue src/components/debug/MapDebugDrawer.vue src/components/layout/HeaderBar.vue src/components/map/ChongqingMap3D.vue src/composables/useMapDebug.ts
git commit -m "feat: 增加地图光效调试控制"
```

## Final Verification

- [ ] Run `npm test` — Expected: all Vitest suites PASS.
- [ ] Run `npm run typecheck` — Expected: exit code 0.
- [ ] Run `npm run build` — Expected: Vite production build succeeds; existing chunk-size warning is acceptable.
- [ ] Run `git status --short` — Expected: no unintended files or uncommitted source changes.
- [ ] Recheck both saved screenshots against `docs/superpowers/specs/2026-07-11-map-glow-hover-design.md` and the user reference: outer halo is stronger than internal borders, hover preserves terrain detail and visually lifts only the active region.
