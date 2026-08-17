# 02 — Add sanitized OAuth, source preflight, and low-resolution quality probes

**What to build:** Prove the official source, credential handling, pinned-quarter availability, quota budget, and no-data quality without spending full-resolution nationwide PU.

**Blocked by:** Ticket 01. The credential and authenticated collection-metadata preflight passed on 2026-08-16.

Status: completed

- [x] Read credentials only from the process environment. Never use a `VITE_` prefix or print values.
- [x] Implement OAuth client-credentials exchange and token reuse until expiry.
- [x] Mock token success, 401, 429, malformed response, expiry, refresh-once and redacted-error behavior.
- [x] Query/validate the official quarterly collection ID and requested fixed quarter before processing.
- [x] Reject `latest`, missing quarter, unknown collection, or changed band contract.
- [x] Add an explicit estimated request/PU budget and stop before the first request when it exceeds the configured cap.
- [x] Implement a low-resolution `dataMask`/`observations` probe for the representative targets.
- [x] Compare Q2/Q3/Q4 using fixed render parameters and record no-data ratios without making aesthetic choices per target.
- [x] Produce a pilot decision record that pins one primary quarter, ordered fallbacks, no-data threshold, color transform, and source year.
- [x] Keep live execution behind `--execute`; dry-run is the default.

## Acceptance evidence

- One token is reused for all pilot calls until expiry.
- Logs and snapshots contain no client secret, access token, or Authorization header.
- Primary quarter and fallback order are explicit and versioned.
- Current official request, PU, and pixel-size limits are rechecked and recorded.
- The pilot decision is evidence-backed for coastal, cloudy/mountain, very large, and island/high-latitude targets.

## Completed evidence (2026-08-16)

- Authenticated collection metadata and 15 STAC target-quarter checks passed for the pinned official collection and bands.
- The accepted 15-cell quality matrix records request/response hashes, dimensions, bytes, no-data ratios, and actual PU headers.
- RGB previews were visually reviewed after the first-pass DN-normalization defect was detected and rejected.
- Decision: primary `2025-Q2`; ordered fallback `2025-Q4`, `2025-Q3`; 2% threshold; source year 2025.
