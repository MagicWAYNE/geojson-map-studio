# 05 — Prove same-page authoring, hot updates and resource safety

**What to build:** Complete V1.2 with automated and real-browser evidence that direct upload, atomic update buttons, controlled hover and same-page layout work without persistence regressions, scene rebuilds on business edits or built-in-map regressions.

**Blocked by:** 02 — Activate valid GeoJSON directly from the side panel; 03 — Commit editor data through atomic update actions; 04 — Coordinate editor focus with map hover.

Status: ready-for-human

- [x] At 1920×1080 the left-shifted map and right panel do not overlap, clip critical controls or create document scrolling.
- [x] Uploading the mixed deterministic fixture changes the map directly with one canvas and lists every region in the panel.
- [x] Editing a row highlights its region while columns, badges and panel values remain at the last committed state before update.
- [x] Clicking “更新此分块” atomically changes that region's column, badge, display name and two panel values while hover remains active.
- [x] Invalid and incomplete row updates show precise errors and do not alter the last valid map visualization.
- [x] “更新指标” and “全部更新” behave atomically; JSON prefill remains draft-only until an explicit update.
- [x] Repeated row, metric and update-all actions keep exactly one canvas and do not reset the camera or duplicate HUD/glow/mosaic resources.
- [x] Map pointer, editor focus and carousel precedence match the contract in real interaction.
- [x] Replacing GeoJSON clears previous focus, dirty state and committed custom visualization; full refresh keeps geometry and clears all business data.
- [x] Former upload-route navigation lands on the homepage workspace without business URL state.
- [x] Reset restores built-in terrain texture, eight badges, hover panel, carousel and district drilldown.
- [x] Browser console contains no unhandled errors, Vue warnings, duplicate-resource symptoms or persistence-policy violations.
- [x] Full source tests, typecheck, production build and diff checks pass; existing chunk-size advisories are reported accurately.
- [x] Standards and Spec review against the fixed starting commit have zero unresolved actionable findings.
- [x] All target changes and evidence are committed on `codex/open-source-prep`; no merge, push, deployment or worktree deletion occurs.

## Comments

Save at least one screenshot of the same-page workspace before a row update and one after the committed row is visibly hovered with its new values. Screenshots need not be committed.

Accepted at a 1920×1080 viewport on `http://127.0.0.1:4175/#/`. The map occupied
`left 24 / top 132 / 1120×948`; the independently scrolling panel occupied
`left 1176 / top 24 / 720×1032`, with no overlap or document scrolling.

Browser evidence covered direct mixed-geometry upload, three detected rows,
draft-only editing, atomic row/metric/all updates, precise invalid-input retention,
JSON prefill, controlled hover precedence, geometry replacement isolation, refresh
clearing all business data, legacy-route redirect, built-in reset, eight built-in
badges, hover panel and district drilldown. Every observed transition retained one
canvas and the final browser console contained no warnings or errors.

Final automated evidence: 49 source test files and 385 tests passed; typecheck,
production build and diff checks passed. The production build retained only Vite's
existing advisory for chunks larger than 500 kB. Standards and Spec review against
fixed point `d0d0527` reported zero unresolved actionable findings after fixes for
stale activation cancellation, workspace intent ownership, duplicate initialization,
duplicate publish flow and literal issue status formatting.
