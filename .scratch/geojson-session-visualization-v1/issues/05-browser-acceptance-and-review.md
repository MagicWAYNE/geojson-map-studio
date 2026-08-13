# 05 — Prove session lifetime and visual behavior end to end

**What to build:** Complete the feature with real-browser evidence that manual and JSON-prefilled visualization works during SPA navigation, disappears on refresh while geometry remains, cannot leak between maps, and does not regress the built-in map or Three.js resource lifecycle.

**Blocked by:** 02 — Persist geometry while keeping visualization in page memory; 03 — Edit visualization data for detected regions; 04 — Use business JSON as session-only editor prefill.

**Status:** ready-for-human

- [x] At 1920×1080, upload the mixed Polygon/MultiPolygon/hole fixture, manually enable at least two regions, apply, and verify exactly those bars and the edited hover title/labels/units.
- [x] Navigate loader → home → loader → home without reload and verify the draft, one canvas and one set of overlays remain.
- [x] Reload home and verify the same custom geometry and tech-blue effects remain while all custom bars, badges, edited names and data panels are gone.
- [x] Prefill from the metrics fixture, make a manual correction, apply and verify the correction wins until reload.
- [x] Exercise a legacy persisted record and verify geometry-only migration plus zero restored custom metrics.
- [x] Replace the GeoJSON and reset to the built-in map; verify no prior session values leak and built-in bars, hover panel, texture and drilldown remain intact.
- [x] Browser console has no unhandled errors, Vue warnings, duplicate resources or persistence-policy violations.
- [x] Full source tests, typecheck, production build and diff check pass; existing chunk-size warnings are reported accurately.
- [x] Standards and Spec review against the fixed starting commit have zero unresolved actionable findings.
- [x] Target changes are committed on `codex/open-source-prep`; no merge, push, deployment or worktree deletion occurs.

## Comments

Save screenshots for manual-entry visualization and the same geometry after refresh with no session data; screenshots need not be committed.

## Acceptance evidence

- 1920×1080 manual flow used the deterministic `valid-mixed.geojson` fixture, enabled 区域 A/B, rendered exactly two badges, and showed the edited `创新一区` hover title with `孵化项目 120 个` / `导师服务 45.60 次`.
- Two loader/home SPA cycles retained the edited draft while every home render contained one canvas and one overlay. A full reload retained the same custom geometry and tech-blue effects with zero overlays, badges or panels.
- Metrics JSON reported exact matched names `区域 A、区域 B`, missing `区域 C` and extra `区域 D`; a manual correction to `JSON 后修正区` / `121` rendered, then disappeared on reload.
- A deterministic synthetic V1 IndexedDB record loaded only `旧版测试区` geometry, exposed no legacy metrics, and was rewritten to version 2 with only geometry text, filename and name property.
- A replacement GeoJSON produced one disabled `替换测试区` row and no old names or values. Reset restored eight built-in badges, the terrain texture and hover panel; clicking a built-in region navigated to its district route.
- Browser console checks returned zero warnings/errors. Screenshots: `/Users/fei/.codex/visualizations/2026/08/10/019fe9e1-af49-7ae3-be4f-e385aabab117/cqbigscreen-session-v11/manual-two-regions.png` and `/Users/fei/.codex/visualizations/2026/08/10/019fe9e1-af49-7ae3-be4f-e385aabab117/cqbigscreen-session-v11/same-geometry-after-refresh.png`.
- Full validation: 46 test files / 360 tests, typecheck, production build and diff check passed. Vite retained the pre-existing advisory that some production chunks exceed 500 kB after minification.
- Final two-axis review against `923a799`: Standards 0 findings; Spec 0 findings.
