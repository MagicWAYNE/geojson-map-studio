# `/goal` launch material: Region Catalog Selection V1

## Preflight

- cwd must be `/Users/fei/Projects/geojson-map-studio`.
- branch must be `main` unless the user creates and explicitly selects a dedicated worktree before launch.
- fixed code point is `3ddd1f5 fix: apply metric definitions with region updates`.
- the working tree already contains user-owned GeoJSON preparation from session `01a00345-669c-79a2-8d45-bbd21cb672f2`; it is an explicit input, not a clean baseline.
- implementation may add code, tests, runtime catalog assets, this feature's `.scratch` materials, plan and harness, and may create scoped local commits.
- implementation must not read or stage `.env`; delete or stage `.claude/worktrees/`, `AGENT.md`, the temporary acquisition script, raw responses or unrelated output; push; merge; deploy; release; change repository visibility; or delete a worktree.

## Copyable `/goal` command

```text
/goal Complete Region Catalog Selection V1 in /Users/fei/Projects/geojson-map-studio from fixed code point 3ddd1f5 while preserving all pre-existing user-owned uncommitted data-preparation state. Do not stop until the existing GeoJSON authoring page keeps local boundary upload and adds “或从区域库选择” directly below it; users can explicitly load 全国→省级区域, 省级区域→下一级区域, 省级区域→区县, and 地市级区域→区县 maps from the prepared 2025-09 catalog; no select change loads a map until “加载此区域” is clicked; one shared geometry-candidate path performs inspection, preparation, failure-atomic activation, IndexedDB geometry persistence, authoring-session reset and map update for both local files and catalog assets; catalog maps use unique official properties.gb as stable region keys and properties.name as non-unique default display names; legacy uploaded geometry and persisted package versions remain compatible; refresh restores catalog geometry and Chinese default display names while business values, edited presentation and visual settings retain their existing session-only lifetime; malformed, missing, empty, aborted or stale catalog loads preserve the last valid map; unavailable prefecture and Macau county entries are disabled and make no asset request; the application never calls TianDiTu at runtime.

Read and treat these as the contract before changing code:
1. .scratch/region-catalog-v1/spec.md
2. .scratch/region-catalog-v1/data-inventory.md
3. .scratch/region-catalog-v1/issues/01-runtime-catalog-package.md
4. .scratch/region-catalog-v1/issues/02-stable-key-display-persistence.md
5. .scratch/region-catalog-v1/issues/03-catalog-source-shared-activation.md
6. .scratch/region-catalog-v1/issues/04-region-catalog-picker-ui.md
7. .scratch/region-catalog-v1/issues/05-acceptance-review.md
8. .scratch/region-catalog-v1/acceptance.md
9. docs/superpowers/plans/2026-08-15-region-catalog-v1.md
10. CONTEXT.md
11. docs/adr/0001-split-sample-and-map-tool-product-lines.md
12. output/tianditu-administrative-geojson-2025-09/README.md
13. output/tianditu-administrative-geojson-2025-09/manifest.json
14. output/tianditu-administrative-geojson-2025-09/OFFICIAL-DOWNLOAD-VERIFICATION.md
15. src/views/MapLoaderView.vue
16. src/views/HomeView.vue
17. src/components/map/mapDocument.ts
18. src/components/map/mapAuthoringWorkspace.ts
19. src/components/map/activeMapSource.ts
20. src/components/map/indexedDbMapPackageStore.ts
21. src/components/map/ChongqingMap3D.vue

Execute tickets in dependency order: 01 runtime package, 02 stable key/display persistence, 03 catalog source and shared activation, 04 picker UI, 05 acceptance/review. Use red-green-refactor at the public seams even when no named TDD skill is available. Keep a compact progress log naming current ticket, exact completed evidence, remaining work, dirty-state separation and blockers. Do not weaken current tests or infer browser acceptance from a listening port.

Preserve these invariants:
- The prepared data is an input artifact. Runtime output contains only deterministic minified derived Polygon/MultiPolygon maps plus a schema-versioned catalog; it excludes raw responses, official samples, acquisition caches, temporary files and credentials.
- Initial page load fetches only catalog.json. One explicit load fetches exactly one map asset. GeoJSON is never imported into the JavaScript bundle.
- Views never reconstruct Chinese asset paths. A deep catalog module owns schema parsing, hierarchy, labels, availability and selection resolution.
- Local upload and catalog fetch converge before inspect/prepare/activate. There remains one active-map source, one authoring session and one geometry store.
- Stable region identity and presentation are separate: catalog key=gb and display=name. Keys are non-empty/unique; display names are non-empty and may repeat. Geometry, metrics, hover and edits stay keyed by gb.
- Arbitrary uploads default key and display to the same selected legacy property. Persisted v1/v2 packages migrate without changing their visible names. The new package stores both properties and includes both in identity.
- A newer file choice, catalog load or reset aborts older catalog fetch/activation. Aborts are silent; all real failures use the existing expanded Alert and preserve the last valid map.
- Selected catalog geometry persists as full geometry text, so refresh does not require a catalog refetch. Business and visual state do not gain persistence.
- Current map composition, camera defaults, tech-blue appearance, HUD, effects, backgrounds, bars, hover priority, explicit business update buttons, optional business JSON and built-in reset remain unchanged.

Do not implement runtime TianDiTu calls, map double-click drilldown, breadcrumbs, township/street data, search, favorites, recents, user catalogs, geometry composition/editing/simplification/reprojection, business or visual persistence, accounts, billing, collaboration, export, deployment, release, push, merge or worktree deletion.

Do not mark complete from unit tests alone. Run the fixed data inventory and deterministic package tests; full source tests; typecheck; production build; fixed-point/worktree diff checks; and a real 1920x1080 browser matrix covering local upload, 34-country regions, 河北 11 next-level regions, 河北 167 counties with duplicate visible names, 石家庄 22 counties, unavailable entries, stale cancellation, failure retention, refresh, region editing, hover, charts, HUD/effects, one-canvas resource safety and built-in reset. Record evidence in .scratch/region-catalog-v1/acceptance.md. Review against the Spec and repository conventions, resolve every actionable finding, and create scoped local commits without staging .env, .claude/worktrees, AGENT.md, raw data or the temporary acquisition script.
```

## Frontier

```text
01 runtime package ─┐
                    ├─> 03 shared source/activation -> 04 picker UI -> 05 acceptance/review
02 key/display ─────┘
```

## Goal progress template

```text
Ticket: <01-05>
Completed evidence: <tests/browser/commit>
Current slice: <one user-visible behavior>
Remaining: <short list>
Blocker: none | <exact repeated external condition>
Catalog request: none | <selection/path/status/aborted?>
Active geometry: <source/identity/region count>
Identity/display: <key property/display property/duplicate display proof>
Persistence: <geometry retained; business/visual session-only>
Resources: <canvas/renderer/base scene counts>
Dirty-state separation: <pre-existing paths preserved; staged paths>
Scope changes: none | <explicit user approval>
```

## Final evidence checklist

- exact cwd, branch, fixed point, remote and pre-existing dirty-state inventory;
- 411-file validation and deterministic runtime package manifest;
- runtime package size, excluded-source proof and no runtime upstream request;
- key/display migration and duplicate-name behavior tests;
- catalog source success/failure/abort/stale tests;
- picker dependency, explicit-load and unavailable-entry tests;
- upload regression and refresh state-lifetime tests;
- `npm test -- --run` final file/test counts;
- `npm run typecheck`;
- `npm run build` and honest advisory reporting;
- `git diff --check 3ddd1f5 --` and worktree diff check;
- 1920×1080 browser matrix and clean console;
- one-canvas/resource evidence;
- final Spec/repository review with zero unresolved actionable findings;
- scoped local commit list and separate remaining user-owned uncommitted paths;
- explicit confirmation of no push, merge, deployment, release or worktree deletion.
