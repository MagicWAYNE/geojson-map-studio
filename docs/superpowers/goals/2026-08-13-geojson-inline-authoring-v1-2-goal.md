# `/goal` 启动材料：GeoJSON 同页地图创作与原子更新 V1.2

## 使用前检查

- cwd 必须是 `/Users/fei/cqbigscreen/.claude/worktrees/open-source-prep`。
- 分支必须是 `codex/open-source-prep`。
- 固定代码起点是 `d0d0527 docs: record session visualization acceptance`。
- 启动前允许且只允许本 feature 新增的 spec、票据与 harness 未提交；如出现其他改动，先停止并辨明归属，不得覆盖用户内容。
- 允许修改代码、测试、本 feature 的 `.scratch` 票据与本 harness，并创建范围明确的本地提交。
- 不授权合并 `main`、推送、部署、删除 worktree，或改写已完成的 V1.1 票据和无关文件。

## 可直接复制的 `/goal` 命令

```text
/goal Complete GeoJSON same-page map authoring and atomic visualization updates V1.2 in /Users/fei/cqbigscreen/.claude/worktrees/open-source-prep without stopping until the 1920x1080 homepage shows the existing Three.js map shifted left at its current canvas size and camera composition plus a fixed independently scrolling authoring panel on the right; a completely valid GeoJSON upload activates and displays immediately without a second apply/navigation action; editor input remains a draft until the user clicks one row-level “更新此分块”, the map-wide “更新指标”, or “全部更新”; successful updates atomically reconcile columns, badges and hover-panel data without rebuilding geometry, camera, HUD, effects, renderer or canvas; focusing any control in a region row immediately highlights that stable region key; map pointer hover takes precedence over editor focus, editor focus takes precedence over automatic carousel, and leaving the map restores the active editor focus. Invalid or partial input must preserve the last committed visualization. JSON remains draft-only prefill. Geometry remains the only persisted custom-map data, refresh clears all business data, and built-in Chongqing texture, eight bars, hover, carousel and drilldown remain intact. Full automated checks, 1920x1080 browser QA, two-axis code review and scoped local commits must pass.

Read these first and treat them as the contract:
1. .scratch/geojson-inline-authoring-v1-2/spec.md
2. .scratch/geojson-inline-authoring-v1-2/issues/01-same-page-authoring-shell.md
3. .scratch/geojson-inline-authoring-v1-2/issues/02-direct-geojson-activation.md
4. .scratch/geojson-inline-authoring-v1-2/issues/03-atomic-business-updates.md
5. .scratch/geojson-inline-authoring-v1-2/issues/04-controlled-authoring-hover.md
6. .scratch/geojson-inline-authoring-v1-2/issues/05-browser-acceptance-and-review.md
7. .scratch/geojson-session-visualization-v1/spec.md
8. src/views/HomeView.vue
9. src/views/MapLoaderView.vue
10. src/router.ts
11. src/components/map/mapDocument.ts
12. src/components/map/activeMapSource.ts
13. src/components/map/mapVisualizationSession.ts
14. src/components/map/ChongqingMap3D.vue
15. src/components/map/mapDistrictBarLayer.ts
16. src/components/map/mapDistrictHoverCarousel.ts
17. src/components/map/mapDistrictBarOverlayLayout.ts
18. src/components/map/MapDistrictBarOverlay.vue

Use the repository implement and TDD skills. Work the ticket frontier in dependency order with red-green-refactor at the highest existing seams: the same-page authoring workspace, active map source/session lifetime, normalized map document, district-bar reconciliation, hover coordination, and Three.js document integration. Keep a compact progress log naming the current ticket, evidence passed, remaining work and exact blockers. Do not weaken existing tests, test private collections when public rendered behavior is available, or treat a listener/port alone as browser proof.

Preserve these invariants:
- GeoJSON structure changes are keyed by deterministic geometry identity and may rebuild the map scene once.
- Same-identity display names, labels, units, enabled membership and numeric values update only the business layer; they must not recreate the WebGL renderer, canvas, base region geometry, camera, controls, HUD, glow or mosaic particles.
- Business commits update the module-memory visualization session without rewriting unchanged geometry to IndexedDB.
- Editor inputs can contain blank or partial raw text, but only a fully validated atomic commit may enter MapDocument/Three.js.
- One row update commits enabled state, presentation display name, primary and secondary values together. Do not add one update button per field.
- The metric update commits both labels and both units together. Update-all validates the complete draft before changing committed state.
- Dirty uncommitted edits never affect the rendered data layer and never enter IndexedDB, localStorage, sessionStorage, URL state, cookies, Cache Storage or Service Worker state.
- Hover arbitration has one owner. While the pointer is inside the map, its hit (including empty space) wins; outside the map, editor focus wins; automatic carousel is last. Do not mutate the user's carousel-enabled preference merely to pause authoring.
- A focused region without committed metrics receives geometry hover effects but no fabricated badge or data panel.
- Failed file reads, geometry activation, row commits, metric commits, update-all and reset keep the last valid active map and committed visualization.
- Preserve current camera defaults { pos: [-89.4, 117.0, 56.4], target: [2.7, -2.9, 7.0] }, map canvas size 1120x948, tech-blue custom appearance, built-in texture/data/drilldown path, session-only effect defaults and unrelated worktree changes.

Do not implement per-keystroke business-data commits, partial-value preview panels, paid persistence, billing, accounts, cross-tab/device sync, more than two metrics, per-region units/colors, CSV/Excel/clipboard import, export, custom geometry editing, SVG/Shapefile/KML upload, online tiles, uploaded textures, custom-region detail pages, responsive redesign outside 1920x1080, deployment, push, main merge or worktree deletion.

Do not mark complete from unit tests alone. Use a real 1920x1080 browser to prove: same-page left-map/right-panel layout; direct valid upload; hover on row focus before values are committed; no visual data change while typing; atomic visible change after row update; invalid update preserves the last valid map; metric and update-all behavior; JSON prefill stays draft-only until update; pointer/editor/carousel precedence; repeated updates keep one canvas and do not reset the camera; geometry replacement isolation; full-refresh geometry retention plus total business-data loss; former upload-route compatibility; built-in reset with terrain texture, eight badges, hover and drilldown; and a clean console. Run the full source suite, typecheck, production build and diff checks. Run the repository code-review skill against fixed point d0d0527 and resolve every actionable Standards or Spec finding before final commits and goal completion.
```

## 实施顺序

| Ticket | 交付结果 | Blocked by |
| --- | --- | --- |
| 01 | 首页形成左地图、右创作面板，旧上传路由兼容 | None |
| 02 | 有效 GeoJSON 校验后直接、原子地替换当前地图 | 01 |
| 03 | 草稿/已提交状态分离，分块/指标/全部更新原子提交，业务层热更新 | 01, 02 |
| 04 | 编辑器 focus、地图鼠标、自动轮播统一 hover 仲裁 | 03 |
| 05 | 1920×1080 验收、资源/持久化审计、全量回归、双轴评审 | 02, 03, 04 |

纯线性执行时按 01 → 02 → 03 → 04 → 05；不要在 Ticket 01 尚未保持绿灯时并行改动渲染器。

## 推荐模块与 seam

| Seam | 责任 | 主要行为测试 |
| --- | --- | --- |
| Same-page authoring workspace | editable/committed 草稿、dirty/error、上传、预填、原子提交、focus | 用户操作后公开状态与 MapDocument |
| Active map source/session | 几何激活、纯内存业务替换、失败原子性、刷新边界 | 内存 store/session adapter |
| Normalized map document | 完整业务合同、稳定 key、展示字段验证 | compose/prefill tests |
| District-bar reconciliation | create/update/remove、range、高度、文本、资源释放 | layer 公共接口与 snapshots |
| Hover coordinator | pointer/editor/carousel 优先级与恢复 | 纯状态机行为 |
| Three.js integration | identity rebuild vs business hot update、单 canvas、受控 hover | 现有 renderer integration seam |

避免让 `HomeView` 直接管理 Three.js 柱体对象，也避免让 `ChongqingMap3D` 读取上传文件或浏览器存储。删除任一深模块时，如果复杂性会散落到多个调用方，说明 seam 放置正确。

## 状态模型

```text
GeoJSON file
  └─ complete validation + atomic geometry activation
       ├─ active geometry/document
       ├─ committed visualization (module memory only)
       └─ editable draft

editable draft --typing--> dirty raw fields --no renderer change--┐
                                                                  │
row update / metric update / update all                            │
  ├─ invalid --> row/group error + last committed map unchanged   │
  └─ valid ----> committed visualization + session replace -------┘
                            └─ one-frame business-layer reconcile
```

Hover 仲裁：

```text
pointerInsideMap ? pointerHitOrNull
                 : authoringFocusKey ?? carouselKey ?? null
```

## Goal 状态检查模板

```text
Ticket: <01-05>
Completed evidence: <focused tests / browser behavior / commit>
Current work: <one concrete vertical slice>
Remaining: <short list>
Blocker: none | <exact repeated external condition>
Scene path: geometry rebuild | business reconcile | no renderer change
Canvas/resource count: <observed>
Persistence audit: geometry-only | violation found: <exact field/storage>
Scope changes: none | <explicitly approved change>
```

## 人工验收矩阵

| 场景 | 必须观察到 | 禁止出现 |
| --- | --- | --- |
| 同页布局 | 1120×948 地图左移；右侧面板完整、独立滚动 | 面板遮挡地图、页面整体滚动、第二 canvas |
| 直接上传 | 完整校验后地图立刻变为新边界、分块行出现 | 额外“应用地图”跳转、无效文件替换画面 |
| 输入未更新 | 对应分块 hover；地图仍显示上次提交数据；行显示 dirty | 半截数值进入柱体/窗格、闪烁或重建地图 |
| 更新此分块 | 展示名、启用状态、主/次值同批生效，hover 保持 | 字段分批生效、相机复位、canvas 替换 |
| 更新指标 | 两个 label/unit 共同生效 | 名称与单位版本不一致 |
| 全部更新 | 整份草稿一次校验/提交 | 部分行成功、部分行仍旧但无说明 |
| 非法更新 | 精确错误、dirty 保留、地图保持上次有效状态 | `NaN`、柱体消失、面板显示伪数据 |
| Hover 优先级 | 地图鼠标 > 编辑器 focus > 轮播；离开地图恢复编辑 focus | 两区同时激活、轮播抢焦点、修改全局开关 |
| JSON 预填 | 仅编辑字段改变；显式更新后地图改变 | 上传 JSON 自动提交或进入持久化 |
| 反复更新 | 一张地图、一个 canvas、一套 HUD/effect，当前相机不变 | WebGL context/DOM/资源累积 |
| 更换 GeoJSON | 新 identity 直接加载，旧 dirty/focus/data 清空 | 上一地图数据串入、新旧 hover 混合 |
| 整页刷新 | 自定义几何仍在，所有业务数据与 dirty/focus 消失 | 柱体/展示名/单位/数值恢复 |
| 旧上传路由 | 重定向到同页工作区 | 独立 loader 复活、URL 携带业务数据 |
| 恢复内置地图 | 纹理、8 个徽标、hover、轮播、区县下钻正常 | 自定义数据残留或内置资源被热更新破坏 |

## Harness 证据清单

- 每张 ticket 的 red-green-refactor 证据和范围明确的本地提交；
- workspace 对 editable/committed/dirty/error/focus 的行为测试；
- geometry activation 与 session-only visualization replacement 的持久化审计；
- district-bar reconcile 对新增、更新、删除、range、高度、snapshot 和 dispose 的测试；
- hover coordinator 的完整优先级/恢复状态表测试；
- Three.js 集成中 geometry identity 改变会重建、同 identity 业务更新不重建的证据；
- 反复更新前后的 canvas、renderer/HUD/effect 公开生命周期证据；
- `npm test -- --dir src` 最终文件数与测试数；
- `npm run typecheck`；
- `npm run build`；
- `git diff --check d0d0527...HEAD` 与工作树 diff check；
- 1920×1080 更新前 dirty+hover 截图；
- 1920×1080 更新后同一区块柱体/徽标/窗格截图；
- 刷新后同一几何无业务数据截图；
- 浏览器控制台 error/warning、单 canvas、无页面滚动检查；
- JSON prefill、替换几何、旧路由和内置 reset 的浏览器证据；
- Standards / Spec 两轴最终报告；
- `git status --short`、`git rev-list --left-right --count main...HEAD`、`git log d0d0527..HEAD --oneline`；
- 明确记录未合并、未推送、未部署、未删除 worktree。

## 已知风险与约束

| 风险 | 降低方式 |
| --- | --- |
| Vue 文档替换导致整个 Three.js 重挂载 | 按 geometry identity 区分 scene rebuild 与 business reconcile，并测试 canvas identity |
| 主值变化使其他柱高失真 | reconcile 每次重新计算全体 enabled range/highs |
| 启用/关闭频繁产生资源泄漏 | data-layer module 负责增删和 dispose，使用资源计数/幂等测试 |
| 编辑器与鼠标/轮播争抢 hover | 单一 hover coordinator 输出唯一 effective key |
| 输入 blur 点击按钮导致 focus 短暂丢失 | 以 row-level focus containment 管理 focus，更新成功后显式保留 row focus |
| JSON prefill 被误认为已提交 | editable/committed 双状态与 dirty 标识，上传不调用 commit |
| 每次业务提交重复写 IndexedDB | active-source 明确提供 same-identity session replacement path |
| 500 个分块导致每次更新代价过高 | 用户点击触发、每帧合并一次，保留 500 region 上限并做上限 fixture 性能检查 |
