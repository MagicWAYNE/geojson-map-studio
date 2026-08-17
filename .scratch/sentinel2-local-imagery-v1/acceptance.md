# Sentinel-2 Local Imagery Library V1 acceptance

Status: completed

Planning snapshot: `ae202fb`

## Launch gates

| Gate | Required evidence | Status |
| --- | --- | --- |
| Working tree | Fresh HEAD/branch/status; user-owned overlapping paths resolved or explicitly reconciled | Passed: `main@ae202fb70c55339782d1e75525949f0aae6477b6`; six pre-existing modified files rechecked immediately before Ticket 05 and the user's camera-default extraction/change was preserved |
| OAuth client | Local-only client ID/secret work without exposure; token HTTP 200, 1,800-second lifetime, collection HTTP 200 | Passed |
| Source pin | Official collection and exact primary/fallback quarters recorded | Passed: primary 2025-Q2; fallback 2025-Q4, 2025-Q3 |
| GeoJSON CRS | Four representative alignment controls accept the coordinate interpretation | Passed by projected-bounds tests, pilot visual review, final static samples and real-browser Hebei/Xiamen alignment |
| Data license | Copernicus notice fixed; TianDiTu-derived GeoJSON release reviewed separately | Passed for imagery; GeoJSON redistribution remains a separate release gate |

## Automated gates

| Gate | Required evidence | Status |
| --- | --- | --- |
| Planner inventory | 377 unique targets: 1 country, 34 province-level, 342 prefecture-level | Passed: 1/34/342 |
| Determinism | Byte-identical job and runtime manifests from identical inputs | Passed; planner SHA `f343185a8a41fb984e6a8a76dd86d688bdc289fff4086738d7d7af7f19bbc98e`, repaired runtime manifest SHA `2c10d906af4e8b827b9224fe7339116ab89682b3fb888421196dd0a2e1f118b2` |
| Dimensions | 8% projected padding, longest side 2000, all dimensions <=2500 | Passed for all 377 targets |
| Budget | Request, pixel and PU estimate below approved cap before live calls | Passed; repaired generator excludes country and 33 locally composed provinces from Process budget; Macau has no prefecture source and remains direct: 343 worst-case requests and <=4,173.053 estimated PU. Historical actual promoted PU 4,560.331; rejected direct-country PU 92.865; total 4,653.196 |
| Credentials | Token reuse/expiry and redacted 401/429/error tests | Passed: 3 focused OAuth tests |
| Quality policy | Fixed primary quarter and deterministic threshold/fallback behavior | Passed: 15 quality probes + 15 accepted RGB previews; 2% threshold |
| Generator safety | Dry-run, execute gate, retry, checkpoint, resume, corrupt response and atomic rename | Passed: 7 generator tests, including province local-composition and no-prefecture direct-path regressions, plus authenticated resume with zero Process requests |
| Package | Hash, attribution, source identity, safe path, missing/orphan/corrupt detection | Passed: 377 entries, 375 images, 2 waivers, 378 files; repaired inventory SHA `21f36dea914f49f4d2b5c98afd04c99d7903f4fba7c4c51a3c2b0db7618ad0fe` |
| Runtime source | Manifest parsing and selection resolution; no path reconstruction in views | Passed by focused tests and browser resource inventory |
| UV mapping | Shared EPSG:3857 bounds for polygons, multipolygons, holes and islands | Passed by focused tests and 1920x1080 Hebei/Xiamen visual review |
| Failure atomicity | 404/decode/hash/stale failures retain valid geometry/rendering | Passed by unit cases and real-browser missing-JPEG/Hainan controls |
| Resource lifecycle | Replaced textures/materials disposed; one canvas remains | Passed by disposal tests and repeated browser toggles/map changes |
| Regression | Full source tests, typecheck and build | Passed after LAN HTTP digest repair: 68 files/481 tests, typecheck and production build |

## Authenticated pilot matrix

| Target | Why | Q2 | Q3 | Q4 | Alignment | Decision |
| --- | --- | --- | --- | --- | --- | --- |
| Compact coastal city | coast/islands and high aspect ratio | Probed | Probed | Probed | Passed | Xiamen selected Q2 and passed final browser review |
| 成都 or equivalent | basin/mountain/cloud pressure | Probed | Probed | Probed | Passed | Chengdu sample accepted |
| 呼伦贝尔 or equivalent | very large extent | Probed | Probed | Probed | Passed | Hulunbuir sample and final image accepted |
| Island/high-latitude target | sparse observations/snow/no-data | Probed | Probed | Probed | Passed with waiver | Sansha best quarter remained 12.008% no-data and is explicitly unavailable |

Record for every cell: request hash, output dimensions, bytes, no-data ratio, actual PU if exposed, source item/quarter, SHA-256, and reviewed screenshot path. Never record credentials or bearer tokens.

## 1920x1080 browser matrix

| Scenario | Required proof | Status |
| --- | --- | --- |
| Default rendering | Current tech-blue composition is unchanged before opt-in | Passed; reload resets the session-only switch to off |
| Country imagery | Country geometry resolves and loads exactly one local texture | Passed: nationwide 34-province geometry loaded same-origin `images/country/100000.jpg`, aligned without rejected black blocks, and retained one canvas |
| Province imagery | Representative province resolves correct local entry and UVs | Passed: 32 available provinces with prefecture sources were locally recomposed; Hainan remains unavailable under the quality policy; Inner Mongolia, Xinjiang, Tibet and Gansu same-origin textures were browser-reviewed without rectangular no-data blocks; Macau retained its verified direct texture |
| Prefecture imagery | Compact, typical and large targets render without stretch/misalignment | Passed for Xiamen in browser; Xiamen/Hulunbuir/Nanning final JPEGs visually reviewed |
| Offline operation | Upstream blocked/network disabled; local catalog and texture still load | Passed as upstream-disconnected local-host operation: after clean reload every observed resource origin was `http://localhost:5174` |
| Missing asset | Error is visible; last valid geometry/rendering remains | Passed with temporary missing Shanxi JPEG; honest error and tech-blue fallback, then package restored and reverified |
| Rapid changes | Only newest geometry/texture intent activates | Passed by generation/abort tests and browser map changes |
| Visual regressions | Hover, editor, metrics, bars, badges, effects, HUD and camera remain correct | Passed by source regression suite and live visual inspection; selected-region overlay remained functional over texture |
| Reset | Built-in reset cancels texture work and restores current behavior | Passed by tests and browser reload/session reset |
| Resources | Exactly one canvas; repeated toggles do not grow textures/materials | Passed; one canvas after success, waiver, fault, reload and repeated toggles |
| Network/console | No Copernicus/TianDiTu runtime request; no unhandled errors or WebGL warnings | Passed for country/province/prefecture flows and `http://192.168.1.132:5174`: the LAN HTTP origin used the SHA-256 fallback, loaded the country texture, and produced no warnings/errors |

Browser evidence is real 1920x1080 application behavior. “Offline” means disconnected from all upstream providers while the local application server and its same-origin static package remain available; the page asset inventory proves there is no external origin to satisfy at runtime. Automated tests separately cover the narrow stale-load race and texture/material disposal counters that cannot be inferred from canvas count alone.

## Final evidence commands

Commands are finalized by implementation, but the harness must expose equivalents of:

```bash
npm run imagery:plan
npm run imagery:verify-plan
npm run imagery:verify-library
npm test -- --run
npm run typecheck
npm run build
git diff --check
```

Authenticated commands must default to dry-run and require `--execute`. The final ledger records command, date, sanitized outcome, request/PU usage, file/test counts, package count/bytes, browser URL and exact dirty-state separation.

## Scope boundary

No runtime upstream API, per-county texture set, time slider, raw L2A nationwide composite, DEM terrain, deployment, release, public dataset hosting, push, merge, or worktree deletion is authorized.

## Dirty-state baseline (2026-08-16)

The implementation launch point is branch `main`, commit `ae202fb70c55339782d1e75525949f0aae6477b6`. The following modified paths pre-date Sentinel-2 implementation and remain user-owned:

```text
package.json
src/components/map/ChongqingMap3D.test.ts
src/components/map/ChongqingMap3D.vue
src/components/visual-settings/MapCompositionControls.test.ts
src/composables/useMapVisualSettings.test.ts
src/composables/useMapVisualSettings.ts
```

The map component and visual-settings overlap currently contains the user's camera-default extraction/change. It must remain intact. Ticket 05 must compare these paths against this baseline immediately before editing and stop if the changes can no longer be preserved safely.

## Final scope accounting (2026-08-16)

- Branch and fixed code point: `main@ae202fb70c55339782d1e75525949f0aae6477b6`; it was freshly re-read before implementation even though it equals the earlier planning snapshot.
- Scoped commits: none. No files were staged, committed, pushed or merged.
- Preserved user-owned tracked changes: `package.json`, `src/components/map/ChongqingMap3D.test.ts`, `src/components/map/ChongqingMap3D.vue`, `src/components/visual-settings/MapCompositionControls.test.ts`, `src/composables/useMapVisualSettings.test.ts`, and `src/composables/useMapVisualSettings.ts`. The camera-default extraction and `[-6.5, 127.6, 97.4]` value remain present.
- Sentinel-scoped tracked edits/additions: `.gitignore`, `package-lock.json`, imagery scripts/tests/docs/Harness files, manifest/resolver/composable/control/UV modules, and the minimal existing map-document/source/loader/home/composition seams listed by `git status`.
- Preserved unrelated untracked state: `.claude/worktrees/`, `.env`, `AGENT.md`, `output/`, and TianDiTu acquisition scripts.
- Local binary delivery: `public/imagery-library/` remains ignored and was not published. Its previous package revision was moved recoverably to `/Users/fei/.Trash/geojson-map-studio-sentinel2-previous-package-20260816`; no worktree was deleted.
