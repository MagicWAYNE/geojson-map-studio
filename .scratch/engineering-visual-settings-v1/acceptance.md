# Engineering Visual Settings V1 acceptance

Status: ready-for-human

Fixed point: `a86da05`

Branch: `codex/right-sidebar-settings`

## Automated evidence

| Gate | Evidence | Result |
| --- | --- | --- |
| Fixed inventory | `VisualSettingsPanel.test.ts` contains an explicit inline snapshot of every published fixed-point field plus a fixed action list. It is independent of the current defaults schema, so deleting a schema leaf and its UI control cannot silently update the expected baseline. | Passed |
| Session behavior | `useMapVisualSettings.test.ts` covers default layout, partial numeric text, warning-only out-of-bounds composition, effect/HUD draft apply/discard, cross-page chart updates without draft loss, session-owned presets/resets/normalization/JSON projections, and no Web Storage writes. | Passed |
| Resource lifecycle | `ChongqingMap3D.test.ts` covers same-geometry hot reconcile, one canvas, unchanged renderer, controls target, camera defaults, in-place effects/HUD/bar updates, and disposal on genuine geometry changes. | Passed |
| Data-authoring regression | `HomeView.test.ts`, `MapLoaderView.test.ts`, map-document/session tests, and the 1920×1080 browser run cover upload, region rows, dirty business fields, applied values, built-in restore, and drilldown. | Passed |
| Full suite | `npm test -- --run` | 52 files / 399 tests passed |
| Types | `npm run typecheck` | Passed |
| Production build | `npm run build` | Passed; existing >500 kB chunk advisory remains |
| Diff hygiene | `git diff --check a86da05...HEAD` and worktree `git diff --check` | Passed |

## 1920×1080 browser matrix

The local Vite page was exercised at exactly 1920×1080. Screenshots were captured during acceptance but intentionally not committed.

### Built-in map

- The document stayed at 1080 px high, the fixed right sidebar exposed `数据配置 / 视觉样式`, and all five visual pages were reachable through page-local scroll containers.
- Composition started at `left 24 / top 132 / width 1120 / height 948`. Moving left to 1180 produced viewport/sidebar warnings, copying CSS produced `已复制 ✓`, and reset restored the exact default.
- Representative live changes were exercised across normal outward glow, Hover surface/outward glow, normal/Hover inward glow, mosaic preset/density, render scale, bars, badge, Hover panel, collision, HUD, and carousel. Exactly one canvas remained visible.
- Effect and HUD draft modes were exercised with apply and discard. Returning between effects and charts preserved each page's independent scroll position.
- Engineering diagnostics showed FPS, target size, render scale, channel/mosaic states, bar status, camera, and normalized JSON. Copy feedback and carousel toggle were exercised.
- Eight built-in business badges kept their exact values through visual edits. Built-in district click still navigated to `#/district/南岸区`.

### Uploaded map

- Uploaded `src/components/map/__fixtures__/valid-mixed.geojson`: three regions, Polygon and MultiPolygon geometry, and an interior hole loaded directly with the tech-blue visual stack.
- The custom map showed no fabricated built-in badges or business values. Representative Hover/mosaic settings remained effective, while clicking the custom geometry did not activate built-in drilldown.
- An uncommitted region value draft (`123`) and its enabled state survived navigation to visual pages and back during the same session.

### Refresh and restore

- Refresh preserved the active custom geometry package while clearing dirty business fields and enabled values.
- Composition, effect, chart, HUD, page scroll, and draft state returned to source defaults after refresh.
- Restoring the built-in map returned eight badges, zero custom rows, one canvas, and built-in drilldown.
- Final browser state: built-in home map, eight badges, one canvas, 1080 px document height, and no console errors or warnings.

## Persistence audit

The active visual-session, visual pages, reused controls, `HomeView`, and `ChongqingMap3D` contain no IndexedDB, localStorage, sessionStorage, URL, cookie, Cache Storage, or Service Worker write path for visual or business settings. Browser refresh behavior matched that source audit. The existing active-map geometry package remains the sole persisted artifact and is intentionally outside visual/business settings.

## Review disposition

Initial review findings were resolved by:

- preserving dirty effect/HUD leaves with three-way clean-leaf synchronization instead of copying the whole effective config over a draft;
- making chart updates atomic across effective and draft bar subtrees;
- allowing finite composition values outside the design viewport and warning instead of clamping;
- moving presets, scoped resets, normalization projections, numeric field lifecycle, and runtime naming into the visual-session interface;
- replacing schema-derived inventory expectations with an explicit fixed-point snapshot; and
- recording this acceptance matrix.

Final Standards and Spec review results are recorded in the completion report after both reviewers re-check the committed branch.

## Scope boundary

All changes are local commits in this worktree. No merge, push, deployment, release, persistent visual settings, paid feature, or worktree deletion was performed.
