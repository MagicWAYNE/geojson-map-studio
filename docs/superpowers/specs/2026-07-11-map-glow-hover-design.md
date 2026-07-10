# 地图常驻光效、Hover 动效与调试控制设计

## 背景与目标

主屏当前使用 `ChongqingMap3D.vue` 渲染八个区块的 Three.js 挤出地图，已具备卫星纹理、1px 区界、Raycaster hover、tooltip、拖拽旋转和点击下钻。现有 hover 只会瞬时修改顶面材质，缺少参考图中的外轮廓辉光、区域聚焦和过渡动画。

本次升级只作用于主屏 Three.js 地图：常态显示稳定的蓝色外轮廓辉光和克制的内部区界；hover 时保留卫星纹理，增强区域蓝青光、专属轮廓并轻微抬升。现有相机、布局、tooltip 数据、旋转缩放和点击下钻行为保持不变。

柱状标记、排名标签、详情页 ECharts 地图、流动追光和呼吸动画不在本次范围内。

## 技术方案

采用几何分层辉光，不引入 `EffectComposer`、Bloom 后处理或自定义顶面 Shader。

### 边界分类

将 SVG 解析、环投影和边界分类从组件中拆到独立纯模块。对每条无向边使用规范化端点键计数：

- 只出现一次的边属于整体外轮廓；
- 出现两次或更多次的边属于区块共享边，只保留一份作为内部区界；
- 每个区块自身的全部边另行保留，用于 hover 专属轮廓。

现有八区 SVG 的 11,959 条边可精确归并为 2,895 条外轮廓边和 4,532 条共享边，数据无需手工补画。

### 渲染层

使用 Three.js examples 中的 `LineSegments2`、`LineSegmentsGeometry` 和 `LineMaterial` 绘制屏幕像素宽度的线条。全部线材质使用透明加色混合、关闭深度写入，并通过轻微高度偏移与 `renderOrder` 避免顶面闪烁。

常态渲染层从下到上为：

1. 当前卫星纹理挤出网格；
2. 唯一内部区界；
3. 外轮廓远端柔光；
4. 外轮廓近端柔光；
5. 外轮廓亮芯。

外轮廓近端柔光宽度为 `outerGlowWidth * 0.5`、透明度为 `outerGlowStrength`；远端柔光宽度为 `outerGlowWidth`、透明度为 `outerGlowStrength * 0.35`。亮芯透明度固定为 `0.95`。

每个区块在初始化时创建一个视觉状态对象，保存网格、顶面材质、局部容器、hover 亮芯和 hover 辉光。pointer move 只切换目标状态，不创建或销毁 Three.js 对象。

### Hover 动画

每个区块维护 `progress`（0 到 1）和是否为当前目标。渲染循环按时间增减进度：进入使用 `enterMs`，离开使用 `leaveMs`，视觉值使用 cubic ease-out。快速跨区时，旧区回落和新区抬升同时进行，不闪烁。

动画插值包括：

- 顶面颜色从现有 `TOP_COLOR` 过渡到 `surfaceColor`；
- emissive 从现有 `TOP_EMISSIVE` 和强度 `0.35` 过渡到配置值；
- 区块局部容器沿挤出轴抬升至 `lift`；
- hover 亮芯和辉光透明度由 0 过渡到目标值。

tooltip 立即显示当前 Raycaster 命中的区块，不等待动画完成。pointer leave 将所有目标切回 0。现有拖拽距离大于 6px 时不触发点击的规则保持不变。

## 效果配置契约

配置使用可复制、可版本化的 JSON，运行时类型为 `MapEffectConfig`：

```json
{
  "version": 1,
  "base": {
    "innerColor": "#4da3ff",
    "innerWidth": 1,
    "innerOpacity": 0.55,
    "outerColor": "#7fcbff",
    "outerCoreWidth": 1.8,
    "outerGlowWidth": 10,
    "outerGlowStrength": 0.3
  },
  "hover": {
    "surfaceColor": "#7fcbff",
    "emissiveColor": "#168dff",
    "emissiveIntensity": 0.8,
    "outlineColor": "#d8f5ff",
    "outlineWidth": 2.4,
    "glowColor": "#27a7ff",
    "glowWidth": 7,
    "glowStrength": 0.35,
    "lift": 1,
    "enterMs": 180,
    "leaveMs": 220
  }
}
```

各字段的调试范围如下：

| 字段 | 范围 | 步长 |
| --- | ---: | ---: |
| `innerWidth` | 0–4 px | 0.1 |
| `innerOpacity` | 0–1 | 0.01 |
| `outerCoreWidth` | 0–6 px | 0.1 |
| `outerGlowWidth` | 0–24 px | 0.5 |
| `outerGlowStrength` | 0–1 | 0.01 |
| `emissiveIntensity` | 0–2 | 0.05 |
| `outlineWidth` | 0–8 px | 0.1 |
| `glowWidth` | 0–20 px | 0.5 |
| `glowStrength` | 0–1 | 0.01 |
| `lift` | 0–3 world units | 0.1 |
| `enterMs`、`leaveMs` | 0–1000 ms | 10 |

颜色字段只接受六位十六进制颜色。线宽或强度为 0 时隐藏对应层。所有参数集中在默认常量和响应式配置中，地图组件监听配置并原位更新材质；调参时不重建地图几何。

## 地图调试抽屉

现有抽屉标题改为“地图调试”，保留 320px 宽度并增加“布局 / 效果”两个页签。

### 布局页签

保留当前地图位置、尺寸、相机视角、复制 CSS、复制相机参数和重置布局功能，行为不变。

### 效果页签

效果参数按三组展示：

1. 常态边界：内部线颜色、宽度、透明度，以及外圈颜色、亮芯宽度、辉光宽度和强度；
2. Hover 表面：顶面颜色、emissive 颜色与强度、抬升高度；
3. Hover 轮廓与动效：亮芯颜色和宽度、辉光颜色、宽度与强度、进入和离开时长。

颜色参数使用颜色选择器和十六进制文本框；数值参数使用数字框和滑块。抽屉内容区可滚动，页签与标题保持可见。

底部提供实时更新的只读格式化 JSON 和“复制效果参数”按钮。复制内容只包含上述 `MapEffectConfig`，不混入布局或相机参数，也不提供粘贴导入功能。另设“恢复效果默认值”，只重置效果，不改变布局。

效果配置持久化到版本化的独立键 `cq-map-effect-config-v1`。加载时逐字段校验并裁剪范围；字段缺失、类型错误或非法颜色时，仅对应字段回退默认值；版本不支持或整段缓存无法解析时，整份配置恢复默认值。无法访问 `localStorage` 时仍允许本次会话调参。剪贴板 API 不可用时沿用现有 `execCommand` 回退。

## 数据流与生命周期

`useMapDebug` 继续作为模块级单例，新增响应式 `effect`、效果默认值、配置规范化、效果重置和格式化 JSON。调试抽屉写入 `effect`，地图组件深度监听后更新现有材质和线条属性。

ResizeObserver 和窗口 resize 同时更新 renderer 像素比及所有 `LineMaterial.resolution`。组件卸载时停止 watcher、移除监听器，并使用集合去重释放几何、材质和纹理，避免共享资源被重复处理。

宽线辉光构建若发生异常，只降级为当前 1px `THREE.LineLoop` 区界；地图纹理、基础 hover、tooltip 和点击下钻继续可用。原始 SVG、纹理或数据加载失败时仍使用现有错误层反馈。

## 测试与验收

引入 Vitest 和 `npm test` 脚本，纯逻辑测试覆盖：

- 相邻多边形的反向共享边只生成一条内部区界；
- 非共享边归入外轮廓，独立区块和孔洞不会被误删；
- hover 区域边界保留完整；
- 配置缺失字段合并默认值，超界数值被裁剪；
- 非法颜色、错误类型、损坏缓存和不支持版本安全回退；
- 格式化 JSON 可重新解析并与当前规范化配置一致。

浏览器在 1920×1080 下完成以下验收：

1. 默认态外圈稳定发光、内部区界清晰，透明画布和卫星纹理不变；
2. 依次和快速 hover 八个区块，高亮、轻抬、回落和 tooltip 无闪烁或残留；
3. 旋转、缩放、点击下钻和拖拽防误点行为无回归；
4. 所有效果控件实时生效，刷新后保持，重置后恢复默认值；
5. 复制 JSON 字段完整、数值与界面一致；
6. 浏览器控制台无新增错误，当前机器稳定后常态不低于 55 FPS，连续 hover 不低于 50 FPS；
7. 保存默认态和 hover 态截图，与参考图核对外圈光晕、内部层级和选区聚焦感。

最终验证命令为 `npm test`、`npm run typecheck` 和 `npm run build`。
