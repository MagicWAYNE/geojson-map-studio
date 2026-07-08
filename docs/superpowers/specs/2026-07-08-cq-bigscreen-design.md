# 重庆大屏（长嘉汇金融调解中心复刻）设计文档

日期：2026-07-08
状态：已与用户确认

## 背景与目标

复刻 https://nanan-daping.hzyuntiaojie.com/share/page/4672f9ff0ff763dbda101aca31a9eee7
（阿里 DataV 搭建的"长嘉汇金融调解中心"大屏，重庆南岸区智慧调解平台，画布 1920×1080），
并在复刻基础上升级两项能力：

1. 中间地图由原站"中国 3D 平面地图 + 省际飞线"替换为 **重庆市区县 GEO SVG 地图**，
   区县区块 hover 高亮；
2. 点击区县 **下钻进入独立路由子页面** `/district/:name`。

原团队素材已获取，位于 `orignal-assets/datav-nanan/`（字体 61 个、图片 117 张、
装饰 SVG 23 个、视频、DataV 原始配置 `raw/config.json`、布局摘要
`layout-summary.json`、资源清单 `manifest.json` / `assets.csv`、本地预览页
`preview.html`）。

原站 12 个数据接口（`/index.php/api/jrtj/*`）响应已抓取快照，全部为省级维度数据。

## 已确认的决策

| 决策点 | 结论 |
|--------|------|
| 地图层级 | 重庆市区县区块（38 区县），非中国省级 |
| 数据来源 | 全部本地 mock（真实接口快照 + 区县级自造数据） |
| 下钻形态 | 独立路由子页 `/district/:name`，浏览器前进/后退可用 |
| 语言 | TypeScript |
| SVG 来源 | 脚本将阿里 Atlas 重庆区县 GeoJSON 投影转换为 SVG（A1） |
| 分辨率适配 | 固定 1920×1080 设计稿 + 容器 transform: scale() 等比缩放（B1，与原站一致） |

## 1. 技术栈与项目结构

Vue 3（`<script setup>`）+ Vite + TypeScript + vue-router 4 + ECharts 5。
不引入 Pinia：下钻状态即路由参数，无跨页共享状态。

```
cqbigscreen/
├── scripts/geojson-to-svg.mjs      # 一次性脚本：重庆区县 GeoJSON → GEO SVG
├── public/
│   └── maps/chongqing.svg          # 生成的地图（38 区县，path name=区县名）
├── src/
│   ├── main.ts / App.vue / router.ts
│   ├── styles/                     # fonts.css（@font-face）+ base.css
│   ├── assets/                     # 从 orignal-assets 精选拷贝的字体/图片
│   ├── types/index.ts              # 接口数据类型定义
│   ├── api/index.ts                # 数据层：读本地 mock，签名兼容真实 API
│   ├── mocks/                      # 12 个真实接口快照 + 区县级自造数据
│   ├── composables/useECharts.ts   # 图表初始化/resize/dispose 复用
│   ├── components/
│   │   ├── layout/  ScaleScreen.vue / HeaderBar.vue / PanelBox.vue
│   │   ├── panels/  KpiPanel / AmountTablePanel / QualityPanel / TechPanel /
│   │   │            OrgPanel / SocialPanel / InquiryPanel / DisposalPanel /
│   │   │            TrainingPanel
│   │   └── map/     ChongqingMap.vue（GEO SVG 地图，hover + 点击下钻）
│   └── views/
│       ├── HomeView.vue            # 主大屏
│       └── DistrictView.vue        # 区县下钻子页
└── docs/superpowers/specs/         # 本文档
```

## 2. 页面布局

### 主屏（复刻原站）

- 顶部标题栏："长嘉汇金融调解中心" + 英文副标 + 右侧日期时间（实时）
- 左上：KPI 翻牌数字两行共 6 项（累计调解案件 / 当事人可联案件 / 实际调成案件 /
  当月调解案件 / 累计履行金额 / 及时履行金额）
- 左下："案件 / 在调金额分布"滚动表（省份、案件、在调金额）
- 中间偏左：**重庆区县 GEO SVG 地图**（替换原站中国地图；保留飞线视觉元素，
  改为从南岸区发出到各区县的装饰性飞线）
- 中列：质效分析（全额还款/分期还款/示范调判/减少诉讼 4 指标 + 按省双色柱状图）、
  科技赋能（服务外呼/失联修复/情绪监测 tab + 累计/今日数字）、
  组织架构（特邀调解组织/调解人员/平均年龄/学历）、社会效果表（5 家调解中心）
- 右列：电询转办分析（累计电询/普通电询/无责投诉/有效投诉、累计转办/有效/无责 +
  询问/转办/有责三线折线图）、处置结果列表（事由/电询数量/处置措施）、
  合规培训&走访抽查滚动表
- 底部："指导监督单位：南岸区人民法院 南岸区司法局"

### 子页 `/district/:name`

同风格框架 + 面包屑返回按钮。左列：该区县 KPI；中间：同一张重庆 SVG 地图，
当前区县 select 高亮、其余区县降透明度；右列：该区县还款结构柱状图、
调解组织表、月度趋势折线图。面板组件全部复用主屏组件，仅换数据。

## 3. 地图交互（核心新功能）

- **注册**：fetch `public/maps/chongqing.svg` → `echarts.registerMap('chongqing',
  { svg })` → `geo: { map: 'chongqing' }`
- **hover**：`emphasis` 高亮填充（亮蓝渐变）+ 描边发光 + 区县名 label +
  tooltip（案件数、在调金额、调解组织数）
- **点击下钻**：geo click 事件 → `router.push('/district/' + name)`
- **子页高亮**：`geo.regions` 对当前区县设置 select/高亮样式，其余淡化
- **SVG 生成脚本**：d3-geo Mercator 投影，把阿里 DataV Atlas 重庆 GeoJSON
  （`500000_full.json`，38 区县）转成每区县一个 `<path name="区县名">` 的 SVG；
  脚本内置断言：生成的 38 个区县名与 mock 数据 key 严格一致，缺失或多余即报错退出

## 4. 数据层

- `src/mocks/` 存放已抓取的 12 个真实接口 JSON 快照：
  `dashboard_data`（KPI）、`tjzx_data`（调解质效）、`huankuan_list`（还款柱状图）、
  `kejifuneng_data`（科技赋能）、`zzgl_data`（组织架构）、`zuzhizhixiao_list`（社会效果）、
  `dx_data`（电询转办）、`dxmonth_list`（月度折线）、`chuzhi_list`（处置结果）、
  `hgpx_list`（合规培训）、`je_fenbu_list`（金额分布表）、`je_fenbu_map`（飞线）
- 新增区县级自造 mock：
  - `district_map.json`：38 区县的案件量/在调金额/调解组织数（地图着色 + tooltip）
  - `district_detail.json`：每区县 KPI、还款结构、组织列表、月度趋势（下钻页）
- `src/api/index.ts`：暴露 `getDashboardData()` / `getDistrictMapData()` /
  `getDistrictDetail(name)` 等异步函数，内部 import mock JSON + 模拟延迟，
  响应结构与真实接口一致（`{code, msg, time, data}`），后续切真实后端仅改此层

## 5. 视觉还原

- 字体：DIN-MediumItalic、DINCond-Bold、Bebas、YouSheBiaoTiHei、OPPOSans、
  Digital-7Mono 等从素材库拷贝 woff/woff2，`@font-face` 声明
- 图片：面板背景框、标题装饰、图标直接引用拷贝素材
- 配色（取自 layout-summary.json colors 统计）：纯黑背景、#2483FF / #008BFF /
  #00DEFF 蓝系主色、#edd892 金色强调、#90a3c8 / #a5bde5 次级文字
- KPI 数字翻牌：JS 递增动画还原 number-title-flop 效果
- 表格滚动：CSS animation 无缝滚动还原 carousel/progress-table

## 6. 错误处理

- mock / SVG 加载失败：对应面板显示占位错误态，不白屏
- 路由参数区县名不存在：子页显示"未找到该区县"并提供返回主屏入口

## 7. 验证与测试

- `vue-tsc --noEmit` 类型检查通过
- `npm run build` 构建成功
- dev server + headless browser（gstack browse）截图与原站逐屏对照
- 交互 QA：hover 高亮 → tooltip 内容 → 点击下钻 → 子页高亮 → 浏览器返回，
  全链路脚本驱动验证
- 不写常规单元测试（纯展示型大屏）；SVG 生成脚本自带区县名完整性断言

## 范围外（明确不做）

- 真实后端对接、登录鉴权
- 原站萤石云视频监控播放器（ez-player）：用静态占位图替代
- 原站"南海诸岛"小地图：随中国地图一并移除（地图已换为重庆区县）
- 移动端适配
