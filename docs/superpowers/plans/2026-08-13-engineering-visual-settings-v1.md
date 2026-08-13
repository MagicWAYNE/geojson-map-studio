# 工程视觉设置 V1 实施计划

## 目标

把原数据大屏中隐藏的完整地图调试能力迁入 GeoJSON 科技地图工作台的固定右侧栏，形成“数据配置 / 视觉样式”双功能工作区。第一版不裁剪任何旧视觉字段或工程动作，同时确保视觉修改只热更新现有 Three.js 资源，不破坏 GeoJSON、业务数据、相机或页面会话边界。

## 固定范围

- Worktree: `/Users/fei/Projects/geojson-map-studio/.claude/worktrees/right-sidebar-settings`
- Branch: `codex/right-sidebar-settings`
- Fixed point: `a86da05 docs: align product split with standalone repository`
- Design viewport: 1920×1080
- Current map defaults: `left 24 / top 132 / width 1120 / height 948`
- Current camera defaults: `{ "pos": [-89.4, 117.0, 56.4], "target": [2.7, -2.9, 7.0] }`

## 已确认的产品结构

```text
Right sidebar
├─ 数据配置
│  ├─ GeoJSON 与可选 JSON
│  ├─ 指标定义
│  └─ 区域数据
└─ 视觉样式
   ├─ 构图与视角
   ├─ 地图效果
   ├─ 图表样式
   ├─ HUD
   └─ 工程信息
```

第一版的视觉样式是工程设置台。不得以“面向普通用户”为理由省略低层参数、运行状态或 JSON 复制能力。

## 深模块与 seam

| Seam | Interface 责任 | 实现中隐藏的复杂性 | 最高行为测试 |
| --- | --- | --- | --- |
| Right-sidebar workspace | 切换一级/二级页面并保持创作状态 | 页面布局、滚动、焦点、懒挂载 | 可见导航与状态保持 |
| Visual-settings session | read/edit/apply/discard/reset/preset/copy intentions | reactive identity、raw numeric drafts、normalization、dirty、defaults、warnings | session snapshot/result |
| Existing normalized configs | 接受并返回合法视觉配置 | bounds、version migration、clone/assign | 现有 config tests |
| Three.js visual integration | 消费 effective config 与发布 runtime status | watchers、shader passes、resource updates、degradation | renderer/canvas/resource identity |
| Chart-layer reconciliation | 热更新柱体和 DOM overlay appearance | meshes/materials/dispose/layout/collision | public layer/layout snapshots |

删除 visual-settings session 后，草稿、归一化、重置、预设、运行状态和复制逻辑会重新散落到多个页面，说明该 module 具有足够深度。

## 状态模型

```text
source defaults
      │
      ▼
applied visual config ───────────────► Three.js / overlay effective config
      │                                      │
      ├─ clone on entering draft mode        └─ runtime status / warnings
      ▼
editable visual draft
      ├─ partial numeric text ──► field-local only
      ├─ valid field commit ────► normalized draft
      ├─ apply ─────────────────► applied config
      ├─ discard ───────────────► clone applied config
      └─ scoped/full reset ─────► normalized defaults

refresh ──► source defaults (no visual persistence)
```

实时预览模式仍须经过字段级合法化；它不允许半截数字直接进入 shader 或 Three.js transform。

## 完整控制基线

完整性基线以 `a86da05` 的以下既有控制描述和动作为准：

| Legacy area | 必须保留 |
| --- | --- |
| Layout | left/top/width/height 数字+滑杆、CSS、相机读数、复制、重置 |
| Effects | 常态边界、常态外光、Hover 表面、Hover 外光、quality、两组 inward glow、mosaic、B3/蓝紫预设、live/draft/apply/discard/reset/copy/status |
| Chart style | 完整 bars、badge、panel、collision、runtime、bar/overlay copy 与 scoped reset |
| HUD | anchor、static、rotating、live/draft/apply/discard/reset/copy |
| Engineering | FPS、target size、renderScale、channel/mosaic/bar degradation、carousel、完整 normalized JSON |

实现可重组旧组件，但必须用 inventory test 证明没有字段或动作静默丢失。

## Ticket 执行顺序

| Ticket | 可独立演示的结果 | Blocked by |
| --- | --- | --- |
| 01 | 双功能右侧栏、视觉目录、会话 seam、构图/视角完整可用 | None |
| 02 | 所有地图效果控制完整迁移并热应用 | 01 |
| 03 | 所有柱体、标签、窗格与碰撞样式完整迁移 | 01 |
| 04 | 所有 HUD 控制和工程诊断完整迁移 | 01 |
| 05 | 全量 inventory、浏览器、资源、持久化与双轴评审 | 02, 03, 04 |

默认顺序为 01 → 02 → 03 → 04 → 05。Ticket 02/03/04 虽可在 01 后并行，但在单 agent `/goal` 中应按序完成和提交，减少共享右侧栏冲突。

## Ticket 01 — 工作区、会话与构图

1. 先写右侧栏切换时保留 GeoJSON/业务草稿/authoring focus 的失败测试。
2. 以现有右侧栏为唯一容器增加一级和二级导航，不恢复独立 Debug Drawer。
3. 建立视觉设置目录和会话 interface，以构图为首个端到端消费者。
4. 将 Home map 的静态 CSS 与 reset 默认值合并为单一配置源。
5. 恢复数字/滑杆、CSS copy、camera copy、reset，并增加 overlap/out-of-viewport warning。
6. 证明切换页面不重复 load active map、不创建第二 canvas、不改变数据状态。

## Ticket 02 — 完整地图效果

1. 先锁定 legacy effect descriptor/action inventory。
2. 将现有 effect 控制接入视觉设置会话，保持 reactive nested identity。
3. 保留 live/draft、raw numeric、apply/discard、group reset、full reset。
4. 保留 base/hover outward + inward、surface、mosaic、quality 和所有 presets。
5. 将 runtime status、performance warning 和 normalized JSON 放入清晰工程区域。
6. 通过公开 renderer/canvas/scene identity 证明全部为热更新。

## Ticket 03 — 完整图表样式

1. 先锁定 legacy bar/overlay descriptor/action inventory。
2. 将行业文案改为通用区域数据柱体、数值标签和指标浮层。
3. 接入完整 bar 字段并保持 layer reconcile/dispose 责任不外泄。
4. 接入完整 badge/panel/collision 字段并保持 screen-pixel layout contract。
5. 保留 runtime、copy、bar reset、overlay reset。
6. 证明样式变化不改变 business visualization，且无数据时不制造事实。

## Ticket 04 — 完整 HUD 与工程信息

1. 先锁定 legacy HUD descriptor/action inventory。
2. 接入 anchor/static/rotating 全字段以及 live/draft/apply/discard/reset/copy。
3. 汇总 FPS、target、render scale、glow/mosaic/bar status。
4. 将 carousel switch 放到工程信息，同时保持 hover coordinator 优先级。
5. 确认旧 drawer/header toggle 无第二入口或第二状态 owner。
6. 证明 HUD texture/resource 不因普通参数更新重复创建。

## Ticket 05 — 最终验收

### 自动验证

- legacy-to-new control/action inventory 0 omissions；
- full source tests；
- typecheck；
- production build；
- `git diff --check a86da05 --`；
- clean-worktree diff check；
- persistence scan；
- Standards / Spec review against `a86da05`，0 actionable findings。

### 真实浏览器矩阵（1920×1080）

| 场景 | 必须观察到 | 禁止出现 |
| --- | --- | --- |
| 一级切换 | 数据与视觉状态都保留 | Map remount、草稿丢失 |
| 构图 | 4 个字段与滑杆同步、warning、copy/reset 正确 | reset 跳回 400、页面滚动 |
| 常态效果 | 边界/内外光即时或 apply 后变化 | scene/canvas 替换 |
| Hover 效果 | surface/lift/内外光/mosaic 生效 | authoring hover 失效 |
| 性能 | 高成本组合出现提示与真实 runtime status | 无提示卡死、伪状态 |
| 图表 | bars/badge/panel/collision 变化但值不变 | 数值/单位被样式修改 |
| HUD | anchor/static/rotating 全组变化与 reset | texture/resource 累加 |
| 工程信息 | FPS/status/carousel/JSON 可用 | 第二 debug drawer |
| uploaded map | 同组控制作用于科技蓝自定义地图 | 恢复内置纹理/钻取 |
| refresh | geometry 保留；业务与视觉恢复默认 | visual config 被持久化 |
| lifecycle | 始终一个 canvas/renderer/base scene | WebGL 或 Vue console error |

## 风险与处理

| 风险 | 处理 |
| --- | --- |
| 完整控制量大而静默漏项 | fixed-point inventory test + ticket acceptance mapping |
| `useMapDebug` 同时承担产品与诊断状态 | expand visual-settings session，迁移消费者，再收缩旧 owner |
| 构图默认 400 与当前 24 冲突 | 单一 source default，同时供 Home 与 reset 使用 |
| 不同页面草稿语义不一致 | session 统一 snapshot/intent，字段保留 raw draft adapter |
| deep watch 递归或 identity 替换 | 沿用 assign/normalize，测试 nested reference stability |
| glow passes/renderScale 导致 GPU 压力 | 保留 full control + warning/degradation，不擅自裁剪 |
| chart style 意外修改业务数据 | config 与 MapDocument 分离，测试 business snapshot identity |
| panel mount 导致地图重挂载 | Home 保持 map sibling，切换只发生在 sidebar content |
| reset 作用域不清 | 每个页面 scoped reset + explicit full reset，测试范围 |
| 视觉配置被误持久化 | storage audit + refresh browser proof |

## 提交策略

每个 ticket 至少一个范围明确的本地提交，保持测试绿灯：

1. `feat: add visual workspace and composition controls`
2. `feat: release complete map effect settings`
3. `feat: release complete chart style settings`
4. `feat: release HUD and engineering controls`
5. `docs: record engineering visual settings acceptance`

不合并 `main`、不推送、不部署、不发布、不删除 worktree。
