# 01 — Move map authoring into the homepage shell

**What to build:** Present the existing map and GeoJSON authoring controls together on the homepage: preserve the current map canvas and camera composition while shifting it left, place a fixed independently scrolling authoring panel on the right, and keep existing saved custom or built-in maps visible while the panel initializes.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] At 1920×1080 the map keeps its current canvas size, camera position and target while moving left enough for a non-overlapping right panel.
- [ ] The right panel contains the existing GeoJSON file, optional JSON file, name-property, summary, region-editor and reset capabilities without introducing a second background or canvas.
- [ ] Existing persisted custom geometry and current in-memory visualization populate both map and panel on initial load.
- [ ] Built-in Chongqing loads with its existing visual presentation while the empty custom-authoring panel remains usable.
- [ ] Large region lists scroll inside the panel; the homepage itself stays fixed and does not acquire document scrolling.
- [ ] The former upload route resolves to the same homepage workspace without storing business data in the URL.
- [ ] Loading, warning and failure states keep the last valid map visible and are explained inside the panel.
- [ ] Existing map-only resource lifecycle remains one canvas, one renderer and one set of background/HUD layers.

## Comments

This ticket makes the layout and state ownership change demoable before changing the commit semantics. Preserve current apply behavior temporarily if needed to keep the slice green, then remove it in Ticket 02.
