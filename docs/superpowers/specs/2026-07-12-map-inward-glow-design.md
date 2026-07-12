# 地图外圈内扩柔光与传播波设计

日期：2026-07-12

状态：交互设计已确认，待实施计划

## 目标

在现有地图外扩柔光基础上，新增从边缘向地图内部扩散的屏幕空间柔光。常态通道沿整张地图外圈工作，hover 通道沿当前选中区域边缘工作；两者参数完全独立，并可与现有常态/hover 外扩柔光同时启用和叠加。

内扩效果包含稳定的近端/远端双层底光，以及从边缘向内部传播的柔和波峰。常态波持续循环；hover 波每次进入区域时从边缘重新发射。

## 已确认的视觉规则

- 常态与 hover 分别拥有独立内扩通道。
- 内扩与外扩可同时启用，不互斥、不自动联动。
- 常态默认颜色取外圈边线颜色 `#ffffff`。
- hover 默认颜色取选中轮廓颜色 `#d8f5ff`。
- 内扩覆盖地图顶面和当前相机可见的挤出侧壁。
- 柔光仅保留在地图/区域遮罩内部，不允许泄漏到地图外。
- 白色外圈和行政区边界保持清晰，视觉上位于柔光之上。
- 宽度保持屏幕 CSS 像素恒定，不随相机缩放改变。
- 采用 B 型“近端 + 远端”双层衰减，并以 B1 克制档作为默认。
- 常态和 hover 内扩默认开启。
- 稳定底光始终保留，传播波叠加在底光之上。
- hover 每次进入区域时将传播相位重置为 `0`；保持 hover 时继续按周期循环。

## 技术方案

采用“扩展现有屏幕空间模糊管线”方案，不引入距离场 Jump Flood，也不向地图几何写入边缘距离属性。

现有屏幕空间管线扩展为四个逻辑通道：

1. 常态外扩
2. hover 外扩
3. 常态内扩
4. hover 内扩

遮罩按状态复用：

- 常态内扩与常态外扩共享整张地图静态遮罩。
- hover 内扩与 hover 外扩共享当前区域的动态遮罩和 hover progress。
- 内扩参数独立，因此常态/hover 内扩分别拥有自己的 near/far 模糊结果。
- 四类通道共享尺寸计算、相机脏标记、一个 ping target、异常处理和资源生命周期。

相较距离场方案，此方案对尖角和狭窄区域的传播距离是模糊近似，波峰可能自动压缩；该限制可接受，因为它显著降低了实现复杂度和 GPU 开销，并与最近完成的外扩柔光保持相同视觉语言。

## 渲染顺序

每帧按以下顺序执行：

1. 按需更新常态或 hover 遮罩。
2. 仅为签名变化、相机变化或尺寸变化的通道重建 near/far 模糊缓存。
3. 渲染主地图场景。
4. 合成常态外扩。
5. 合成常态内扩稳定底光与传播波。
6. 合成 hover 外扩。
7. 合成 hover 内扩稳定底光与传播波。

现有 Line2 边界层仍随主地图场景绘制。后续柔光合成使用加法混合，不会覆盖或压暗白色线条；内扩 shader 严格裁切地图内部，使边线像素和外侧轮廓保持清晰，不增加第二次边线渲染。合成受通道级 `maxAlpha` 与全局 quality 参数约束。零宽度、零透明度、关闭开关或零波峰强度时，跳过对应 GPU 工作。

## 内扩合成模型

每个内扩通道由两部分组成。

### 稳定底光

稳定底光使用 near/far 两张模糊纹理。shader 通过原始遮罩生成只保留内部像素的裁切因子，并将近端和远端能量按独立透明度比例、falloff 和 edge softness 合成。

输出必须满足：

- 遮罩外 alpha 恒为 `0`。
- 边缘内侧能量最高，并向内部单调衰减。
- `baseRatio = 0` 时不显示稳定底光；`baseRatio = 1` 时使用完整配置强度。
- 最终 alpha 不超过通道级 `maxAlpha`。

### 向内传播波

shader 根据原始遮罩与 near/far 模糊采样估算归一化边缘深度：外边缘为 `0`，配置的最大传播深度为 `1`。传播相位经过 easing 后决定波峰中心；`widthRatio` 决定波峰宽度，`travelRatio` 决定最大传播深度，`decay` 决定波峰向内部移动时的振幅衰减。

输出 alpha 为稳定底光与传播波之和，再执行内部裁切与 `maxAlpha` 限制。尖角、孔洞边缘和狭窄区域必须保持有限值并自然压缩，不得产生 NaN、硬裁切或地图外泄漏。

常态使用连续时钟。hover 通道在不可见时停止合成；进入一个区域时相位重置，离开时跟随现有 `leaveMs` 淡出。传播动画每帧只更新合成 uniform，不触发遮罩或模糊重建。

## 配置模型

地图效果配置升级为 `version: 3`，新存储键为：

```text
cq-map-effect-config-v3
```

现有外扩字段保持原样。内扩参数嵌套在 `base.inwardGlow` 与 `hover.inwardGlow` 中。

```ts
type InwardWaveEasing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'

interface MapInwardWaveConfig {
  enabled: boolean
  widthRatio: number
  strength: number
  periodMs: number
  delayMs: number
  travelRatio: number
  decay: number
  easing: InwardWaveEasing
}

interface MapInwardGlowConfig {
  enabled: boolean
  color: string
  width: number
  strength: number
  maxAlpha: number
  nearRadiusRatio: number
  nearOpacityRatio: number
  farRadiusRatio: number
  farOpacityRatio: number
  falloff: number
  edgeSoftness: number
  nearPasses: number
  farPasses: number
  baseRatio: number
  wave: MapInwardWaveConfig
}
```

`base.inwardGlow` 和 `hover.inwardGlow` 均为 `MapInwardGlowConfig`，对象必须在加载、复制、重置和草稿编辑时进行深克隆，不共享可变嵌套引用。

## 默认值

### 常态内扩

```json
{
  "enabled": true,
  "color": "#ffffff",
  "width": 48,
  "strength": 0.18,
  "maxAlpha": 0.5,
  "nearRadiusRatio": 0.35,
  "nearOpacityRatio": 0.83,
  "farRadiusRatio": 1,
  "farOpacityRatio": 1,
  "falloff": 1,
  "edgeSoftness": 0.96,
  "nearPasses": 2,
  "farPasses": 4,
  "baseRatio": 0.7,
  "wave": {
    "enabled": true,
    "widthRatio": 0.24,
    "strength": 0.45,
    "periodMs": 3600,
    "delayMs": 0,
    "travelRatio": 1,
    "decay": 0.65,
    "easing": "ease-out"
  }
}
```

### Hover 内扩

```json
{
  "enabled": true,
  "color": "#d8f5ff",
  "width": 64,
  "strength": 0.22,
  "maxAlpha": 0.6,
  "nearRadiusRatio": 0.35,
  "nearOpacityRatio": 0.83,
  "farRadiusRatio": 1,
  "farOpacityRatio": 1,
  "falloff": 1,
  "edgeSoftness": 0.96,
  "nearPasses": 2,
  "farPasses": 4,
  "baseRatio": 0.6,
  "wave": {
    "enabled": true,
    "widthRatio": 0.22,
    "strength": 0.65,
    "periodMs": 1400,
    "delayMs": 0,
    "travelRatio": 1,
    "decay": 0.55,
    "easing": "ease-out"
  }
}
```

## 参数范围与归一化

- `width`: `0..200` CSS px
- `strength`: `0..1`
- `maxAlpha`: `0.1..1`
- `nearRadiusRatio`: `0..1.5`
- `nearOpacityRatio`: `0..2`
- `farRadiusRatio`: `0.25..2`
- `farOpacityRatio`: `0..2`
- `falloff`: `0.25..4`
- `edgeSoftness`: `0..1`
- `nearPasses` / `farPasses`: 四舍五入并裁切为整数 `1..8`
- `baseRatio`: `0..1`
- `wave.widthRatio`: `0.01..1`
- `wave.strength`: `0..2`
- `wave.periodMs`: `250..10000`
- `wave.delayMs`: `0..5000`
- `wave.travelRatio`: `0.25..2`
- `wave.decay`: `0..4`
- `wave.easing`: 仅接受四个枚举值

所有非有限数、非法颜色和非法枚举均回退对应通道默认值。归一化必须收敛，watch 持久化不能形成重复写入循环。

## 迁移和持久化

读取优先级与故障规则：

1. 有合法 v3：加载并归一化 v3。
2. 无 v3、有合法 v2：完整保留 v2 的常态、hover、外扩与 quality 参数，补入本设计的常态/hover 内扩默认值。
3. 无 v3/v2、有合法 v1：先执行现有 v1 迁移语义，再补齐 v3 内扩默认值。
4. 缺失所有缓存：使用完整 v3 默认值。
5. v3 存在但损坏、未知或不可解析：回退完整 v3 默认值，不读取旧键。

旧 `cq-map-effect-config-v1` 和 `cq-map-effect-config-v2` 不删除。后续编辑只写 v3。迁移可在内存中重复执行并得到相同结果，不要求首次读取立即写回。

“恢复全部默认值”恢复完整 v3 默认配置；内扩分组重置只恢复对应 `base.inwardGlow` 或 `hover.inwardGlow`。可复制参数区输出完整 v3 JSON，并支持格式化/解析无损往返。

## 调试抽屉

在现有地图调试抽屉新增两个完整参数组：

- 常态内扩柔光
- Hover 内扩柔光

每组提供：

- 启用、颜色、宽度、透明度、最大透明度
- near/far 半径比与透明度比
- falloff、edge softness、near/far passes
- 稳定底光比例
- 传播波启用、宽度比例、强度、周期、延迟、传播深度、传播衰减和 easing
- B1 预设
- 分组重置

继续使用现有“编辑草稿 → 实时预览 → 应用/撤销”语义。草稿、应用值、持久化值和复制 JSON 必须相互隔离，不得因嵌套对象共享而提前写入有效配置。

运行状态新增：

- `baseInwardState`: `active | zero | disabled`
- `hoverInwardState`: `ready | active | zero | disabled`
- `baseWaveActive`: boolean
- `hoverWaveActive`: boolean

性能提示综合 renderScale、四类柔光通道、near/far passes 和启用状态估算负载。

## 脏标记和性能规则

- 内扩与外扩共享两张遮罩，不复制静态或 hover mask target。
- 常态/hover 内扩各新增 near/far 两张缓存纹理，总计新增四张 render target。
- 所有通道共享一个 ping target。
- 颜色、透明度、maxAlpha、falloff、softness、baseRatio 和 wave 参数只更新合成输入，不重建模糊。
- width、near/far radius ratio、near/far passes 只使对应内扩通道的 blur cache 失效。
- 相机、CSS 尺寸、DPR 或 renderScale 改变时，使受影响的遮罩和模糊缓存失效。
- hover progress 或区域 world matrix 变化只使 hover 遮罩及依赖它的 hover blur 失效。
- wave 相位变化不得标记 mask 或 blur dirty。
- 关闭或有效零通道不执行对应 mask、blur 或 composite 工作。

## 错误处理与资源释放

沿用当前统一降级边界：屏幕空间柔光 shader、render target、resize、mask、blur 或 composite 任一步骤失败时，关闭屏幕空间柔光管线，保留地图主体、清晰边线和基础 hover 材质效果，并只告警一次。

构造阶段部分分配失败、运行期异常和重复 dispose 均必须释放所有自有 render target、材质、FullScreenQuad 和 shader 资源；不能释放来源地图 mesh 的 geometry/material。

## 测试要求

### 配置

- 精确断言完整 v3 默认值和新存储键。
- 深冻结、深克隆、格式化/解析往返。
- v1/v2 自定义配置保留并补齐内扩默认。
- 损坏 v3 不回退旧缓存。
- 所有数值范围、非有限值、颜色和 easing 枚举归一化。
- watch 归一化收敛且不重复写入。

### Shader 与管线

- 遮罩外 alpha 恒为零，内部边缘按 near/far 衰减。
- baseRatio、maxAlpha、wave width/strength/travel/decay/easing 生效。
- 常态/hover 内扩与外扩可同时合成且顺序稳定。
- 四类通道开关、状态、缓存和 dirty rule 独立。
- wave 每帧只更新 composite，不重建 mask/blur。
- hover 进入和切换区域时相位重置；离开时按 progress 淡出。
- 顶面和可见侧壁都进入遮罩。
- resize、DPR、相机和 renderScale 正确失效缓存。
- 关闭、零效果、异常和 dispose 路径无多余 GPU 调用或资源泄漏。

### 调试抽屉

- 两组全部控件、范围、步长和 easing 选项。
- 草稿预览、应用、撤销、复制、B1 预设、分组重置和全部重置。
- 嵌套对象身份隔离与持久化时机。
- 运行状态和性能提示。

## 浏览器验收

在 1920×1080 下检查：

- 常态、hover、快速切换区域、长时间 hover。
- 相机旋转、缩放、窗口 resize 与 DPR 变化。
- 白色外圈和行政区边界保持清晰。
- 内扩覆盖顶面和可见侧壁，不泄漏地图外。
- B1 默认下底图纹理清晰可辨。
- 传播波无硬边、闪烁、跳相、NaN 或突然全图变亮。
- hover 每次进入区域都从边缘重新发射。
- 默认与调试高负载组合下观察运行状态和降级提示。
- 常态与 hover 动画目标维持约 55–60 FPS；持续低于 55 FPS 时优先降低 renderScale 或 passes。

最终必须通过全量测试、类型检查、生产构建和局域网 HTTP 验证。

## 非目标

- 不实现严格屏幕空间 SDF/JFA 距离场。
- 不向地图 geometry 写入边缘距离属性。
- 不修改地图数据、相机默认值、地图布局默认值或现有边线宽度。
- 不让内扩与外扩自动互斥或共享参数。
- 不新增地图柱状图或其他业务图层。
