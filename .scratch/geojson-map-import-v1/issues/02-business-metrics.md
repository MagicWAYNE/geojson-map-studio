# 可选业务数据合同

Status: ready-for-human

## Objective

实现 metrics V1 JSON，并让柱体与浮层消费通用 `MapRegionMetrics`。

## Scope

- 校验标签、单位、唯一名称和非负有限值，产生 matched/missing/extra 摘要。
- `primary` 驱动柱高与徽标，`secondary` 只进入 hover 面板。
- 无业务数据或无匹配项时不创建柱体、徽标或数据面板，不复用重庆旧值。
- 上传标签与单位作为纯文本渲染。

## Acceptance

- 部分匹配只影响匹配区域。
- 空数据不产生 `NaN`、`undefined` 或伪造值。
- 内置 `DistrictMapItem` 由 adapter 转为通用指标。

## Comments

实现提交后进入人工复核。
