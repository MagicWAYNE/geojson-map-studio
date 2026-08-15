# Region Catalog Selection V1 acceptance

Status: passed

Fixed code point: `3ddd1f5`

## Automated gates

| Gate | Required evidence | Status |
| --- | --- | --- |
| Runtime package | Packager test validates 411 inputs, builds twice with identical catalog values/text, and publishes 404 non-empty maps plus `catalog.json`; 7 empty selections remain metadata-only. Runtime GeoJSON is 26,270,333 bytes. No raw/audit/sample input is published. | Passed |
| Catalog model | `regionCatalog.test.ts` resolves country, province children, province counties and prefecture counties using explicit paths; unsafe URLs and unavailable entries are covered. | Passed |
| Stable identity | Document/source tests cover v1/v2→v3 migration, `gb` keys, repeated `name` values and refresh restoring Chinese defaults without metrics. | Passed |
| Shared activation | View tests prove local upload and catalog text use the same preparation and `authoringSession.loadGeometry`/active-source activation seam. | Passed |
| Failure atomicity | Source/view tests cover HTTP 404, malformed manifest/asset, empty asset validation, abort and stale ordering while retaining the prior map. | Passed |
| UI behavior | Picker and view tests cover dependent controls, no eager asset request, explicit load, unavailable entries, busy labels, retry and Alert state. | Passed |
| Regression | Existing upload, authoring, hover, visual settings, persistence and reset suites remain green. | Passed |
| Full suite | `npm test -- --run`: 57 files, 440 tests passed. | Passed |
| Types | `npm run typecheck` completed without diagnostics. | Passed |
| Production build | `npm run build` passed; existing chunk-size advisory remains (`HomeView` 816.87 kB, `DistrictView` 1,050.40 kB minified). Catalog remains under `dist/region-catalog`, outside JS chunks. | Passed with advisory |
| Diff hygiene | `git diff --check 3ddd1f5 --` and `git diff --check` produced no output before final commit. | Passed |

## 1920×1080 browser matrix

| Scenario | Required proof | Status |
| --- | --- | --- |
| Local upload | Uploaded `valid-mixed.geojson`; 3 keys loaded, the upload name-field selector stayed available and canvas count stayed 1. | Passed |
| Country | Loaded `全国 → 省级区域`; 34 rows and 74,118 positions, with Chinese defaults and `gb` keys. | Passed |
| Province children | Loaded `河北省 → 下一级区域`; 11 rows and 4,858 positions. | Passed |
| Province counties | Loaded `河北省 → 区县`; 167 rows/167 unique keys. `新华区` keys were `156130105`/`156130902`; `桥西区` keys were `156130104`/`156130703`. | Passed |
| Prefecture counties | Loaded `石家庄市 → 区县`; 22 rows and 1,727 positions. | Passed |
| Unavailable entry | 甘肃省/嘉峪关市 rendered disabled as `嘉峪关市（暂无下一级区域）`; load action remained disabled. Source/unit evidence proves no request for unavailable entries. | Passed |
| Stale request | Started country load and immediately chose a local file; final active source was `valid-mixed.geojson` with 3 rows and one canvas. View test additionally proves the stale catalog signal is aborted. | Passed |
| Failure | Temporarily removed the generated 河北 children asset, then restored it. Vite served its HTML fallback, causing expanded `加载失败`/invalid-JSON status; the prior 石家庄 map retained all 22 rows and one canvas. Source test separately covers a literal HTTP 404. | Passed |
| Refresh | Edited/enabled `156130102`, applied values, collapsed sidebar, then refreshed. Geometry restored with 22 rows and default `长安区`; enabled=false, value empty, catalog controls reset to 全国, sidebar expanded. | Passed |
| Resource safety | Canvas count remained exactly 1 through country, province-child, province-county, prefecture-county, failure, refresh, upload and reset. Existing renderer/resource regression tests stayed green. | Passed |
| Built-in regression | `恢复内置重庆地图` removed editor rows, disabled business-data input and kept exactly one canvas. | Passed |
| Console/layout | Browser log query returned no warning/error. Body scroll height equaled the 1080 viewport; the long editor used sidebar scrolling (1,400 scrollHeight / 918 clientHeight). | Passed |

## Review disposition

Initial review findings and resolutions:

1. The picker action inherited browser-default button styling because scoped parent styles did not cross the component boundary. Added local technology-blue hover/focus/disabled styles and visually rechecked at 1920×1080.
2. The country scope did not show its resolved content level. Added the disabled, explicit `展示内容：省级区域` control so every scope states what will load.
3. Manifest retry could let an older aborted request clear a newer loading state. Added a manifest generation guard.
4. Runtime packaging initially counted positions but did not enforce every application coordinate/ring invariant. Added coordinate bounds, closure, minimum ring size, dateline and non-zero-area validation.

Final Spec/repository review: no unresolved actionable findings. The implementation stays on the reusable map-authoring product line, keeps local upload and the existing renderer/session owners, uses the repository's region/project terminology in new UI, and adds no runtime upstream call, navigation/drilldown, persistent business/visual data or external delivery action.

## Final command evidence

- `npm run geojson:catalog`: 411 catalog entries; 404 published non-empty GeoJSON files plus manifest.
- `npm test -- --run`: 57 files / 440 tests passed.
- `npm run typecheck`: passed with no diagnostics.
- `npm run build`: passed with the existing chunk advisory recorded above.
- `git diff --check 3ddd1f5 --` and `git diff --check`: no output.

## Scope boundary

No runtime upstream requests, drilldown, township data, user catalogs, geometry editing, business persistence, visual persistence, deployment, release, push, merge, or worktree deletion are authorized.
