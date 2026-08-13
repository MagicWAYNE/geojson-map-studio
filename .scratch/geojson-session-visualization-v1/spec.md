# GeoJSON 分块会话态数据可视化 V1.1

Status: ready-for-agent

## Problem Statement

用户已经可以上传 GeoJSON 并得到保留现有 HUD、边界光、hover、马赛克、轮播和科技蓝材质的分块地图，但当前业务数据主要通过额外 JSON 文件输入，并与 GeoJSON 一起持久化。这使普通用户无法在页面中直观地逐分块补充展示名称、数值和单位，也不符合“地图边界可保留、业务数据持久化作为后续收费能力”的产品边界。

用户需要在 GeoJSON 被识别后直接看到分块清单，为每个分块选择是否启用可视化、编辑展示名称和两项指标数值，并复用现有柱体与 hover 窗格。免费版本中的这些业务数据只能存在当前页面运行内存：单页路由往返时可以继续使用，浏览器刷新、关闭标签页或新开标签页后必须丢失；GeoJSON 边界仍按现有规则从 IndexedDB 恢复。

## Solution

在独立地图上传页中，把 GeoJSON 上传后的结果扩展为一个分块数据编辑步骤。系统以 GeoJSON 选定名称字段生成的原始分块名作为不可变稳定标识，同时提供可编辑且默认等于原始名称的展示名称。用户可以为全图设置两项指标的名称和单位，并逐分块启用可视化、填写主数值和次数值。

主数值继续驱动柱体高度和顶部数值徽标，次数值继续显示在 hover 窗格。未启用或未配置业务数据的分块只显示地图几何和现有效果，不生成柱体或数据浮层。

GeoJSON 几何包继续持久化；展示名称、指标名称、单位和区域数值进入一个只使用 JavaScript 运行内存的会话态模块。它不得使用 IndexedDB、localStorage、sessionStorage、URL、Service Worker cache 或其他刷新后可恢复的存储。现有可选业务 JSON 上传入口保留，但改为给编辑器批量预填，不再进入持久化记录。

## User Stories

1. As a map creator, I want the system to list every detected GeoJSON region, so that I know which blocks can receive data.
2. As a map creator, I want the original GeoJSON region identity to remain visible, so that I can match the editor row to my source data.
3. As a map creator, I want each region to start with its original name as the display name, so that a valid map works without manual renaming.
4. As a map creator, I want to change a region's display name without changing its geometry identity, so that labels can be business-friendly without breaking data binding.
5. As a map creator, I want display-name validation before applying the map, so that blank or ambiguous names do not appear in hover panels.
6. As a map creator, I want to enable visualization for selected regions only, so that regions without business data remain visible without fabricated values.
7. As a map creator, I want to set a primary metric label and unit once for the whole map, so that bars remain comparable across regions.
8. As a map creator, I want to set a secondary metric label and unit once for the whole map, so that hover panels use consistent terminology.
9. As a map creator, I want to enter primary and secondary numeric values per enabled region, so that the existing data visualization can represent my data.
10. As a map creator, I want invalid, negative, infinite or partially filled values rejected with row-specific feedback, so that the rendered map never shows `NaN` or misleading values.
11. As a map creator, I want the primary value to control bar height and the badge, so that the visual hierarchy remains familiar.
12. As a map viewer, I want the hover panel title to use the edited display name, so that I see business language rather than a source-system key.
13. As a map viewer, I want the hover panel to show the configured labels, values and units as plain text, so that the presentation is correct and safe.
14. As a map creator, I want disabled regions to retain geometry, hover lighting and carousel effects without data overlays, so that incomplete data does not remove map coverage.
15. As a map creator, I want my edits to survive loader-to-home and home-to-loader navigation in the same running page, so that I can preview and revise without retyping.
16. As a free-version user, I want a refresh to clear all edited names, labels, units and values, so that the non-persistence rule is explicit and predictable.
17. As a returning user, I want the uploaded GeoJSON geometry to remain after refresh, so that I only need to re-enter business data.
18. As a free-version user, I want a refreshed custom map to show no bars or data panel, so that stale or previously paid-like data cannot reappear.
19. As a user with an existing V1 saved map, I want the geometry to continue loading while any previously stored metrics are discarded, so that migration does not break my map or violate the new boundary.
20. As a map creator, I want the existing business JSON input to prefill the same editor, so that bulk entry remains possible without gaining persistence.
21. As a map creator, I want JSON matched/missing/extra results before applying, so that I can fix source-name mismatches.
22. As a map creator, I want manual edits after JSON prefill to win, so that bulk input does not prevent corrections.
23. As a map creator, I want replacing or resetting the GeoJSON to clear incompatible session data, so that one map's values never leak into another map.
24. As a built-in map viewer, I want the original Chongqing bars, hover panel, texture and drilldown to remain unchanged, so that this feature only changes custom-map authoring.
25. As a maintainer, I want automated proof that no business fields are written to browser persistence, so that the future paid boundary cannot regress silently.
26. As a maintainer, I want route-cycle and refresh browser proof, so that in-memory lifetime is verified in the real application rather than inferred from unit tests.

## Implementation Decisions

- The existing normalized map-document seam remains the renderer's interface. Geometry, appearance, metric values and metric labels still converge there before Three.js rendering.
- Original region identity and display naming are separate concepts. The exact value selected from the GeoJSON name property remains the stable key for matching, geometry lookup, carousel state and resource ownership. The editable display name is presentation-only and must never replace that key.
- Display names default to the original region names, are rendered as plain text, are limited to 40 Unicode characters, and must be non-empty and unique across the detected regions.
- V1.1 retains exactly two map-wide metric definitions. Each definition has a label and unit; labels are limited to 20 Unicode characters and units to 8, matching the existing renderer contract. Per-region units and a variable number of metrics are not introduced.
- Each region row has an explicit visualization-enabled state. Disabled rows require no numeric data and produce no bar, badge or data-panel entry. Enabled rows require finite non-negative primary and secondary values.
- The primary metric drives bar height and the badge. The secondary metric is shown in the hover panel. Both labels and units are shared across all enabled regions so visual comparisons remain meaningful.
- A session-visualization module owns edited display names, labels, units, enabled states and values. Its interface binds the session data to the active geometry identity, returns a composed map document, replaces the whole draft atomically, and clears it when geometry is replaced or reset.
- The session-visualization implementation uses only module memory. It must not read or write IndexedDB, localStorage, sessionStorage, URL state, cookies, Cache Storage or Service Worker state. SPA navigation keeps the module instance alive; a full reload creates an empty state.
- Persisted custom-map records become geometry-only records with a new record version. They contain GeoJSON text, source filename and selected name property, but no metric JSON, labels, units, display names, enabled flags or values.
- Existing records containing persisted metrics are treated as legacy. Loading them must ignore the metrics immediately, render the geometry without custom data, and attempt a one-way rewrite to the geometry-only record. A rewrite failure may produce a warning but must never expose the legacy metrics or blank the map.
- A session draft is associated with a deterministic identity of the prepared geometry and selected name property. It is applied only when that identity matches the active custom map, preventing data from one GeoJSON from leaking into another.
- The upload page becomes a staged authoring flow: choose and validate GeoJSON, select the unique name property, edit map-wide metric definitions, edit detected region rows, then apply and view the map.
- Applying first validates the entire draft. Geometry persistence remains failure-atomic. Only after the geometry activation succeeds may the matching in-memory visualization become active and navigation proceed.
- Returning to the loader through SPA navigation restores the current in-memory draft for the same geometry. Reloading the loader reconstructs rows from persisted geometry with original display names, no enabled visualizations and no values.
- The existing optional business JSON contract remains accepted only as a bulk-prefill adapter. It populates labels, units and matched rows in the editor, reports matched/missing/extra names, and never bypasses editor validation or enters the persisted package.
- Manual changes made after JSON prefill are authoritative until another explicit prefill action replaces them.
- Resetting to the built-in map clears both the persisted custom geometry and all custom session visualization. The built-in map continues to load its existing business data through its existing adapter and is not subject to the free custom-map lifetime rule.
- The home page remains map-only. Editing controls stay on the independent loader route, and the current camera, map shell, HUD, effects, tech-blue material, built-in texture path and custom-map no-drilldown behavior remain unchanged.
- Errors identify the affected file or editor row and do not replace the last valid active geometry or active session visualization.

## Testing Decisions

- Tests should cross the highest stable seam and assert observable lifetime and rendering behavior. They should not assert private ref shapes, internal event order or IndexedDB implementation details beyond the persisted public record.
- The normalized map-document module is tested for stable-key/display-name separation, plain-text labels, enabled-row filtering and numeric validation.
- The active-map-source seam is tested with in-memory persistence and session adapters: geometry persists, session visualization survives same-page loads, refresh simulation loses it, geometry replacement/reset clears it, and failures keep the previous valid state.
- The production IndexedDB adapter is tested with fake IndexedDB to prove the new record excludes every business-data field and to prove legacy records are rewritten geometry-only while legacy metrics never reach the document.
- The loader view is tested through file selection and user-visible controls: detected rows, defaults, validation, per-row enablement, manual edits, JSON prefill, correction after prefill, apply and reset.
- The Three.js integration is tested through its existing map-document interface: stable keys still bind geometry and bars, display names reach hover titles, disabled/missing rows create no bar, and built-in documents remain unchanged.
- Existing bar-layer, overlay and lifecycle tests are reused as prior art. New tests extend their public inputs rather than mocking new private renderer internals.
- A real 1920×1080 browser acceptance flow must verify manual editing, bars and hover content, SPA navigation retention, full-refresh loss, geometry retention, legacy migration, JSON prefill and built-in reset.
- Full completion requires all source tests, typecheck, production build, diff check and the repository's Standards/Spec two-axis review to pass with no unresolved actionable findings.

## Out of Scope

- Implementing the paid persistence feature, pricing, billing, entitlements or login.
- Persisting custom business data through any browser or backend storage.
- Cross-tab, cross-window, cross-device or account synchronization.
- More than two metrics, per-region units, per-region colors, custom bar styles or formulas.
- CSV/Excel import, clipboard-table import, export, downloadable templates or remote datasets.
- Editing GeoJSON geometry, coordinates, holes, region keys or name-property source values.
- SVG, Shapefile, KML, online tiles, uploaded raster textures or coordinate-system conversion.
- Custom-region detail pages or enabling drilldown for uploaded maps.
- Changing the map-only home composition, current camera, HUD/effect defaults or built-in Chongqing behavior.
- Deployment, pushing, merging to `main` or deleting the worktree.

## Further Notes

- “Session” in this spec means the lifetime of the currently running JavaScript page, not `sessionStorage`. A browser reload is the authoritative boundary and must clear custom visualization data.
- Deterministic synthetic fixtures are allowed only for automated tests and browser acceptance. They must be identified as test data and must not be presented as real business data.
- The future paid feature should be able to add a second session-visualization adapter at the existing seam rather than changing renderer or editor semantics.
