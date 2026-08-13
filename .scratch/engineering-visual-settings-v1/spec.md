# 工程视觉设置 V1

Status: ready-for-human

## Problem Statement

GeoJSON 科技地图工作台已经具备成熟的 Three.js 边界、柔光、Hover、马赛克粒子、数据柱体、指标浮层和 HUD 效果，也保留了原数据大屏用于调试这些效果的一整套控制实现。但当前工具页面只展示 GeoJSON 与区域数据配置，视觉控制入口已经从页面移除，地图创作者无法在同一工作区中调节构图和视觉参数。

现有控制实现以“地图调试”为定位，分散在布局、效果、数据调试和 HUD 四类页面中，直接依赖共享的 debug 状态。部分文案仍绑定旧创业扶持大屏；构图重置值仍为旧页面的 `left: 400px`，与当前工具页的 `left: 24px` 不一致；不同控制页还分别管理实时预览、草稿、归一化、复制和重置。第一版开源准备阶段需要完整释放这些工程能力，而不是提前裁剪参数，同时要避免把调试状态和 Three.js 更新知识扩散进右侧栏。

## Solution

右侧创作工作区增加“数据配置 / 视觉样式”两类一级功能。现有 GeoJSON 上传、指标定义和区域数据编辑完整保留在“数据配置”；“视觉样式”以“构图与视角 / 地图效果 / 图表样式 / HUD / 工程信息”五个二级页面承载旧控制系统的全部可操作能力。

第一版明确定位为工程视觉设置台。所有旧视觉字段、预设、实时预览、草稿应用、放弃、分组重置、全部重置、参数复制、运行状态和性能警告均须有可用入口。旧的行业文案改为通用地图创作语言，但不因产品化重命名而删减控制项。

视觉状态由一个深的视觉设置会话统一拥有：构图、相机读数、地图效果、数据柱体与浮层、HUD、草稿/已应用状态、dirty、归一化、运行状态和重置意图都通过同一 interface 暴露。右侧栏不直接管理 Three.js 对象，`ChongqingMap3D` 只消费会话发布的有效配置并沿用当前热更新路径。视觉设置继续只存在于页面会话中，刷新恢复源码默认值，不进入 IndexedDB、localStorage、sessionStorage、URL、Cookie、Cache Storage 或 Service Worker。

## User Stories

1. As a map creator, I want to switch between data configuration and visual styling in the same right sidebar, so that I can complete one map without leaving the workspace.
2. As a map creator, I want switching sidebar functions to preserve my GeoJSON, region-data draft and applied visualization, so that navigation does not lose work.
3. As an engineering user, I want every visual control from the original data-big-screen panel available in the first release, so that I can decide later which controls are worth retaining.
4. As a map creator, I want visual controls grouped by composition, map effects, chart style, HUD and engineering information, so that a large parameter set remains navigable.
5. As a map creator, I want each secondary visual page to scroll independently inside the fixed sidebar, so that the 1920×1080 workspace itself never scrolls.
6. As a map creator, I want to edit the map's left, top, width and height, so that I can tune its composition against the sidebar.
7. As a map creator, I want numeric composition fields and sliders to stay synchronized, so that coarse and precise adjustment are both possible.
8. As a map creator, I want the composition reset to restore the current tool layout, so that reset never jumps back to the old data-big-screen position.
9. As an engineering user, I want to copy the current map CSS, so that a proven composition can be promoted into source defaults later.
10. As an engineering user, I want to see and copy current camera position and target, so that a proven Three.js view can be promoted into source defaults later.
11. As a map creator, I want a clear warning when the map composition overlaps the sidebar or leaves the design viewport, so that engineering freedom does not hide layout risk.
12. As a map creator, I want to control normal internal-border color, width and opacity, so that uploaded geometry can match different visual themes.
13. As a map creator, I want to control the normal outer core and outer glow, so that boundary prominence is adjustable.
14. As an engineering user, I want every near/far radius, opacity, falloff, softness and pass field for normal outward glow, so that the full glow profile remains tunable.
15. As a map creator, I want to control normal inward glow, so that the map surface can retain depth without external bloom.
16. As a map creator, I want to control Hover surface, emissive color, intensity, outline, lift and transition timing, so that region interaction can be tuned end to end.
17. As an engineering user, I want every near/far radius, opacity, falloff, softness and pass field for Hover outward and inward glow, so that no original shader control is lost.
18. As a map creator, I want to enable or disable Hover mosaic particles and edit every particle color, density, cluster, cell, gap, flicker, burst, offset and seed field, so that the original particle system remains fully accessible.
19. As a map creator, I want the existing B3 glow and blue-purple mosaic presets, so that known-good reference looks remain one action away.
20. As a map creator, I want to select render scale and composition alpha limits, so that image quality and GPU load can be balanced.
21. As an engineering user, I want effect runtime states and actionable performance warnings, so that high-cost combinations are diagnosable.
22. As a map creator, I want effect controls to support live preview and draft mode, so that I can choose immediate experimentation or explicit application.
23. As a map creator, I want to apply, discard, reset one effect group or reset all effects, so that experiments are reversible at the correct scope.
24. As an engineering user, I want to copy the complete normalized effect configuration, so that a tuned configuration can be reviewed or promoted later.
25. As a map creator, I want generic “区域数据柱体” language instead of entrepreneurship-specific labels, so that controls make sense for arbitrary GeoJSON maps.
26. As a map creator, I want every existing bar control available, including enablement, colors, width, anchor offsets, height range, exponent, glow, base ring, pulse ring, animation and Hover response, so that the complete chart appearance remains tunable.
27. As a map creator, I want every existing badge control available, including display, positioning, size, padding, color, typography, number formatting and animation, so that column labels can be tuned precisely.
28. As a map creator, I want every existing Hover metric-panel control available, including preferred side, gap, size, padding, title asset, typography, formatting and transition fields, so that the information pane can be tuned precisely.
29. As an engineering user, I want every collision-avoidance field for badges and panels, so that dense uploaded maps can be diagnosed.
30. As an engineering user, I want bar runtime count, numeric range and degraded state visible, so that chart-layer failures are distinguishable from missing business data.
31. As an engineering user, I want normalized bar and overlay JSON copy actions plus scoped resets, so that chart styling can be inspected and promoted independently.
32. As a map creator, I want all HUD anchor, static-disc and rotating-disc fields available, so that the technology base can fit different boundary geometries.
33. As a map creator, I want HUD live preview and draft mode with apply, discard and reset, so that large HUD experiments remain reversible.
34. As an engineering user, I want to copy the complete normalized HUD configuration, so that a tuned configuration can be promoted later.
35. As an engineering user, I want FPS, render target size, render scale, glow-channel state, mosaic state and degraded status in one engineering page, so that visual regressions can be diagnosed in place.
36. As an engineering user, I want to toggle automatic region carousel from the engineering page, so that Hover effects can be observed without editing data.
37. As a map creator, I want visual adjustments to keep the current GeoJSON, applied region values, dirty data fields and authoring focus unchanged, so that styling never corrupts content authoring.
38. As a map creator, I want visual adjustments to preserve camera state unless I explicitly manipulate the camera or composition, so that unrelated settings do not reset my view.
39. As a maintainer, I want all same-geometry visual changes to retain one renderer, one canvas and one base map scene, so that opening the full control surface does not leak WebGL resources.
40. As a maintainer, I want invalid or partial numeric text to remain editable without entering Three.js, so that `NaN`, flicker and unstable shader values never appear.
41. As a maintainer, I want every published control represented in an inventory test, so that later refactors cannot silently drop an original field.
42. As a free-version user, I want visual settings to reset on refresh, so that the existing non-persistent product boundary remains unchanged.
43. As a returning user, I want persisted custom geometry to survive refresh while visual settings and business data return to defaults, so that storage behavior remains predictable.
44. As a built-in-map viewer, I want the default Chongqing texture, bars, Hover, HUD, carousel and drilldown unchanged before any visual setting is applied, so that exposing controls does not regress the sample.
45. As a custom-map creator, I want the same engineering controls to affect uploaded tech-blue maps, so that the panel is not limited to the built-in sample.

## Implementation Decisions

- The existing fixed right sidebar remains the single workspace surface. It gains two first-level functions: “数据配置” and “视觉样式”; no second overlay drawer is reintroduced.
- The visual function contains five second-level pages: composition and view, map effects, chart style, HUD, and engineering information.
- The first release deliberately publishes the complete legacy visual-control inventory. Product simplification is a later decision and must not be smuggled into this implementation.
- A visual-settings catalog owns stable section identifiers, labels, order, engineering classification and default expansion. Completeness tests compare the published catalog/control descriptors against the legacy baseline.
- A deep visual-settings-session module owns effective and draft visual state, dirty state, normalization, scoped apply/discard/reset, presets, runtime diagnostics and session lifetime. Views invoke user intentions through its interface rather than mutating renderer objects.
- Existing low-level normalization and clone functions remain authoritative. The session composes them; it does not create a competing visual-config schema.
- Existing map-effect, bar, overlay, mosaic, inward-glow and HUD controls may be reused internally, but debug-specific ownership and industry terminology are removed from their public presentation.
- Composition defaults have one source of truth matching the current tool workspace: `left: 24`, `top: 132`, `width: 1120`, `height: 948`. Home rendering and composition reset consume the same value.
- Composition may intentionally overlap the sidebar in engineering mode. The system warns but does not clamp the user's chosen layout beyond existing numeric safety limits.
- Camera position and target remain runtime readings from OrbitControls. Copy is supported; programmatic camera text editing is not introduced in this version.
- Visual edits do not alter map documents, map geometry identity, visualization-session data or active-map persistence.
- Effect and HUD pages retain both live-preview and explicit-draft modes. Partial numeric text remains local to its field until a valid commit event; normalized values alone reach effective config.
- Map effects continue using in-place watchers and runtime application. Same-geometry visual updates must not recreate renderer, canvas, region meshes, controls or camera.
- Data styling changes reconcile the existing bar and overlay layers without changing the underlying region values, labels or units.
- The engineering page retains normalized JSON copy and runtime status because the user explicitly needs the full panel during open-source preparation.
- Automatic carousel preference remains page-memory-only and independent from editor-focus pause behavior.
- Visual settings remain page-memory-only. No browser persistence, remote persistence, URL encoding or export file is added.
- The old standalone debug drawer and header debug toggle become obsolete once equivalent functionality exists in the visual workspace. They may remain unmounted during migration, but final implementation must have one state owner and one user-facing entry.

## Testing Decisions

- Tests cross the highest stable seams: the right-sidebar workspace, visual-settings-session interface, existing normalized configuration interfaces and `ChongqingMap3D` integration.
- A source-level and rendered inventory test proves every legacy control descriptor and action is reachable from one of the five visual pages. Exact CSS class names are not the contract.
- Visual-settings-session tests cover effective versus draft state, partial numeric input, apply, discard, scoped reset, full reset, preset application, dirty state, normalization, warnings and refresh/session reset.
- Composition integration tests prove numeric/range synchronization, current-layout reset, warning-only overlap behavior, CSS copy text and camera copy text.
- Effect tests retain prior coverage for every group, B3 preset, mosaic preset, runtime status, performance warnings, live/draft behavior and normalized JSON.
- Chart-style tests retain prior coverage for every bar and overlay field, generic terminology, runtime status, JSON copy and scoped reset.
- HUD tests retain prior coverage for every anchor/static/rotating field, live/draft behavior, normalization, JSON copy and reset.
- Homepage tests prove switching first- and second-level pages preserves data-authoring state and keeps one fixed independently scrolling sidebar.
- Three.js integration tests prove visual changes use hot-apply/reconcile paths and keep renderer, canvas, base scene, geometry, camera and controls identities stable.
- Persistence audits assert that visual settings never enter IndexedDB, Web Storage, URL, cookies, Cache Storage or Service Worker state.
- Real-browser acceptance uses 1920×1080 and covers the built-in map plus an uploaded mixed Polygon/MultiPolygon/hole fixture, full page navigation, representative changes from every visual group, overlap warnings, draft/apply/discard/reset, JSON copy, carousel, clean console and single-canvas/resource lifecycle.
- Full completion requires all source tests, typecheck, production build, diff checks and two-axis Standards/Spec review against the fixed starting commit with no unresolved actionable findings.

## Out of Scope

- Deciding which visual controls will remain in the eventual simplified public product.
- Persisting visual settings locally or remotely.
- Named user presets, preset creation, import or export files.
- Editing camera position or target through raw numeric fields.
- Responsive redesign outside the current 1920×1080 workspace.
- New shader channels, particle systems, chart types, HUD textures or visual algorithms.
- Changing GeoJSON validation, coordinate conversion, region identity or geometry persistence.
- Changing business-data commit semantics, adding more metrics or persisting business data.
- Paid persistence, billing, accounts, collaboration or cloud projects.
- Deployment, release, repository visibility changes, merging to `main`, pushing or deleting the worktree.

## Further Notes

- “完整释放” means every currently usable control and action in the legacy layout/effect/data/HUD control system has an equivalent reachable entry. It does not require preserving old component names or the old drawer layout.
- “工程视觉设置” is intentional first-release language. Runtime diagnostics, normalized JSON and low-level shader vocabulary may remain visible until later product pruning.
- Visual live preview is distinct from business-data editing: visual values may hot-apply after field-level validation, while region business values still require their explicit atomic update buttons.
- The baseline legacy inventory is the control descriptors and actions present at fixed point `a86da05`; later implementation must document any field that cannot be carried forward rather than silently omitting it.
