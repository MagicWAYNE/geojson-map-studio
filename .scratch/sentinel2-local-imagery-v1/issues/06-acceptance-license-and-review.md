# 06 — Complete offline acceptance, license evidence, and final review

**What to build:** Close the implementation only after the local data package, runtime behavior, visual alignment, offline operation, resource lifecycle, attribution and source boundaries are proven together.

**Blocked by:** Tickets 01-05.

Status: completed

- [x] Run deterministic planner, client mocks, generator mocks, package verification, full source tests, typecheck and production build.
- [x] Re-run a sanitized live preflight and record current service limits, pinned source availability, request count and actual PU use.
- [x] Visually review pilot and final textures for cloud gaps, seasonal/color seams, clipping, stretched pixels, coastlines and islands.
- [x] Run the fixed 1920x1080 browser matrix with network online and then with upstream domains blocked/offline.
- [x] Prove local upload, prepared region catalog, authoring, hover, metrics, bars, badges, effects, HUD, camera and reset regressions remain green.
- [x] Prove no Copernicus/TianDiTu request occurs at runtime.
- [x] Prove exactly one canvas and bounded texture/material resources.
- [x] Verify `NOTICE-DATA.md`, per-entry attribution, source years, legal-notice link and no endorsement language.
- [x] Keep the Copernicus imagery release decision separate from the TianDiTu-derived GeoJSON redistribution decision.
- [x] Review against Spec and repository conventions; resolve every actionable finding.
- [x] Record exact scoped commits and remaining user-owned dirty paths. Do not push, merge, deploy, release, publish data, or delete worktrees.

## Acceptance evidence

Use `.scratch/sentinel2-local-imagery-v1/acceptance.md` as the sole evidence ledger. Mock/synthetic, pilot, full-data, automated and real-browser evidence must be labeled separately.

Final review (2026-08-16): country, province and prefecture browser views each resolved the expected single same-origin texture; all observed page resources originated at `http://localhost:5174`, one canvas remained live, and console inspection found no warning/error. Automated disposal/stale-load/failure tests supplement the browser resource evidence. Package inspection found 377 exact per-entry attributions, no unexpected quarter/projection/dimension value and no endorsement language. No commit, push, merge, deployment, release, public hosting or worktree deletion was performed.
