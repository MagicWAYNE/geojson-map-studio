# 03 — Commit editor data through atomic update actions

**What to build:** Separate editable fields from the map's last committed visualization and let users explicitly update one region, both map-wide metric definitions, or the entire draft. The map changes immediately after a successful update and remains unchanged after invalid or incomplete input.

**Blocked by:** 01 — Move map authoring into the homepage shell; 02 — Activate valid GeoJSON directly from the side panel.

**Status:** ready-for-human

- [x] Each region row exposes one “更新此分块” action that atomically commits enabled state, display name, primary value and secondary value.
- [x] The metric section exposes one “更新指标” action that atomically commits both labels and both units.
- [x] An “全部更新” action validates and commits the complete editable draft in one operation.
- [x] Editing any field marks the relevant row or metric group dirty without changing columns, badges or panel content.
- [x] A successful update clears its dirty state, updates the in-memory visualization session and immediately changes the map without route navigation.
- [x] A failed update preserves editable text, reports the exact row/field and leaves the committed map document unchanged.
- [x] Row commits are independent: invalid dirty text in another row does not block updating a valid row.
- [x] Disabled committed rows have geometry but no column, badge or data panel; enabling and updating creates all three data effects together.
- [x] Primary-value changes recalculate the enabled-map range and all column heights consistently.
- [x] Display names, labels, units and secondary values update the existing overlay as plain text.
- [x] JSON upload replaces only the editable draft after validation; map data changes only after an explicit update, and later manual edits win.
- [x] Same-identity business updates reconcile the data layer at most once per animation frame and do not recreate canvas, base geometry, camera, controls, HUD, glow or mosaic resources.
- [x] Geometry-only persistence and refresh-clears-business-data behavior remain unchanged.

## Comments

Prefer one deep district-bar reconciliation interface over exposing create/update/remove resource operations to the homepage or editor.

Implemented through `mapAuthoringWorkspace`, session-only active-source publishing and
one-frame `reconcileDistrictBarLayer`. Focused evidence covers atomic row/metric/all
commits, JSON draft-only prefill, persistence write count, create/update/remove/range
reconciliation, one-canvas hot updates and one scene rebuild on geometry identity change.
