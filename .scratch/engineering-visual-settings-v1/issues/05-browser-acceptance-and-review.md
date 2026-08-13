# 05 — Prove full visual-control parity and resource safety

**What to build:** Complete Engineering Visual Settings V1 with automated inventory proof and real-browser evidence that every legacy visual capability is reachable and hot-applies safely for built-in and uploaded maps without persistence or authoring regressions.

**Blocked by:** 02 — Release every map-effect control; 03 — Release every chart and information-layer style control; 04 — Release every HUD control and engineering diagnostic.

Status: ready-for-human

- [x] Automated inventory evidence accounts for every legacy layout, effect, chart-style and HUD field/action at fixed point `a86da05` with no unexplained omissions.
- [x] At 1920×1080, data and visual first-level pages plus all five visual second-level pages are reachable inside the fixed independently scrolling sidebar without document scrolling.
- [x] Switching among all pages preserves GeoJSON, editable/committed business data, dirty/error state, authoring focus and current effective visual configuration.
- [x] Built-in-map acceptance covers composition, normal/Hover glow, inward glow, mosaic, columns, overlays, HUD, carousel and drilldown before and after representative edits.
- [x] Uploaded mixed-geometry acceptance proves the same controls affect the tech-blue custom map and do not revive built-in texture or drilldown behavior.
- [x] Draft, live preview, apply, discard, scoped reset, full reset, presets, overlap warnings, performance warnings and all copy actions are exercised in the browser.
- [x] Repeated changes from every visual page retain exactly one canvas, renderer, base scene, camera and controls, with no duplicate HUD/glow/mosaic/bar resources.
- [x] Visual edits do not alter geometry identity or business data; business edits do not reset visual settings during the same page session.
- [x] Full refresh retains custom geometry but clears visual settings and business data back to their documented defaults.
- [x] Persistence audit finds no visual config in IndexedDB, localStorage, sessionStorage, URL, cookies, Cache Storage or Service Worker state.
- [x] Browser console contains no unhandled errors, Vue warnings, WebGL errors or duplicate-resource symptoms.
- [x] Full source tests, typecheck, production build and fixed-point/worktree diff checks pass; existing chunk-size advisories are reported accurately.
- [x] Standards and Spec review against `a86da05` have zero unresolved actionable findings.
- [x] All target changes and evidence are committed locally on `codex/right-sidebar-settings`; no merge, push, deployment, release or worktree deletion occurs.

## Comments

Capture screenshots for data configuration, each visual second-level page, a visibly changed built-in map, the same change on an uploaded map, and the restored defaults. Screenshots need not be committed.
