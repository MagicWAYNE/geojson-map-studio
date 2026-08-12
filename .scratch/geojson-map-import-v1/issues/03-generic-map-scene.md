# 内置地图适配与通用 Three.js 场景

Status: ready-for-human

## Objective

让内置 SVG 与上传 GeoJSON 统一产生 `MapDocument`，地图组件只消费规范文档。

## Scope

- 将 SVG URL、天地图纹理、重庆业务数据与“两江新区”兼容逻辑收进内置 adapter。
- 根据 `appearance` 构建 terrain-texture 或 tech-blue 材质。
- 自定义地图复用边界光、hover、马赛克、轮播、HUD、柱体和 overlay。
- 仅 `drilldown=true` 时进入详情页。

## Acceptance

- 内置 8 区、纹理 UV、业务柱体和下钻不回归。
- tech-blue 不加载 PNG 或计算 raster UV。
- 场景卸载只释放自己拥有的 Three.js 资源一次。

## Comments

实现提交后进入人工复核。
