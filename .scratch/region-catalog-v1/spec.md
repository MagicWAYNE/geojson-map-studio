# Region Catalog Selection V1

Status: ready-for-agent

Fixed code point: `3ddd1f5`

## Purpose

Add a first-party region catalog below the existing GeoJSON boundary upload so a user can select a prepared national, province-level, or prefecture-level map and load it into the same authoring workspace without first finding and uploading a local file.

The region catalog is an additional geometry source. It must reuse the existing GeoJSON inspection, preparation, failure-atomic activation, IndexedDB geometry persistence, session-only visualization, Three.js rendering, authoring focus, and visual-settings behavior. It must not create a second map-loading state owner.

## Required user outcomes

1. The user can still upload an arbitrary local GeoJSON exactly as before.
2. Directly below the boundary upload, the user can choose `全国`, `省级区域`, or `地市级区域` as the map scope.
3. The picker reveals only the province, prefecture, and child-level controls required by that scope.
4. The user explicitly clicks `加载此区域` before the active map changes.
5. A valid catalog map activates through the same authoring session and immediately creates editable region rows.
6. A catalog-loaded map keeps Chinese display names while using stable official `gb` values as renderer, authoring, metric, and hover keys.
7. Refresh restores the selected geometry and its Chinese default display names, while business values and visual settings keep their existing session-only lifetime.
8. A failed, empty, stale, or aborted catalog load leaves the last valid map and committed visualization unchanged.

## Prepared data baseline

The input dataset is the completed output from Codex session `01a00345-669c-79a2-8d45-bbd21cb672f2`:

`output/tianditu-administrative-geojson-2025-09/`

It contains:

| Map kind | Files | Regions |
| --- | ---: | ---: |
| Country contains province-level regions | 1 | 34 |
| Province-level region contains next-level regions | 34 | 493 total |
| Province-level region contains counties | 34 | 2,890 total |
| Prefecture-level region contains counties | 342 | 2,852 total |

All 411 derived GeoJSON files are below the current 10 MiB, 500-feature, and 250,000-position limits. All derived geometries are `Polygon` or `MultiPolygon`. The complete pretty-printed derived set is about 94 MiB, a minified runtime set is about 25.06 MiB, and HTTP gzip for the complete set is about 9.33 MiB. Only one selected map is fetched per explicit load.

Seven province-wide county files contain valid duplicate human names, including `新华区`, `桥西区`, `城区`, `铁西区`, `向阳区`, `鼓楼区`, and `市中区`. Their `gb` values remain unique. Six prefecture files contain zero county features. Macau has no county map. These are supported catalog states, not reasons to weaken GeoJSON validation globally.

See `.scratch/region-catalog-v1/data-inventory.md` for the fixed inventory and edge cases.

## Scope and selection contract

The selection model is a discriminated union. Views must not compose asset paths themselves.

```ts
type RegionCatalogSelection =
  | { kind: 'country-provinces' }
  | { kind: 'province-children'; provinceGb: string }
  | { kind: 'province-counties'; provinceGb: string }
  | { kind: 'prefecture-counties'; provinceGb: string; prefectureGb: string }
```

The picker resolves each selection through one catalog module:

| Selection | Runtime asset family |
| --- | --- |
| `country-provinces` | `01-country-provinces.geojson` |
| `province-children` | `02-provinces-prefectures/<province>.geojson` |
| `province-counties` | `03-provinces-counties/<province>.geojson` |
| `prefecture-counties` | `04-prefectures-counties/<province>/<prefecture>.geojson` |

Use the neutral user-facing term `下一级区域` for official special cases where the source hierarchy does not correspond to an ordinary province → prefecture → county chain. The catalog owns availability and labels for municipalities, special regions, and empty child maps.

## Runtime catalog package

Create a deterministic runtime packager separate from the acquisition script. Its input is the prepared output directory; its output is a versioned static package such as:

```text
public/region-catalog/tianditu-2025-09/
  catalog.json
  maps/...
```

The runtime package must:

- include only minified derived Polygon/MultiPolygon GeoJSON and catalog metadata;
- exclude `raw/`, `official-download-samples/`, temporary files, acquisition caches, and credentials;
- contain explicit relative asset paths rather than require UI filename reconstruction;
- record schema version, data version, source label, `gb` key property, `name` display property, feature count, byte length, parent relationships, child-level label, and availability;
- represent zero-feature maps as unavailable catalog entries and never publish them as selectable valid maps;
- be deterministic for identical prepared input, excluding any volatile generation timestamp from byte-for-byte output comparisons;
- validate all 411 inputs against current application limits before publishing;
- be addressable through `VITE_REGION_CATALOG_BASE_URL`, defaulting to the versioned local public path;
- never call TianDiTu at application runtime.

The first release may track the approximately 25 MiB minified package in the repository. The base-URL interface must make later movement to a CDN possible without changing selection or activation behavior.

## Stable key and display-name contract

The current `nameProperty` contract assumes one property is both unique identity and display text. V1 must deepen that contract without breaking uploads:

```ts
interface GeoJsonRegionProperties {
  regionKeyProperty: string
  displayNameProperty: string
}
```

- Catalog maps use `regionKeyProperty: 'gb'` and `displayNameProperty: 'name'`.
- Arbitrary uploads default both properties to the user's selected unique name property.
- Region keys must be non-empty and unique.
- Display names must be non-empty but may repeat.
- Geometry, metrics, dirty state, authoring focus, hover, bars, badges, and row commits remain keyed by the stable region key.
- Default row and map presentation use the display name.
- Editing a display name remains session-only business visualization and never changes the stable key.

Persisted geometry packages must gain a backward-compatible version that records both properties. Loading older versions defaults `displayNameProperty` to the legacy `nameProperty`. Geometry identity must include both property choices so a different identity/display interpretation cannot reuse stale visualization state.

## Shared activation path

Both sources must converge before preparation:

```text
local File.text() ---------┐
                           ├─> geometry candidate -> inspect -> prepare -> authoringSession.loadGeometry
catalog fetch Response.text┘
```

Refactor only enough to share candidate inspection, preparation, generation guards, alert state, activation, focus clearing, visualization reset, and persistence. `MapLoaderView` may coordinate user intent, but the catalog module owns catalog parsing, selection resolution, asset URL construction, and fetch results.

Begin one geometry intent before catalog fetch. Pass its `AbortSignal` through fetch and activation. A later file choice, catalog load, or reset aborts the older request. An abort is not rendered as a user error.

## UI contract

Keep the picker on the existing data workspace; do not create another route or page.

Required composition:

```text
GeoJSON 边界文件 [选择文件]

或从区域库选择
地图范围     [全国 / 省级区域 / 地市级区域]
省级区域     [按需出现]
地市级区域   [按需出现]
展示内容     [省级区域 / 下一级区域 / 区县]
                             [加载此区域]

业务数据 JSON [可选]
```

- Keep local upload reachable without changing tabs or routes.
- Do not load geometry while the user is changing selects.
- Disable `加载此区域` until the selection resolves to an available catalog entry.
- Mark unavailable entries `暂无下一级区域` and prevent requests for them.
- During a request, disable duplicate load actions and show the selected map label.
- On success, use the existing collapsible success status and region editor.
- On failure, use the existing expanded error alert and keep the prior map visible.
- The optional business-data file applies equally to uploaded and catalog-loaded geometry after activation.
- The current name-property selector remains available for arbitrary uploads; catalog maps use their fixed key/display metadata and do not ask the user to choose a key field.

## Persistence and state lifetime

- The full selected geometry text is persisted through the existing active-map store, so refresh does not depend on the catalog server remaining available.
- Catalog choice controls themselves do not need to be restored in V1; the restored map label must still explain the active geometry source.
- Default Chinese region display names must survive refresh because they are part of the persisted geometry interpretation, not session-only edited business data.
- Metric values, enabled state, edited display names, metric definitions, and visual settings keep their current session-only behavior.
- Do not add localStorage, sessionStorage, cookies, URL state, Cache Storage, a Service Worker, accounts, or cloud persistence.

## Error and special-case behavior

- Catalog schema/version invalid: expanded `加载失败`; active map unchanged.
- Catalog unavailable at startup: local upload remains fully usable; picker shows retryable catalog failure.
- Asset 404/network failure: expanded failure with selected map label; active map unchanged.
- Empty entry declared in catalog: disabled without a network request.
- Unexpected empty GeoJSON: normal `empty-features` validation failure; active map unchanged.
- Aborted/stale request: silent cancellation; only the newest intent may activate.
- Invalid `gb` or display name: build-time catalog validation failure; no runtime asset is published.
- Duplicate display names with unique `gb`: valid and loadable.
- Built-in reset: cancels any in-flight catalog request and restores current built-in behavior.

## Performance and delivery

- Initial page load fetches only `catalog.json`, never all GeoJSON files.
- A click on `加载此区域` fetches exactly one resolved asset.
- Do not import GeoJSON into the JavaScript bundle.
- Keep source geometry unchanged: no coordinate simplification, reprojection, or rounding in V1.
- Show a busy state while fetching, parsing, persisting, and activating large maps.
- Report the existing Vite chunk advisory accurately; catalog assets are static files and must not inflate the main JS chunk.

## Required automated evidence

- deterministic runtime packager output and inventory validation;
- catalog schema parsing, hierarchy, selection resolution, explicit paths, and empty-entry availability;
- legacy geometry package migration and new key/display persistence;
- duplicate display names with unique keys;
- upload behavior unchanged when key and display property are identical;
- catalog fetch success, 404, malformed catalog, malformed asset, empty asset, abort, and stale completion;
- one shared activation result for upload and catalog sources;
- picker dependency logic and explicit-load behavior;
- existing alert collapsed/expanded rules;
- geometry refresh retention plus business/visual session reset;
- one canvas and one geometry rebuild for a successful catalog geometry replacement;
- full existing source suite, typecheck, production build, and diff checks.

## Required real-browser evidence

At 1920×1080 prove:

1. local upload remains usable;
2. catalog controls are visible below the boundary upload without document scrolling regression;
3. `全国 → 省级区域` loads 34 Chinese-named regions;
4. `河北省 → 下一级区域` loads 11 regions;
5. `河北省 → 区县` loads 167 stable-key rows even though `新华区` and `桥西区` repeat;
6. `石家庄市 → 区县` loads 22 regions;
7. an unavailable prefecture is disabled and makes no asset request;
8. rapid consecutive loads activate only the last request;
9. asset failure leaves the previous map visible and expands the alert;
10. refresh restores catalog geometry and Chinese default names but clears business and visual session state;
11. region editing, controlled hover, metrics, bars, badges, HUD, effects, backgrounds, and built-in reset remain intact;
12. console is free of unhandled errors and duplicate-resource warnings.

## Out of scope

- Runtime requests to TianDiTu or another upstream administrative service.
- Rechecking the user-confirmed data-use permission.
- Map double-click drilldown or breadcrumb navigation.
- Township/street data.
- Catalog search, favorites, recent selections, or user-defined catalogs.
- Combining several catalog maps into one geometry.
- Geometry editing, simplification, reprojection, or alternate coordinate systems.
- Persisting business or visual settings.
- Accounts, billing, cloud projects, collaboration, export, deployment, release, push, merge, or worktree deletion.

## Completion definition

V1 is complete only when every scope above is implemented through one shared activation path, all automated and browser evidence passes, the source-data inventory remains reproducible, the current user-owned uncommitted files are preserved, and final review has no unresolved actionable Spec or repository-convention findings.
