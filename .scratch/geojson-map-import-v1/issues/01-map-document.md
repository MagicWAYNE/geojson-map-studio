# GeoJSON 规范化地图文档

Status: ready-for-human

## Objective

定义规范地图文档并实现 GeoJSON 检查与准备 seam。

## Scope

- 定义 `MapDocument`、`PreparedMapPackage`、`MapImportSummary`、`MapImportError` 和 `MapRegionMetrics`。
- 支持 Polygon、MultiPolygon、孔洞、名称字段、固定 Web Mercator 投影与居中归一化。
- 限制为 10 MiB、500 个区域、250,000 个位置；拒绝跨日期变更线及非法坐标/环。
- 模块返回最终 `ProjectionResult`，不访问 IndexedDB、路由或 Three.js。

## Acceptance

- Polygon、MultiPolygon、孔洞和反向环生成正确 `Region`。
- 默认或自选字段产生非空唯一名称，冲突值可诊断。
- 无效根、几何、名称、坐标及超限输入返回稳定错误码与路径。
- 输入文本不被修改。

## Comments

实现提交后进入人工复核。
