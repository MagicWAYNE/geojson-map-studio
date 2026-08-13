# 05 — Prove same-page authoring, hot updates and resource safety

**What to build:** Complete V1.2 with automated and real-browser evidence that direct upload, atomic update buttons, controlled hover and same-page layout work without persistence regressions, scene rebuilds on business edits or built-in-map regressions.

**Blocked by:** 02 — Activate valid GeoJSON directly from the side panel; 03 — Commit editor data through atomic update actions; 04 — Coordinate editor focus with map hover.

**Status:** ready-for-agent

- [ ] At 1920×1080 the left-shifted map and right panel do not overlap, clip critical controls or create document scrolling.
- [ ] Uploading the mixed deterministic fixture changes the map directly with one canvas and lists every region in the panel.
- [ ] Editing a row highlights its region while columns, badges and panel values remain at the last committed state before update.
- [ ] Clicking “更新此分块” atomically changes that region's column, badge, display name and two panel values while hover remains active.
- [ ] Invalid and incomplete row updates show precise errors and do not alter the last valid map visualization.
- [ ] “更新指标” and “全部更新” behave atomically; JSON prefill remains draft-only until an explicit update.
- [ ] Repeated row, metric and update-all actions keep exactly one canvas and do not reset the camera or duplicate HUD/glow/mosaic resources.
- [ ] Map pointer, editor focus and carousel precedence match the contract in real interaction.
- [ ] Replacing GeoJSON clears previous focus, dirty state and committed custom visualization; full refresh keeps geometry and clears all business data.
- [ ] Former upload-route navigation lands on the homepage workspace without business URL state.
- [ ] Reset restores built-in terrain texture, eight badges, hover panel, carousel and district drilldown.
- [ ] Browser console contains no unhandled errors, Vue warnings, duplicate-resource symptoms or persistence-policy violations.
- [ ] Full source tests, typecheck, production build and diff checks pass; existing chunk-size advisories are reported accurately.
- [ ] Standards and Spec review against the fixed starting commit have zero unresolved actionable findings.
- [ ] All target changes and evidence are committed on `codex/open-source-prep`; no merge, push, deployment or worktree deletion occurs.

## Comments

Save at least one screenshot of the same-page workspace before a row update and one after the committed row is visibly hovered with its new values. Screenshots need not be committed.
