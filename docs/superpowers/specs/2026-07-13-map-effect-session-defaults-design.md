# 地图效果参数固化与会话态设计

日期：2026-07-13

## 目标

将用户提供的 v3 地图效果参数固化为源码默认值。地图效果参数只在当前页面会话内可调；每次刷新或重新打开页面都从源码默认值重新开始。

## 范围

- 更新常态、Hover、常态内扩、Hover 内扩及 quality 的完整默认值。
- 停止应用启动时读取 `cq-map-effect-config-v1/v2/v3`。
- 停止效果参数变化时写入 localStorage。
- 保留抽屉实时预览、草稿、应用、放弃、分组重置、全部重置和复制 v3 JSON。
- 保留地图布局 `cq-map-debug-layout` 的现有持久化。
- 相机视角继续只作为运行时读数，不新增持久化。

## 数据流

`useMapDebug` 初始化效果状态时，直接深克隆 `MAP_EFFECT_DEFAULTS`：

```ts
const effect = reactive(cloneMapEffectConfig(MAP_EFFECT_DEFAULTS))
```

效果 watcher 继续执行 normalization，并使用原位赋值保持 base、hover、quality、inwardGlow 和 wave 的对象身份稳定，但不再调用任何效果配置 load/save API。

旧的 v1/v2/v3 localStorage 键：

- 不读取；
- 不写入；
- 不主动删除。

因此旧缓存即使存在，也不会影响当前效果；刷新后始终恢复源码默认值。

## 默认参数

源码默认值精确匹配用户在 2026-07-13 提供的 version 3 JSON。关键变化包括：

- base：`outerColor=#cad6fc`，外扩 width 100 / strength 0.35；
- base inward：颜色 `#3c69eb`，width 36 / strength 0.75，wave 关闭；
- hover：`emissiveColor=#4894db`，外扩开启，width 64 / strength 0.12；
- hover inward：保留 width 64 / strength 0.22，wave 关闭；
- quality：renderScale 0.5，maxAlpha 1。

完整字段由配置测试以精确对象断言锁定，避免只验证部分关键值。

## 兼容性

保留 `mapEffectConfig` 中通用的 v1/v2/v3 解析、迁移和保存 helper，避免扩大本次改动范围；应用运行路径不再调用它们。旧配置测试继续证明这些纯函数行为，但应用级测试必须证明缓存不会参与初始化或运行时写入。

## 测试与验收

1. 先写失败测试，证明当前实现仍会读取和写入效果缓存。
2. 精确断言新的完整 v3 默认 JSON。
3. 分别预置 v1、v2、v3 缓存，模块加载后效果仍等于源码默认值。
4. 当前会话修改深层 inward/wave 参数后，localStorage 不产生效果键写入。
5. 模块重载后恢复源码默认值。
6. `resetEffect()` 保持所有嵌套对象身份稳定并恢复新默认值。
7. 布局缓存读取和写入行为保持不变。
8. 运行聚焦测试、全量测试、类型检查和生产构建。

## 非目标

- 不删除用户浏览器中的旧效果缓存键。
- 不增加新的持久化开关。
- 不改变地图布局默认值或布局缓存。
- 不改变 shader、glow pipeline、hover 时序和调试抽屉布局。
