# 地图首版调试参数默认值固化设计

日期：2026-07-12

状态：已确认，待实施计划

## 目标

把用户完成首版调试的地图布局、3D 初始视角和效果参数固化为项目源码默认值，使无本地缓存的新浏览器、新设备或新部署首次打开时直接使用这组参数。

## 持久化规则

- 采用“源码默认值优先于空缓存，已有自定义缓存继续保留”的规则。
- 不升级 `cq-map-effect-config-v2` 存储键，不主动覆盖已有 v2 效果缓存。
- 不升级布局存储键，不主动覆盖已有布局缓存。
- 当前浏览器已经保存的调试参数继续按现有持久化逻辑生效。
- 点击“恢复全部默认值”或布局“重置”时，恢复为本设计中的新源码默认值。

## 布局默认值

```css
.pos-map {
  left: 40px;
  top: 230px;
  width: 1000px;
  height: 680px;
}
```

对应：

```ts
{ left: 40, top: 230, width: 1000, height: 680 }
```

## 3D 初始视角

```json
{
  "pos": [-62.1, 94.9, 108.9],
  "target": [17.2, -3.5, 22.5]
}
```

相机 position 和 OrbitControls target 使用以上精确值。用户后续拖动/缩放仍沿用现有交互和实时视角复制功能；本轮不新增相机持久化。

## 效果参数默认值

```json
{
  "version": 2,
  "base": {
    "innerColor": "#ffffff",
    "innerWidth": 1.5,
    "innerOpacity": 0.55,
    "outerColor": "#ffffff",
    "outerCoreWidth": 2,
    "outerGlowEnabled": true,
    "outerGlowColor": "#8ab7ff",
    "outerGlowWidth": 72,
    "outerGlowStrength": 0.48,
    "outerGlowNearRadiusRatio": 0.35,
    "outerGlowNearOpacityRatio": 1.25,
    "outerGlowFarRadiusRatio": 0.7,
    "outerGlowFarOpacityRatio": 0.75,
    "outerGlowFalloff": 0.9,
    "outerGlowEdgeSoftness": 0.96,
    "outerGlowNearPasses": 4,
    "outerGlowFarPasses": 4
  },
  "hover": {
    "surfaceColor": "#7fcbff",
    "emissiveColor": "#22b4d8",
    "emissiveIntensity": 0.5,
    "outlineColor": "#d8f5ff",
    "outlineWidth": 2.4,
    "glowEnabled": false,
    "glowColor": "#ffffff",
    "glowWidth": 110,
    "glowStrength": 0.15,
    "glowNearRadiusRatio": 0.35,
    "glowNearOpacityRatio": 0.83,
    "glowFarRadiusRatio": 1,
    "glowFarOpacityRatio": 1,
    "glowFalloff": 1,
    "glowEdgeSoftness": 0.96,
    "glowNearPasses": 2,
    "glowFarPasses": 4,
    "lift": 2,
    "enterMs": 400,
    "leaveMs": 300
  },
  "quality": {
    "renderScale": 0.5,
    "maxAlpha": 1
  }
}
```

这些值替换 `MAP_EFFECT_DEFAULTS` 的 v2 canonical defaults，并继续经过现有范围校验、深拷贝和冻结机制。

## 兼容性

- 已有合法 v2 缓存继续优先于源码默认值。
- 已有自定义 v1 缓存继续按当前迁移规则保留用户字段并补齐新字段；新增字段使用本轮新默认值。
- 两代已知 v1 默认缓存迁移到完整的新 v2 默认值。
- 损坏、未知或缺失缓存回退到完整的新默认值。

## 测试与验收

- 精确断言新的 `MAP_LAYOUT_DEFAULT`。
- 精确断言相机 position 与 controls target 初始值。
- 精确断言完整 `MAP_EFFECT_DEFAULTS`。
- 验证无缓存加载、恢复效果默认值和布局重置使用新值。
- 验证合法已有 v2 自定义缓存不被新默认值覆盖。
- 验证两代已知 v1 默认缓存迁移到新默认，自定义 v1 仍保留。
- 运行全量测试、类型检查和生产构建。

## 非目标

- 不修改存储键或配置版本。
- 不强制覆盖已有自定义缓存。
- 不增加相机视角 localStorage 持久化。
- 不改变地图数据、渲染管线、控件范围、交互或性能策略。
