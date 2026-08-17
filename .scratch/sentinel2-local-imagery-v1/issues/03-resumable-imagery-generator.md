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

Province repair (2026-08-17): direct province Process requests for Inner Mongolia, Xinjiang, Tibet and Gansu were confirmed to contain MGRS-shaped black no-data blocks even though their derived prefecture quality summaries passed. Province targets with prefecture sources now use the same geometry-masked local-prefecture composition strategy (`local-prefecture-mask-composite-v1`), require every constituent prefecture checkpoint to be complete, and generate prefectures before parents on a clean run. The package contains 32 available composed province textures; Hainan remains unavailable under the quality policy. Macau has no prefecture source, so it retains its verified direct texture and remains in the request budget. The four reported targets consumed zero Process requests during repair and passed live browser review without rectangular gaps or console warnings. The fully recomposed package has runtime manifest SHA `2c10d906af4e8b827b9224fe7339116ab89682b3fb888421196dd0a2e1f118b2` and inventory SHA `21f36dea914f49f4d2b5c98afd04c99d7903f4fba7c4c51a3c2b0db7618ad0fe`.
