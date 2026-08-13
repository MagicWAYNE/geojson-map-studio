# 03 — Edit visualization data for detected regions

**What to build:** After a valid GeoJSON is detected, show an authoring table where the user configures two map-wide metric labels/units and, for every region, enables visualization, edits its display name and enters primary/secondary values. Applying opens the existing map with the expected bars, badges and hover content.

**Blocked by:** 01 — Separate stable region identity from display names; 02 — Persist geometry while keeping visualization in page memory.

**Status:** ready-for-agent

- [ ] Every detected region appears exactly once with its original identity visible and its display name defaulted.
- [ ] Each row has an explicit visualization-enabled control plus editable display name, primary value and secondary value.
- [ ] Metric labels and units are map-wide, use the existing 20/8 Unicode limits and render as plain text.
- [ ] Enabled rows require finite non-negative primary and secondary values; errors identify the row and keep Apply disabled.
- [ ] Disabled rows require no values and render geometry/effects without bars, badges or data-panel entries.
- [ ] Applying a valid draft persists only geometry, activates the matching session visualization, navigates home and produces bars driven by primary values.
- [ ] Hover titles use display names and the panel shows both configured labels, values and units.
- [ ] Returning to the loader without reload restores the current draft; reloading reconstructs an empty draft for the persisted geometry.
- [ ] The map-only home and current camera, HUD, glow, hover, mosaic and carousel contracts remain unchanged.

## Comments

This ticket is the main manual-entry tracer bullet and must be demoable without uploading a metrics JSON file.
