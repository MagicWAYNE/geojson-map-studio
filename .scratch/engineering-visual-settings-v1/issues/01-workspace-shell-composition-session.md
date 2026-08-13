# 01 — Establish the visual workspace and composition session

**What to build:** Add “数据配置 / 视觉样式” to the existing fixed right sidebar and make “构图与视角” the first complete visual slice, backed by one visual-settings session that preserves data-authoring state while users switch pages and tune map composition.

**Blocked by:** None — can start immediately.

Status: ready-for-human

- [x] The existing GeoJSON upload, metric definition and region editor remain intact under “数据配置”.
- [x] “视觉样式” opens inside the same right sidebar; no second debug drawer, background or canvas is introduced.
- [x] The five visual second-level pages have stable catalog identifiers and navigation, with unfinished pages allowed to show an explicit pending state in this ticket.
- [x] Switching first- or second-level pages preserves loaded geometry, data draft, committed visualization, dirty fields and authoring focus.
- [x] A visual-settings-session interface owns current composition, draft/effective semantics, runtime camera text and reset intent without exposing Three.js objects.
- [x] Map left, top, width and height support synchronized numeric and range controls.
- [x] Home map rendering and reset share `{ left: 24, top: 132, width: 1120, height: 948 }` as their single default source.
- [x] CSS and camera position/target can be copied with accessible success/failure feedback.
- [x] Sidebar overlap or viewport escape produces a warning but does not silently clamp a valid engineering value.
- [x] The sidebar remains independently scrollable and the 1920×1080 document does not acquire page scrolling.
- [x] Focused tests prove state preservation, composition apply/reset, copy behavior and no second canvas.

## Comments

This tracer establishes the state and navigation seams through a visible end-to-end composition capability. Do not begin by moving every legacy control into a new folder without a working sidebar slice.
