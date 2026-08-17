# Sentinel-2 Local Imagery Library V1 implementation plan

## Goal

Generate a reproducible local Copernicus Sentinel-2 imagery library for the prepared country/province/prefecture catalog and add an opt-in local-imagery texture mode to the current GeoJSON authoring map, with no upstream API call at application runtime.

Contract: `.scratch/sentinel2-local-imagery-v1/spec.md`

Planning snapshot: `ae202fb`

## Launch conditions

- Record a fresh fixed code point before implementation. The planning snapshot is not permission to reset later work.
- Preserve `.env`, `.claude/worktrees/`, `AGENT.md`, prepared `output/`, acquisition scripts, and every unrelated modified/untracked file.
- Do not start Ticket 05 while the current user-owned `ChongqingMap3D`, `useMapVisualSettings`, and `MapCompositionControls` changes remain unresolved or cannot be reconciled safely.
- Tickets 01 and all mocked/offline portions of 02-04 can run without credentials.
- Authenticated pilot/generation requires local-only `S2_CLIENT_ID` and `S2_CLIENT_SECRET` and must remain within free quota. No paid credit, purchase, or commercial processing is authorized.

## Current seams to preserve

- `scripts/build-region-catalog.mjs` and the versioned runtime catalog own prepared geometry packaging.
- `regionCatalog.ts` owns selection hierarchy and explicit geometry asset paths.
- `activeMapSource.ts` and `mapAuthoringWorkspace.ts` own failure-atomic geometry activation and session state.
- `ChongqingMap3D.vue` owns the existing Three.js map scene and one-renderer lifecycle.
- `useMapVisualSettings.ts` and `MapCompositionControls.vue` own current map-composition settings.
- Runtime imagery must join these seams; it must not create a second map loader, scene, renderer, settings store, or persistence mechanism.

## Frontier

```text
01 deterministic target planner
             |
             v
02 OAuth/source/quality pilot
             |
             v
03 resumable imagery generator
             |
             v
04 verified runtime library package
             |
             v
05 local imagery runtime toggle
             |
             v
06 acceptance/license/review
```

Ticket 01 can be completed immediately. Ticket 02 has mocked/offline work plus an external credential gate. Ticket 05 additionally waits for the overlapping user-owned map-composition work to settle.

## Step 01 — Deterministic target planner

Suggested paths:

```text
scripts/sentinel2-imagery.mjs
scripts/lib/sentinel2-imagery-plan.mjs
scripts/lib/sentinel2-imagery-plan.test.ts
```

Read the versioned region catalog and prepared geometry. Produce exactly 377 target jobs with stable IDs, source kind, geographic/projected bounds, 8% padding, dimensions, local output paths and PU estimates. Keep geometry interpretation and fallback rules in the deep planner rather than in the CLI.

The planner must be deterministic, credential-free and network-free. Its output is a source-controlled plan/manifest candidate, not imagery.

Commit target: planner, fixtures, tests, command and explicitly reviewed deterministic job manifest only. Do not stage prepared source data or credentials.

## Step 02 — OAuth, official source, and quality pilot

Suggested paths:

```text
scripts/lib/copernicus-auth.mjs
scripts/lib/copernicus-process-client.mjs
scripts/lib/copernicus-quality-policy.mjs
scripts/lib/*.test.ts
.scratch/sentinel2-local-imagery-v1/pilot-decision.md
```

Build all network behavior behind injected fetch seams. Prove token reuse, sanitized failures, source collection validation, fixed-quarter availability, dry-run budgeting and low-resolution quality probes before running any full image.

Evaluate Q2/Q3/Q4 for the fixed representative matrix. Pin one primary quarter, ordered fallback, no-data threshold, color transform and exact source year. Do not choose a different preferred quarter independently for every target.

Commit target: client, mocks, quality policy and sanitized pilot decision. Never commit tokens, secrets, Authorization headers or raw credential responses.

## Step 03 — Resumable generator

Use immutable job records to make Process API requests. Add allowlisted pilot, explicit execute gate, concurrency 1-2, request/PU cap, `Retry-After`, bounded backoff, checkpoint/resume, temporary files, image validation, atomic rename and SHA-256 evidence.

Keep the primary-quarter nationwide pass separate from targeted fallback. A fallback run must be driven by recorded quality policy, not manual aesthetic selection.

Commit target: generator behavior and tests. Generated binary imagery remains untracked until Ticket 04 makes an explicit delivery decision.

## Step 04 — Runtime imagery package

Suggested paths:

```text
scripts/lib/sentinel2-imagery-package.mjs
scripts/lib/sentinel2-imagery-package.test.ts
public/imagery-library/copernicus-sentinel2-<version>/manifest.json
public/imagery-library/copernicus-sentinel2-<version>/NOTICE-DATA.md
```

Create a deterministic runtime manifest with safe explicit paths, projected/geographic bounds, dimensions, source version, quarters, quality, attribution, bytes and hashes. Verify expected/missing/orphan/corrupt files and ensure processing checkpoints/raw responses never ship.

Measure the binary package before deciding to track it. If it is too large for ordinary Git delivery, keep a stable base-URL contract and use a separately reviewed local/downloadable data package. Do not make a release or hosting decision implicitly.

Commit target: schema, parser/verification tests, manifest and notice; binary assets only if the user explicitly approves the reviewed delivery mode.

## Step 05 — Runtime texture and opt-in UI

Do not begin until overlapping user-owned map-composition changes are settled.

Suggested modules:

```text
src/components/map/localImageryLibrary.ts
src/components/map/localImageryLibrary.test.ts
src/components/map/localImageryTexture.ts
src/components/map/localImageryTexture.test.ts
```

Parse and resolve the local imagery manifest outside the view. Add one explicit switch to the existing map-composition owner. Load one local texture into the existing Three.js scene, derive shared UVs from manifest EPSG:3857 bounds, preserve existing map behavior, guard stale loads and dispose replaced resources.

Default remains tech blue. Runtime never receives Copernicus credentials and never calls Copernicus or TianDiTu.

Commit target: runtime domain, texture integration, UI, tests and only the smallest intentional overlaps with the settled visual-settings code.

## Step 06 — Acceptance, license, and review

Run focused tests after every ticket, then the full commands exposed by the implementation:

```bash
npm run imagery:plan
npm run imagery:verify
npm test -- --run
npm run typecheck
npm run build
git diff --check
```

Run the authenticated pilot and record source, quota, request and actual PU evidence without secrets. Run the 1920x1080 browser matrix online and with upstream access blocked. Inspect boundaries, islands, seasonal seams, image failures, stale loads, one-canvas lifetime, texture/material disposal, console and network.

Review against:

1. `.scratch/sentinel2-local-imagery-v1/spec.md`;
2. current repository ownership and visual-settings behavior;
3. Copernicus attribution and dataset provenance;
4. independent TianDiTu-derived GeoJSON redistribution status.

Resolve every actionable finding. Do not push, merge, deploy, release, publish the imagery package, buy credits, or delete worktrees.

## Progress template

```text
Ticket: <01-06>
Completed evidence: <tests/pilot/browser/commit>
Current slice: <one verifiable behavior>
Remaining: <short list>
Blocker: none | credentials | quota | source | dirty overlap | license | <exact condition>
Source: <collection/version/quarter/fallback>
Budget: <estimated/actual requests and PU>
Targets: <planned/probed/generated/verified/unavailable>
Package: <version/files/bytes/hash status>
Runtime: <active geometry/imagery entry/local request/status>
Resources: <canvas/texture/material counts>
Credentials: absent from logs/files? yes/no
Dirty-state separation: <preserved paths/staged paths>
Scope changes: none | <explicit user approval>
```

## Pre-existing dirty-state policy

At planning time `main` is at `ae202fb`. The user owns uncommitted changes in:

- `package.json`;
- `src/components/map/ChongqingMap3D.vue` and test;
- `src/components/visual-settings/MapCompositionControls.test.ts`;
- `src/composables/useMapVisualSettings.ts` and test;
- `.env`;
- `.claude/worktrees/`;
- `AGENT.md`;
- prepared `output/`;
- TianDiTu acquisition scripts.

Implementation must take a fresh inventory because this list may change. Never reset, delete, bulk-stage, or silently absorb these paths. If `package.json` needs imagery commands, preserve the current user-owned script change and stage intentionally only after provenance review.
