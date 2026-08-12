# GeoJSON 地图导入 V1 Implementation Plan

> 供 `/goal` 长任务使用。每个检查点必须先写失败测试、实现最小闭环、运行聚焦验证，再进入下一项。不要在中途合并 `main` 或推送远端。

**Goal:** 在当前 `codex/open-source-prep` worktree 中交付“GeoJSON 上传 + 默认科技蓝材质 + 可选业务数据”，刷新可恢复，失败不破坏当前地图，并完整保留现有地图视觉效果。

**Architecture:** 用 `mapDocument` 深模块把内置 SVG adapter 和 GeoJSON adapter 收敛成一个 `MapDocument`；用 `activeMapSource` 深模块封装 IndexedDB 和内置回退。上传页只准备/激活地图包，Three.js 地图只消费规范化文档。

**Tech Stack:** Vue 3、TypeScript、Three.js r185、d3-geo、Vue Router、IndexedDB、Vitest + happy-dom、Vite、浏览器实屏验收。

## Global constraints

- 先读设计规格：`docs/superpowers/specs/2026-08-12-geojson-map-import-v1-design.md`。
- 保留当前 `/` 的纯地图展示，不把上传控件塞回首页。
- 保留当前 `.pos-map`、相机、HUD 和 effect 默认合同。
- 内置重庆地图必须继续使用当前 SVG、天地图纹理、业务数据与点击下钻。
- 自定义地图只使用默认科技蓝材质，不读取旧重庆业务数据，不进入详情页。
- IndexedDB 只保存最后成功激活的自定义地图包；解析或写入失败保持旧状态。
- 不实现设计规格“非目标”中的项目。
- 不弱化、删除或跳过现有测试来获得绿色结果。
- 全量测试使用 `npm test -- --dir src` 或等价的 worktree-safe 命令。
- 只提交本目标文件；不得合并 `main`、推送、发布或删除 worktree。

## Checkpoint 1 — 规范化地图文档与 GeoJSON adapter

**Primary files:**

- Create: `src/components/map/mapDocument.ts`
- Create: `src/components/map/mapDocument.test.ts`
- Modify: `src/components/map/mapGeometry.ts`
- Modify: `src/components/map/mapGeometry.test.ts`

**Deliverable:**

- 定义 `MapDocument`、`PreparedMapPackage`、`MapImportSummary`、`MapImportError` 和 `MapRegionMetrics`。
- 实现 `inspectGeoJsonMap()` 和 `prepareGeoJsonMapPackage()`，支持 Polygon/MultiPolygon、孔洞、名称字段、固定 Web Mercator 投影、归一化、限制检查和结构化错误。
- `MapDocument.geometry` 直接保存最终 `ProjectionResult`；adapter 之外不得再次投影或归一化。
- 返回纯数据，不访问 IndexedDB、路由或 Three.js。

**Focused proof:**

- Polygon、MultiPolygon、孔洞、反向环均得到正确 `Region`；
- `properties.name` 与自选属性字段均可建立唯一名称；
- 无效根对象、几何、名称、坐标、跨日期变更线几何和超限输入返回稳定错误码；
- 输入对象/文本不被修改。

## Checkpoint 2 — 可选业务数据合同

**Primary files:**

- Modify: `src/components/map/mapDocument.ts`
- Modify: `src/components/map/mapDocument.test.ts`
- Modify: `src/components/map/mapDistrictBarLayer.ts`
- Modify: `src/components/map/mapDistrictBarLayer.test.ts`
- Modify: `src/components/map/MapDistrictBarOverlay.vue`
- Modify/add focused overlay tests as needed

**Deliverable:**

- 解析设计规格中的 metrics V1 JSON；校验标签、单位、唯一名称和非负有限值。
- 产生 matched/missing/extra 摘要。
- 柱体与浮层改为消费 `MapRegionMetrics`，内置 `DistrictMapItem` 由 adapter 转换。
- 无数据时不创建柱体、徽标或数据面板；不可复用旧重庆数值。

**Focused proof:**

- primary 驱动柱高，secondary 只显示在面板；
- 部分匹配只影响匹配区域；
- 无数据和空匹配都不会产生 `NaN`、`undefined` 或旧数据；
- 可见标签与单位来自上传文档并作为纯文本渲染。

## Checkpoint 3 — 内置地图 adapter 与通用场景输入

**Primary files:**

- Create: `src/components/map/builtinMapDocument.ts`
- Create: `src/components/map/builtinMapDocument.test.ts`
- Modify: `src/components/map/ChongqingMap3D.vue`
- Modify: `src/components/map/ChongqingMap3D.test.ts`
- Modify: `src/api/index.ts` and `src/types/index.ts` only where required by the adapter

**Deliverable:**

- 把固定 SVG URL、天地图纹理、重庆业务数据和“两江新区”兼容逻辑收进内置 adapter。
- 内置 adapter 用 `parseSvgRegions()` + `projectRegions()` 生成与 GeoJSON 相同的 `ProjectionResult`。
- `ChongqingMap3D` 改为只消费 `MapDocument.geometry`，不再自行投影，并根据 `appearance` 构建 terrain-texture 或 tech-blue 顶面材质。
- 自定义地图继续复用边界光、hover、马赛克、轮播、HUD、柱体和 overlay；只有 `drilldown=true` 才导航详情页。

**Focused proof:**

- 内置 adapter 仍生成当前 8 个区域与两江新区合并数据；
- 内置纹理的 UV 映射保持原样；
- tech-blue 路径不加载 PNG、不执行 raster UV 变换；
- 自定义地图不可下钻，内置地图仍可下钻；
- teardown 继续只释放自己拥有的所有 Three.js 资源一次。

## Checkpoint 4 — IndexedDB active map source

**Primary files:**

- Create: `src/components/map/activeMapSource.ts`
- Create: `src/components/map/activeMapSource.test.ts`
- Create: `src/components/map/indexedDbMapPackageStore.ts`
- Create: `src/components/map/indexedDbMapPackageStore.test.ts`

**Deliverable:**

- 定义 `MapPackageStore` 并通过构造参数注入 `activeMapSource`；测试使用内存 adapter，生产使用 IndexedDB adapter。
- 实现 `load()`、`activate()` 和 `resetToBuiltin()`；`load()` 返回文档和结构化 warnings。
- 固定数据库/store/schema 版本和记录格式。
- 激活采用先准备、后原子写入；存储损坏或版本未知回退内置地图并返回 warning。
- 不用 localStorage 保存大文件，不存本地文件路径。

**Focused proof:**

- 空库加载内置地图；
- 激活后新实例/刷新语义能恢复自定义地图；
- 写入失败保留旧 active record；
- 损坏/未知版本记录回退内置地图；
- 读取失败回退内置地图且 warning 可由上传页呈现；
- reset 删除 active record，后续 load 仍为内置地图。

## Checkpoint 5 — 上传页和路由闭环

**Primary files:**

- Create: `src/views/MapLoaderView.vue`
- Create: `src/views/MapLoaderView.test.ts`
- Modify: `src/router.ts`
- Modify: `src/views/HomeView.vue`
- Modify: `src/views/HomeView.test.ts`

**Deliverable:**

- 新增 `/map-loader`；保持 `/` map-only。
- 实现 GeoJSON 必选、metrics JSON 可选、名称字段选择、校验摘要、应用和恢复内置地图。
- 只有完整校验通过才能应用；激活成功后导航 `/`。
- HomeView 异步加载 active document；加载期间不显示旧业务 UI，存储异常时使用内置回退。MapLoaderView 挂载时读取并呈现 load warnings。

**Focused proof:**

- 页面语义标签、键盘操作、按钮 enable/disable 和错误呈现；
- 名称字段冲突会阻止应用；
- 成功激活/重置分别调用正确模块方法并导航；
- HomeView 仍只有背景和地图主体，不重新引入页头/侧栏/调试抽屉。

## Checkpoint 6 — 资源生命周期与回归

**Primary files:**

- Modify/add only lifecycle tests justified by failures
- Add deterministic GeoJSON and metrics fixtures under a test-only fixture directory

**Required fixtures:**

1. `valid-mixed.geojson`: 3 个区域，覆盖 Polygon、带孔 Polygon、MultiPolygon；
2. `valid-metrics.json`: 2 个匹配、1 个 GeoJSON 缺失、1 个多余数据；
3. `no-metrics`: 只使用 fixture 1；
4. `duplicate-names.geojson`；
5. `invalid-coordinate.geojson`；
6. `unsupported-geometry.geojson`。

**Automated proof:**

```bash
npm test -- --dir src
npm run typecheck
npm run build
git diff --check
```

所有命令必须通过。构建已有的 chunk-size warning 可以记录，但不得把 warning 描述为失败或通过以外的错误。

## Checkpoint 7 — 1920×1080 浏览器验收

在 `127.0.0.1` 的空闲端口启动当前 worktree，使用浏览器实际执行，而不是只确认端口监听：

1. 清空本目标 IndexedDB active record，打开 `/`：内置地图视觉和互动正常。
2. 打开 `/#/map-loader`，上传 `valid-mixed.geojson`，不上传 metrics，应用：
   - `/` 显示恰好 3 个新区域；
   - 使用科技蓝材质；
   - HUD、边界光、hover、马赛克和轮播存在；
   - 没有柱体徽标、数据面板、旧重庆区域名或旧数值。
3. 刷新 `/`：仍是 3 区自定义地图。
4. 再导入相同 GeoJSON + `valid-metrics.json`：仅 2 个匹配区域出现柱体/徽标，摘要明确 missing/extra。
5. 上传每个非法 fixture：显示对应错误，返回 `/` 时当前有效自定义地图不变。
6. 在 loader 点击恢复内置地图并刷新：恢复当前重庆地图、天地图纹理、柱体数据和下钻。
7. 重复两轮 loader ↔ home：DOM 中始终只有一个 canvas；控制台没有未处理错误、资源重复或 Vue warning。

保存一张“无业务数据科技蓝地图”和一张“有业务数据地图”的 1920×1080 截图作为验收证据；截图不需要提交到 Git，除非仓库已有明确产物目录。

## Completion and stop condition

只有同时满足以下条件才可把 goal 标为完成：

- 设计规格的 8 条验收合同全部有自动化或浏览器证据；
- 全量测试、类型检查、构建和 diff check 通过；
- 内置地图回归与自定义地图两条路径都实际跑通；
- 代码经过仓库 `code-review` 的 Standards 与 Spec 双轴审查且无未解决 actionable finding；
- 当前 worktree 的目标改动已用有意义的提交落在 `codex/open-source-prep`；
- 没有合并、推送、部署或删除 worktree；
- 最终状态报告列出提交、测试数字、浏览器证据、已知限制和未执行动作。

如果连续三轮都因为同一个外部条件无法推进，按 `/goal` 阻塞规则报告；不要通过删除断言、伪造数据、跳过浏览器验收或扩大权限来宣称完成。
