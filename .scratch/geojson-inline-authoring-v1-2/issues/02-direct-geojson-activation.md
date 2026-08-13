# 02 — Activate valid GeoJSON directly from the side panel

**What to build:** Make a completely valid GeoJSON selection replace the map in the same workspace immediately after validation and failure-atomic geometry activation, without a second map-wide apply action or route navigation.

**Blocked by:** 01 — Move map authoring into the homepage shell.

**Status:** ready-for-agent

- [ ] Selecting a valid Polygon/MultiPolygon/hole fixture directly changes the visible map and creates one editor row per detected region.
- [ ] The default unique `name` property is selected when available; otherwise the first usable unique property is selected.
- [ ] Changing the selected name property re-prepares and directly activates the same geometry with the new stable region identities.
- [ ] Geometry activation persists only the geometry record and installs a default empty in-memory visualization for the new identity.
- [ ] Invalid, too-large, stale or unsupported files leave the current map, committed visualization and editor session unchanged.
- [ ] A persistence failure leaves the last valid geometry visible and reports the exact file/error context.
- [ ] A successful geometry replacement clears prior focus, dirty fields, JSON prefill summary and visualization data from the previous identity.
- [ ] The obsolete apply-and-navigate action is removed; reset still restores the built-in map failure-atomically.
- [ ] Custom GeoJSON continues to use tech-blue appearance, current HUD/effects/camera and no custom drilldown.

## Comments

“Direct” begins only after complete file validation and a successful atomic activation. Do not render unvalidated geometry as an optimistic intermediate state.
