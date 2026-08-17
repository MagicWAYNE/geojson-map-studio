# Sentinel-2 local imagery source and capacity baseline

Snapshot date: 2026-08-16

Status: OAuth, authenticated collection metadata, fixed-quarter quality probes, and RGB previews verified

## Current official availability

The unauthenticated official CDSE STAC collection endpoint is reachable:

`https://stac.dataspace.copernicus.eu/v1/collections/sentinel-2-global-mosaics`

A catalogue probe around Chengdu for 2025-01-01 through 2026-12-31 returned quarterly items for:

- 2025 Q1
- 2025 Q2
- 2025 Q3
- 2025 Q4
- 2026 Q1

The sampled 2026 Q1 item exposed `B02`, `B03`, `B04`, `B08`, `observations`, `Product`, and `userdata` assets. This proves catalogue presence only; it is not authenticated image-processing acceptance.

## Product choice

Primary: official Sentinel-2 Level-3 Quarterly Mosaics.

The official product is created from three months of Sentinel-2 L2A observations. It masks invalid SCL classes, sorts valid reflectance observations per band, and uses the first quartile. It may still contain no-data pixels where no valid observation exists.

Fallback: adjacent quarterly mosaics through the same official collection. Raw L2A is reserved for reviewed holes that remain after quarterly fallback.

## Authentication contract

Create an OAuth client in the CDSE Sentinel Hub dashboard and keep these variables local-only:

```text
S2_CLIENT_ID
S2_CLIENT_SECRET
```

Token endpoint:

`https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token`

Process endpoint:

`https://sh.dataspace.copernicus.eu/process/v1`

Tokens must be reused until expiry. The implementation must never request one token per texture.

## Sanitized authenticated preflight

On 2026-08-16 the project-local credentials were verified without printing or persisting either value:

- required environment entries: present;
- OAuth token endpoint: HTTP 200;
- returned token lifetime: 1,800 seconds;
- authenticated quarterly-mosaic collection request: HTTP 200;
- collection ID: `byoc-5460de54-082e-473a-b6ea-d5cbe3c17cca`;
- advertised source bands: `B02`, `B03`, `B04`, `B08`, `observations`.

This preflight did not call the Process API and consumed no imagery-processing PU.

## Current general-user limits

Official quota documentation currently lists:

- 10,000 Sentinel Hub API requests per month;
- 300 requests per minute;
- 10,000 Processing Units per month;
- 300 Processing Units per minute;
- Process API output width/height maximum 2500 pixels.

These are external service facts and must be rechecked before a full production run.

## Local target estimate

The prepared library has 377 targets: 1 country, 34 province-level, and 342 prefecture-level.

At longest dimension 2000 and preserved Web Mercator aspect ratio:

| Measure | Estimate |
| --- | ---: |
| Total output pixels | about 1.202 billion |
| RGB 3-band PU | about 4,586 |
| 4-input-band PU | about 6,115 |
| Raw 8-bit RGB | about 3.36 GiB |
| Final JPEG/WebP package | about 0.5-0.8 GB |
| Recommended working space | 5-10 GB |

One fixed quarterly release should fit the current monthly general-user PU quota. Multi-quarter processing for every target probably will not. The harness therefore performs a low-resolution quality probe and spends fallback PU only where the primary quarter has unacceptable no-data.

## License baseline

The official Sentinel legal notice grants lawful reproduction, distribution, communication to the public, adaptation, modification, and combination with other information. Modified published outputs must identify their source using:

```text
Contains modified Copernicus Sentinel data <YEAR>
```

Generated data notices must use the actual source year or years. Do not describe Sentinel data as public domain or silently place it under the repository's software license.

## Pilot evidence and remaining launch evidence

- Accepted quality probes consumed 6.761 PU and accepted RGB previews consumed 20.282 PU. Including the initial three 128px checks and the visually rejected unnormalized-DN preview pass, observed harness use was about 47.384 PU.
- The official quarterly collection rejected a too-coarse Chengdu probe above 1600 metres per pixel. The accepted dynamic probe uses at least 128 pixels on the long side and no coarser than 1590 metres per pixel.
- The representative matrix pinned `2025-Q2` as primary, with ordered `2025-Q4`, then `2025-Q3` valid-pixel fallbacks and a 2% no-data threshold. Q2 was cleanest for all representative land targets; Q4 materially reduced Sansha missing coverage; Q4 winter/snow seams ruled it out as the nationwide primary.
- The accepted deterministic RGB transform is `DN / 10000`, gain 2.5, gamma 0.9, clamp 0-1. The rejected unnormalized transform produced saturated white previews and is not eligible for generation.
- The prepared GeoJSON coordinate interpretation still needs a four-target alignment control.
- Distribution permission for the TianDiTu-derived GeoJSON is separate from the Copernicus imagery license.
