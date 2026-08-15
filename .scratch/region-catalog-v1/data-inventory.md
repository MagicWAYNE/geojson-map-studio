# Region Catalog V1 data inventory

Status: fixed-input

Source session: `01a00345-669c-79a2-8d45-bbd21cb672f2`

Prepared root: `output/tianditu-administrative-geojson-2025-09/`

Source data version: `2025-09`

## Derived inventory

| Family | Path | Files | Total features |
| --- | --- | ---: | ---: |
| Country → province-level | `01-country-provinces.geojson` | 1 | 34 |
| Province-level → next-level | `02-provinces-prefectures/` | 34 | 493 |
| Province-level → counties | `03-provinces-counties/` | 34 | 2,890 |
| Prefecture-level → counties | `04-prefectures-counties/` | 342 | 2,852 |
| Total | — | 411 | — |

Audit-only inputs are `raw/`, `official-download-samples/`, `OFFICIAL-DOWNLOAD-VERIFICATION.md`, and the acquisition manifest. They are not runtime catalog assets.

## Compatibility audit

All 411 derived files passed these fixed checks against the current application limits:

- byte length ≤ 10 MiB;
- feature count ≤ 500;
- coordinate position count ≤ 250,000;
- root type `FeatureCollection`;
- geometry type only `Polygon` or `MultiPolygon`;
- every `properties.gb` is non-empty and unique within its file;
- every `properties.name` is non-empty.

Largest observed values:

| Dimension | File | Value |
| --- | --- | ---: |
| Bytes | `01-country-provinces.geojson` | 6,447,870 |
| Features | `03-provinces-counties/510000-四川省.geojson` | 183 |
| Positions | `01-country-provinces.geojson` | 74,118 |

Runtime packaging measurements:

- pretty-printed derived data: about 94 MiB;
- minified derived data: 26,272,997 bytes / 25.06 MiB;
- all derived data after gzip level 9: 9,779,115 bytes / 9.33 MiB;
- country map after gzip level 9: 671,840 bytes / 0.64 MiB.

## Duplicate display names

The following province-wide county files have duplicate valid human names. They prove that `name` cannot remain the stable key:

| Province | Duplicate names |
| --- | --- |
| 河北省 | `新华区`, `桥西区` |
| 山西省 | `城区` |
| 辽宁省 | `铁西区` |
| 黑龙江省 | `向阳区` |
| 江苏省 | `鼓楼区` |
| 山东省 | `市中区` |
| 四川省 | `市中区` |

All corresponding `gb` values are unique.

## Empty catalog entries

These prefecture-level files have zero county features and must be catalog entries with `available: false`:

- 广东省 / 东莞市 (`156441900`)
- 广东省 / 中山市 (`156442000`)
- 甘肃省 / 嘉峪关市 (`156620200`)
- 甘肃省 / 中农发山丹马场 (`156629700`)
- 甘肃省 / 莲花山风景林自然保护区 (`156629800`)
- 甘肃省 / 太子山天然林保护区 (`156629900`)

澳门特别行政区 has one next-level feature and zero county features. Its county selection is unavailable.

## Special hierarchy notes

- Municipalities and special regions may expose district-like features through the source family named `province-contains-prefectures`.
- UI text must come from normalized catalog metadata instead of assuming every `02` file contains ordinary prefecture-level cities.
- The country file contains exactly 34 province-level Polygon/MultiPolygon features. Boundary-line features were intentionally excluded from derived runtime inputs and remain audit-only.
- No coordinate reprojection, simplification, rounding, or geometry rewriting has been applied.

## Revalidation command contract

The runtime packager introduced by Ticket 01 must reproduce this audit programmatically and fail before publishing if any file violates it. Do not rely on this Markdown inventory as executable validation.
