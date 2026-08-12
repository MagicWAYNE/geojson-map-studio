# GeoJSON 地图导入 V1 设计

日期：2026-08-12

状态：目标合同已固定，可进入 `/goal` 长任务实施

## 结果定义

在不破坏当前内置重庆地图的前提下，增加一条本地地图导入路径。用户在独立上传页选择一个 GeoJSON，并可选选择一份业务数据 JSON；系统校验成功后保存这份地图包，进入纯地图首页并用新的区域边界重建 Three.js 地图。自定义地图使用默认科技蓝材质，同时复用当前 HUD、3D 挤出、内外边界光、hover 抬升、马赛克粒子、自动轮播和区域柱体/浮层能力。

刷新浏览器后继续加载已激活的自定义地图。用户可以从上传页恢复内置重庆地图。任何解析、校验或持久化失败都不得替换当前有效地图。

## 已固定的产品决策

- `/` 继续是没有上传控件的纯地图展示页。
- 新增独立路由 `/map-loader`，承载上传、校验摘要、应用和恢复内置地图操作。
- V1 只接收 GeoJSON 几何，不接收 SVG。`.json` 只有在内容为 GeoJSON `FeatureCollection` 时才可作为几何文件。
- 只支持 `Polygon` 和 `MultiPolygon`，必须保留孔洞。
- GeoJSON 按 RFC 7946 的经纬度坐标处理，使用固定 Web Mercator 投影后再归一化到现有 `PLANE_MAX` 局部坐标，因此继续使用当前相机、HUD 和 `.pos-map` 构图。V1 面向不跨国际日期变更线的行政区地图。
- 区域身份默认使用 `properties.name`。若它不存在或不唯一，上传页允许从所有字符串/数字属性中选择一个能产生非空唯一值的名称字段。
- 自定义地图不使用现有天地图 PNG。顶面和侧面使用固定科技蓝材质，继续叠加现有光效和 hover 材质过渡。
- 业务数据是可选 JSON。没有业务数据时不生成虚假数值，不显示柱体数值徽标或数据面板，但区域几何、HUD、光效、hover 和自动轮播仍正常。
- 已激活地图包存入 IndexedDB；刷新后恢复。当前内置地图仍是无存储、存储损坏或用户重置时的可靠回退。
- 激活成功后导航到 `/`，通过正常的组件卸载/挂载完成资源切换。V1 不要求在同一 Three.js 实例中原地热替换。
- 自定义区域没有现有区县详情数据，因此点击不进入 `/district/:name`；内置地图保留现有下钻行为。

## 输入合同

### GeoJSON

必需满足：

- 根对象为 `FeatureCollection`，`features` 至少一项；
- 每个 feature 是 `Polygon` 或 `MultiPolygon`；
- 每个坐标都是 `[longitude, latitude]` 有限数值对，经度在 `[-180, 180]`、纬度在 Web Mercator 有效范围 `[-85.05112878, 85.05112878]`；
- 环至少有四个位置并闭合；单个环不得跨越国际日期变更线；
- 选定名称字段在所有 feature 中非空且唯一；
- 解析后至少存在一个有效区域；
- 文件不超过 10 MiB、区域数不超过 500、总位置数不超过 250,000。

不满足时返回结构化错误，显示具体文件、feature 序号/名称和原因；当前有效地图保持不变。

### 可选业务数据 JSON

V1 使用一个稳定、通用且足够小的合同：

```json
{
  "version": 1,
  "primaryMetric": { "label": "扶持企业", "unit": "家" },
  "secondaryMetric": { "label": "服务资源", "unit": "项" },
  "regions": [
    { "name": "区域 A", "primary": 120, "secondary": 45.6 }
  ]
}
```

规则：

- `version` 必须为 `1`；
- `regions[].name` 非空且唯一；
- `primary`、`secondary` 必须是有限的非负数；
- `primary` 驱动柱高和柱顶徽标；`secondary` 只进入 hover 数据面板；
- 数据名称与 GeoJSON 区域名称精确匹配；不匹配项在校验摘要中列出；
- GeoJSON 中没有数据的区域仍渲染，但没有柱体；
- 业务数据文件不超过 2 MiB，最多 500 行；
- `label` 和 `unit` 作为纯文本渲染，分别限制为 20 和 8 个 Unicode 字符。

## 深模块与 seam

### `mapDocument` 模块

这是几何格式与 Three.js 场景之间的核心 seam。调用者只学习一个规范化结果，不了解 GeoJSON 投影、环方向、孔洞、名称字段和限制校验。

```ts
interface MapDocument {
  version: 1
  source: { kind: 'builtin' | 'geojson'; displayName: string }
  geometry: ProjectionResult
  metrics: ReadonlyMap<string, MapRegionMetrics>
  metricLabels: {
    primary: { label: string; unit: string }
    secondary: { label: string; unit: string }
  } | null
  appearance:
    | { kind: 'terrain-texture'; textureUrl: string }
    | { kind: 'tech-blue' }
  drilldown: boolean
}

interface PreparedMapPackage {
  document: MapDocument
  persisted: PersistedMapPackage
  summary: MapImportSummary
}

interface GeoJsonInspection {
  featureCount: number
  totalPositionCount: number
  polygonCount: number
  multiPolygonCount: number
  usableNameProperties: string[]
  namePropertyConflicts: Array<{
    property: string
    duplicateValues: string[]
  }>
}

function inspectGeoJsonMap(geometryText: string): GeoJsonInspection

function prepareGeoJsonMapPackage(input: {
  geometryText: string
  geometryFileName: string
  nameProperty: string
  metricsText?: string
}): PreparedMapPackage
```

`inspectGeoJsonMap` 只完成结构、限制和可选名称字段探测，供上传页在激活前展示选择。`prepareGeoJsonMapPackage` 是完整测试主表面：成功时返回可渲染文档、可持久化原始包和摘要；失败时抛出带稳定错误码、路径和用户消息的 `MapImportError`。二者都不得产生存储或路由副作用。

`MapDocument.geometry` 是唯一规范化几何：它已经经过 Web Mercator 转换和 `projectRegions(..., PLANE_MAX)` 居中缩放，包含最终 `regions`、`scale` 和源平面 `center`。内置 adapter 也用 `parseSvgRegions()` + `projectRegions()` 生成这一结构。`ChongqingMap3D` 直接消费 `document.geometry`，不得再次投影或归一化。

内置 SVG 通过一个现有资源 adapter 产生相同 `MapDocument`，从而让 `ChongqingMap3D` 不再自己知道固定 SVG URL、重庆专用数据合并或纹理选择细节。

### `activeMapSource` 模块

这是有效地图与 IndexedDB 之间的 seam：

```ts
interface ActiveMapSource {
  load(): Promise<ActiveMapLoadResult>
  activate(prepared: PreparedMapPackage): Promise<MapDocument>
  resetToBuiltin(): Promise<MapDocument>
}

interface ActiveMapLoadResult {
  document: MapDocument
  warnings: MapSourceWarning[]
}

interface MapPackageStore {
  readActive(): Promise<PersistedMapPackage | null>
  writeActive(value: PersistedMapPackage): Promise<void>
  deleteActive(): Promise<void>
}
```

- `activeMapSource` 通过 `MapPackageStore` 依赖注入访问存储；生产 adapter 使用 IndexedDB，测试使用内存 adapter，不在业务模块中探测浏览器全局或 mock IndexedDB 私有行为。
- `load()` 先读取 store；无记录时直接加载内置地图，版本不支持、记录损坏或读取失败时回退内置地图并返回可诊断 warning。
- `activate()` 必须先完整准备并验证，再原子写入 active record；写入失败不改变旧记录。
- `resetToBuiltin()` 删除 active record 并加载内置地图。
- IndexedDB 名称固定为 `cqbigscreen-map-source`，schema/store 版本固定记录在模块中，不散落到 Vue 组件。

### Vue 与 Three.js 的职责

- `MapLoaderView.vue` 只负责文件选择、名称字段选择、摘要、错误展示和调用 `activeMapSource`；不解析几何。
- `HomeView.vue` 只请求当前 `MapDocument` 并传给地图；继续保持纯地图结构。
- `ChongqingMap3D.vue` 接收规范化 `MapDocument`，根据 `appearance` 选择纹理或科技蓝材质；不读取 `File`、IndexedDB 或 GeoJSON。
- `mapGeometry` 继续承担局部平面 `Region` 的归一化和几何运算；GeoJSON 经纬度到 Web Mercator 的转换、Polygon/MultiPolygon 的 outer/hole 结构转换在 adapter 内部完成。
- 柱体模块消费通用 `MapRegionMetrics`。现有 `DistrictMapItem` 由内置 adapter 转换，不要求为本目标全仓库重命名所有 `district` 文件。

## 状态与失败原子性

状态机：

```text
builtin ──有效上传并持久化──> custom
custom  ──有效上传并持久化──> custom(new)
custom  ──恢复内置地图──────> builtin
任意状态 ──解析/校验/写入失败──> 原状态
```

关键不变量：

- “校验通过”不等于“已激活”；只有 IndexedDB 写入成功才切换。
- 页面刷新只加载最后一次成功激活的包。
- 存储记录损坏不会让页面空白；回退内置地图并在上传页显示 warning。
- 切换路由时当前 Three.js 场景、RAF、ResizeObserver、纹理、几何和材质全部沿用现有 cleanup 路径释放。

## 默认科技蓝材质

自定义地图使用固定 V1 主题，不新增材质编辑器：

- 顶面：深蓝 `#173f78`，emissive `#0a2a66`；
- 侧面：`#05173a`；
- roughness/metalness 沿用现有地图的克制金属质感；
- 没有 `map` 纹理，不计算 raster UV 变换；
- hover、内外边界光、马赛克粒子和 HUD 继续由当前 effect/hud 配置控制。

视觉目标是“与当前地图同一套科技蓝语言”，不是复刻上传地区的卫星影像。

## 上传页交互

- 路由：`/#/map-loader`；页面可以保留项目背景，但不嵌入地图画布。
- 必需 GeoJSON 文件选择；可选业务 JSON 文件选择。
- 选择 GeoJSON 后立即解析属性候选，但不会激活。
- 名称字段不能唯一时，阻止应用并显示冲突值；候选字段变化后重新校验。
- 摘要显示：文件名、区域数、总位置数、Polygon/MultiPolygon 数、名称字段、匹配/缺失/多余业务数据数。
- “应用并查看地图”只有完整校验通过时可用；成功后导航 `/`。
- “恢复内置重庆地图”需要明确点击，但不需要二次确认；成功后导航 `/`。

## 验收合同

1. 初次运行或 IndexedDB 为空时，内置重庆地图外观、数据柱、HUD、hover、轮播、点击下钻和固化相机不回归。
2. 上传含 Polygon、MultiPolygon 和孔洞的有效 GeoJSON 后，所有区域在科技蓝材质中正确成形、缩放并居中。
3. 自定义地图保留 HUD、内外边界光、hover 抬升、马赛克粒子与自动轮播。
4. 无业务数据时没有柱体和数据浮层，不出现随机值、旧重庆值或 `undefined/NaN`。
5. 有业务数据时只为匹配且有效的区域创建柱体，primary/secondary 标签和单位正确显示。
6. 刷新 `/` 后仍加载最后成功激活的自定义地图；恢复内置地图后再次刷新仍是内置地图。
7. 重复导入、路由往返和失败导入不会叠加 canvas、RAF、事件监听、观察器或 Three.js 资源。
8. 非法 JSON、非 FeatureCollection、非 Polygon、空/重复名称、非有限坐标、超限文件或非法业务值均被拒绝，且当前地图不变。

## 非目标

- SVG 上传、CSV/Excel 业务数据、Shapefile/KML；
- 在线瓦片、上传自定义纹理、卫星影像自动裁切；
- 后端上传、对象存储、账号、跨设备同步或分享链接；
- 坐标系转换 UI、GCJ-02/WGS84 纠偏、地图编辑或边界绘制；
- 跨国际日期变更线的几何和极区 Web Mercator 之外的坐标；
- 自定义材质编辑器、主题市场或每区域独立样式；
- 为自定义区域生成详情页；
- 对全仓库 `district` 命名做纯重构；
- 同一 Three.js 实例内的无卸载热替换；
- 部署、推送、合并 `main` 或删除 worktree。
