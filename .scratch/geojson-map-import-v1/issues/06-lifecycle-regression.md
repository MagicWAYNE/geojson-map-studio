# Fixtures、资源生命周期与全量回归

Status: ready-for-human

## Objective

建立确定性 fixture，并证明重复导入与路由往返不泄漏地图运行时资源。

## Required fixtures

- `valid-mixed.geojson`：3 区，覆盖 Polygon、孔洞与 MultiPolygon。
- `valid-metrics.json`：2 匹配、1 缺失、1 多余。
- `duplicate-names.geojson`、`invalid-coordinate.geojson`、`unsupported-geometry.geojson`。

## Acceptance

- `npm test -- --dir src`、`npm run typecheck`、`npm run build`、`git diff --check` 全部通过。
- 重复 loader/home 往返保持单 canvas，RAF、监听器、观察器与 Three.js 资源沿既有 cleanup 释放。
- 构建已有 chunk-size warning 只记录，不误报为失败。

## Comments

实现提交后进入人工复核。
