# `/goal` 启动材料：GeoJSON 分块会话态数据可视化 V1.1

## 使用前检查

- cwd 必须是 `/Users/fei/cqbigscreen/.claude/worktrees/open-source-prep`。
- 分支必须是 `codex/open-source-prep`。
- 固定代码起点是 `923a799 fix: close GeoJSON import validation gaps`；启动前允许且只允许本 feature 新增的 spec、票据与 harness 处于未提交状态，不得混入用户无关改动。
- 允许修改代码、测试、本 feature 的 `.scratch` 票据与本 harness，并创建范围明确的本地提交。
- 不授权合并 `main`、推送、部署、删除 worktree，或改写无关文件。

## 可直接复制的 `/goal` 命令

```text
/goal Complete GeoJSON session-only region visualization V1.1 in /Users/fei/cqbigscreen/.claude/worktrees/open-source-prep without stopping until a user can upload GeoJSON, see every detected region, edit a presentation-only display name, enable selected regions, enter two map-wide metric labels/units and per-region primary/secondary values, apply them to the existing Three.js bars/badges/hover panel, navigate within the SPA without losing the draft, then refresh and retain only the custom geometry while every custom display name, label, unit, enabled state and numeric value is gone. Existing optional metrics JSON must become editor prefill only. No custom business data may be written to IndexedDB, localStorage, sessionStorage, URL state, cookies, Cache Storage or Service Worker state. Legacy persisted metrics must be ignored and migrated to a geometry-only record. Built-in Chongqing behavior and all current custom-map HUD/glow/hover/mosaic/carousel/camera effects must remain intact. Full automated checks, 1920x1080 browser QA, two-axis code review and scoped local commits must pass.

Read these first and treat them as the contract:
1. .scratch/geojson-session-visualization-v1/spec.md
2. .scratch/geojson-session-visualization-v1/issues/01-stable-region-display-names.md
3. .scratch/geojson-session-visualization-v1/issues/02-geometry-only-persistence.md
4. .scratch/geojson-session-visualization-v1/issues/03-inline-region-data-editor.md
5. .scratch/geojson-session-visualization-v1/issues/04-json-prefill-session-only.md
6. .scratch/geojson-session-visualization-v1/issues/05-browser-acceptance-and-review.md
7. src/components/map/mapDocument.ts
8. src/components/map/activeMapSource.ts
9. src/components/map/indexedDbMapPackageStore.ts
10. src/components/map/mapSource.ts
11. src/views/MapLoaderView.vue
12. src/views/HomeView.vue
13. src/components/map/ChongqingMap3D.vue
14. src/components/map/mapDistrictBarLayer.ts
15. src/components/map/MapDistrictBarOverlay.vue

Use the repository implement and TDD skills. Work the ticket frontier in dependency order with red-green-refactor at the existing highest seams: normalized map document, active map source/session adapter, loader view, and Three.js document integration. Keep a compact progress log naming the current ticket, evidence passed, remaining work and exact blockers. Do not weaken existing tests or test private implementation details when observable behavior is available.

Preserve the map-only home composition, fixed .pos-map/camera view, built-in SVG/terrain/data/drilldown path, default tech-blue custom material, session-only effect defaults, and unrelated worktree changes. Test fixtures must be deterministic and clearly synthetic; do not present them as real business data.

Do not implement paid persistence, billing, accounts, cross-tab/device sync, more than two metrics, per-region units/colors, CSV/Excel/clipboard import, export, custom geometry editing, SVG/Shapefile/KML upload, online tiles, custom textures, custom-region detail pages, deployment, push, main merge or worktree deletion.

Do not mark complete from unit tests alone. Use a real 1920x1080 browser to prove manual entry, hover content, SPA retention, full-refresh data loss with geometry retention, JSON prefill plus manual correction, legacy-record migration, map replacement isolation, built-in reset, one-canvas lifecycle and a clean console. Run the full source test suite, typecheck, production build and diff check. Run the repository code-review skill against fixed point 923a799 and resolve every actionable Standards or Spec finding before committing final fixes and completing the goal.
```

## 实施顺序

| Ticket | 交付结果 | Blocked by |
| --- | --- | --- |
| 01 | 稳定分块身份与可编辑展示名称分离，渲染链不回归 | None |
| 02 | GeoJSON 几何持久化、业务数据纯内存、旧记录去数据迁移 | 01 |
| 03 | 分块编辑表格、两项指标、手工应用与 SPA 往返恢复 | 01, 02 |
| 04 | 现有业务 JSON 改为会话态批量预填并允许人工修正 | 03 |
| 05 | 1920×1080 验收、全量回归、双轴评审与提交审计 | 02, 03, 04 |

## Goal 状态检查模板

```text
Ticket: <01-05>
Completed evidence: <focused tests / browser behavior / commit>
Current work: <one concrete vertical slice>
Remaining: <short list>
Blocker: none | <exact repeated external condition>
Persistence audit: geometry-only | violation found: <exact field/storage>
Scope changes: none | <explicitly approved change>
```

## 人工验收矩阵

| 场景 | 必须观察到 | 禁止出现 |
| --- | --- | --- |
| GeoJSON 识别 | 每个分块恰好一行，原始标识可见，展示名默认一致 | 重复/丢失分块、修改稳定标识 |
| 手工数据应用 | 仅启用分块有柱体/徽标；hover 显示展示名和两项指标 | 缺失区造数、`NaN`、旧重庆值 |
| SPA 路由往返 | 同一页面运行期间草稿和渲染数据仍在 | 重复 canvas、数据突然清空 |
| 整页刷新 | 自定义边界与科技蓝效果仍在；所有自定义数据消失 | 恢复名称/单位/数值、柱体残留 |
| JSON 预填 | matched/missing/extra 正确；人工修正生效 | JSON 直接绕过编辑校验或进入持久化 |
| 更换 GeoJSON | 新分块使用空会话草稿 | 上一张地图数据串入 |
| 旧记录迁移 | 几何正常、旧 metrics 不展示、记录改为 geometry-only | 旧业务数据复活或地图空白 |
| 恢复内置地图 | 重庆纹理、柱体、hover、轮播、下钻完整 | 自定义数据残留、内置数据被清空 |

## Harness 证据清单

- 每张 ticket 的 red-green 证据与提交；
- 新记录和迁移后记录的 geometry-only 断言；
- 对 IndexedDB、localStorage、sessionStorage、URL 与 cache 的业务字段零持久化证明；
- map document、active source/session、loader、bar/overlay、Three.js 生命周期聚焦测试；
- `npm test -- --dir src` 最终文件数与测试数；
- `npm run typecheck`；
- `npm run build`；
- `git diff --check 923a799...HEAD`；
- 1920×1080 手工数据可视化截图；
- 同一几何刷新后无业务数据截图；
- 浏览器控制台 error/warning 与单 canvas 检查；
- legacy record 迁移浏览器或集成证据；
- Standards / Spec 两轴最终报告；
- `git status --short`、`git rev-list --left-right --count main...HEAD` 和提交列表；
- 明确记录未合并、未推送、未部署、未删除 worktree。
