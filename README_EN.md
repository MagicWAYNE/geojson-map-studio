# GeoJSON Tech Map Studio

[简体中文](./README.md) | [English](./README_EN.md)

A Three.js-based data mapping project. Select a region from the built-in library or import a GeoJSON file to create a polished 3D data map directly in your browser.

The resulting maps can be used in data dashboards, command-center interfaces, presentations, WeChat articles, Xiaohongshu posts, and anywhere else you need compelling map visualizations.

![GeoJSON Map Studio preview](./preview.gif)

## Product Line Scope

This standalone repository was forked from the original data-dashboard project. The two product lines are preserved as follows:

- The current repository's `main` branch contains the reusable GeoJSON map creation tool.
- The `data-bigscreen-sample-v1` tag preserves the Chongqing entrepreneurship-support dashboard from the time of the fork as a sample and portfolio snapshot.

The original project's `main` branch still contains the legacy data dashboard and is unaffected by this repository. This project is no longer centered on a particular region, industry, or one-off dashboard delivery.

## Current Features

- Select a map from the built-in region library, or upload GeoJSON containing Polygon, MultiPolygon, and interior-ring geometries.
- Configure each region's display name, enabled state, primary metric, and secondary metric.
- Update map columns, badges, and hover panels atomically for one region, the metrics, or the entire dataset.
- Use the built-in tech-blue materials, 3D extrusion, HUD, glow effects, particles, automatic hover carousel, and interactive map feedback.
- Adjust visual parameters for composition, camera, columns, hover panels, and map effects.
- Load project-local Sentinel-2 imagery for prepared built-in regions without calling a third-party imagery API at runtime.
- Keep custom geometry in browser storage while business data remains session-only and is cleared on refresh.
- Prevent invalid files or incomplete values from replacing the last valid map.

## Usage Guide

1. Select a built-in region or upload a GeoJSON file for the area you need. To prepare other regional datasets, we recommend the [Alibaba Cloud DataV GeoJSON tool](https://datav.aliyun.com/portal/school/atlas/area_selector).
2. Add data under **Region Data Configuration** to enable column charts and show data when a region is selected.
3. Use the mouse to adjust the model: drag with the left button to rotate, drag with the middle button to zoom, and drag with the right button to reposition.
4. Open **Visual Styles** to refine the exposed composition, camera, and map-effect parameters and create your own visual treatment.

## Not Current Goals

- Accounts, cloud projects, or cross-device synchronization.
- Paid-tier business-data persistence.
- Image, video, or embeddable-component export.
- SVG, Shapefile, KML, CSV, or Excel import.
- Additional fixed dashboard sections for a specific region or industry.

## Local Development

Node.js 20 or later is required.

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm test -- --dir src
npm run typecheck
npm run build
```

## Services and About Me

If this project is useful to you, follow the links below to learn more or get in touch:

- [GitHub repository](https://github.com/MagicWAYNE/geojson-map-studio)
- [X: @Wolfrid10888630](https://x.com/Wolfrid10888630)
- [Email: wei.mingda@outlook.com](mailto:wei.mingda@outlook.com)

## Direction

The current priority is to refine the shortest creation flow: **import boundaries → configure regional data → preview a polished map immediately**. Future project persistence, export, and commercialization features should build on this general-purpose workflow instead of coupling the product back to the legacy dashboard sample.
