# Sentinel-2 Local Imagery Library V1

Status: ready-with-runtime-overlap-gate

Planning snapshot: `ae202fb`

## Purpose

Build a reproducible, attribution-complete local imagery library from official Copernicus Sentinel-2 products and add an explicit local-imagery option to the current GeoJSON authoring map. The application must never require Copernicus credentials or call Copernicus at runtime.

V1 uses the official Sentinel-2 Level-3 Quarterly Mosaics as its primary imagery source. Raw Sentinel-2 L2A is a targeted fallback for unresolved no-data areas, not the default nationwide processing path.

## Launch gates

Planning, offline tests, and the authenticated pilot are not blocked. Runtime integration has one remaining gate:

1. The current user-owned uncommitted right-sidebar/map-composition work overlaps the future runtime integration seams: `src/components/map/ChongqingMap3D.vue`, its tests, `src/composables/useMapVisualSettings.ts`, its tests, and `MapCompositionControls` tests. Before Ticket 05, those changes must be committed, otherwise separated, or explicitly reconciled by the user. Do not overwrite them.

The CDSE OAuth gate passed on 2026-08-16 using the project-local `S2_CLIENT_ID` and `S2_CLIENT_SECRET`: token exchange returned HTTP 200 and the official quarterly-mosaic collection returned HTTP 200 with the expected public bands. This evidence contains no credential or bearer token. Never print, persist in generated manifests, copy into browser code, or commit either credential.

The launch agent must record a fresh HEAD and dirty-state inventory. `ae202fb` is a planning snapshot, not permission to discard later work.

## Required user outcomes

1. The project has a deterministic build-time imagery planner for country, province-level, and prefecture-level views derived from the prepared region catalog.
2. The planner emits one country texture, 34 province-level textures, and 342 prefecture-level textures. It does not create one texture per county.
3. Every target keeps its source aspect ratio and uses a maximum output dimension of 2000 pixels, never exceeding the Process API 2500-pixel limit.
4. Every texture uses a fixed, documented quarterly mosaic release and deterministic color transform. No target independently chooses an aesthetically preferred acquisition date.
5. No-data quality is measured before full-resolution processing. A configured primary quarter is used everywhere; only targets crossing the quality threshold use the same ordered fallback-quarter policy.
6. The generator is resumable, rate-limited, failure-atomic, and safe to rerun. Successful files are verified by content type, dimensions, byte length, and SHA-256 before being considered complete.
7. A schema-versioned local manifest maps the active region-catalog selection to a local texture, projected bounds, dimensions, source product, processing parameters, attribution, quality summary, and hash.
8. The authoring UI exposes an explicit local-imagery switch only when a compatible local texture exists. Missing or invalid textures preserve the current map and show an honest failure state.
9. Runtime imagery shares the existing Three.js scene, geometry, camera, hover, authoring, metrics, effects, and one-canvas lifecycle. It does not create a second map renderer or online basemap.
10. With network disabled after the static package is built, the user can load prepared region geometry and toggle the matching imagery on and off.

## Prepared geometry baseline

The source geometry is the existing versioned runtime region catalog built from:

`output/tianditu-administrative-geojson-2025-09/`

The imagery target inventory is:

| Target kind | Count | Geometry source |
| --- | ---: | --- |
| Country | 1 | country feature collection bounds |
| Province-level region | 34 | country catalog features |
| Prefecture-level region | 342 | province-child features, with parent-level fallback for province-equivalent targets |
| Total | 377 | prepared local geometry only |

At maximum dimension 2000, the planning baseline is about 1.202 billion output pixels. Three input bands cost approximately 4,586 Processing Units; adding a fourth quality/mask input raises the estimate to about 6,115 PU. Treat these as planning estimates and record actual response usage where the service exposes it.

The prepared GeoJSON has no explicit `crs` member. V1 must treat coordinates as RFC 7946 longitude/latitude only after a control-point alignment pilot. It must not apply a GCJ-02 offset. Record the accepted CRS interpretation in the generated dataset manifest.

## Official source contract

Primary catalogue collection:

```text
STAC collection: sentinel-2-global-mosaics
Sentinel Hub collection: byoc-5460de54-082e-473a-b6ea-d5cbe3c17cca
Bands: B02, B03, B04, B08, observations, dataMask
Process endpoint: https://sh.dataspace.copernicus.eu/process/v1
Token endpoint: https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token
```

Authoritative references:

- https://documentation.dataspace.copernicus.eu/Data/SentinelMissions/Sentinel2.html
- https://stac.dataspace.copernicus.eu/v1/collections/sentinel-2-global-mosaics
- https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Process/Examples/BYOC.html
- https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Overview/Authentication.html
- https://documentation.dataspace.copernicus.eu/Quotas.html
- https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice

Do not silently switch to EOX, Google, Bing, Esri, TianDiTu, or another imagery provider. A source change requires a new data version and an explicit license review.

## Dynamic resolution and projection contract

For each target:

1. Compute the geographic geometry bounds.
2. Convert the bounds to Web Mercator normalized coordinates.
3. Expand width and height by 8% on each side, clamped to the valid Web Mercator world extent.
4. Preserve projected aspect ratio.
5. Set the longest output dimension to 2000 pixels and round the other dimension to the nearest positive integer.
6. Snap projected bounds to a deterministic pixel grid so reruns produce identical UV metadata.
7. Request an EPSG:3857 output using bilinear downsampling.

The planner owns this calculation and is covered by fixtures for a compact coastal city, a typical inland city, a very large prefecture, a municipality/province-equivalent target, islands, and invalid/empty geometry.

## Source version and cloud policy

V1 must pin a dataset release such as `sentinel2-quarterly-2025q3-v1`; it must not use `latest`.

Before pinning the quarter, run the pilot matrix against at least Q2, Q3, and Q4 for:

- 厦门市 or another compact coastal target;
- 成都市 or another cloudy/mountain-basin target;
- 呼伦贝尔市 or another very large target;
- one island-heavy or high-latitude target.

Use one primary quarter for the complete release. Run a low-resolution quality probe using `dataMask` or `observations`. If a target exceeds the configured no-data threshold, issue one deterministic fallback request over an ordered adjacent-quarter window. Never select dates independently by visual preference.

Record:

- primary and fallback quarters;
- valid-observation/no-data ratio;
- output color transform/evalscript hash;
- STAC or source item identifiers where available;
- whether fallback was used.

## Build-time package contract

Suggested output, excluded from the JavaScript bundle:

```text
public/imagery-library/copernicus-sentinel2-<version>/
  manifest.json
  NOTICE-DATA.md
  country/100000.jpg
  provinces/<gb>.jpg
  prefectures/<gb>.jpg
```

The implementation may move the large imagery package to an ignored local asset directory or a separately downloadable dataset archive if repository size review requires it. The manifest base-URL interface must keep that move independent from runtime selection logic.

The build pipeline must have distinct commands for:

- `plan`: no credentials, no network, writes a deterministic job manifest;
- `probe`: authenticated, low-resolution quality only;
- `fetch --pilot`: authenticated, allowlisted targets only;
- `fetch --resume`: authenticated, full allowlisted or release job set;
- `verify`: no credentials, validates files, metadata, hashes, attribution, completeness, and orphan files;
- `package`: publishes only verified final textures and runtime metadata.

Dry-run is the default for any command that could consume Processing Units. Full live processing requires an explicit flag such as `--execute` and prints an estimated request/PU budget before the first request. Logs must redact secrets and bearer tokens.

## Runtime manifest contract

The runtime module parses an immutable schema. Views and Three.js components must not reconstruct paths.

```ts
interface LocalImageryEntry {
  targetKind: 'country' | 'province' | 'prefecture'
  gb: string
  label: string
  assetPath: string
  width: number
  height: number
  projectedBounds: [number, number, number, number]
  geographicBounds: [number, number, number, number]
  projection: 'EPSG:3857'
  sourceVersion: string
  primaryQuarter: string
  fallbackQuarters: string[]
  noDataRatio: number
  attribution: string
  sha256: string
}
```

The manifest records a schema version, dataset version, geometry catalog version/identity, source legal-notice URL, color-transform hash, target count, total bytes, and all entries. Unsafe paths, duplicate identities, non-finite bounds, impossible dimensions, missing attribution, unknown schema versions, or hash mismatches are fatal verification errors.

## Texture-to-geometry alignment

The texture is not baked separately into each district. One target texture covers the complete target projected bounds. Every district vertex derives UV coordinates from the same EPSG:3857 bounds:

```text
u = (x - minX) / (maxX - minX)
v = 1 - (y - minY) / (maxY - minY)
```

Polygon holes and islands remain geometry concerns; the mesh clips the rectangular JPEG naturally. Existing region keys, hover, metrics, bars, glow, HUD, camera, and authoring behavior remain unchanged.

Texture loading must be failure-atomic. A stale or failed texture request cannot clear the previous valid texture or replace geometry. Dispose replaced Three.js textures and material references so repeated toggles and geometry changes do not leak GPU resources.

## UI contract

Add one explicit control in the existing map-composition/visual-settings owner:

```text
底图纹理
[ ] 加载本地 Sentinel-2 影像
数据版本：<version>
```

- Default remains the current tech-blue map without imagery.
- The switch is disabled with a useful reason when no compatible local entry exists.
- Enabling the switch loads exactly one local static image and never calls Copernicus.
- A loading state prevents duplicate requests.
- A failed image preserves the current valid rendering and exposes an error through the current settings/status pattern.
- The control is session-only in V1 unless the existing visual-settings contract at launch already persists equivalent composition controls. Do not invent a second persistence mechanism.
- Keep current default backgrounds, map effects, hover priority, bars, badges, and built-in reset unchanged.

## Security and credentials

- OAuth client credentials are build-time server credentials only.
- Never use `VITE_` prefixes for secrets.
- Never write access tokens to disk or manifests.
- Reuse one access token until its expiry; do not request a token per image.
- On 401, refresh once and retry once. Repeated 401 is a credential blocker.
- On 429, honor `Retry-After`, reduce concurrency, and resume later.
- Default concurrency is 1; maximum V1 concurrency is 2.
- Never send credentials to STAC endpoints that do not require them.

## License and open-source delivery

Generated imagery is modified Sentinel data. Every published dataset version must include:

```text
Contains modified Copernicus Sentinel data <YEAR>
```

If several source years are used, list every year. Keep code license and data notice separate. The generated manifest must carry attribution per entry, and the UI must make the dataset attribution reachable.

Copernicus permission covers the imagery source. It does not establish redistribution permission for the prepared TianDiTu-derived GeoJSON; that source remains an independent open-source release gate.

## Failure behavior

- Missing credentials: `plan` and `verify` still work; authenticated commands fail before any request.
- Invalid credentials: no output is promoted; report sanitized HTTP status and endpoint class.
- STAC/source version unavailable: fail planning/pilot for the requested pinned version; never fall forward to `latest`.
- Quota estimate above configured budget: require a new explicit approval/budget or split the release; do not continue silently.
- 429/5xx: bounded exponential backoff, checkpoint, then resumable failure.
- Invalid content type, dimensions, or short body: quarantine partial response; do not publish it.
- No-data threshold failure after fallback: mark target unavailable and keep it out of the runtime package until reviewed.
- Texture 404/decode/hash mismatch at runtime: existing geometry and prior valid rendering remain active.
- Aborted/stale runtime load: silent cancellation and resource disposal.

## Required automated evidence

- deterministic 377-target planning inventory and 2000-pixel dimension rules;
- invalid/empty geometry and municipality fallback behavior;
- fixed quarter and deterministic fallback policy;
- sanitized OAuth/token reuse behavior with mocked fetch;
- dry-run default and explicit `--execute` gate;
- PU/request estimate and configured budget gate;
- retry, `Retry-After`, checkpoint, resume, corrupt body, and atomic promotion;
- manifest schema, safe paths, unique identities, hashes, attribution, and orphan-file detection;
- runtime selection-to-texture resolution without path reconstruction;
- UV calculation for Polygon/MultiPolygon, holes, islands, and shared bounds;
- local texture success, 404, decode error, stale load, replacement, disposal, and reset;
- current geometry upload/catalog, authoring, hover, metrics, visual settings, effects, and one-canvas tests remain green.

## Required live and browser evidence

Authenticated pilot:

1. Preflight obtains one token without logging it.
2. Official quarterly collection metadata and pinned quarter are available.
3. Four representative target probes record no-data ratios and estimated PU.
4. Pilot full-resolution images pass type, dimensions, hash, attribution, and visual review.
5. Projected boundary overlay aligns within an agreed tolerance at coastline, mountain, municipal, and island controls.

At 1920x1080 with the local package:

1. default tech-blue map remains unchanged;
2. country, province, and prefecture catalog maps resolve the expected local imagery entry;
3. imagery switch loads one local texture and makes no Copernicus/TianDiTu request;
4. network-disabled reload still restores geometry and permits local imagery loading;
5. province view has no administrative-edge date/color seams attributable to per-city source selection;
6. missing texture leaves geometry visible and provides an honest error;
7. rapid geometry changes/toggles activate only the latest intent;
8. hover, editing, metrics, bars, badges, HUD, effects, camera and reset remain correct;
9. canvas count remains one and repeated toggles do not increase live texture/material resources;
10. console has no unhandled error or WebGL resource warning.

## Out of scope

- Runtime calls to Copernicus, TianDiTu, EOX, or another imagery provider.
- A global interactive slippy-map tile server.
- Per-county textures.
- Arbitrary user AOI downloads.
- Historical time slider or multi-version UI.
- Raw L2A nationwide cloud processing unless the quarterly mosaic pilot fails.
- DEM/terrain-height meshes, hillshade, 3D terrain displacement, or elevation analysis.
- Editing or redistributing the source administrative GeoJSON license by assumption.
- Deployment, release, public data hosting, push, merge, or worktree deletion.

## Completion definition

V1 is complete only when the pinned official source, credential and quota gates are proven; all 377 planned targets are either verified and packaged or explicitly reviewed unavailable; runtime imagery is local-only and failure-atomic; license notices and reproducibility metadata are complete; automated and browser acceptance passes; overlapping user-owned work remains preserved; and no unresolved actionable Spec or repository-convention finding remains.
