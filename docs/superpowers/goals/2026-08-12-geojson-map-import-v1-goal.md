# `/goal` 启动材料：GeoJSON 地图导入 V1

## 使用前检查

- 当前 cwd 必须是：`/Users/fei/cqbigscreen/.claude/worktrees/open-source-prep`
- 当前分支必须是：`codex/open-source-prep`
- 当前基线应至少包含：`742891a style: reduce home view to map-only presentation`
- 允许目标执行器修改代码、测试和本目标文档，并创建本地提交。
- 不授权合并 `main`、推送、部署、删除 worktree 或改写用户无关文件。

若 `/goal` 不在命令列表，可按官方 OpenAI 文档启用 `features.goals`；不要在不支持 `/goal` 的情况下把普通单轮任务冒充长任务。

## 可直接复制的 `/goal` 命令

```text
/goal Complete GeoJSON 地图导入 V1 in /Users/fei/cqbigscreen/.claude/worktrees/open-source-prep without stopping until a user can upload a valid GeoJSON on /#/map-loader, optionally attach the V1 business metrics JSON, activate it, see the new centered Three.js boundaries with the existing HUD/glow/hover/mosaic/carousel effects and default tech-blue material, refresh and retain the active custom map from IndexedDB, reject invalid imports without replacing the current map, and reset back to the unchanged built-in Chongqing map; all acceptance checks, full tests, typecheck, production build, browser QA, two-axis code review, and scoped commits must pass.

Read these first and treat them as the contract:
1. .scratch/geojson-map-import-v1/spec.md
2. .scratch/geojson-map-import-v1/issues/01-map-document.md through 07-browser-acceptance.md
3. src/components/map/ChongqingMap3D.vue
4. src/components/map/mapGeometry.ts
5. src/components/map/mapDistrictBarLayer.ts
6. src/components/map/MapDistrictBarOverlay.vue
7. src/components/map/mapHud.ts
8. src/views/HomeView.vue
9. src/router.ts

Work checkpoint by checkpoint with red-green-refactor at the declared seams. Keep a compact progress log naming the current checkpoint, evidence passed, remaining work, and blockers. Preserve the current map-only home composition, fixed camera/layout, built-in SVG/terrain path, session-only effect defaults, and unrelated worktree changes. Do not implement SVG upload, online tiles, custom raster textures, backend storage, cross-device sync, CSV, custom-region detail pages, deployment, push, main merge, or worktree deletion.

Use the exact completion and stop conditions in the seven tickets. Do not mark complete from unit tests alone: exercise the import, refresh persistence, invalid rollback, no-metrics behavior, metrics behavior, and reset flow in a real 1920x1080 browser session. Never weaken tests or fabricate business data to make acceptance pass.
```

## Goal 状态检查模板

目标运行中查询 `/goal` 时，期望状态包含：

```text
Checkpoint: <1-7>
Completed evidence: <tests/artifacts/browser behavior>
Current work: <one concrete task>
Remaining: <short list>
Blocker: none | <exact repeated external condition>
Scope changes: none | <explicitly approved change>
```

## 人工验收矩阵

| 场景 | 必须观察到 | 禁止出现 |
| --- | --- | --- |
| 空存储首次打开 `/` | 当前内置重庆地图、纹理、HUD、柱体、hover、轮播、下钻 | 空白地图、自定义残留 |
| 有效 GeoJSON、无 metrics | 新边界、科技蓝材质、HUD/光效/hover/轮播 | 重庆名称/数值、柱体徽标、`NaN` |
| 刷新自定义地图 | 同一自定义区域与材质 | 回退内置、重复 canvas |
| 有效 GeoJSON + metrics | 只给匹配区域显示柱体/浮层；标签单位来自文件 | 为缺失区域造数、显示 extra 数据 |
| 非法 GeoJSON/metrics | 精确错误和保留现有地图 | active record 被覆盖、页面崩溃 |
| 恢复内置地图并刷新 | 回到当前重庆地图完整效果 | 自定义边界残留 |

## Harness 证据清单

- 聚焦 adapter、metrics、persistence、scene integration、loader view 测试；
- `npm test -- --dir src` 的最终文件数/测试数；
- `npm run typecheck`；
- `npm run build`；
- `git diff --check`；
- 1920×1080 无 metrics 截图；
- 1920×1080 有 metrics 截图；
- 浏览器控制台 error/warning 检查；
- Standards / Spec 两轴审查报告；
- `git status --short` 和 `main...HEAD` 领先/落后计数；
- 最终提交列表和明确的“未合并、未推送、未部署、未删除 worktree”。
