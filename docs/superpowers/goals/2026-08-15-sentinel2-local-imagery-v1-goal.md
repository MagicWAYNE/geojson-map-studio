# `/goal` launch material: Sentinel-2 Local Imagery Library V1

## Status

`ready-with-runtime-overlap-gate`

The CDSE OAuth and authenticated collection-metadata preflight passed on 2026-08-16 without exposing credentials or consuming imagery-processing PU. Tickets 01-04 can proceed. Runtime Ticket 05 waits for overlapping user-owned map-composition changes to be settled or explicitly reconciled.

## Preflight

- cwd must be `/Users/fei/Projects/geojson-map-studio`.
- planning snapshot is `ae202fb`; record the actual HEAD, branch, remote and status before work and use the fresh HEAD as the fixed point.
- preserve all user-owned modified/untracked paths. Never reset, delete, rewrite, bulk-stage or silently commit them.
- do not inspect or stage `.env`; only test required environment-variable presence through a redacted preflight.
- authenticated work may use free CDSE quota only after printing a sanitized request/PU estimate and receiving the explicit `--execute` gate encoded by the harness. No paid credits or purchases.
- do not push, merge, deploy, release, publish imagery/data, change repository visibility, or delete worktrees.

## Copyable `/goal` command

```text
/goal Complete Sentinel-2 Local Imagery Library V1 in /Users/fei/Projects/geojson-map-studio while preserving all pre-existing user-owned uncommitted state. Record a fresh fixed code point before edits; ae202fb is only the planning snapshot. Do not stop until a deterministic build-time pipeline plans exactly 377 local imagery targets (1 country, 34 province-level, 342 prefecture-level), uses official Copernicus Sentinel-2 Level-3 Quarterly Mosaics with one pinned primary quarter and deterministic quality-triggered fallbacks, generates or explicitly reviews every target through a resumable rate-limited failure-atomic process, packages only verified local textures with projected bounds, hashes, quality and exact Copernicus attribution, and adds an opt-in local Sentinel-2 imagery switch to the existing Three.js map without any Copernicus or TianDiTu runtime request, second renderer, stale activation or GPU resource leak.

Read and treat these as the contract before changing code:
1. .scratch/sentinel2-local-imagery-v1/spec.md
2. .scratch/sentinel2-local-imagery-v1/source-baseline.md
3. .scratch/sentinel2-local-imagery-v1/issues/01-deterministic-target-planner.md
4. .scratch/sentinel2-local-imagery-v1/issues/02-oauth-source-and-quality-probe.md
5. .scratch/sentinel2-local-imagery-v1/issues/03-resumable-imagery-generator.md
6. .scratch/sentinel2-local-imagery-v1/issues/04-runtime-library-package.md
7. .scratch/sentinel2-local-imagery-v1/issues/05-local-imagery-runtime-toggle.md
8. .scratch/sentinel2-local-imagery-v1/issues/06-acceptance-license-and-review.md
9. .scratch/sentinel2-local-imagery-v1/acceptance.md
10. .scratch/sentinel2-local-imagery-v1/harness-config.example.json
11. .scratch/sentinel2-local-imagery-v1/fixtures/pilot-targets.json
12. docs/superpowers/plans/2026-08-15-sentinel2-local-imagery-v1.md
13. CONTEXT.md
14. docs/adr/0001-split-sample-and-map-tool-product-lines.md
15. public/region-catalog/tianditu-2025-09/catalog.json
16. src/components/map/regionCatalog.ts
17. src/components/map/regionCatalogSource.ts
18. src/components/map/activeMapSource.ts
19. src/components/map/mapAuthoringWorkspace.ts
20. src/components/map/ChongqingMap3D.vue
21. src/composables/useMapVisualSettings.ts
22. src/components/visual-settings/MapCompositionControls.vue

Execute Tickets 01-06 in dependency order. Ticket 01 and mocked/offline parts of later tickets may run without credentials. Before any authenticated call, prove S2_CLIENT_ID and S2_CLIENT_SECRET are present without printing them, validate the official collection and pinned source, print request/pixel/PU budget, default to dry-run and require --execute. Reuse OAuth tokens until expiry. Never put secrets in VITE variables, logs, files, tests, manifests or browser code. Stay inside free quota; if paid credits, a purchase, higher quota or a different provider is required, stop and report the exact blocker.

Before Ticket 05, re-check the user-owned dirty map-composition files. If ChongqingMap3D.vue, useMapVisualSettings.ts, MapCompositionControls or their tests still contain unresolved user work that cannot be safely reconciled, do not overwrite it; stop that ticket and report the exact overlapping paths while preserving completed non-overlapping pipeline work.

Use red-green-refactor at public seams. Keep a compact progress log naming current ticket, exact completed evidence, remaining work, source/quarter, estimated and actual PU, target counts, package status, runtime request, resource counts, credential-redaction proof, dirty-state separation and blockers. Do not weaken tests or treat mocks, a successful token, an HTTP 2xx, generated files, a listening port or a single screenshot as nationwide acceptance.

Preserve these invariants:
- application runtime is local-only and contains no Copernicus/TianDiTu credentials or upstream call;
- country/province/prefecture share one source version and deterministic fallback policy; per-city aesthetic date selection is forbidden;
- longest output dimension is 2000 with EPSG:3857 shared bounds and deterministic 8% padding;
- one target texture covers the whole target; counties reuse it through shared UV bounds rather than receive separate textures;
- dry-run is default, live work is allowlisted/resumable/budgeted, and partial or corrupt files are never promoted;
- runtime paths come only from a parsed versioned manifest; views do not reconstruct them;
- the current map geometry/session/renderer/settings owners remain authoritative and exactly one canvas remains live;
- imagery is opt-in; current tech-blue composition, hover, editing, metrics, bars, effects, HUD, camera, backgrounds and reset remain correct;
- modified data attribution is exact and separate from the code license;
- Copernicus imagery permission does not silently approve redistribution of TianDiTu-derived GeoJSON.

Do not implement runtime slippy maps, per-county textures, user AOI downloads, time sliders, raw L2A nationwide compositing unless the official quarterly pilot fails and the user approves scope, DEM/height terrain, deployment, release, public data hosting, push, merge or worktree deletion.

Completion requires deterministic planner/package evidence; sanitized OAuth and quota evidence; representative Q2/Q3/Q4 pilot and fixed source decision; verified target inventory; complete hashes/attribution; full tests/typecheck/build/diff checks; a real 1920x1080 online/offline browser matrix; zero runtime upstream calls; visual alignment review; one-canvas and texture/material disposal proof; final Spec/repository/license review with zero unresolved actionable findings; and an exact accounting of scoped commits versus preserved user-owned dirty paths.
```

## Frontier

```text
01 planner -> 02 auth/pilot -> 03 generator -> 04 package -> 05 runtime -> 06 acceptance
```

## Goal progress template

```text
Ticket: <01-06>
Completed evidence: <tests/pilot/browser/commit>
Current slice: <one observable behavior>
Remaining: <short list>
Blocker: none | credentials | quota | source | dirty overlap | license | <exact condition>
Source: <collection/version/quarter/fallback>
Budget: <estimated/actual requests and PU>
Targets: <planned/probed/generated/verified/unavailable>
Package: <version/files/bytes/hash status>
Runtime: <selection/local asset/status/upstream requests>
Resources: <canvas/texture/material counts>
Credential redaction: <evidence>
Dirty-state separation: <preserved paths/staged paths>
Scope changes: none | <explicit user approval>
```

## Final evidence checklist

- fresh cwd/branch/HEAD/remote/status and preserved user dirty-state inventory;
- 377-target deterministic plan and dimension/PU estimates;
- official collection, pinned quarter and current quota verification;
- sanitized OAuth token reuse and no-secret proof;
- representative Q2/Q3/Q4 probe/pilot with no-data and alignment evidence;
- dry-run/execute, retry, checkpoint, resume and atomic promotion tests;
- verified target/file/hash/byte/quality inventory and reviewed unavailable targets;
- deterministic runtime manifest and `NOTICE-DATA.md`;
- explicit large-binary delivery decision without implicit release;
- runtime manifest resolution, shared UV, failure/stale/disposal tests;
- full source tests, typecheck, build and diff checks;
- 1920x1080 online/offline browser matrix and clean console/network;
- exactly one canvas and bounded texture/material resources;
- exact Copernicus attribution plus separate GeoJSON release gate;
- final review with zero unresolved actionable findings;
- scoped local commit list and separate remaining user-owned paths;
- explicit confirmation of no paid credits, push, merge, deployment, release, publication or worktree deletion.
