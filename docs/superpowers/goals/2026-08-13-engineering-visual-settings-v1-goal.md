# `/goal` 启动材料：工程视觉设置 V1

## 使用前检查

- cwd 必须是 `/Users/fei/Projects/geojson-map-studio/.claude/worktrees/right-sidebar-settings`。
- 分支必须是 `codex/right-sidebar-settings`。
- 固定代码起点是 `a86da05 docs: align product split with standalone repository`。
- 启动前允许且只允许本 feature 新增的 spec、票据、计划与 harness 未提交；如出现其他改动，先停止并辨明归属，不得覆盖用户内容。
- 允许修改代码、测试、本 feature 的 `.scratch` 票据、计划与 harness，并创建范围明确的本地提交。
- 不授权合并 `main`、推送、部署、发布、改变仓库可见性、删除 worktree 或改写旧 feature 票据。

## 可直接复制的 `/goal` 命令

```text
/goal Complete Engineering Visual Settings V1 in /Users/fei/Projects/geojson-map-studio/.claude/worktrees/right-sidebar-settings without stopping until the fixed 1920x1080 right sidebar has two first-level functions, “数据配置” and “视觉样式”, while preserving the existing GeoJSON upload, metric definitions, region authoring, committed visualization, dirty/error state and authoring focus. Under “视觉样式”, release every visual control and action present at fixed point a86da05 through five second-level pages: “构图与视角”, “地图效果”, “图表样式”, “HUD” and “工程信息”. Completeness means no silent omission of any legacy layout field/action; normal or Hover boundary, surface, outward/inward glow, quality, mosaic field, preset, live/draft/apply/discard/reset/copy/status action; bar, badge, metric-panel or collision field/action; HUD anchor/static/rotating field/action; FPS/runtime/degradation/carousel/camera/config diagnostic. Replace entrepreneurship-specific control labels with generic region-map language but do not simplify the engineering parameter surface. Introduce one deep visual-settings session that owns effective/draft state, raw numeric edits, dirty state, normalization, presets, scoped/full reset, copy results, runtime diagnostics and page-session lifetime; views must not manage Three.js resources directly. Use one composition default source { left: 24, top: 132, width: 1120, height: 948 }, preserve camera defaults { pos: [-89.4, 117.0, 56.4], target: [2.7, -2.9, 7.0] }, warn but do not clamp engineering composition overlap, and keep all visual settings session-only. Every same-geometry visual change must hot-apply or reconcile in place without recreating renderer, canvas, base geometry, scene, camera or controls, and must never mutate or persist GeoJSON business data. Full legacy-control inventory proof, automated checks, 1920x1080 real-browser QA, persistence/resource audits, two-axis code review and scoped local commits must pass.

Read these first and treat them as the contract:
1. .scratch/engineering-visual-settings-v1/spec.md
2. .scratch/engineering-visual-settings-v1/issues/01-workspace-shell-composition-session.md
3. .scratch/engineering-visual-settings-v1/issues/02-release-all-map-effects.md
4. .scratch/engineering-visual-settings-v1/issues/03-release-all-chart-style-controls.md
5. .scratch/engineering-visual-settings-v1/issues/04-release-hud-and-engineering-tools.md
6. .scratch/engineering-visual-settings-v1/issues/05-browser-acceptance-and-review.md
7. .scratch/engineering-visual-settings-v1/legacy-control-inventory.md
8. docs/superpowers/plans/2026-08-13-engineering-visual-settings-v1.md
9. CONTEXT.md
10. docs/adr/0001-split-sample-and-map-tool-product-lines.md
11. src/views/HomeView.vue
12. src/views/MapLoaderView.vue
13. src/components/debug/MapDebugDrawer.vue
14. src/components/debug/MapEffectControls.vue
15. src/components/debug/MapDataControls.vue
16. src/components/debug/MapDistrictBarControls.vue
17. src/components/debug/MapDistrictBarOverlayControls.vue
18. src/components/debug/MapHudControls.vue
19. src/components/debug/MapInwardGlowControls.vue
20. src/components/debug/MapMosaicParticleControls.vue
21. src/composables/useMapDebug.ts
22. src/components/map/ChongqingMap3D.vue
23. src/components/map/mapEffectConfig.ts
24. src/components/map/mapDistrictBarConfig.ts
25. src/components/map/mapDistrictBarOverlayConfig.ts
26. src/components/map/mapHudConfig.ts
27. src/components/map/mapInwardGlowConfig.ts
28. src/components/map/mapMosaicParticleConfig.ts
29. src/components/map/mapDistrictBarLayer.ts
30. src/components/map/MapDistrictBarOverlay.vue
31. src/components/map/mapAuthoringWorkspace.ts
32. src/components/map/mapHoverCoordinator.ts

Use the available implement, TDD and code-review skills. Work the ticket frontier in dependency order with red-green-refactor at the highest seams: right-sidebar workspace, visual-settings session, normalized configs, chart-layer reconciliation and Three.js visual integration. Keep a compact progress log naming the current ticket, control-inventory delta, tests/browser evidence, remaining work and exact blockers. Do not weaken existing tests, test private Three.js collections when public lifecycle behavior is available, or equate a listening port with browser acceptance.

Preserve these invariants:
- “Complete release” is measured against every control descriptor and action reachable from the legacy layout/effect/data/HUD control system at a86da05. Reorganization and renaming are allowed; silent omission is not.
- The right sidebar is the only user-facing workspace. Do not restore a second overlay Debug Drawer or a second visual state owner.
- `数据配置` preserves geometry upload, optional JSON prefill, metric atomic updates, region atomic updates, dirty/errors and controlled authoring hover exactly as implemented.
- `视觉样式` contains five stable pages: composition/view, map effects, chart style, HUD and engineering information. All content scrolls inside the sidebar; the document remains fixed at 1920x1080.
- The visual-settings session is the sole owner of effective/draft visual state, raw numeric drafts, dirty state, normalization, presets, reset, copy feedback and runtime diagnostics. Components invoke intentions; they do not mutate Three.js objects.
- Home composition and reset use the same defaults: left 24, top 132, width 1120, height 948. Engineering values may overlap the sidebar or viewport after a warning; do not silently clamp otherwise valid values.
- Camera remains OrbitControls-driven and copyable. Do not add raw camera editing. Preserve source defaults pos [-89.4,117.0,56.4], target [2.7,-2.9,7.0].
- Partial numeric text stays field-local. Only normalized finite values may reach effect, HUD, layout, shader or chart config.
- Live preview and explicit draft modes retain their current behavior. Apply/discard and scoped/full reset must have exact tested scopes.
- Same-identity visual changes retain renderer, canvas, base scene, region geometry, camera and controls. Reconcile only the affected glow, mosaic, bar, overlay or HUD properties/resources.
- Visual styling never changes map geometry identity, region enabled values, display names, metric labels, units or numeric business values.
- Visual settings, runtime diagnostics and raw drafts remain page-memory-only and never enter IndexedDB, localStorage, sessionStorage, URL, cookies, Cache Storage or Service Worker state.
- Automatic carousel preference remains page-memory-only and hover priority stays map pointer > editor focus > carousel.
- Built-in Chongqing texture, eight default bars, Hover panel, carousel and drilldown remain unchanged before edits. Uploaded geometry retains tech-blue appearance and no custom drilldown.

Do not prune controls, redesign shaders, add new visual algorithms, add named preset persistence/import/export, add raw camera editing, persist visual or business settings, change GeoJSON parsing/identity, add new metrics or chart types, redesign outside 1920x1080, deploy, release, push, merge main or delete the worktree.

Do not mark complete from unit tests alone. In a real 1920x1080 browser prove: first-level data/visual switching with all authoring state retained; all five visual pages reachable and independently scrolling; current composition default/reset, numeric-slider sync, overlap warning, CSS/camera copy; representative and boundary changes in every normal/Hover outward/inward glow, surface, quality, mosaic and preset group; full bar/badge/panel/collision controls without business-value mutation; full HUD anchor/static/rotating controls; live/draft/apply/discard/scoped/full reset; performance/runtime/degradation/FPS/carousel and JSON copy; equivalent behavior on built-in and uploaded mixed geometry; repeated changes retain one canvas/renderer/base scene/camera/controls and do not leak HUD/glow/mosaic/bar resources; refresh retains geometry but clears business and visual settings; clean console and no visual persistence. Run the full source suite, typecheck, production build and diff checks. Run two-axis Standards/Spec review against a86da05 and resolve every actionable finding before final local commits and goal completion.
```

## Frontier 与依赖

```text
01 workspace + visual session + composition
 ├─ 02 complete map effects
 ├─ 03 complete chart style
 └─ 04 complete HUD + engineering tools
        └──────────────┬──────────────┘
                       ▼
                 05 acceptance/review
```

单 agent 默认按 01 → 02 → 03 → 04 → 05 执行；不要为了并行而让多个 ticket 同时重写共享的右侧栏或视觉会话。

## Goal 状态检查模板

```text
Ticket: <01-05>
Legacy inventory: <accounted>/<baseline>; omissions: none | <exact controls>
Completed evidence: <tests/browser/commit>
Current slice: <one visible end-to-end behavior>
Remaining: <short list>
Blocker: none | <exact repeated external condition>
Visual update path: composition | effect hot-apply | chart reconcile | HUD apply | no renderer change
Resource identity: canvas=<count/id>; renderer/base/camera/controls=<retained?>
Authoring state: geometry/data draft/committed/dirty/focus=<retained?>
Persistence audit: session-only | violation: <storage/field>
Scope changes: none | <explicitly approved change>
```

## 最终证据清单

- 固定点 `a86da05` 与工作树/分支/远程/clean status 证明；
- legacy layout/effect/data/HUD control + action inventory 与新页面映射，0 unexplained omissions；
- 每个 ticket 的 red-green-refactor 证据与范围明确本地提交；
- sidebar state preservation 与 composition behavior tests；
- visual-settings-session effective/draft/raw/dirty/normalize/preset/reset/copy tests；
- effect/inward/mosaic/quality/runtime/performance tests；
- bar/badge/panel/collision/reconcile/dispose tests；
- HUD/runtime/carousel tests；
- Three.js renderer/canvas/base/camera/controls identity tests；
- `npm test -- --dir src` 最终文件数与测试数；
- `npm run typecheck`；
- `npm run build`；
- `git diff --check a86da05 --` 与 worktree diff check；
- visual persistence scan；
- 1920×1080 数据页、五个视觉页、built-in edited、uploaded edited、reset 截图；
- console error/warning、document scroll、one-canvas/resource evidence；
- Standards / Spec 最终报告，0 actionable findings；
- `git status --short`、`git rev-list --left-right --count main...HEAD`、`git log a86da05..HEAD --oneline`；
- 明确记录未合并、未推送、未部署、未发布、未删除 worktree。
