# 01 — Build the versioned runtime region catalog package

**What to build:** Convert the prepared TianDiTu-derived output into a deterministic, validated, minified runtime catalog with explicit hierarchy and asset paths, without shipping raw responses or calling the upstream service at application runtime.

**Blocked by:** None.

Status: ready-for-agent

- [ ] Add a dedicated runtime packager; do not merge runtime packaging responsibilities into the acquisition client.
- [ ] Read the completed prepared directory and validate all 411 derived GeoJSON files against application limits.
- [ ] Emit a schema-versioned `catalog.json` with the four selection kinds, province/prefecture relationships, explicit relative paths, labels, feature counts, byte lengths, `gb` key, `name` display property, and availability.
- [ ] Minify published GeoJSON without changing coordinates, rings, feature order, properties, or geometry type.
- [ ] Exclude `raw/`, official download samples, verification artifacts, credentials, `.env`, and temporary scripts from runtime output.
- [ ] Mark all six empty prefecture files and Macau county selection unavailable.
- [ ] Make output deterministic for the same prepared input and cover determinism with tests.
- [ ] Default the runtime base path to `/region-catalog/tianditu-2025-09/` and allow `VITE_REGION_CATALOG_BASE_URL` to replace it.
- [ ] Add a reproducible project command while preserving the existing user-owned `geojson:tianditu` package-script change.
- [ ] Prove the generated package is approximately 25 MiB uncompressed/minified and does not enter the main JavaScript bundle.

## Comments

Treat the prepared output as an input artifact. Do not delete, rewrite, bulk-stage, or silently commit the source `output/`, `raw/`, official samples, `.env`, or `scripts/temporary-tianditu-administrative-geojson.mjs`.
