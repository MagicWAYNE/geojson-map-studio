# 01 — Build the deterministic imagery target planner

**What to build:** Produce a credential-free, network-free job manifest for the 377 country/province/prefecture texture targets from the prepared region catalog and geometry.

**Blocked by:** None.

Status: completed

- [x] Add a small deep planning module rather than embedding calculations in a CLI entry point.
- [x] Resolve 1 country, 34 province-level, and 342 prefecture-level target geometries with explicit stable `gb` identities.
- [x] Use parent geometry fallback for province-equivalent or zero-county targets; never infer a bounding box from an empty child file.
- [x] Convert geographic bounds to EPSG:3857, add 8% padding per side, clamp valid world extent, and preserve aspect ratio.
- [x] Set maximum dimension to 2000 and prove no output dimension exceeds the Process API 2500-pixel limit.
- [x] Snap bounds to a deterministic grid and record both geographic and projected bounds.
- [x] Estimate output pixels, request count, and three-/four-band PU before any live call.
- [x] Emit a deterministic schema-versioned job manifest with no timestamp or credentials.
- [x] Cover compact, typical, very large, island-heavy, municipality, invalid and empty fixtures.
- [x] Add a no-network `plan` command and a verification command; do not add live processing yet.

## Acceptance evidence

- Exactly 377 unique targets.
- Country/province/prefecture counts are 1/34/342.
- Repeated runs produce byte-identical job manifests.
- Estimated base PU remains within the documented planning envelope.
- No target has non-finite bounds, zero dimensions, unsafe paths, or an implicit `latest` source version.

## Completed evidence (2026-08-16)

- `npm run imagery:plan`: 377 targets, 1,201,720,000 pixels, estimated 4,584.198 three-band PU and 6,112.264 four-band PU.
- `npm run imagery:verify-plan`: passed; final pinned release-job manifest SHA-256 `f343185a8a41fb984e6a8a76dd86d688bdc289fff4086738d7d7af7f19bbc98e`.
- `npx vitest run scripts/sentinel2/target-planner.test.ts`: 6 tests passed, including invalid/empty fixtures, four scale/shape cases, determinism, municipality and empty-child fallback.
