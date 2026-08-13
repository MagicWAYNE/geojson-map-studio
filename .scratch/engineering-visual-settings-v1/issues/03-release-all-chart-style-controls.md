# 03 — Release every chart and information-layer style control

**What to build:** Make the full legacy data-column, badge, Hover metric-panel and collision-control surface available under “图表样式”, using generic region-map language while keeping business values and visual styling independent.

**Blocked by:** 01 — Establish the visual workspace and composition session.

Status: ready-for-agent

- [ ] “区级扶持企业柱状图” and “数据调试” are replaced by generic “区域数据柱体” and “图表样式” language without dropping behavior.
- [ ] Every legacy bar control is reachable, including enablement, colors, width, anchors, base offset, height range, exponent, glow, base ring, pulse ring, animation and Hover response.
- [ ] Every legacy badge control is reachable, including visibility, position, dimensions, padding, colors, typography, formatting, Hover behavior and animation.
- [ ] Every legacy Hover metric-panel control is reachable, including side, gap, dimensions, padding, title asset placement, typography, numeric formatting and transitions.
- [ ] Every legacy collision-avoidance control is reachable and remains expressed in screen-pixel behavior.
- [ ] A control inventory test compares the published chart-style surface with the fixed-point legacy descriptors and actions.
- [ ] Chart-style changes do not modify enabled regions, display names, metric labels, units or numeric business values.
- [ ] No-data maps keep visual settings editable without creating fabricated columns, badges or panels.
- [ ] Bar count, numeric range and degraded state remain visible on the engineering surface.
- [ ] Normalized bar and overlay JSON can be copied independently; bar, overlay and complete visual resets operate at the documented scope.
- [ ] Bar changes reconcile existing resources in place; enable/disable creates or disposes only data-layer resources and retains one canvas/base scene.
- [ ] Existing bar-layer, overlay-layout, overlay-rendering and runtime-status tests remain green through the new session seam.

## Comments

This ticket may proceed in parallel with Tickets 02 and 04 after Ticket 01 is green because it consumes the shared session but does not depend on effect- or HUD-page completion.
