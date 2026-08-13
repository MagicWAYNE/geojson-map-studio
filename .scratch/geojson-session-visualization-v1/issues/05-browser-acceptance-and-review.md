# 05 — Prove session lifetime and visual behavior end to end

**What to build:** Complete the feature with real-browser evidence that manual and JSON-prefilled visualization works during SPA navigation, disappears on refresh while geometry remains, cannot leak between maps, and does not regress the built-in map or Three.js resource lifecycle.

**Blocked by:** 02 — Persist geometry while keeping visualization in page memory; 03 — Edit visualization data for detected regions; 04 — Use business JSON as session-only editor prefill.

**Status:** ready-for-agent

- [ ] At 1920×1080, upload the mixed Polygon/MultiPolygon/hole fixture, manually enable at least two regions, apply, and verify exactly those bars and the edited hover title/labels/units.
- [ ] Navigate loader → home → loader → home without reload and verify the draft, one canvas and one set of overlays remain.
- [ ] Reload home and verify the same custom geometry and tech-blue effects remain while all custom bars, badges, edited names and data panels are gone.
- [ ] Prefill from the metrics fixture, make a manual correction, apply and verify the correction wins until reload.
- [ ] Exercise a legacy persisted record and verify geometry-only migration plus zero restored custom metrics.
- [ ] Replace the GeoJSON and reset to the built-in map; verify no prior session values leak and built-in bars, hover panel, texture and drilldown remain intact.
- [ ] Browser console has no unhandled errors, Vue warnings, duplicate resources or persistence-policy violations.
- [ ] Full source tests, typecheck, production build and diff check pass; existing chunk-size warnings are reported accurately.
- [ ] Standards and Spec review against the fixed starting commit have zero unresolved actionable findings.
- [ ] Target changes are committed on `codex/open-source-prep`; no merge, push, deployment or worktree deletion occurs.

## Comments

Save screenshots for manual-entry visualization and the same geometry after refresh with no session data; screenshots need not be committed.
