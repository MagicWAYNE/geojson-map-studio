# 03 — Generate verified local imagery with bounded live processing

**What to build:** Turn the pinned job manifest into a resumable, rate-limited, verified local texture set without promoting partial or corrupt responses.

**Blocked by:** Tickets 01 and 02; live execution requires valid OAuth credentials and approved pilot decision.

Status: completed

- [x] Build exact Process API requests from immutable job records; do not recompute bounds differently in the client.
- [x] Use the official Level-3 Quarterly Mosaic BYOC collection and pinned time range.
- [x] Request EPSG:3857 true-color B04/B03/B02 output with the pinned deterministic evalscript and bilinear downsampling.
- [x] Run the primary quarter for every allowlisted target and use ordered fallback requests only when the probe threshold requires them.
- [x] Default concurrency to 1 and cap at 2.
- [x] Honor `Retry-After`; use bounded retry for 429 and transient 5xx; checkpoint every terminal target state.
- [x] Treat 401 as refresh-once; repeated 401 stops the run.
- [x] Write downloads to explicit temporary files and atomically rename only after content type, dimensions, byte length and image decode succeed.
- [x] Record SHA-256, source version/year, exact request hash, evalscript hash, quality ratio, fallback use, retry count, and final bytes.
- [x] Support `--pilot`, `--allow`, `--resume`, `--max-pu`, and `--execute` without accepting unresolved globs for destructive cleanup.
- [x] Quarantine corrupt/partial output and never count it as complete.
- [x] Ensure Ctrl-C leaves a valid checkpoint and no promoted half-file.

## Acceptance evidence

- Pilot targets produce visually reviewed 2000-pixel images.
- Resume skips files only after hash/dimension verification.
- Mock 429/5xx/401/corrupt/abort cases are deterministic.
- Actual PU/request usage stays within the approved cap.
- No token or credential appears in files, console output, or errors.

Final live result (2026-08-16): 377 terminal targets, 375 complete and 2 explicit quality waivers. Promoted source requests used 4,560.330707550049 PU; the visually rejected direct-country attempt used an additional 92.86511993408203 PU, for 4,653.195827484131 PU total and zero retries. The final country texture is a local geometry-masked composite of 341 accepted prefecture textures (`local-prefecture-mask-composite-v2`), so it incurs no additional Process API call. A formal resume pass revalidated every local hash and issued no Process request.
