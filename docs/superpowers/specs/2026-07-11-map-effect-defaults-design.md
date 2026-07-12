# 地图光效默认参数调整设计

## 目标

将用户在效果控制面板中调试确认的 `MapEffectConfig` 设置为地图光效的新默认值。

## 方案

- 仅修改 `MAP_EFFECT_DEFAULTS`，保持它继续作为规范化回退、首次加载、格式化 JSON 和“恢复默认值”的唯一来源。
- 保持 `version: 1`、存储键 `cq-map-effect-config-v1`、字段结构及参数范围不变。
- 不迁移或覆盖浏览器已有的持久化配置；已有配置继续优先，用户点击“恢复默认值”后切换到新默认值。
- 不修改地图几何、材质应用逻辑、Hover 状态机、抽屉布局或既有交互。

## 新默认值

```json
{
  "version": 1,
  "base": {
    "innerColor": "#ffffff",
    "innerWidth": 1.5,
    "innerOpacity": 0.55,
    "outerColor": "#ffffff",
    "outerCoreWidth": 2,
    "outerGlowWidth": 0,
    "outerGlowStrength": 0
  },
  "hover": {
    "surfaceColor": "#7fcbff",
    "emissiveColor": "#22b4d8",
    "emissiveIntensity": 0.5,
    "outlineColor": "#d8f5ff",
    "outlineWidth": 2.4,
    "glowColor": "#27a7ff",
    "glowWidth": 0,
    "glowStrength": 0,
    "lift": 2,
    "enterMs": 400,
    "leaveMs": 300
  }
}
```

## 测试与验收

- 先新增精确断言新默认配置的失败测试，再修改生产常量使测试通过。
- 更新依赖旧默认值的控件重置断言。
- 运行全量测试、类型检查、生产构建和 `git diff --check`。
- 浏览器确认“恢复默认值”输出上述 JSON，地图仍可正常 Hover 和点击下钻。
