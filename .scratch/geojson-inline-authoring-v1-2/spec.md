# GeoJSON 同页地图创作与原子更新 V1.2

Status: ready-for-agent

## Problem Statement

当前 GeoJSON 上传与分块业务数据编辑位于独立页面，用户需要先完成编辑、点击应用，再跳转到地图页面确认效果。这种往返流程割裂了“选择边界—编辑分块—观察地图”的创作过程，也使用户难以确认自己正在编辑的分块与地图上的实际区域是否一致。

用户希望把地图和创作面板放在同一个 1920×1080 页面中：地图整体左移，右侧固定显示上传与编辑面板。有效 GeoJSON 上传后应直接替换当前地图；当用户进入某个分块的编辑行时，地图应立即高亮对应区块；名称和数值只有在用户点击明确的更新按钮后才作为一个有效整体进入地图，避免半截数字、空值或字段间不同步污染 Three.js 预览。

## Solution

首页改为左侧地图、右侧创作面板的同页工作区。现有 GeoJSON 检查、投影、科技蓝材质、业务 JSON 预填、几何持久化和业务数据页面内存规则继续复用。

有效 GeoJSON 完成校验并选定唯一名称字段后，系统直接激活并显示新地图，不再要求用户跳转或点击第二个“应用地图”按钮。右侧为每个分块维护可编辑草稿；每行使用一枚“更新此分块”按钮，原子提交该行的启用状态、展示名称、主数值和次数值。全图两项指标的名称与单位使用一枚“更新指标”按钮原子提交，并提供“全部更新”用于一次校验和提交所有草稿。输入期间地图保留最近一次有效数据，非法或不完整输入只在面板中报错。

任意分块行内控件获得焦点时，对应区块立即进入受控 hover。点击“更新此分块”后，该区块保持 hover，柱体、徽标和悬浮窗一起显示刚提交的值。地图鼠标指向优先于编辑器 focus；编辑器 focus 优先于自动轮播。

业务数据更新只替换柱体与浮层数据，不重建地图几何、相机、HUD、光效、粒子或 canvas。几何 identity 变化才允许完整重建地图场景。

## User Stories

1. As a map creator, I want the upload and editor to sit beside the map, so that I can author and inspect one continuous workspace.
2. As a map creator, I want the map shifted left without changing its camera composition, so that the right editor has space without shrinking the main visualization.
3. As a map creator, I want a valid GeoJSON to load immediately, so that I do not need a separate apply-and-navigate step.
4. As a map creator, I want an invalid GeoJSON to leave the current map untouched, so that a failed experiment does not destroy my last valid result.
5. As a returning user, I want persisted custom geometry to open directly in the same-page workspace, so that I can continue configuring it after refresh.
6. As a map creator, I want every detected region listed once in the right panel, so that I can configure all available blocks.
7. As a map creator, I want the original region identity to remain visible, so that I can match editor rows to my GeoJSON source.
8. As a map creator, I want a row-level update button, so that its enabled state, display name and two values change together.
9. As a map creator, I want map-wide metric definitions to update together, so that labels and units never become mismatched pairs.
10. As a map creator, I want an update-all action, so that I can commit a complete valid draft efficiently.
11. As a map creator, I want edited but uncommitted fields marked as dirty, so that I know which values are not yet visible on the map.
12. As a map creator, I want the map to retain its last valid values while I type, so that empty or partial input does not make the visualization flicker.
13. As a map creator, I want row-specific validation errors, so that I can fix the exact invalid value without losing other work.
14. As a map creator, I want a failed row update to leave the committed map state unchanged, so that invalid data never reaches Three.js.
15. As a map creator, I want a successful row update to change its column, badge and hover panel together, so that the map never shows mixed versions of one row.
16. As a map creator, I want changing a primary value to rescale all enabled columns consistently, so that cross-region comparison remains correct.
17. As a map creator, I want disabling a row and updating it to remove its data overlays while retaining geometry, so that missing business data does not remove map coverage.
18. As a map creator, I want focusing any control in a region row to highlight that exact region, so that I can visually locate what I am editing.
19. As a map creator, I want the editor-focused region to remain highlighted after I click its update button, so that I can immediately inspect the new result.
20. As a map viewer, I want map-pointer hover to take precedence over editor focus, so that direct exploration remains natural.
21. As a map creator, I want automatic carousel hover paused while a region row is active, so that the preview does not jump to another region during editing.
22. As a map viewer, I want carousel hover to resume after authoring focus is cleared, so that the existing ambient presentation behavior remains available.
23. As a map creator, I want hover highlighting to work even before a row has complete business values, so that region identification is independent of its data completeness.
24. As a map creator, I want the hover data panel to appear only for committed complete data, so that placeholders are not presented as business facts.
25. As a map creator, I want existing business JSON upload to fill the editor draft without silently committing it, so that I can review and correct it before updating the map.
26. As a map creator, I want manual corrections after JSON prefill to win when I update, so that bulk entry remains editable.
27. As a free-version user, I want committed visualization data to remain page-memory-only, so that refresh still clears names, labels, units, enabled states and values.
28. As a returning user, I want refresh to retain custom geometry while restoring an empty business draft and geometry-only map, so that the free persistence boundary remains unchanged.
29. As a map creator, I want replacing the GeoJSON to clear the previous geometry's editor focus, dirty fields and visualization session, so that data never leaks between maps.
30. As a map creator, I want restoring the built-in map to clear the custom editor state, so that the built-in Chongqing presentation is pristine.
31. As a built-in map viewer, I want the existing texture, eight bars, hover panel, carousel and district drilldown to remain unchanged, so that authoring changes do not regress the default product.
32. As a map creator, I want business updates to preserve the current camera and map effects, so that editing does not reset my visual context.
33. As a maintainer, I want repeated updates to retain exactly one canvas and one set of HUD/effect resources, so that the editor cannot leak WebGL resources.
34. As a maintainer, I want geometry changes and business-data changes to follow separate renderer paths, so that expensive scene rebuilds occur only when structurally necessary.
35. As a user opening the former upload route, I want to land on the same-page workspace, so that old bookmarks do not lead to a dead page.
36. As a user, I want all controls reachable in the fixed-height right panel, so that large region lists scroll inside the panel rather than moving the whole screen.

## Implementation Decisions

- The homepage becomes the single map-authoring workspace. It owns the active map document, editor panel and authoring focus; a second full-screen upload experience is no longer maintained.
- The map canvas keeps its existing width, height, camera position and target and moves left. The right panel uses a fixed-width, independently scrolling layout at the 1920×1080 design viewport.
- The former upload route remains as a compatibility redirect to the homepage. It must not encode business data in URL state.
- Existing GeoJSON inspection, name-property selection, projection, normalized map document, tech-blue appearance and geometry-only persistence remain authoritative.
- A valid GeoJSON upload automatically activates the geometry through the existing failure-atomic active-map-source seam. There is no separate map-wide apply-and-navigate action.
- A map-authoring workspace module owns two visualization states for the active geometry: editable draft and last committed visualization. It also owns dirty/error state and the current authoring-focused region key.
- The workspace interface exposes user-intent operations such as loading geometry, editing fields, committing one region, committing map-wide metric definitions, committing all, focusing a region and resetting. Callers do not compose map documents or mutate session storage directly.
- A region commit atomically applies that row's enabled state, presentation display name, primary value and secondary value to a candidate built from the last committed visualization. Invalid values do not change committed state.
- A metric-definition commit atomically applies both labels and both units. A commit-all validates and applies the complete editable draft.
- The active-map-source seam distinguishes geometry activation from same-identity visualization replacement. Business commits update only the page-memory session and active document; they do not rewrite the unchanged IndexedDB geometry record.
- Editor fields remain raw editable values long enough to represent blank or partial input. Conversion to numeric visualization values occurs only at commit validation.
- Dirty state is computed against the committed visualization. Successful commit clears the relevant dirty state; failed commit preserves it and exposes a user-visible error.
- JSON prefill replaces only the editable draft after complete file validation. It does not update the committed visualization until a row, metric group or all-draft update is requested.
- Successful commits replace the matching in-memory visualization session so a same-page navigation can restore committed data. Editable but uncommitted text is not persisted to any browser storage.
- Renderer updates are split by structure. A changed geometry identity may dispose and rebuild the map scene; visualization changes for the same identity reconcile only the district bar/data-overlay layer.
- The district-bar module gains one deep reconciliation interface that hides create/update/remove, range recalculation, height changes, display-data replacement and resource disposal. Callers do not individually manage Three.js bar objects.
- Same-key value or display-name changes update existing bar resources. Enable/disable membership changes create or dispose only the affected business-layer resources. All enabled bar heights are recalculated when the primary-value range changes.
- Business updates are coalesced to at most one renderer reconciliation per animation frame. They must not recreate the WebGL renderer, canvas, base geometry, HUD, glow, mosaic particles, camera or controls.
- Controlled authoring focus uses the stable region key and the existing hover visuals. The hover precedence is map pointer, then authoring focus, then automatic carousel.
- Pointer precedence applies while the pointer is inside the map: a hit region overrides authoring focus and empty map space temporarily clears visual hover. Leaving the map restores the still-active authoring focus.
- Focusing any interactive control within a region row sets authoring focus immediately. Moving focus outside that row clears it unless the update action for that row is completing; after a successful row update the row remains focused.
- Authoring focus highlights geometry even when the row has no committed metrics. The badge and data panel continue to derive only from committed complete metrics.
- The default page-memory-only business-data rule, geometry-only IndexedDB record, legacy migration behavior and built-in-map adapter remain unchanged.
- Errors never replace the last valid map geometry or committed visualization. Slow or stale file reads cannot overwrite a newer upload or edit session.

## Testing Decisions

- Tests cross the highest stable interfaces and assert observable behavior. They do not inspect Vue ref names, private Three.js collections or exact internal event ordering when workspace or rendered behavior is available.
- The main authoring-workspace tests cover direct geometry activation, editable-versus-committed state, row/metric/all atomic commits, dirty flags, validation failure, JSON prefill and geometry replacement isolation.
- Homepage integration tests select files and operate visible controls to prove the map document and controlled focus passed to the renderer change without route navigation.
- District-bar reconciliation tests prove same-key updates, enable/disable changes, range rescaling and resource disposal through the public layer interface.
- Three.js integration tests prove same-identity business commits keep the existing renderer/canvas and base scene, while geometry-identity changes perform one safe rebuild.
- Hover coordination tests cover pointer-over-editor-over-carousel precedence, editor focus before committed values, focus retention after update and carousel resumption.
- Prior tests for map document validation, active source/session lifetime, loader behavior, bar snapshots, overlay text, scene cleanup and built-in drilldown are retained or migrated to the new same-page behavior.
- Real-browser acceptance uses 1920×1080 and deterministic synthetic fixtures. It proves direct upload, row focus hover, no change before update, atomic change after update, invalid-input retention, JSON prefill, replacement isolation, refresh data loss, built-in reset and one-canvas lifecycle.
- Full completion requires all source tests, typecheck, production build, diff check and Standards/Spec two-axis review against the fixed starting commit with no unresolved actionable findings.

## Out of Scope

- Per-keystroke business-data updates to columns, badges or data panels.
- Rendering incomplete values or placeholder business facts in the hover panel.
- A separate partial-preview data contract for null primary or secondary values.
- Persisting editable or committed custom business data beyond the running JavaScript page.
- Paid persistence, billing, accounts, cross-tab/device synchronization or backend storage.
- More than two metrics, per-region units, formulas, colors or bar styles.
- CSV/Excel/clipboard import, export, remote datasets or templates.
- SVG/Shapefile/KML upload, geometry editing, coordinate conversion, online tiles or uploaded textures.
- Custom-region drilldown pages or changes to the built-in district detail experience.
- Responsive redesign outside the existing fixed 1920×1080 big-screen composition.
- Deployment, pushing, merging to `main` or deleting the worktree.

## Further Notes

- “实时”在本版本中分为两类：编辑器 focus 引起的区块 hover 是即时的；业务数据在用户点击明确的更新按钮并通过校验后即时进入地图。输入每个字符时不提交业务数据。
- “更新此分块”是本版本的主要原子操作；不采用每个字段一枚更新按钮，避免一个分块同时展示多个提交版本。
- Direct GeoJSON loading still means “after the complete file validates and the geometry activation succeeds”. It never means rendering an unvalidated or only partially read file.
