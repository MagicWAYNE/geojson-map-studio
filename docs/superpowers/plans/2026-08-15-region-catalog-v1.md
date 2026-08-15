# Region Catalog Selection V1 implementation plan

## Goal

Add a versioned prepared-region catalog below local GeoJSON upload so users can explicitly load national, province-level and prefecture-level maps through the current authoring session, using official `gb` identifiers internally and Chinese `name` values for default presentation.

Contract: `.scratch/region-catalog-v1/spec.md`

Fixed code point: `3ddd1f5`

## Current seams to preserve

- `MapLoaderView.vue` owns geometry user intent, candidate preparation, status and authoring panel composition.
- `mapAuthoringWorkspace.ts` owns geometry cancellation, authoring state, focus and atomic visualization updates.
- `activeMapSource.ts` owns failure-atomic geometry persistence and active-document replacement.
- `mapDocument.ts` owns GeoJSON validation, projection, identity and default visualization construction.
- `ChongqingMap3D.vue` consumes normalized `MapDocument`; it must not learn catalog URLs or source hierarchy.

## Frontier

```text
01 runtime catalog package ─┐
                            ├─> 03 catalog source + shared activation -> 04 picker UI -> 05 acceptance/review
02 key/display persistence ─┘
```

Prefer 01 → 02 → 03 → 04 → 05 in one working tree. Tickets 01 and 02 are conceptually independent but both touch contracts consumed by Ticket 03; do not parallelize edits to `mapDocument.ts`, `MapLoaderView.vue` or `package.json`.

## Step 01 — Runtime package and catalog

Add a deterministic packaging module and tests. Suggested paths:

```text
scripts/build-region-catalog.mjs
scripts/lib/region-catalog-package.mjs
scripts/lib/region-catalog-package.test.ts
public/region-catalog/tianditu-2025-09/catalog.json
public/region-catalog/tianditu-2025-09/maps/...
```

The packager reads prepared data but publishes only normalized runtime assets. Generate explicit asset paths; never rely on Vue controls to reproduce Chinese filenames. Add `build:region-catalog` without removing the existing uncommitted `geojson:tianditu` script.

The build-time validator should reuse the same numeric limits as the application through a small shared constants module if this can be done without coupling Node packaging to browser-only code. Avoid duplicating magic limit values in two owners.

Commit target: runtime packager, tests, catalog schema and explicitly approved runtime assets only. Preserve source output and user-owned files unstaged.

## Step 02 — Stable key and display property

Refactor the smallest deep seam in `mapDocument.ts`:

- parse and validate a unique key property;
- parse and validate a non-empty display property without uniqueness;
- return projected regions keyed by the stable value;
- create default visualization rows with source display names;
- include both properties in geometry identity and summaries;
- persist both in a new package version;
- migrate v1/v2 records by using the old `nameProperty` for both.

Retain the upload UI's existing name-property behavior. It should call the new API with the same field for key and display unless a provider supplies separate metadata.

Test at the document and active-source seams before changing the view. Use a minimal duplicate-display fixture with unique keys and the real 河北 inventory in integration coverage.

Commit target: model, migration and tests; no catalog UI.

## Step 03 — Catalog source and shared activation

Suggested modules:

```text
src/components/map/regionCatalog.ts
src/components/map/regionCatalog.test.ts
src/components/map/regionCatalogSource.ts
src/components/map/regionCatalogSource.test.ts
```

The catalog module parses immutable data and resolves `RegionCatalogSelection` to a map entry. The source fetches catalog and assets using an injected fetch seam for deterministic tests.

Extract from `MapLoaderView` one shared `prepareAndActivateGeometry` flow that accepts text, display filename/label, inspection policy, key property and display property. File reads and catalog fetches remain source-specific adapters before that seam.

Begin a geometry intent before catalog fetch and pass its signal through all asynchronous work. Verify that file upload, a second catalog load and reset each cancel older catalog work.

Commit target: catalog domain/source, shared activation and tests; no final picker styling.

## Step 04 — Picker UI

Suggested component:

```text
src/components/map/RegionCatalogPicker.vue
src/components/map/RegionCatalogPicker.test.ts
```

Keep catalog selection state and dependency logic in the component or a narrow composable, but keep fetch/activation in the parent intent owner. Emit a typed `load` intent containing `RegionCatalogSelection`.

Place the component below boundary upload and above the common optional business JSON field. Render controls from catalog data; do not hard-code province or prefecture lists. Use one explicit load button and the existing Alert for final outcomes.

Test source switching, incomplete selections, municipality labels, empty-entry disabling, busy state, no eager asset request, explicit load and keyboard-accessible labels.

Commit target: picker, view integration, styles and focused tests.

## Step 05 — Acceptance and review

Run focused tests after each step, then:

```bash
npm test -- --run
npm run typecheck
npm run build
git diff --check 3ddd1f5 --
git diff --check
```

Serve the exact implementation and perform the browser matrix from `.scratch/region-catalog-v1/acceptance.md` at 1920×1080. Inspect the console, network requests, document/sidebar scroll, active map after failure, refresh behavior and canvas/resource counts.

Review along two axes:

1. Spec: every required behavior, failure state, persistence boundary and non-goal.
2. Repository: `CONTEXT.md`, ADR 0001, existing source ownership, accessibility and named baseline code smells.

Resolve every actionable finding, update acceptance evidence, and make scoped local commits. Do not push, merge, deploy, release or delete worktrees.

## Pre-existing dirty-state policy

At planning time the repository is on `main` at `3ddd1f5` with user-owned uncommitted data-preparation state. The implementation must begin by recording exact status and must preserve:

- `.env` without reading or staging it;
- `.claude/worktrees/`;
- `AGENT.md`;
- `scripts/temporary-tianditu-administrative-geojson.mjs`;
- prepared `output/` source and audit data;
- `scripts/fetch-tianditu-administrative-geojson.mjs`;
- the existing `package.json` addition for `geojson:tianditu`.

If implementation needs to overlap `package.json`, preserve the user line and stage the resulting file intentionally. Do not delete, rewrite or bulk-stage unrelated inputs. If provenance cannot be separated safely, stop and report the exact overlapping paths before committing.
