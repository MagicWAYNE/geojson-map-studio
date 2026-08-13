# 03 — Release every chart and information-layer style control

**What to build:** Make the full legacy data-column, badge, Hover metric-panel and collision-control surface available under “图表样式”, using generic region-map language while keeping business values and visual styling independent.

**Blocked by:** 01 — Establish the visual workspace and composition session.

Status: ready-for-human

- [x] “区级扶持企业柱状图” and “数据调试” are replaced by generic “区域数据柱体” and “图表样式” language without dropping behavior.
- [x] Every legacy bar control is reachable, including enablement, colors, width, anchors, base offset, height range, exponent, glow, base ring, pulse ring, animation and Hover response.
- [x] Every legacy badge control is reachable, including visibility, position, dimensions, padding, colors, typography, formatting, Hover behavior and animation.
- [x] Every legacy Hover metric-panel control is reachable, including side, gap, dimensions, padding, title asset placement, typography, numeric formatting and transitions.
- [x] Every legacy collision-avoidance control is reachable and remains expressed in screen-pixel behavior.
- [x] A control inventory test compares the published chart-style surface with the fixed-point legacy descriptors and actions.
- [x] Chart-style changes do not modify enabled regions, display names, metric labels, units or numeric business values.
- [x] No-data maps keep visual settings editable without creating fabricated columns, badges or panels.
- [x] Bar count, numeric range and degraded state remain visible on the engineering surface.
- [x] Normalized bar and overlay JSON can be copied independently; bar, overlay and complete visual resets operate at the documented scope.
- [x] Bar changes reconcile existing resources in place; enable/disable creates or disposes only data-layer resources and retains one canvas/base scene.
- [x] Existing bar-layer, overlay-layout, overlay-rendering and runtime-status tests remain green through the new session seam.

## Comments

This ticket may proceed in parallel with Tickets 02 and 04 after Ticket 01 is green because it consumes the shared session but does not depend on effect- or HUD-page completion.
