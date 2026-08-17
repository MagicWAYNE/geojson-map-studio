# 04 — Verify and package the local imagery library

**What to build:** Promote only complete verified textures into a deterministic static library with runtime-safe metadata and required Copernicus notices.

**Blocked by:** Tickets 01 and 03.

Status: completed

- [x] Define and test a schema-versioned runtime manifest separate from the processing checkpoint.
- [x] Require 377 unique expected identities unless an unavailable target has an explicit reviewed waiver.
- [x] Validate relative safe asset paths, dimensions, projected/geographic bounds, EPSG:3857, source version, quarter, quality ratio, attribution, hashes, and byte length.
- [x] Detect missing, duplicate, unexpected, corrupt, and orphan files.
- [x] Emit deterministic manifest text and a package-level SHA-256 inventory.
- [x] Include `NOTICE-DATA.md` with exact source year attribution and the official legal-notice link.
- [x] Record the prepared geometry catalog data version/identity used for bounds.
- [x] Keep credentials, raw OAuth responses, temporary downloads, checkpoints, probes and request bodies out of the runtime package.
- [x] Measure package size and decide explicitly whether final binaries are tracked, ignored local assets, Git LFS, or a separate downloadable dataset. Do not assume a large-data delivery mechanism.
- [x] Prove the static package does not enter the main JavaScript bundle.

## Acceptance evidence

- Byte-identical runtime manifest for identical verified input.
- Attribution is present globally and per entry.
- Package verification fails on one-byte image changes, missing files, unsafe paths, wrong dimensions, or orphan assets.
- The package contains no client ID, secret, bearer token, or upstream response headers.

Final package result (2026-08-16): 377 manifest entries, 375 JPEGs, 2 explicit unavailable entries, 378 files and 378,264,768 total bytes. Manifest SHA-256 is `5f45eedc3dde7740131d2e3e6b96b4991f880e0b9f22a4b95b52441a12657d24`; inventory SHA-256 is `a124ca0837d0cc4de84ed3da902b5a44cae7e9a56f1a2c9ae2e07225d36b7ebc`. The binary library is intentionally ignored local delivery data under `public/imagery-library/`; it is copied as static output at build time and no imagery path or content hash occurs in the JavaScript bundle.
