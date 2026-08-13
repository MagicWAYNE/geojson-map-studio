# 02 — Persist geometry while keeping visualization in page memory

**What to build:** A custom map keeps its GeoJSON geometry across refreshes, while edited names, metric definitions, enabled states and values survive only SPA navigation in the current page and disappear on full reload. Previously persisted V1 metrics are ignored and removed through a geometry-only migration.

**Blocked by:** 01 — Separate stable region identity from display names.

**Status:** ready-for-human

- [x] New persisted records contain only the geometry text, geometry filename, selected name property and record version.
- [x] No custom labels, units, display names, enabled states, numeric values or metrics JSON are written to IndexedDB, localStorage, sessionStorage, URL state or browser caches.
- [x] Same-page loader/home navigation preserves visualization for the matching active geometry.
- [x] A simulated or real full reload preserves custom geometry but yields original display names, zero enabled rows, no bars and no data panel.
- [x] Replacing the GeoJSON or resetting to the built-in map clears incompatible session visualization.
- [x] Legacy records with metrics still load their geometry, never expose stored metrics, and are rewritten geometry-only; rewrite failure returns a warning without exposing data or blanking the map.
- [x] Persistence failure remains atomic and cannot attach one geometry's session data to another geometry.

## Comments

The running-page memory adapter is the free product implementation; no storage-backed paid adapter is part of this ticket.
