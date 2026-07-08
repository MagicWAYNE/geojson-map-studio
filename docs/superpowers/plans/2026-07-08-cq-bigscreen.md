# 重庆大屏复刻 + 区县地图下钻 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 Vue3 + Vite + TS + ECharts 复刻"长嘉汇金融调解中心"大屏（1920×1080），中间地图替换为重庆区县 GEO SVG 地图，支持 hover 高亮与点击下钻到 `/district/:name` 子页。

**Architecture:** 固定 1920×1080 设计稿 + 外层 scale 等比缩放（ScaleScreen）；所有面板绝对定位复刻原站坐标；数据层为本地 mock（12 个真实接口快照 + 脚本生成的区县数据），接口签名兼容真实后端；地图由一次性脚本将阿里 Atlas 重庆 GeoJSON 转成带 `name` 属性的 SVG，经 `echarts.registerMap` 渲染。

**Tech Stack:** Vue 3.5（`<script setup>` + TS strict）、Vite 6、vue-router 4（hash 模式）、ECharts 5.6、d3-geo（仅 node 脚本用）。

**设计文档:** `docs/superpowers/specs/2026-07-08-cq-bigscreen-design.md`
**视觉基准:** `docs/superpowers/reference/nanan-full.png`（原站整屏截图，逐面板对照它复刻）
**接口快照:** `orignal-assets/api-snapshots/*.json`（12 个真实接口响应，信封 `{code:1, msg, time, data}`）

## Global Constraints

- 画布固定 1920×1080，组件全部绝对定位（px 值来自原站 DataV 配置逆向，见各任务）
- 运行时零外网依赖：字体/图片/视频/SVG/数据全部本地（仅 `scripts/geojson-to-svg.mjs` 首跑联网下载 GeoJSON 并缓存入库）
- mock 响应信封 `{code: number, msg: string, time: string, data: T}`，`code === 1` 为成功
- 区县名以阿里 Atlas GeoJSON `properties.name` 为准，38 个，脚本断言 mock 与 SVG 严格一致
- 全局配色：背景 `#000`，主蓝 `#2483FF` / `#008BFF` / `#00DEFF`，金色 `#edd892`，次级文字 `#90a3c8` / `#a5bde5`
- 字体：标题 `YouSheBiaoTiHei`，正文 `OPPOSans-R`，数字 `Bebas`
- 每任务结束：`npx vue-tsc --noEmit` 零错误（Task 1 起），git commit
- 无常规单元测试（纯展示大屏，spec 决议）；数据完整性由脚本断言保证，视觉/交互由最终 QA 任务验证
- 原站隐藏组件（宽趋势图组、仪表盘、横向柱图、tab 备用面板）**不复刻**

## 最终文件结构

```
cqbigscreen/
├── package.json  vite.config.ts  tsconfig.json  index.html  .gitignore
├── scripts/
│   ├── districts.mjs               # 38 区县名（唯一权威清单，两脚本共用）
│   ├── gen-district-mocks.mjs      # 生成区县 mock（种子随机，可复跑）
│   ├── geojson-to-svg.mjs          # GeoJSON → SVG + 质心坐标，含名称断言
│   └── data/chongqing.geo.json     # GeoJSON 缓存（入库，离线可复跑）
├── public/maps/chongqing.svg
├── src/
│   ├── main.ts  App.vue  router.ts  vite-env.d.ts
│   ├── styles/fonts.css  styles/base.css
│   ├── assets/fonts|images|svg|video/   # 从 orignal-assets 精选拷贝（干净命名）
│   ├── types/index.ts
│   ├── api/index.ts
│   ├── mocks/*.json                # 12 快照 + district_map + district_detail + district_centroids
│   ├── composables/useECharts.ts
│   ├── utils/chartOptions.ts       # 双柱/多折线 option 构造器（主屏与子页共用）
│   ├── components/
│   │   ├── layout/ScaleScreen.vue  HeaderBar.vue  SectionTitle.vue  SubTitle.vue
│   │   ├── common/NumberFlop.vue  ScrollTable.vue
│   │   ├── panels/KpiPanel.vue  AmountTablePanel.vue  QualityPanel.vue  TechPanel.vue
│   │   │        OrgPanel.vue  SocialPanel.vue  InquiryPanel.vue  DisposalPanel.vue  TrainingPanel.vue
│   │   └── map/ChongqingMap.vue
│   └── views/HomeView.vue  DistrictView.vue
```

## 主屏绝对布局速查（来自 DataV 配置逆向 + 截图核对）

| 区块 | left | top | w | h |
|---|---|---|---|---|
| HeaderBar（视频+标题条+时钟+全屏） | 0 | 0 | 1920 | 174 |
| KPI 区（两行 6 项） | 36 | 143 | 748 | 178 |
| 重庆地图 | 40 | 320 | 800 | 680 |
| 金额分布表（含小标题） | 36 | 812 | 360 | 215 |
| 质效分析大标题 | 868 | 129 | 492 | 60 |
| 质效分析面板 | 868 | 195 | 492 | 380 |
| 科技赋能面板 | 868 | 580 | 492 | 100 |
| 组织架构面板 | 868 | 684 | 492 | 88 |
| 社会效果面板 | 868 | 776 | 492 | 266 |
| 电询转办分析大标题 | 1394 | 129 | 492 | 60 |
| 电询转办面板 | 1394 | 195 | 492 | 360 |
| 处置结果面板 | 1394 | 555 | 492 | 312 |
| 合规培训区（大标题+表） | 1394 | 871 | 492 | 171 |
| 底部指导单位 | 0 | 1052 | 1920 | 24 |

---

### Task 1: 项目脚手架与静态资源入库

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `.gitignore`, `src/vite-env.d.ts`
- Create: `src/main.ts`, `src/App.vue`, `src/router.ts`
- Create: `src/styles/fonts.css`, `src/styles/base.css`
- Create: `src/components/layout/ScaleScreen.vue`
- Create: `src/views/HomeView.vue`（占位）, `src/views/DistrictView.vue`（占位）
- Create: `src/assets/fonts|images|svg|video/`（拷贝自 orignal-assets，重命名）

**Interfaces:**
- Consumes: `orignal-assets/datav-nanan/assets/`（素材源）
- Produces: 可运行的 Vite 应用骨架；`@` → `src` 别名；干净命名的静态资源（后续任务按下方映射表引用）；路由 `/` 与 `/district/:name`

- [ ] **Step 1: 写 .gitignore**

```gitignore
node_modules
dist
*.local
.DS_Store
.gstack/
```

- [ ] **Step 2: 写 package.json**

```json
{
  "name": "cqbigscreen",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "vue-tsc --noEmit",
    "gen:mocks": "node scripts/gen-district-mocks.mjs",
    "gen:map": "node scripts/geojson-to-svg.mjs"
  },
  "dependencies": {
    "echarts": "^5.6.0",
    "vue": "^3.5.13",
    "vue-router": "^4.5.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.2.1",
    "d3-geo": "^3.1.1",
    "typescript": "~5.7.2",
    "vite": "^6.0.7",
    "vue-tsc": "^2.2.0"
  }
}
```

- [ ] **Step 3: 写 vite.config.ts / tsconfig.json / index.html / src/vite-env.d.ts**

`vite.config.ts`:
```ts
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  }
})
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noEmit": true,
    "jsx": "preserve",
    "resolveJsonModule": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] },
    "types": ["vite/client"]
  },
  "include": ["src/**/*.ts", "src/**/*.vue", "src/**/*.d.ts"]
}
```

`index.html`:
```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>长嘉汇金融调解中心</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
```

- [ ] **Step 4: 拷贝静态资源（重命名为语义化文件名）**

先校验源文件存在（任何一个 cp 报错即停下排查 `orignal-assets/datav-nanan/assets/` 下的实际文件名，不要跳过）：

```bash
cd /Users/fei/cqbigscreen
mkdir -p src/assets/fonts src/assets/images src/assets/svg src/assets/video public/maps
SRC=orignal-assets/datav-nanan/assets
# 字体（4 个，woff）
cp $SRC/fonts/OPPOSans-R-570e2894ac.woff       src/assets/fonts/OPPOSans-R.woff
cp $SRC/fonts/OPPOSans-M-f70ed804fd.woff       src/assets/fonts/OPPOSans-M.woff
cp $SRC/fonts/Bebas-86f47c1689.woff            src/assets/fonts/Bebas.woff
cp $SRC/fonts/YouSheBiaoTiHei-33628abb31.woff  src/assets/fonts/YouSheBiaoTiHei.woff
# 全局背景 / 顶栏
cp $SRC/images/c55bb5a1d8dea6e76f25ff4debd20b2f-2d95bc085c.png src/assets/images/bg-main.png
cp $SRC/images/fc392581614d0845949f44e2ac8ef17a-9e613fb557.png src/assets/images/bg-terrain.png
cp $SRC/images/03091049bfd09a9d10c3cedb5a6b6dac-adbbbd9d4a.png src/assets/images/header-bar.png
cp $SRC/video/hc3-8af7a2cd3c.webm                              src/assets/video/header-bg.webm
# 面板装饰
cp $SRC/images/49b4b982e4d66d08c256076e446cb9bc-a23ed94653.png src/assets/images/section-bar.png
cp $SRC/images/e5fcf27ddd1dbc43d18ad117a93b6b1d-c29f828e55.png src/assets/images/glow.png
cp $SRC/images/3616bc093bc26704038c5ee65613cbda-82a9e4db18.png src/assets/images/corner-tag.png
# 图标（144×144 蓝色系；分配到面板的对应关系在最终 QA 任务里按截图微调）
cp $SRC/images/aceab51663646d6f5240d58c6a25c8f8-21d5a71c43.png src/assets/images/icon-kpi-case.png
cp $SRC/images/4459add436eb8cdcb9457c65518f92d7-d1d845eaef.png src/assets/images/icon-kpi-money.png
cp $SRC/images/05ad366638f7b904403a888d0a0aadda-d711cf0ab5.png src/assets/images/icon-quality-1.png
cp $SRC/images/1358fe34a338a9ce5f8cc46fc078c757-8c0e1e8bd3.png src/assets/images/icon-quality-2.png
cp $SRC/images/05213dcb89f2eba36b30e7d7b6a4648e-acd9971780.png src/assets/images/icon-quality-3.png
cp $SRC/images/c3d1065de77d53434296294e701167bf-4496cce628.png src/assets/images/icon-quality-4.png
cp $SRC/images/9d4e2707f633dd25aa7398fd4aab49f2-391e57c6d6.png src/assets/images/icon-tech.png
cp $SRC/images/bb39c7c9575bba6e47a29a1ed0eaf2c4-c012c67599.png src/assets/images/icon-org.png
cp $SRC/images/6c0e6a45e57d6d1e5a6b9ebac8ad2ac8-73fa0f3de7.png src/assets/images/icon-inquiry.png
cp $SRC/images/58b2467b69a022f3d5eeb463175de883-dd9624f5f7.png src/assets/images/icon-small-1.png
cp $SRC/images/0659c8c9abcaf46bdbc42c1ff3fa16f7-1c67ef6065.png src/assets/images/icon-small-2.png
cp $SRC/images/0938e4947346fe510ef0073fcfb1d737-8b0f157341.png src/assets/images/fullscreen-in.png
cp $SRC/images/0a33ce6402ca41b562b1c81e6b4f8376-966ea90c3f.png src/assets/images/fullscreen-out.png
# 装饰 SVG
cp $SRC/svg/97eda9adc82ab3dd76fce9a07bffb993-1810e7a1e1.svg src/assets/svg/arrow.svg
cp $SRC/svg/76f1f0ab5f333f3a1f098276f291c3c2-9a16135e38.svg src/assets/svg/rank-1.svg
cp $SRC/svg/872bb5f4a88906c76f202e42aed9d93a-bd70962ae4.svg src/assets/svg/rank-2.svg
cp $SRC/svg/bee160127913725572262e8c9bd51833-5097736b79.svg src/assets/svg/rank-3.svg
ls src/assets/fonts src/assets/images src/assets/svg src/assets/video
```
Expected: 无 cp 报错；ls 显示 4 字体 + 21 图片 + 4 svg + 1 视频。

- [ ] **Step 5: 写样式**

`src/styles/fonts.css`:
```css
@font-face { font-family: 'YouSheBiaoTiHei'; src: url('../assets/fonts/YouSheBiaoTiHei.woff') format('woff'); font-display: swap; }
@font-face { font-family: 'OPPOSans-R'; src: url('../assets/fonts/OPPOSans-R.woff') format('woff'); font-display: swap; }
@font-face { font-family: 'OPPOSans-M'; src: url('../assets/fonts/OPPOSans-M.woff') format('woff'); font-display: swap; }
@font-face { font-family: 'Bebas'; src: url('../assets/fonts/Bebas.woff') format('woff'); font-display: swap; }
```

`src/styles/base.css`:
```css
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body, #app { width: 100%; height: 100%; overflow: hidden; }
body { background: #000; color: #fff; font-family: 'OPPOSans-R', 'Microsoft Yahei', sans-serif; }
img { display: block; user-select: none; -webkit-user-drag: none; }
ul, ol { list-style: none; }
```

- [ ] **Step 6: 写应用骨架**

`src/main.ts`:
```ts
import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import './styles/fonts.css'
import './styles/base.css'

createApp(App).use(router).mount('#app')
```

`src/App.vue`:
```vue
<script setup lang="ts">
import ScaleScreen from '@/components/layout/ScaleScreen.vue'
</script>

<template>
  <ScaleScreen>
    <router-view />
  </ScaleScreen>
</template>
```

`src/router.ts`:
```ts
import { createRouter, createWebHashHistory } from 'vue-router'

export default createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
    { path: '/district/:name', name: 'district', component: () => import('@/views/DistrictView.vue'), props: true },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})
```

`src/components/layout/ScaleScreen.vue`:
```vue
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const scale = ref(1)
function update() {
  scale.value = Math.min(window.innerWidth / 1920, window.innerHeight / 1080)
}
onMounted(() => {
  update()
  window.addEventListener('resize', update)
})
onUnmounted(() => window.removeEventListener('resize', update))
</script>

<template>
  <div class="screen-wrapper">
    <div class="screen" :style="{ transform: `scale(${scale})` }">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.screen-wrapper {
  width: 100vw; height: 100vh; background: #000;
  overflow: hidden; display: flex; align-items: center; justify-content: center;
}
.screen {
  width: 1920px; height: 1080px; flex: none;
  transform-origin: center center; position: relative;
}
</style>
```

`src/views/HomeView.vue`（占位，Task 6 重写）:
```vue
<template>
  <div style="padding: 200px; font-size: 40px">主屏占位</div>
</template>
```

`src/views/DistrictView.vue`（占位，Task 13 重写）:
```vue
<script setup lang="ts">
defineProps<{ name: string }>()
</script>

<template>
  <div style="padding: 200px; font-size: 40px">区县占位：{{ name }}</div>
</template>
```

- [ ] **Step 7: 安装依赖并验证**

```bash
cd /Users/fei/cqbigscreen && npm install && npx vue-tsc --noEmit
```
Expected: 安装成功；vue-tsc 无输出、退出码 0。

```bash
npm run dev & SERVER_PID=$!; sleep 3; curl -s http://localhost:5173/ | grep -o '<title>[^<]*</title>'; kill $SERVER_PID
```
Expected: 输出 `<title>长嘉汇金融调解中心</title>`。

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: Vue3+Vite+TS 脚手架与静态资源入库

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: 类型定义 + 接口快照 mock + 数据层

**Files:**
- Create: `src/types/index.ts`
- Create: `src/mocks/`（拷贝 12 个接口快照）
- Create: `src/api/index.ts`

**Interfaces:**
- Consumes: `orignal-assets/api-snapshots/*.json`
- Produces（后续所有面板任务依赖的确切签名）:
  - `getDashboardData(): Promise<DashboardData>`
  - `getTjzxData(): Promise<TjzxData>`
  - `getHuankuanList(): Promise<XYItem[]>`
  - `getKejifunengData(): Promise<KejifunengItem[]>`
  - `getZzglData(): Promise<ZzglData>`
  - `getZuzhizhixiaoList(): Promise<ZuzhizhixiaoItem[]>`
  - `getDxData(): Promise<DxData>`
  - `getDxmonthList(): Promise<XYItem[]>`
  - `getChuzhiList(): Promise<ChuzhiItem[]>`
  - `getHgpxList(): Promise<HgpxItem[]>`
  - `getJeFenbuList(): Promise<JeFenbuItem[]>`
  - 类型 `ApiEnvelope<T>`、`XYItem { x: string; y: number; colorField: string }` 等（见下）

- [ ] **Step 1: 拷贝接口快照**

```bash
cd /Users/fei/cqbigscreen && mkdir -p src/mocks && cp orignal-assets/api-snapshots/*.json src/mocks/ && ls src/mocks
```
Expected: 12 个 json（dashboard_data / tjzx_data / huankuan_list / kejifuneng_data / zzgl_data / zuzhizhixiao_list / dx_data / dxmonth_list / chuzhi_list / hgpx_list / je_fenbu_list / je_fenbu_map）。

- [ ] **Step 2: 写 src/types/index.ts**

```ts
export interface ApiEnvelope<T> {
  code: number
  msg: string
  time: string
  data: T
}

/** dashboard_data —— 左上 KPI（数值为字符串，单位万件/万元） */
export interface DashboardData {
  tj_year_tj: string
  tj_year_kl: string
  tj_year_tc: string
  tj_month_tj: string
  tj_year_yx: string
  tj_month_yx: string
  tj_dss: string
}

/** tjzx_data —— 质效分析 4 指标 */
export interface TjzxData {
  tjzx_qe: string
  tjzx_fq: string
  tjzx_ss: string
  tjzx_qr: string
}

/** huankuan_list / dxmonth_list / 区县 huankuan、trend 通用行 */
export interface XYItem {
  x: string
  y: number
  colorField: string
}

export interface KejifunengChild {
  mc: string
  mc1: string
  dw: string
  dw1: string
  lj: string
  jr: string
}

/** kejifuneng_data —— 科技赋能 3 个 tab（content: 外呼/失联修复/情绪监控） */
export interface KejifunengItem {
  id: number
  content: string
  imgSrc: string
  child: KejifunengChild
}

/** zzgl_data —— 组织架构 */
export interface ZzglData {
  zzgl_zz: string
  zzgl_ry: string
  zzgl_nl: string
  zzgl_xl: string
}

/** zuzhizhixiao_list —— 社会效果表行 */
export interface ZuzhizhixiaoItem {
  id: number
  lx: string
  bwt: number
  rs: number
  bl: string
  dx: number
}

/** dx_data —— 电询转办分析 7 个数字 */
export interface DxData {
  dx_zx_year: string
  dx_zx_xw: string
  dx_zx_ts: string
  dx_zx_yz: string
  dx_yn_year: string
  dx_yn_yz: string
  dx_yn_wz: string
}

/** chuzhi_list —— 处置结果行 */
export interface ChuzhiItem {
  zb: number
  sl: number
  lx: string
  base: number
  czjg: string
  dw: string
  img: string
}

/** hgpx_list —— 合规培训行 */
export interface HgpxItem {
  zt: string
  rs: number
  rq: string
}

/** je_fenbu_list —— 金额分布表行 */
export interface JeFenbuItem {
  nf: string
  city: string
  aj: number
  ztje: number
}

/** 区县地图着色/tooltip 数据（脚本生成） */
export interface DistrictMapItem {
  name: string
  aj: number
  ztje: number
  zzs: number
}

export interface DistrictKpi {
  tj: string
  kl: string
  tc: string
  month_tj: string
  yx: string
  month_yx: string
}

export interface DistrictOrg {
  lx: string
  rs: number
  dx: number
  bwt: number
  bl: string
}

/** 区县下钻详情（脚本生成） */
export interface DistrictDetail {
  kpi: DistrictKpi
  huankuan: XYItem[]
  trend: XYItem[]
  orgs: DistrictOrg[]
}

/** ScrollTable 列定义（放此处而非 .vue 内：<script setup> 不允许具名导出） */
export interface ScrollColumn {
  key: string
  title: string
  width: string
  align?: 'left' | 'center' | 'right'
  color?: string
}
```

- [ ] **Step 3: 写 src/api/index.ts**

（`getDistrictMapData` / `getDistrictDetail` 在 Task 3 生成 json 后追加，本任务先只写 11 个快照 getter；`je_fenbu_map` 是原站中国地图飞线数据，新地图不用，不暴露 getter，文件仅存档。）

```ts
import type {
  ApiEnvelope, ChuzhiItem, DashboardData, DxData, HgpxItem, JeFenbuItem,
  KejifunengItem, TjzxData, XYItem, ZuzhizhixiaoItem, ZzglData
} from '@/types'
import dashboardRaw from '@/mocks/dashboard_data.json'
import tjzxRaw from '@/mocks/tjzx_data.json'
import huankuanRaw from '@/mocks/huankuan_list.json'
import kejifunengRaw from '@/mocks/kejifuneng_data.json'
import zzglRaw from '@/mocks/zzgl_data.json'
import zuzhizhixiaoRaw from '@/mocks/zuzhizhixiao_list.json'
import dxRaw from '@/mocks/dx_data.json'
import dxmonthRaw from '@/mocks/dxmonth_list.json'
import chuzhiRaw from '@/mocks/chuzhi_list.json'
import hgpxRaw from '@/mocks/hgpx_list.json'
import jeFenbuRaw from '@/mocks/je_fenbu_list.json'

/** 模拟网络延迟，保持异步接口形态与真实后端一致 */
const delay = (ms = 120) => new Promise<void>((r) => setTimeout(r, ms))

function unwrap<T>(raw: unknown): T {
  const env = raw as ApiEnvelope<T>
  if (env.code !== 1) throw new Error(env.msg || 'mock 数据错误')
  return env.data
}

export async function getDashboardData(): Promise<DashboardData> {
  await delay()
  return unwrap<DashboardData>(dashboardRaw)
}

export async function getTjzxData(): Promise<TjzxData> {
  await delay()
  return unwrap<TjzxData>(tjzxRaw)
}

export async function getHuankuanList(): Promise<XYItem[]> {
  await delay()
  return unwrap<XYItem[]>(huankuanRaw)
}

export async function getKejifunengData(): Promise<KejifunengItem[]> {
  await delay()
  return unwrap<KejifunengItem[]>(kejifunengRaw)
}

export async function getZzglData(): Promise<ZzglData> {
  await delay()
  return unwrap<ZzglData>(zzglRaw)
}

export async function getZuzhizhixiaoList(): Promise<ZuzhizhixiaoItem[]> {
  await delay()
  return unwrap<ZuzhizhixiaoItem[]>(zuzhizhixiaoRaw)
}

export async function getDxData(): Promise<DxData> {
  await delay()
  return unwrap<DxData>(dxRaw)
}

export async function getDxmonthList(): Promise<XYItem[]> {
  await delay()
  return unwrap<XYItem[]>(dxmonthRaw)
}

export async function getChuzhiList(): Promise<ChuzhiItem[]> {
  await delay()
  return unwrap<ChuzhiItem[]>(chuzhiRaw)
}

export async function getHgpxList(): Promise<HgpxItem[]> {
  await delay()
  return unwrap<HgpxItem[]>(hgpxRaw)
}

export async function getJeFenbuList(): Promise<JeFenbuItem[]> {
  await delay()
  return unwrap<JeFenbuItem[]>(jeFenbuRaw)
}
```

- [ ] **Step 4: 验证**

```bash
cd /Users/fei/cqbigscreen && npx vue-tsc --noEmit
```
Expected: 无输出，退出码 0。

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: 类型定义 + 12 个真实接口快照 mock + api 数据层

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: 区县 mock 生成脚本

**Files:**
- Create: `scripts/districts.mjs`
- Create: `scripts/gen-district-mocks.mjs`
- Create: `src/mocks/district_map.json`（脚本生成后入库）
- Create: `src/mocks/district_detail.json`（脚本生成后入库）
- Modify: `src/api/index.ts`（追加 2 个 getter）

**Interfaces:**
- Consumes: `DistrictMapItem` / `DistrictDetail` / `XYItem` 类型（Task 2）
- Produces:
  - `scripts/districts.mjs` 导出 `export const DISTRICTS: string[]`（38 项，唯一权威清单，Task 4 复用）
  - `getDistrictMapData(): Promise<DistrictMapItem[]>`
  - `getDistrictDetail(name: string): Promise<DistrictDetail | null>`

- [ ] **Step 1: 写 scripts/districts.mjs**

38 个区县名，必须与阿里 Atlas GeoJSON `properties.name` 逐字一致（Task 4 脚本会断言）：

```js
/** 重庆市 38 区县（与阿里 DataV Atlas 500000_full.json 的 properties.name 严格一致） */
export const DISTRICTS = [
  '万州区', '涪陵区', '渝中区', '大渡口区', '江北区', '沙坪坝区', '九龙坡区', '南岸区',
  '北碚区', '綦江区', '大足区', '渝北区', '巴南区', '黔江区', '长寿区', '江津区',
  '合川区', '永川区', '南川区', '璧山区', '铜梁区', '潼南区', '荣昌区', '开州区',
  '梁平区', '武隆区', '城口县', '丰都县', '垫江县', '忠县', '云阳县', '奉节县',
  '巫山县', '巫溪县', '石柱土家族自治县', '秀山土家族苗族自治县', '酉阳土家族苗族自治县',
  '彭水苗族土家族自治县'
]
```

- [ ] **Step 2: 写 scripts/gen-district-mocks.mjs**

种子随机（mulberry32），同一输入永远生成同一输出，可复跑：

```js
import { mkdirSync, writeFileSync } from 'node:fs'
import { DISTRICTS } from './districts.mjs'

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月']
const map = []
const detail = {}

DISTRICTS.forEach((name, i) => {
  const rnd = mulberry32(i + 1)
  const aj = Math.round(3000 + rnd() * 90000)
  const ztje = Math.round(aj * (1.8 + rnd() * 1.5) * 100) / 100
  const zzs = 1 + Math.floor(rnd() * 8)
  map.push({ name, aj, ztje, zzs })

  const tj = aj / 10000
  const kpi = {
    tj: tj.toFixed(2),
    kl: (tj * (0.28 + rnd() * 0.1)).toFixed(2),
    tc: (tj * (0.1 + rnd() * 0.05)).toFixed(2),
    month_tj: (tj * (0.05 + rnd() * 0.03)).toFixed(2),
    yx: (ztje * (0.35 + rnd() * 0.15)).toFixed(2),
    month_yx: (ztje * (0.02 + rnd() * 0.02)).toFixed(2)
  }
  const huankuan = MONTHS.flatMap((m) => [
    { x: m, y: Math.round(aj * (0.01 + rnd() * 0.02)), colorField: '全额还款' },
    { x: m, y: Math.round(aj * (0.05 + rnd() * 0.08)), colorField: '分期还款' }
  ])
  const trend = MONTHS.flatMap((m) => [
    { x: m, y: Math.round(30 + rnd() * 260), colorField: '询问' },
    { x: m, y: Math.round(rnd() * 30), colorField: '转办' },
    { x: m, y: Math.round(rnd() * 8), colorField: '有责' }
  ])
  const orgs = Array.from({ length: 2 + Math.floor(rnd() * 3) }, (_, k) => {
    const bwt = Math.round(aj * (0.1 + rnd() * 0.3))
    const dx = Math.round(bwt * (0.001 + rnd() * 0.002))
    return {
      lx: `${name}调解工作站${k + 1}`,
      rs: 3 + Math.floor(rnd() * 60),
      dx,
      bwt,
      bl: `${((dx / bwt) * 100).toFixed(2)}%`
    }
  })
  detail[name] = { kpi, huankuan, trend, orgs }
})

if (map.length !== 38 || Object.keys(detail).length !== 38) {
  console.error(`区县数量错误: map=${map.length} detail=${Object.keys(detail).length}，应为 38`)
  process.exit(1)
}

mkdirSync('src/mocks', { recursive: true })
writeFileSync('src/mocks/district_map.json', JSON.stringify(map, null, 2))
writeFileSync('src/mocks/district_detail.json', JSON.stringify(detail, null, 2))
console.log(`OK: district_map ${map.length} 条, district_detail ${Object.keys(detail).length} 键`)
```

- [ ] **Step 3: 运行生成**

```bash
cd /Users/fei/cqbigscreen && npm run gen:mocks
```
Expected: `OK: district_map 38 条, district_detail 38 键`；`src/mocks/district_map.json`、`src/mocks/district_detail.json` 生成。

- [ ] **Step 4: api 层追加区县 getter（src/api/index.ts 末尾追加）**

```ts
import districtMapRaw from '@/mocks/district_map.json'
import districtDetailRaw from '@/mocks/district_detail.json'
import type { DistrictDetail, DistrictMapItem } from '@/types'

export async function getDistrictMapData(): Promise<DistrictMapItem[]> {
  await delay()
  return districtMapRaw as DistrictMapItem[]
}

export async function getDistrictDetail(name: string): Promise<DistrictDetail | null> {
  await delay()
  const all = districtDetailRaw as unknown as Record<string, DistrictDetail>
  return all[name] ?? null
}
```

注意：import 语句合并到文件顶部既有 import 区（`DistrictDetail`、`DistrictMapItem` 并入既有的 `@/types` type import）。

- [ ] **Step 5: 验证**

```bash
cd /Users/fei/cqbigscreen && npx vue-tsc --noEmit && npm run gen:mocks && git diff --stat src/mocks
```
Expected: vue-tsc 通过；复跑 gen:mocks 后 `git diff` 无变化（确定性验证）。

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: 区县级 mock 生成脚本与数据（38 区县，种子随机可复跑）

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: GeoJSON → GEO SVG 地图生成

**Files:**
- Create: `scripts/geojson-to-svg.mjs`
- Create: `scripts/data/chongqing.geo.json`（首跑下载缓存，入库）
- Create: `public/maps/chongqing.svg`（生成，入库）
- Create: `src/mocks/district_centroids.json`（生成，入库）

**Interfaces:**
- Consumes: `scripts/districts.mjs` 的 `DISTRICTS`（断言用）；`https://geo.datav.aliyun.com/areas_v3/bound/500000_full.json`（仅首跑联网）
- Produces:
  - `public/maps/chongqing.svg`：viewBox `0 0 1000 950`，38 个 `<path name="区县名" d="...">`
  - `src/mocks/district_centroids.json`：`Record<string, [number, number]>`，SVG 用户坐标系下各区县质心（Task 12 飞线/涟漪点用）

- [ ] **Step 1: 写 scripts/geojson-to-svg.mjs**

```js
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { geoMercator, geoPath } from 'd3-geo'
import { DISTRICTS } from './districts.mjs'

const CACHE = 'scripts/data/chongqing.geo.json'
const SOURCE = 'https://geo.datav.aliyun.com/areas_v3/bound/500000_full.json'
const W = 1000
const H = 950
const PAD = 20

let geojson
if (existsSync(CACHE)) {
  geojson = JSON.parse(readFileSync(CACHE, 'utf8'))
} else {
  const res = await fetch(SOURCE)
  if (!res.ok) throw new Error(`GeoJSON 下载失败: HTTP ${res.status}`)
  geojson = await res.json()
  mkdirSync('scripts/data', { recursive: true })
  writeFileSync(CACHE, JSON.stringify(geojson))
  console.log(`已缓存 GeoJSON → ${CACHE}`)
}

// 名称断言：GeoJSON 区县名与 DISTRICTS（mock 数据 key）双向一致
const names = geojson.features.map((f) => f.properties.name)
const got = new Set(names)
const want = new Set(DISTRICTS)
const missing = DISTRICTS.filter((n) => !got.has(n))
const extra = names.filter((n) => !want.has(n))
if (missing.length || extra.length) {
  console.error('区县名不一致！', JSON.stringify({ missing, extra }, null, 2))
  process.exit(1)
}

const projection = geoMercator().fitExtent([[PAD, PAD], [W - PAD, H - PAD]], geojson)
const path = geoPath(projection)

const paths = geojson.features
  .map((f) => `  <path name="${f.properties.name}" d="${path(f)}" />`)
  .join('\n')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">\n${paths}\n</svg>\n`
mkdirSync('public/maps', { recursive: true })
writeFileSync('public/maps/chongqing.svg', svg)

const centroids = {}
for (const f of geojson.features) {
  const [cx, cy] = path.centroid(f)
  centroids[f.properties.name] = [Math.round(cx * 10) / 10, Math.round(cy * 10) / 10]
}
writeFileSync('src/mocks/district_centroids.json', JSON.stringify(centroids, null, 2))

console.log(`OK: ${names.length} 区县 → public/maps/chongqing.svg + src/mocks/district_centroids.json`)
```

- [ ] **Step 2: 运行并验证**

```bash
cd /Users/fei/cqbigscreen && npm run gen:map
```
Expected: `OK: 38 区县 → ...`。若名称断言失败会打印 missing/extra 并退出码 1 —— 此时以 GeoJSON 实际名称为准修正 `scripts/districts.mjs`（同时必须复跑 `npm run gen:mocks` 保持 mock key 同步），不许反向改 GeoJSON。

```bash
grep -c '<path name=' public/maps/chongqing.svg && python3 -c "import json; c=json.load(open('src/mocks/district_centroids.json')); print(len(c), c['南岸区'])"
```
Expected: `38`；`38 [x, y]`（南岸区质心坐标，x∈(0,1000)、y∈(0,950)）。

- [ ] **Step 3: 浏览器肉眼验证 SVG**

```bash
open public/maps/chongqing.svg
```
Expected: 重庆市轮廓（形似"人"字形/鸡腿状），38 个区县闭合区块，无破碎路径。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: 重庆区县 GeoJSON→SVG 生成脚本、地图 SVG 与质心坐标

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: ECharts composable、图表 option 构造器与公共组件

**Files:**
- Create: `src/composables/useECharts.ts`
- Create: `src/utils/chartOptions.ts`
- Create: `src/components/common/NumberFlop.vue`
- Create: `src/components/common/ScrollTable.vue`
- Create: `src/components/layout/HeaderBar.vue`
- Create: `src/components/layout/SectionTitle.vue`
- Create: `src/components/layout/SubTitle.vue`

**Interfaces:**
- Consumes: `XYItem`（Task 2）、静态资源（Task 1）
- Produces（面板任务依赖的确切签名）:
  - `useECharts(el: Ref<HTMLElement | null>): { chart: ShallowRef<echarts.ECharts | null>; setOption(option: EChartsOption, notMerge?: boolean): void }`
  - `buildDoubleBarOption(list: XYItem[], opts?: { xLabelInterval?: number }): EChartsOption` —— 蓝/金双系列柱状图，系列名取自 colorField 去重（顺序保留）
  - `buildMultiLineOption(list: XYItem[], seriesColors: Record<string, string>, opts?: { areaSeries?: string }): EChartsOption` —— 多折线，指定系列可带渐变面积
  - `NumberFlop` props: `{ value: number; decimals?: number; duration?: number; fontSize?: number; color?: string }`
  - `ScrollTable` props: `{ columns: ScrollColumn[]; rows: Record<string, unknown>[]; height: number; rowHeight?: number; scroll?: boolean }`，`ScrollColumn`（定义于 `@/types`，见 Task 2 补充）
  - `SectionTitle` props: `{ title: string }`（492×60 大标题条）
  - `SubTitle` props: `{ title: string; extra?: string; width?: number }`（20px 高二级标题行）
  - `HeaderBar`：无 props（视频+标题条+实时时钟+全屏按钮）

- [ ] **Step 1: 写 src/composables/useECharts.ts**

```ts
import * as echarts from 'echarts'
import { onBeforeUnmount, onMounted, shallowRef, type Ref } from 'vue'
import type { EChartsOption } from 'echarts'

/**
 * 图表生命周期管理：挂载初始化、容器尺寸自适应、卸载销毁。
 * setOption 在图表尚未初始化时暂存 option，初始化后自动应用（数据先于挂载到达的场景）。
 */
export function useECharts(el: Ref<HTMLElement | null>) {
  const chart = shallowRef<echarts.ECharts | null>(null)
  let ro: ResizeObserver | null = null
  let pending: EChartsOption | null = null
  let pendingNotMerge = false

  onMounted(() => {
    if (!el.value) return
    chart.value = echarts.init(el.value)
    if (pending) {
      chart.value.setOption(pending, { notMerge: pendingNotMerge })
      pending = null
    }
    ro = new ResizeObserver(() => chart.value?.resize())
    ro.observe(el.value)
  })

  onBeforeUnmount(() => {
    ro?.disconnect()
    chart.value?.dispose()
    chart.value = null
  })

  function setOption(option: EChartsOption, notMerge = false) {
    if (chart.value) {
      chart.value.setOption(option, { notMerge })
    } else {
      pending = option
      pendingNotMerge = notMerge
    }
  }

  return { chart, setOption }
}
```

- [ ] **Step 2: 写 src/utils/chartOptions.ts**

```ts
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import type { XYItem } from '@/types'

const AXIS_LABEL = { color: '#90a3c8', fontSize: 12, fontFamily: 'OPPOSans-R' }
const SPLIT_LINE = { lineStyle: { color: 'rgba(144,163,200,0.15)' } }

/** colorField 去重（保留首次出现顺序）作为系列名 */
function seriesNames(list: XYItem[]): string[] {
  return [...new Set(list.map((i) => i.colorField))]
}

function categories(list: XYItem[]): string[] {
  return [...new Set(list.map((i) => i.x))]
}

function seriesData(list: XYItem[], name: string, cats: string[]): number[] {
  return cats.map((c) => list.find((i) => i.x === c && i.colorField === name)?.y ?? 0)
}

/** 蓝/金双系列柱状图（质效分析·还款结构） */
export function buildDoubleBarOption(list: XYItem[], opts: { xLabelInterval?: number } = {}): EChartsOption {
  const cats = categories(list)
  const names = seriesNames(list)
  const gradients: [string, string][] = [
    ['#75a4ff', 'rgba(25,82,191,0.05)'],
    ['#ffc65e', 'rgba(255,198,94,0.05)']
  ]
  return {
    legend: {
      top: 0, right: 8, itemWidth: 10, itemHeight: 10, itemGap: 18,
      textStyle: { color: '#a5bde5', fontSize: 12, fontFamily: 'OPPOSans-R' }
    },
    grid: { left: 8, right: 8, top: 30, bottom: 2, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(6,18,40,0.92)', borderColor: '#2483FF',
      textStyle: { color: '#fff', fontSize: 12 }
    },
    xAxis: {
      type: 'category', data: cats,
      axisLabel: { ...AXIS_LABEL, interval: opts.xLabelInterval ?? 0 },
      axisLine: { lineStyle: { color: 'rgba(144,163,200,0.3)' } },
      axisTick: { show: false }
    },
    yAxis: { type: 'value', axisLabel: AXIS_LABEL, splitLine: SPLIT_LINE },
    series: names.map((nm, idx) => ({
      name: nm, type: 'bar' as const, barWidth: 5, barGap: '60%',
      data: seriesData(list, nm, cats),
      itemStyle: {
        borderRadius: [2, 2, 0, 0],
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: gradients[idx % 2][0] },
          { offset: 1, color: gradients[idx % 2][1] }
        ])
      }
    }))
  }
}

/** 多折线图（电询转办·月度趋势），areaSeries 指定的系列带渐变面积 */
export function buildMultiLineOption(
  list: XYItem[],
  seriesColors: Record<string, string>,
  opts: { areaSeries?: string } = {}
): EChartsOption {
  const cats = categories(list)
  const names = seriesNames(list)
  return {
    legend: {
      top: 0, right: 8, icon: 'circle', itemWidth: 8, itemHeight: 8, itemGap: 18,
      textStyle: { color: '#a5bde5', fontSize: 12, fontFamily: 'OPPOSans-R' }
    },
    grid: { left: 8, right: 12, top: 30, bottom: 2, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(6,18,40,0.92)', borderColor: '#2483FF',
      textStyle: { color: '#fff', fontSize: 12 }
    },
    xAxis: {
      type: 'category', data: cats, boundaryGap: false,
      axisLabel: AXIS_LABEL,
      axisLine: { lineStyle: { color: 'rgba(144,163,200,0.3)' } },
      axisTick: { show: false }
    },
    yAxis: { type: 'value', axisLabel: AXIS_LABEL, splitLine: SPLIT_LINE },
    series: names.map((nm) => {
      const color = seriesColors[nm] ?? '#2e82db'
      return {
        name: nm, type: 'line' as const, smooth: true, symbol: 'circle', symbolSize: 5,
        data: seriesData(list, nm, cats),
        lineStyle: { color, width: 2 },
        itemStyle: { color },
        areaStyle:
          opts.areaSeries === nm
            ? {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: 'rgba(94,146,255,0.45)' },
                  { offset: 1, color: 'rgba(9,82,171,0)' }
                ])
              }
            : undefined
      }
    })
  }
}
```

- [ ] **Step 3: 写 src/components/common/NumberFlop.vue**

```vue
<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{ value: number; decimals?: number; duration?: number; fontSize?: number; color?: string }>(),
  { decimals: 0, duration: 1000, fontSize: 36, color: '#fff' }
)

const display = ref('0')
let raf = 0

function animate(to: number) {
  cancelAnimationFrame(raf)
  const start = performance.now()
  const step = (now: number) => {
    const p = Math.min((now - start) / props.duration, 1)
    const eased = 1 - Math.pow(1 - p, 3)
    display.value = (to * eased).toFixed(props.decimals)
    if (p < 1) raf = requestAnimationFrame(step)
  }
  raf = requestAnimationFrame(step)
}

watch(() => props.value, (v) => animate(v), { immediate: true })
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <span class="flop" :style="{ fontSize: fontSize + 'px', color }">{{ display }}</span>
</template>

<style scoped>
.flop {
  font-family: Bebas, 'Microsoft Yahei', sans-serif;
  line-height: 1;
  letter-spacing: 1px;
}
</style>
```

- [ ] **Step 4: 写 src/components/common/ScrollTable.vue**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { ScrollColumn } from '@/types'

const props = withDefaults(
  defineProps<{
    columns: ScrollColumn[]
    rows: Record<string, unknown>[]
    height: number
    rowHeight?: number
    scroll?: boolean
  }>(),
  { rowHeight: 34, scroll: true }
)

const HEAD_H = 30
const needScroll = computed(
  () => props.scroll && props.rows.length * props.rowHeight > props.height - HEAD_H
)
const renderRows = computed(() => (needScroll.value ? [...props.rows, ...props.rows] : props.rows))
const scrollStyle = computed(() =>
  needScroll.value
    ? {
        animationDuration: `${props.rows.length * 2.4}s`,
        '--scroll-to': `-${props.rows.length * props.rowHeight}px`
      }
    : {}
)
</script>

<template>
  <div class="scroll-table" :style="{ height: height + 'px' }">
    <div class="thead">
      <span
        v-for="c in columns"
        :key="c.key"
        :style="{ width: c.width, textAlign: c.align ?? 'left' }"
      >{{ c.title }}</span>
    </div>
    <div class="tbody" :style="{ height: height - HEAD_H + 'px' }">
      <div class="rows" :class="{ scrolling: needScroll }" :style="scrollStyle">
        <div class="row" v-for="(r, i) in renderRows" :key="i" :style="{ height: rowHeight + 'px' }">
          <span
            v-for="c in columns"
            :key="c.key"
            :style="{ width: c.width, textAlign: c.align ?? 'left', color: c.color }"
          >{{ r[c.key] }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scroll-table { width: 100%; overflow: hidden; }
.thead {
  display: flex; height: 30px; line-height: 30px;
  font-size: 12px; color: #90a3c8; font-family: 'OPPOSans-R';
  background: rgba(36, 131, 255, 0.12);
}
.thead span, .row span {
  padding: 0 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: none;
}
.tbody { overflow: hidden; }
.rows.scrolling { animation: scroll-up linear infinite; }
.row { display: flex; align-items: center; font-size: 13px; color: #fff; font-family: 'OPPOSans-R'; }
.row:nth-child(odd) { background: rgba(36, 131, 255, 0.06); }
@keyframes scroll-up {
  from { transform: translateY(0); }
  to { transform: translateY(var(--scroll-to)); }
}
</style>
```

- [ ] **Step 5: 写 src/components/layout/HeaderBar.vue**

```vue
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import headerImg from '@/assets/images/header-bar.png'
import headerVideo from '@/assets/video/header-bg.webm'
import fsIn from '@/assets/images/fullscreen-in.png'
import fsOut from '@/assets/images/fullscreen-out.png'

const now = ref('')
const isFs = ref(false)
const WEEK = ['日', '一', '二', '三', '四', '五', '六']

function fmt() {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  now.value = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} 星期${WEEK[d.getDay()]}`
}

let timer = 0
onMounted(() => {
  fmt()
  timer = window.setInterval(fmt, 1000)
})
onBeforeUnmount(() => clearInterval(timer))

async function toggleFs() {
  if (document.fullscreenElement) {
    await document.exitFullscreen()
    isFs.value = false
  } else {
    await document.documentElement.requestFullscreen()
    isFs.value = true
  }
}
</script>

<template>
  <header class="header">
    <video class="layer" :src="headerVideo" autoplay loop muted playsinline />
    <img class="layer" :src="headerImg" alt="" />
    <div class="timer">{{ now }}</div>
    <img class="fs-btn" :src="isFs ? fsOut : fsIn" alt="全屏" @click="toggleFs" />
  </header>
</template>

<style scoped>
.header { position: absolute; left: 0; top: 0; width: 1920px; height: 174px; z-index: 20; pointer-events: none; }
.layer { position: absolute; left: 0; top: 0; width: 1920px; height: 174px; object-fit: cover; }
.timer {
  position: absolute; left: 1600px; top: 34px; width: 260px;
  font-family: 'OPPOSans-M'; font-size: 20px; color: #fff; letter-spacing: 1px;
}
.fs-btn { position: absolute; left: 1852px; top: 30px; width: 36px; height: 36px; cursor: pointer; pointer-events: auto; }
</style>
```

- [ ] **Step 6: 写 src/components/layout/SectionTitle.vue 与 SubTitle.vue**

`SectionTitle.vue`（一级标题条，如"质效分析"）:
```vue
<script setup lang="ts">
import barImg from '@/assets/images/section-bar.png'

defineProps<{ title: string }>()
</script>

<template>
  <div class="section-title">
    <img :src="barImg" alt="" />
    <span>{{ title }}</span>
  </div>
</template>

<style scoped>
.section-title { position: relative; width: 492px; height: 60px; }
.section-title img { position: absolute; left: 0; top: 0; width: 492px; height: 60px; }
.section-title span {
  position: absolute; left: 43px; top: 4px;
  font-family: 'YouSheBiaoTiHei'; font-size: 28px; font-style: italic; letter-spacing: 2px;
  background: linear-gradient(180deg, #b0dbfa, #ffffff);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
</style>
```

`SubTitle.vue`（二级标题行，如"调解质效（累计）"）:
```vue
<script setup lang="ts">
withDefaults(defineProps<{ title: string; extra?: string; width?: number }>(), { extra: '', width: 492 })
</script>

<template>
  <div class="sub-title" :style="{ width: width + 'px' }">
    <i />
    <span>{{ title }}</span>
    <em v-if="extra">{{ extra }}</em>
    <div class="line" />
  </div>
</template>

<style scoped>
.sub-title { display: flex; align-items: center; height: 20px; gap: 8px; }
.sub-title i { width: 8px; height: 8px; background: #2483ff; transform: skewX(-12deg); flex: none; }
.sub-title span { font-family: 'OPPOSans-R'; font-size: 14px; color: #fff; flex: none; }
.sub-title em { font-style: normal; font-size: 12px; color: rgba(165, 189, 229, 0.6); flex: none; }
.sub-title .line { flex: 1; height: 1px; background: linear-gradient(90deg, rgba(36, 131, 255, 0.6), transparent); }
</style>
```

- [ ] **Step 7: 验证 + Commit**

```bash
cd /Users/fei/cqbigscreen && npx vue-tsc --noEmit
```
Expected: 无输出，退出码 0。

```bash
git add -A && git commit -m "feat: ECharts composable、图表 option 构造器与公共组件

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: HomeView 骨架（背景 + 顶栏 + 底部 + 面板定位槽）

**Files:**
- Modify: `src/views/HomeView.vue`（重写占位）

**Interfaces:**
- Consumes: `HeaderBar`、`SectionTitle`（Task 5）、背景图（Task 1）
- Produces: 主屏绝对定位骨架；后续面板任务只需在标注的槽位插入组件标签 + 一行定位 CSS

- [ ] **Step 1: 重写 src/views/HomeView.vue**

```vue
<script setup lang="ts">
import HeaderBar from '@/components/layout/HeaderBar.vue'
import SectionTitle from '@/components/layout/SectionTitle.vue'
import bgMain from '@/assets/images/bg-main.png'
import bgTerrain from '@/assets/images/bg-terrain.png'
</script>

<template>
  <div class="home">
    <img class="bg-main" :src="bgMain" alt="" />
    <img class="bg-terrain" :src="bgTerrain" alt="" />
    <HeaderBar />

    <!-- 槽位：Task 12 地图 <ChongqingMap class="pos-map" /> -->
    <!-- 槽位：Task 7 <KpiPanel class="pos-kpi" /> + <AmountTablePanel class="pos-amount" /> -->

    <SectionTitle class="pos-quality-title" title="质效分析" />
    <!-- 槽位：Task 8 <QualityPanel class="pos-quality" /> -->
    <!-- 槽位：Task 9 <TechPanel class="pos-tech" /> <OrgPanel class="pos-org" /> <SocialPanel class="pos-social" /> -->

    <SectionTitle class="pos-inquiry-title" title="电询转办分析" />
    <!-- 槽位：Task 10 <InquiryPanel class="pos-inquiry" /> -->
    <!-- 槽位：Task 11 <DisposalPanel class="pos-disposal" /> <TrainingPanel class="pos-training" /> -->

    <div class="footer">指导监督单位：南岸区人民法院 南岸区司法局</div>
  </div>
</template>

<style scoped>
.home { position: absolute; inset: 0; overflow: hidden; }
.bg-main { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; }
.bg-terrain { position: absolute; left: 0; top: 0; width: 1482px; height: 1080px; opacity: 0.9; }

/* —— 面板定位槽（后续任务直接使用这些 class）—— */
.pos-map { position: absolute; left: 40px; top: 320px; width: 800px; height: 680px; }
.pos-kpi { position: absolute; left: 36px; top: 143px; }
.pos-amount { position: absolute; left: 36px; top: 812px; }
.pos-quality-title { position: absolute; left: 868px; top: 129px; }
.pos-quality { position: absolute; left: 868px; top: 195px; }
.pos-tech { position: absolute; left: 868px; top: 580px; }
.pos-org { position: absolute; left: 868px; top: 684px; }
.pos-social { position: absolute; left: 868px; top: 776px; }
.pos-inquiry-title { position: absolute; left: 1394px; top: 129px; }
.pos-inquiry { position: absolute; left: 1394px; top: 195px; }
.pos-disposal { position: absolute; left: 1394px; top: 555px; }
.pos-training { position: absolute; left: 1394px; top: 871px; }

.footer {
  position: absolute; left: 0; top: 1052px; width: 1920px; text-align: center;
  font-family: 'YouSheBiaoTiHei'; font-size: 20px; letter-spacing: 2px;
  background: linear-gradient(180deg, #b8eaff, #ffffff);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
</style>
```

- [ ] **Step 2: 验证**

```bash
cd /Users/fei/cqbigscreen && npx vue-tsc --noEmit
```
Expected: 通过。启动 `npm run dev` 后浏览器访问 http://localhost:5173/：黑底 + 网格光背景 + 顶部标题条（视频动效）+ 右上实时时钟 + 两个渐变大标题条 + 底部指导单位文字。对照 `docs/superpowers/reference/nanan-full.png` 顶部与底部区域应基本一致。

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: 主屏骨架（背景/顶栏/大标题/底部/面板定位槽）

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: 左列面板 —— KPI 翻牌 + 金额分布滚动表

**Files:**
- Create: `src/components/panels/KpiPanel.vue`
- Create: `src/components/panels/AmountTablePanel.vue`
- Modify: `src/views/HomeView.vue`（挂到 `pos-kpi` / `pos-amount` 槽位）

**Interfaces:**
- Consumes: `getDashboardData` / `getJeFenbuList`（Task 2）、`NumberFlop` / `ScrollTable` / `SubTitle`（Task 5）
- Produces: 主屏左列完整

- [ ] **Step 1: 写 src/components/panels/KpiPanel.vue**

对照截图：第一行 4 项（万件），第二行 2 项（万元），每行首项带图标卡片底；标题 14px `#90a3c8` 在上，数字 36px 白 + 单位 14px。

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import NumberFlop from '@/components/common/NumberFlop.vue'
import { getDashboardData } from '@/api'
import type { DashboardData } from '@/types'
import iconCase from '@/assets/images/icon-kpi-case.png'
import iconMoney from '@/assets/images/icon-kpi-money.png'

interface KpiItem {
  key: keyof DashboardData
  title: string
  suffix: string
  x: number
}

const ROW1: KpiItem[] = [
  { key: 'tj_year_tj', title: '累计调解案件', suffix: '万件', x: 82 },
  { key: 'tj_year_kl', title: '当事人可联案件', suffix: '万件', x: 255 },
  { key: 'tj_year_tc', title: '实际调成案件', suffix: '万件', x: 429 },
  { key: 'tj_month_tj', title: '当月调解案件', suffix: '万件', x: 602 }
]
const ROW2: KpiItem[] = [
  { key: 'tj_year_yx', title: '累计履行金额', suffix: '万元', x: 82 },
  { key: 'tj_month_yx', title: '及时履行金额', suffix: '万元', x: 308 }
]

const data = ref<DashboardData | null>(null)
const error = ref('')
onMounted(async () => {
  try {
    data.value = await getDashboardData()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
})

const num = (v: string | undefined) => (v ? parseFloat(v) : 0)
</script>

<template>
  <div class="kpi-panel">
    <div v-if="error" class="err">{{ error }}</div>
    <template v-else>
      <div class="row" style="top: 0">
        <img class="icon" :src="iconCase" alt="" />
        <div v-for="it in ROW1" :key="it.key" class="item" :style="{ left: it.x + 'px' }">
          <div class="title">{{ it.title }}</div>
          <div class="value">
            <NumberFlop :value="num(data?.[it.key])" :decimals="2" />
            <span class="suffix">{{ it.suffix }}</span>
          </div>
        </div>
      </div>
      <div class="row" style="top: 101px">
        <img class="icon" :src="iconMoney" alt="" />
        <div v-for="it in ROW2" :key="it.key" class="item" :style="{ left: it.x + 'px' }">
          <div class="title">{{ it.title }}</div>
          <div class="value">
            <NumberFlop :value="num(data?.[it.key])" :decimals="2" />
            <span class="suffix">{{ it.suffix }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.kpi-panel { position: relative; width: 748px; height: 178px; }
.row { position: absolute; left: 0; width: 748px; height: 77px; }
.icon { position: absolute; left: 4px; top: 4px; width: 68px; height: 68px; }
.item { position: absolute; top: 2px; }
.title { font-family: 'OPPOSans-R'; font-size: 14px; color: #90a3c8; margin-bottom: 8px; }
.value { display: flex; align-items: baseline; gap: 6px; }
.suffix { font-family: 'OPPOSans-R'; font-size: 14px; color: #90a3c8; }
.err { color: #ff7d57; font-size: 14px; padding-top: 30px; }
</style>
```

- [ ] **Step 2: 写 src/components/panels/AmountTablePanel.vue**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ScrollTable from '@/components/common/ScrollTable.vue'
import type { ScrollColumn } from '@/types'
import SubTitle from '@/components/layout/SubTitle.vue'
import { getJeFenbuList } from '@/api'

const columns: ScrollColumn[] = [
  { key: 'city', title: '省份', width: '30%' },
  { key: 'aj', title: '案件（件）', width: '30%', align: 'center' },
  { key: 'ztje', title: '在调金额（万元）', width: '40%', align: 'right', color: '#edd892' }
]

const rows = ref<Record<string, unknown>[]>([])
const error = ref('')
onMounted(async () => {
  try {
    rows.value = (await getJeFenbuList()) as unknown as Record<string, unknown>[]
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
})
</script>

<template>
  <div class="amount-panel">
    <SubTitle title="案件 / 在调金额分布" :width="360" />
    <div v-if="error" class="err">{{ error }}</div>
    <ScrollTable v-else class="table" :columns="columns" :rows="rows" :height="192" :row-height="38" />
  </div>
</template>

<style scoped>
.amount-panel { position: relative; width: 360px; height: 215px; }
.table { margin-top: 3px; }
.err { color: #ff7d57; font-size: 14px; padding-top: 30px; }
</style>
```

- [ ] **Step 3: 挂载到 HomeView**

`src/views/HomeView.vue` 的 script 增加：
```ts
import KpiPanel from '@/components/panels/KpiPanel.vue'
import AmountTablePanel from '@/components/panels/AmountTablePanel.vue'
```
template 中将 Task 7 槽位注释替换为：
```html
<KpiPanel class="pos-kpi" />
<AmountTablePanel class="pos-amount" />
```

- [ ] **Step 4: 验证**

```bash
cd /Users/fei/cqbigscreen && npx vue-tsc --noEmit
```
Expected: 通过。dev server 下对照基准截图：KPI 数字翻牌到 218.22 / 66.56 / 24.63 / 13.09 / 81384.58 / 5984.00；左下表格 12 行滚动，金额列金色。

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: 左列 KPI 翻牌与金额分布滚动表

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: 质效分析面板（4 指标卡 + 还款双色柱状图）

**Files:**
- Create: `src/components/panels/QualityPanel.vue`
- Modify: `src/views/HomeView.vue`（挂到 `pos-quality` 槽位）

**Interfaces:**
- Consumes: `getTjzxData` / `getHuankuanList`（Task 2）、`useECharts` / `buildDoubleBarOption`（Task 5）、`NumberFlop` / `SubTitle`
- Produces: 中列质效分析面板完整

- [ ] **Step 1: 写 src/components/panels/QualityPanel.vue**

对照截图：二级标题"调解质效（累计）"；2×2 指标卡（全额还款 34752 件 / 分期还款 211512 件 / 示范调判 7550 件 / 减少诉讼 217.47 万件，前三项整数、末项 2 位小数）；下方 34 省双系列柱状图（蓝=全额还款、金=分期还款，x 轴标签每 6 个显示 1 个）。

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import NumberFlop from '@/components/common/NumberFlop.vue'
import SubTitle from '@/components/layout/SubTitle.vue'
import { useECharts } from '@/composables/useECharts'
import { buildDoubleBarOption } from '@/utils/chartOptions'
import { getHuankuanList, getTjzxData } from '@/api'
import type { TjzxData } from '@/types'
import icon1 from '@/assets/images/icon-quality-1.png'
import icon2 from '@/assets/images/icon-quality-2.png'
import icon3 from '@/assets/images/icon-quality-3.png'
import icon4 from '@/assets/images/icon-quality-4.png'

interface Card {
  key: keyof TjzxData
  title: string
  unit: string
  decimals: number
  icon: string
  x: number
  y: number
}

const CARDS: Card[] = [
  { key: 'tjzx_qe', title: '全额还款', unit: '件', decimals: 0, icon: icon1, x: 29, y: 44 },
  { key: 'tjzx_fq', title: '分期还款', unit: '件', decimals: 0, icon: icon2, x: 255, y: 44 },
  { key: 'tjzx_ss', title: '示范调判', unit: '件', decimals: 0, icon: icon3, x: 29, y: 124 },
  { key: 'tjzx_qr', title: '减少诉讼', unit: '万件', decimals: 2, icon: icon4, x: 255, y: 124 }
]

const data = ref<TjzxData | null>(null)
const error = ref('')
const chartEl = ref<HTMLElement | null>(null)
const { setOption } = useECharts(chartEl)

onMounted(async () => {
  try {
    const [tjzx, list] = await Promise.all([getTjzxData(), getHuankuanList()])
    data.value = tjzx
    setOption(buildDoubleBarOption(list, { xLabelInterval: 5 }))
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
})

const num = (v: string | undefined) => (v ? parseFloat(v) : 0)
</script>

<template>
  <div class="quality-panel">
    <SubTitle title="调解质效" extra="（累计）" />
    <div v-if="error" class="err">{{ error }}</div>
    <template v-else>
      <div v-for="c in CARDS" :key="c.key" class="card" :style="{ left: c.x + 'px', top: c.y + 'px' }">
        <img :src="c.icon" alt="" />
        <div>
          <div class="title">{{ c.title }}</div>
          <div class="value">
            <NumberFlop :value="num(data?.[c.key])" :decimals="c.decimals" :font-size="28" />
            <span class="unit">{{ c.unit }}</span>
          </div>
        </div>
      </div>
      <div ref="chartEl" class="chart" />
    </template>
  </div>
</template>

<style scoped>
.quality-panel { position: relative; width: 492px; height: 380px; }
.card { position: absolute; display: flex; align-items: center; gap: 10px; width: 208px; height: 60px; }
.card img { width: 48px; height: 48px; }
.title { font-family: 'OPPOSans-R'; font-size: 14px; color: #90a3c8; margin-bottom: 4px; }
.value { display: flex; align-items: baseline; gap: 5px; }
.unit { font-family: 'OPPOSans-R'; font-size: 13px; color: #90a3c8; }
.chart { position: absolute; left: 0; top: 198px; width: 492px; height: 180px; }
.err { color: #ff7d57; font-size: 14px; padding-top: 30px; }
</style>
```

- [ ] **Step 2: 挂载到 HomeView**

script 增加 `import QualityPanel from '@/components/panels/QualityPanel.vue'`，Task 8 槽位注释替换为 `<QualityPanel class="pos-quality" />`。

- [ ] **Step 3: 验证**

```bash
cd /Users/fei/cqbigscreen && npx vue-tsc --noEmit
```
Expected: 通过。dev server：4 张指标卡数值 34752 / 211512 / 7550 / 217.47；柱状图蓝金双系列、图例在右上、x 轴稀疏省份标签。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: 质效分析面板（指标卡+还款双色柱状图）

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: 科技赋能（tab 切换）+ 组织架构 + 社会效果

**Files:**
- Create: `src/components/panels/TechPanel.vue`
- Create: `src/components/panels/OrgPanel.vue`
- Create: `src/components/panels/SocialPanel.vue`
- Modify: `src/views/HomeView.vue`（挂到 `pos-tech` / `pos-org` / `pos-social` 槽位）

**Interfaces:**
- Consumes: `getKejifunengData` / `getZzglData` / `getZuzhizhixiaoList`（Task 2）、`NumberFlop` / `ScrollTable` / `SubTitle`（Task 5）
- Produces: 中列剩余三面板完整

- [ ] **Step 1: 写 src/components/panels/TechPanel.vue**

数据 `content` 为 外呼/失联修复/情绪监控，tab 显示名做映射（外呼→服务外呼）。选中 tab 显示 `child`：累计 `lj` `dw` / 今日(本月) `jr` `dw1`。

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import NumberFlop from '@/components/common/NumberFlop.vue'
import SubTitle from '@/components/layout/SubTitle.vue'
import { getKejifunengData } from '@/api'
import type { KejifunengItem } from '@/types'
import iconTech from '@/assets/images/icon-tech.png'

const LABEL: Record<string, string> = { 外呼: '服务外呼' }

const list = ref<KejifunengItem[]>([])
const active = ref(0)
const error = ref('')
onMounted(async () => {
  try {
    list.value = await getKejifunengData()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
})

const cur = computed(() => list.value[active.value] ?? null)
</script>

<template>
  <div class="tech-panel">
    <SubTitle title="科技赋能" />
    <div class="tabs">
      <span
        v-for="(it, i) in list"
        :key="it.id"
        class="tab"
        :class="{ active: i === active }"
        @click="active = i"
      >{{ LABEL[it.content] ?? it.content }}</span>
    </div>
    <div v-if="error" class="err">{{ error }}</div>
    <div v-else-if="cur" class="body">
      <img :src="iconTech" alt="" />
      <div class="group">
        <div class="title">{{ cur.child.mc }}</div>
        <div class="value">
          <NumberFlop :value="parseFloat(cur.child.lj)" :font-size="28" />
          <span class="unit">{{ cur.child.dw }}</span>
        </div>
      </div>
      <div class="group" style="left: 240px">
        <div class="title">{{ cur.child.mc1 }}</div>
        <div class="value">
          <NumberFlop :value="parseFloat(cur.child.jr)" :font-size="28" color="#edd892" />
          <span class="unit">{{ cur.child.dw1 }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tech-panel { position: relative; width: 492px; height: 100px; }
.tabs { position: absolute; right: 0; top: -2px; display: flex; gap: 4px; }
.tab {
  padding: 3px 10px; font-family: 'OPPOSans-R'; font-size: 12px; color: #a5bde5;
  background: linear-gradient(180deg, #1f335e, #111c2e);
  border: 1px solid rgba(165, 189, 229, 0.1); border-radius: 2px; cursor: pointer;
}
.tab.active { color: #fff; border-color: #2483ff; background: linear-gradient(180deg, #2a4a8a, #16233d); }
.body { position: relative; margin-top: 14px; height: 60px; }
.body img { position: absolute; left: 20px; top: 2px; width: 48px; height: 48px; }
.group { position: absolute; left: 82px; top: 0; }
.title { font-family: 'OPPOSans-R'; font-size: 14px; color: #90a3c8; margin-bottom: 4px; }
.value { display: flex; align-items: baseline; gap: 5px; }
.unit { font-family: 'OPPOSans-R'; font-size: 13px; color: #90a3c8; }
.err { color: #ff7d57; font-size: 14px; padding-top: 20px; }
</style>
```

- [ ] **Step 2: 写 src/components/panels/OrgPanel.vue**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import NumberFlop from '@/components/common/NumberFlop.vue'
import SubTitle from '@/components/layout/SubTitle.vue'
import { getZzglData } from '@/api'
import type { ZzglData } from '@/types'
import iconOrg from '@/assets/images/icon-org.png'

const data = ref<ZzglData | null>(null)
const error = ref('')
onMounted(async () => {
  try {
    data.value = await getZzglData()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
})

const num = (v: string | undefined) => (v ? parseFloat(v) : 0)
</script>

<template>
  <div class="org-panel">
    <SubTitle title="组织架构" />
    <div v-if="error" class="err">{{ error }}</div>
    <div v-else class="body">
      <img :src="iconOrg" alt="" />
      <div class="group">
        <div class="title">特邀调解组织</div>
        <div class="value">
          <NumberFlop :value="num(data?.zzgl_zz)" :font-size="28" />
          <span class="unit">家</span>
        </div>
      </div>
      <div class="group" style="left: 240px">
        <div class="title">调解人员</div>
        <div class="value">
          <NumberFlop :value="num(data?.zzgl_ry)" :font-size="28" color="#edd892" />
          <span class="unit">人</span>
        </div>
      </div>
      <div class="mini" style="top: 2px">
        <span>平均年龄</span>
        <NumberFlop :value="num(data?.zzgl_nl)" :decimals="1" :font-size="18" color="#edd892" />
      </div>
      <div class="mini" style="top: 34px">
        <span>大专学历及以上</span>
        <NumberFlop :value="num(data?.zzgl_xl)" :decimals="0" :font-size="18" color="#edd892" />
        <span class="unit">%</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.org-panel { position: relative; width: 492px; height: 88px; }
.body { position: relative; margin-top: 12px; height: 60px; }
.body > img { position: absolute; left: 20px; top: 2px; width: 48px; height: 48px; }
.group { position: absolute; left: 82px; top: 0; }
.title { font-family: 'OPPOSans-R'; font-size: 14px; color: #90a3c8; margin-bottom: 4px; }
.value { display: flex; align-items: baseline; gap: 5px; }
.unit { font-family: 'OPPOSans-R'; font-size: 13px; color: #90a3c8; }
.mini { position: absolute; left: 361px; display: flex; align-items: baseline; gap: 6px; }
.mini span { font-family: 'OPPOSans-R'; font-size: 13px; color: #90a3c8; }
.err { color: #ff7d57; font-size: 14px; padding-top: 20px; }
</style>
```

- [ ] **Step 3: 写 src/components/panels/SocialPanel.vue**

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ScrollTable from '@/components/common/ScrollTable.vue'
import type { ScrollColumn } from '@/types'
import SubTitle from '@/components/layout/SubTitle.vue'
import { getZuzhizhixiaoList } from '@/api'

const columns: ScrollColumn[] = [
  { key: 'lx', title: '组织单位', width: '34%' },
  { key: 'rs', title: '调解人员', width: '15%', align: 'center' },
  { key: 'dx', title: '电询数量', width: '15%', align: 'center', color: '#edd892' },
  { key: 'bwt', title: '被委托案', width: '18%', align: 'center' },
  { key: 'bl', title: '被询比率', width: '18%', align: 'center', color: '#00DEFF' }
]

const rows = ref<Record<string, unknown>[]>([])
const error = ref('')
onMounted(async () => {
  try {
    rows.value = (await getZuzhizhixiaoList()) as unknown as Record<string, unknown>[]
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
})
</script>

<template>
  <div class="social-panel">
    <SubTitle title="社会效果" />
    <div v-if="error" class="err">{{ error }}</div>
    <ScrollTable v-else class="table" :columns="columns" :rows="rows" :height="230" :row-height="38" :scroll="false" />
  </div>
</template>

<style scoped>
.social-panel { position: relative; width: 492px; height: 266px; }
.table { margin-top: 10px; }
.err { color: #ff7d57; font-size: 14px; padding-top: 30px; }
</style>
```

- [ ] **Step 4: 挂载到 HomeView 并验证**

script 增加三个 import，Task 9 槽位注释替换为：
```html
<TechPanel class="pos-tech" />
<OrgPanel class="pos-org" />
<SocialPanel class="pos-social" />
```

```bash
cd /Users/fei/cqbigscreen && npx vue-tsc --noEmit
```
Expected: 通过。dev server：tab 点击切换数字（外呼 13131 万次/257091 次）；组织架构 5 家/205 人/28.1/76%；社会效果 5 行静态表。

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: 科技赋能/组织架构/社会效果面板

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: 电询转办分析面板（7 数字 + 三线折线图）

**Files:**
- Create: `src/components/panels/InquiryPanel.vue`
- Modify: `src/views/HomeView.vue`（挂到 `pos-inquiry` 槽位）

**Interfaces:**
- Consumes: `getDxData` / `getDxmonthList`（Task 2）、`useECharts` / `buildMultiLineOption`（Task 5）、`NumberFlop`
- Produces: 右列电询转办面板完整

- [ ] **Step 1: 写 src/components/panels/InquiryPanel.vue**

对照截图：行 A —— 图标 + 累计电询数量 5216 件（白大字），右侧三小项 普通电询 5145 / 无责投诉 71 / 有效投诉 11（金色）；行 B —— 累计转办 18 件，右侧 有效 4 / 无责 14（金色）；下方折线图 询问(蓝, 带面积) / 转办(金) / 有责(绿)。

```vue
<script setup lang="ts">
import { onMounted, ref } from 'vue'
import NumberFlop from '@/components/common/NumberFlop.vue'
import { useECharts } from '@/composables/useECharts'
import { buildMultiLineOption } from '@/utils/chartOptions'
import { getDxData, getDxmonthList } from '@/api'
import type { DxData } from '@/types'
import iconInquiry from '@/assets/images/icon-inquiry.png'
import iconSmall1 from '@/assets/images/icon-small-1.png'

const LINE_COLORS: Record<string, string> = { 询问: '#2e82db', 转办: '#edd892', 有责: '#44ffa2' }

interface Mini {
  key: keyof DxData
  title: string
  x: number
  y: number
}
const MINIS: Mini[] = [
  { key: 'dx_zx_xw', title: '普通电询', x: 255, y: 10 },
  { key: 'dx_zx_ts', title: '无责投诉', x: 340, y: 10 },
  { key: 'dx_zx_yz', title: '有效投诉', x: 418, y: 10 },
  { key: 'dx_yn_yz', title: '有效', x: 255, y: 93 },
  { key: 'dx_yn_wz', title: '无责', x: 340, y: 93 }
]

const data = ref<DxData | null>(null)
const error = ref('')
const chartEl = ref<HTMLElement | null>(null)
const { setOption } = useECharts(chartEl)

onMounted(async () => {
  try {
    const [dx, month] = await Promise.all([getDxData(), getDxmonthList()])
    data.value = dx
    setOption(buildMultiLineOption(month, LINE_COLORS, { areaSeries: '询问' }))
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
})

const num = (v: string | undefined) => (v ? parseFloat(v) : 0)
</script>

<template>
  <div class="inquiry-panel">
    <div v-if="error" class="err">{{ error }}</div>
    <template v-else>
      <div class="big" style="top: 10px">
        <img :src="iconInquiry" alt="" />
        <div>
          <div class="title">累计电询数量</div>
          <div class="value">
            <NumberFlop :value="num(data?.dx_zx_year)" :font-size="30" />
            <span class="unit">件</span>
          </div>
        </div>
      </div>
      <div class="big" style="top: 93px">
        <img :src="iconSmall1" alt="" />
        <div>
          <div class="title">累计转办</div>
          <div class="value">
            <NumberFlop :value="num(data?.dx_yn_year)" :font-size="30" />
            <span class="unit">件</span>
          </div>
        </div>
      </div>
      <div v-for="m in MINIS" :key="m.key" class="mini" :style="{ left: m.x + 'px', top: m.y + 'px' }">
        <div class="title">{{ m.title }}</div>
        <div class="value">
          <NumberFlop :value="num(data?.[m.key])" :font-size="22" color="#edd892" />
          <span class="unit">件</span>
        </div>
      </div>
      <div ref="chartEl" class="chart" />
    </template>
  </div>
</template>

<style scoped>
.inquiry-panel { position: relative; width: 492px; height: 360px; }
.big { position: absolute; left: 12px; display: flex; align-items: center; gap: 10px; }
.big img { width: 52px; height: 52px; }
.mini { position: absolute; }
.title { font-family: 'OPPOSans-R'; font-size: 14px; color: #90a3c8; margin-bottom: 5px; }
.value { display: flex; align-items: baseline; gap: 5px; }
.unit { font-family: 'OPPOSans-R'; font-size: 13px; color: #90a3c8; }
.chart { position: absolute; left: 0; top: 170px; width: 492px; height: 190px; }
.err { color: #ff7d57; font-size: 14px; padding-top: 30px; }
</style>
```

- [ ] **Step 2: 挂载到 HomeView 并验证**

script 增加 `import InquiryPanel from '@/components/panels/InquiryPanel.vue'`，槽位注释替换为 `<InquiryPanel class="pos-inquiry" />`。

```bash
cd /Users/fei/cqbigscreen && npx vue-tsc --noEmit
```
Expected: 通过。dev server：数字 5216/5145/71/11/18/4/14；折线图三系列（1月-5月），询问带蓝色渐变面积，图例圆点。

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: 电询转办分析面板（数字组+三线折线图）

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: 处置结果轮播 + 合规培训滚动表

**Files:**
- Create: `src/components/panels/DisposalPanel.vue`
- Create: `src/components/panels/TrainingPanel.vue`
- Modify: `src/views/HomeView.vue`（挂到 `pos-disposal` / `pos-training` 槽位）

**Interfaces:**
- Consumes: `getChuzhiList` / `getHgpxList`（Task 2）、`ScrollTable` / `SubTitle` / `SectionTitle`（Task 5）
- Produces: 右列剩余两面板完整

- [ ] **Step 1: 写 src/components/panels/DisposalPanel.vue**

每条记录 3 行（事由/诉求 `lx`、电询数量 `sl` 金色、处置措施 `czjg` 灰色截断），整列无缝上滚（复用 ScrollTable 的 keyframes 思路，但自定义行结构，故内联实现滚动）：

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import SubTitle from '@/components/layout/SubTitle.vue'
import { getChuzhiList } from '@/api'
import type { ChuzhiItem } from '@/types'

const ITEM_H = 84
const BODY_H = 268

const list = ref<ChuzhiItem[]>([])
const error = ref('')
onMounted(async () => {
  try {
    list.value = await getChuzhiList()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
})

const needScroll = computed(() => list.value.length * ITEM_H > BODY_H)
const renderList = computed(() => (needScroll.value ? [...list.value, ...list.value] : list.value))
const scrollStyle = computed(() =>
  needScroll.value
    ? { animationDuration: `${list.value.length * 3}s`, '--scroll-to': `-${list.value.length * ITEM_H}px` }
    : {}
)
</script>

<template>
  <div class="disposal-panel">
    <SubTitle title="处置结果" />
    <div v-if="error" class="err">{{ error }}</div>
    <div v-else class="body">
      <div class="items" :class="{ scrolling: needScroll }" :style="scrollStyle">
        <div class="item" v-for="(it, i) in renderList" :key="i">
          <div class="line1">事由/诉求：<b>{{ it.lx }}</b></div>
          <div class="line2">电询数量：<em>{{ it.sl }}</em></div>
          <div class="line3">处置措施：{{ it.czjg }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.disposal-panel { position: relative; width: 492px; height: 312px; }
.body { margin-top: 10px; height: 268px; overflow: hidden; }
.items.scrolling { animation: scroll-up linear infinite; }
.item { height: 84px; padding: 6px 8px 0; border-bottom: 1px solid rgba(36, 131, 255, 0.15); }
.line1 { font-family: 'OPPOSans-R'; font-size: 14px; color: #90a3c8; }
.line1 b { color: #fff; font-weight: normal; }
.line2 { font-family: 'OPPOSans-R'; font-size: 14px; color: #90a3c8; margin: 4px 0; }
.line2 em { font-style: normal; font-family: Bebas, sans-serif; font-size: 18px; color: #edd892; }
.line3 {
  font-family: 'OPPOSans-R'; font-size: 12px; color: #90a3c8;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.err { color: #ff7d57; font-size: 14px; padding-top: 30px; }
@keyframes scroll-up {
  from { transform: translateY(0); }
  to { transform: translateY(var(--scroll-to)); }
}
</style>
```

- [ ] **Step 2: 写 src/components/panels/TrainingPanel.vue**

大标题条"合规培训&走访抽查"（Task 6 已有的 SectionTitle 不在此面板内 —— 该标题条属于本面板，注意本面板从标题条开始）：

```vue
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import SectionTitle from '@/components/layout/SectionTitle.vue'
import ScrollTable from '@/components/common/ScrollTable.vue'
import type { ScrollColumn } from '@/types'
import { getHgpxList } from '@/api'

const columns: ScrollColumn[] = [
  { key: 'idx', title: '序号', width: '10%', align: 'center' },
  { key: 'zt', title: '培训主题', width: '55%' },
  { key: 'rs', title: '参与人数', width: '15%', align: 'center', color: '#edd892' },
  { key: 'rq', title: '时间', width: '20%', align: 'center' }
]

const raw = ref<{ zt: string; rs: number; rq: string }[]>([])
const error = ref('')
onMounted(async () => {
  try {
    raw.value = await getHgpxList()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
})

const rows = computed(() =>
  raw.value.map((r, i) => ({ idx: i + 1, zt: r.zt, rs: r.rs, rq: r.rq.slice(0, 10) }))
)
</script>

<template>
  <div class="training-panel">
    <SectionTitle title="合规培训&走访抽查" />
    <div v-if="error" class="err">{{ error }}</div>
    <ScrollTable v-else class="table" :columns="columns" :rows="rows" :height="98" :row-height="32" />
  </div>
</template>

<style scoped>
.training-panel { position: relative; width: 492px; height: 171px; }
.table { margin-top: 13px; }
.err { color: #ff7d57; font-size: 14px; padding-top: 30px; }
</style>
```

- [ ] **Step 3: 挂载到 HomeView 并验证**

script 增加两个 import，槽位注释替换为：
```html
<DisposalPanel class="pos-disposal" />
<TrainingPanel class="pos-training" />
```

```bash
cd /Users/fei/cqbigscreen && npx vue-tsc --noEmit
```
Expected: 通过。dev server：处置结果 9 条无缝上滚（每条三行，电询数量金色）；合规培训 3 行表（高度不足则滚动）。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: 处置结果轮播与合规培训滚动表

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 12: 重庆区县 GEO SVG 地图组件（hover 高亮 + tooltip + 飞线 + 点击下钻）

**Files:**
- Create: `src/components/map/ChongqingMap.vue`
- Modify: `src/views/HomeView.vue`（挂到 `pos-map` 槽位）

**Interfaces:**
- Consumes: `public/maps/chongqing.svg` + `src/mocks/district_centroids.json`（Task 4）、`getDistrictMapData`（Task 3）、`useECharts`（Task 5）、vue-router
- Produces: `ChongqingMap` props `{ focus?: string; showLines?: boolean }`；点击区县触发 `router.push('/district/<区县名>')`；`focus` 指定的区县高亮、其余淡化（Task 13 子页复用）

**技术要点：**
- `echarts.registerMap('chongqing', { svg })` 注册 GEO SVG
- `geo` 组件设 `silent: true` + 透明样式，仅作为 `lines`/`effectScatter` 的坐标系（SVG 坐标）
- 可交互区块由 `type: 'map'` 系列渲染（emphasis/select/tooltip/click 全在该系列上）
- geo 与 map 系列必须使用**完全相同的** `layoutCenter`/`layoutSize`，否则飞线与区块错位

- [ ] **Step 1: 写 src/components/map/ChongqingMap.vue**

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import { useRouter } from 'vue-router'
import { useECharts } from '@/composables/useECharts'
import { getDistrictMapData } from '@/api'
import centroidsRaw from '@/mocks/district_centroids.json'
import type { DistrictMapItem } from '@/types'

const props = withDefaults(defineProps<{ focus?: string; showLines?: boolean }>(), {
  focus: '',
  showLines: true
})

const CENTER = '南岸区'
const centroids = centroidsRaw as Record<string, [number, number]>

const el = ref<HTMLElement | null>(null)
const { chart, setOption } = useECharts(el)
const router = useRouter()
const error = ref('')
const mapData = ref<DistrictMapItem[]>([])

const LAYOUT: { layoutCenter: (string | number)[]; layoutSize: string } = {
  layoutCenter: ['50%', '50%'],
  layoutSize: '96%'
}

function areaGradient(c1: string, c2: string) {
  return {
    type: 'linear' as const,
    x: 0, y: 0, x2: 0, y2: 1,
    colorStops: [
      { offset: 0, color: c1 },
      { offset: 1, color: c2 }
    ]
  }
}

function buildOption(data: DistrictMapItem[]): EChartsOption {
  const lines = props.showLines
    ? Object.keys(centroids)
        .filter((n) => n !== CENTER)
        .map((n) => ({ coords: [centroids[CENTER], centroids[n]] }))
    : []

  const seriesData = data.map((d) => ({
    name: d.name,
    value: d.aj,
    ztje: d.ztje,
    zzs: d.zzs,
    selected: !!props.focus && d.name === props.focus,
    itemStyle:
      props.focus && d.name !== props.focus
        ? { areaColor: 'rgba(8,24,52,0.55)', borderColor: 'rgba(36,131,255,0.25)' }
        : undefined
  }))

  return {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(6,18,40,0.92)',
      borderColor: '#2483FF',
      padding: [10, 14],
      textStyle: { color: '#fff', fontSize: 13, fontFamily: 'OPPOSans-R' },
      formatter: (p: unknown) => {
        const q = p as { name: string; data?: { value: number; ztje: number; zzs: number } }
        if (!q.data) return q.name
        return [
          `<b style="font-size:15px">${q.name}</b>`,
          `案件量：<span style="color:#00DEFF;font-family:Bebas">${q.data.value.toLocaleString()}</span> 件`,
          `在调金额：<span style="color:#edd892;font-family:Bebas">${q.data.ztje.toLocaleString()}</span> 万元`,
          `调解组织：<span style="color:#44ffa2;font-family:Bebas">${q.data.zzs}</span> 家`
        ].join('<br/>')
      }
    },
    geo: {
      map: 'chongqing',
      ...LAYOUT,
      silent: true,
      itemStyle: { areaColor: 'transparent', borderColor: 'transparent', borderWidth: 0 },
      emphasis: { disabled: true },
      zlevel: 0
    },
    series: [
      {
        type: 'map',
        map: 'chongqing',
        ...LAYOUT,
        selectedMode: props.focus ? 'single' : false,
        data: seriesData,
        itemStyle: {
          areaColor: areaGradient('rgba(12,60,140,0.82)', 'rgba(5,24,58,0.9)'),
          borderColor: '#2483FF',
          borderWidth: 1.2,
          shadowColor: 'rgba(0,165,255,0.45)',
          shadowBlur: 10
        },
        label: { show: true, color: '#a5bde5', fontSize: 11, fontFamily: 'OPPOSans-R' },
        emphasis: {
          label: { show: true, color: '#fff', fontSize: 13, fontWeight: 'bold' },
          itemStyle: {
            areaColor: areaGradient('rgba(36,131,255,0.95)', 'rgba(0,222,255,0.75)'),
            borderColor: '#00DEFF',
            borderWidth: 2,
            shadowColor: '#00a5ff',
            shadowBlur: 20
          }
        },
        select: {
          label: { show: true, color: '#fff', fontSize: 13, fontWeight: 'bold' },
          itemStyle: {
            areaColor: areaGradient('rgba(10,115,255,0.95)', 'rgba(0,222,255,0.8)'),
            borderColor: '#00DEFF',
            borderWidth: 2
          }
        },
        zlevel: 1
      },
      {
        type: 'lines',
        coordinateSystem: 'geo',
        zlevel: 2,
        silent: true,
        effect: { show: true, period: 4, trailLength: 0.3, symbol: 'arrow', symbolSize: 5, color: '#00DEFF' },
        lineStyle: { color: '#2483FF', width: 1, opacity: 0.3, curveness: 0.3 },
        data: lines
      },
      {
        type: 'effectScatter',
        coordinateSystem: 'geo',
        zlevel: 2,
        silent: true,
        symbolSize: 7,
        rippleEffect: { brushType: 'stroke', scale: 3.5 },
        itemStyle: { color: '#00DEFF' },
        data: [{ name: CENTER, value: [...centroids[CENTER], 1] }]
      }
    ]
  }
}

async function init() {
  try {
    const [svgRes, data] = await Promise.all([
      fetch(`${import.meta.env.BASE_URL}maps/chongqing.svg`),
      getDistrictMapData()
    ])
    if (!svgRes.ok) throw new Error(`地图加载失败: HTTP ${svgRes.status}`)
    echarts.registerMap('chongqing', { svg: await svgRes.text() })
    mapData.value = data
    setOption(buildOption(data), true)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
init()

watch(chart, (c) => {
  c?.on('click', (p) => {
    const q = p as { seriesType?: string; name?: string }
    if (q.seriesType === 'map' && q.name) {
      router.push(`/district/${encodeURIComponent(q.name)}`)
    }
  })
})

watch(
  () => props.focus,
  () => {
    if (mapData.value.length) setOption(buildOption(mapData.value), true)
  }
)
</script>

<template>
  <div class="cq-map">
    <div ref="el" class="chart" />
    <div v-if="error" class="err">{{ error }}</div>
  </div>
</template>

<style scoped>
.cq-map { position: relative; }
.chart { width: 100%; height: 100%; }
.err {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  color: #ff7d57; font-size: 16px; font-family: 'OPPOSans-R';
  background: rgba(6, 18, 40, 0.6);
}
</style>
```

- [ ] **Step 2: 挂载到 HomeView**

script 增加 `import ChongqingMap from '@/components/map/ChongqingMap.vue'`，地图槽位注释替换为 `<ChongqingMap class="pos-map" />`。

- [ ] **Step 3: 验证**

```bash
cd /Users/fei/cqbigscreen && npx vue-tsc --noEmit
```
Expected: 通过。dev server 交互验证清单：
1. 地图呈现 38 个深蓝区块 + 蓝色描边发光，区县名小字标注
2. hover 任一区县：区块变亮（蓝→青渐变）+ tooltip 显示 案件量/在调金额/调解组织
3. 南岸区有青色涟漪点，向各区县放射飞线动效
4. 点击"渝北区"：URL 变为 `#/district/渝北区`，页面切到占位视图
5. 浏览器后退：回到主屏

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: 重庆区县 GEO SVG 地图（hover 高亮/tooltip/飞线/点击下钻）

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 13: 区县下钻子页 DistrictView

**Files:**
- Modify: `src/views/DistrictView.vue`（重写占位）

**Interfaces:**
- Consumes: `getDistrictDetail`（Task 3）、`ChongqingMap`（Task 12，传 `focus`）、`NumberFlop` / `ScrollTable` / `SubTitle` / `HeaderBar`（Task 5）、`buildDoubleBarOption` / `buildMultiLineOption` / `useECharts`
- Produces: `/district/:name` 完整子页；未知区县名显示错误态

- [ ] **Step 1: 重写 src/views/DistrictView.vue**

布局：HeaderBar 复用；(36,110) 返回按钮；(36,150) 区县名大标题；左列 (36,220) 2×3 KPI 卡；中央 (480,180) 900×780 地图（当前区县高亮）；右列 (1420,180) 460 宽三个面板（还款结构双柱 / 月度趋势三折线 / 调解组织表）。

```vue
<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import HeaderBar from '@/components/layout/HeaderBar.vue'
import SubTitle from '@/components/layout/SubTitle.vue'
import NumberFlop from '@/components/common/NumberFlop.vue'
import ScrollTable from '@/components/common/ScrollTable.vue'
import type { ScrollColumn } from '@/types'
import ChongqingMap from '@/components/map/ChongqingMap.vue'
import { useECharts } from '@/composables/useECharts'
import { buildDoubleBarOption, buildMultiLineOption } from '@/utils/chartOptions'
import { getDistrictDetail } from '@/api'
import type { DistrictDetail, DistrictKpi } from '@/types'
import bgMain from '@/assets/images/bg-main.png'

const props = defineProps<{ name: string }>()
const router = useRouter()

const detail = ref<DistrictDetail | null>(null)
const notFound = ref(false)
const error = ref('')

const barEl = ref<HTMLElement | null>(null)
const lineEl = ref<HTMLElement | null>(null)
const { setOption: setBar } = useECharts(barEl)
const { setOption: setLine } = useECharts(lineEl)

const LINE_COLORS: Record<string, string> = { 询问: '#2e82db', 转办: '#edd892', 有责: '#44ffa2' }

interface KpiCard {
  key: keyof DistrictKpi
  title: string
  suffix: string
}
const KPI_CARDS: KpiCard[] = [
  { key: 'tj', title: '累计调解案件', suffix: '万件' },
  { key: 'kl', title: '当事人可联案件', suffix: '万件' },
  { key: 'tc', title: '实际调成案件', suffix: '万件' },
  { key: 'month_tj', title: '当月调解案件', suffix: '万件' },
  { key: 'yx', title: '累计履行金额', suffix: '万元' },
  { key: 'month_yx', title: '及时履行金额', suffix: '万元' }
]

const ORG_COLUMNS: ScrollColumn[] = [
  { key: 'lx', title: '调解组织', width: '40%' },
  { key: 'rs', title: '人员', width: '15%', align: 'center' },
  { key: 'dx', title: '电询', width: '15%', align: 'center', color: '#edd892' },
  { key: 'bwt', title: '被委托案', width: '30%', align: 'center' }
]

async function load() {
  try {
    notFound.value = false
    detail.value = await getDistrictDetail(props.name)
    if (!detail.value) {
      notFound.value = true
      return
    }
    setBar(buildDoubleBarOption(detail.value.huankuan), true)
    setLine(buildMultiLineOption(detail.value.trend, LINE_COLORS, { areaSeries: '询问' }), true)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}
onMounted(load)
watch(() => props.name, load)

const num = (v: string | undefined) => (v ? parseFloat(v) : 0)
</script>

<template>
  <div class="district">
    <img class="bg" :src="bgMain" alt="" />
    <HeaderBar />
    <div class="back" @click="router.push('/')">‹ 返回总览</div>

    <div v-if="error" class="center-tip">{{ error }}</div>
    <div v-else-if="notFound" class="center-tip">
      <p>未找到该区县：{{ name }}</p>
      <button @click="router.push('/')">返回主屏</button>
    </div>
    <template v-else-if="detail">
      <h2 class="district-name">{{ name }} · 调解态势</h2>

      <div class="kpi-grid">
        <div v-for="c in KPI_CARDS" :key="c.key" class="kpi-card">
          <div class="title">{{ c.title }}</div>
          <div class="value">
            <NumberFlop :value="num(detail.kpi[c.key])" :decimals="2" :font-size="30" />
            <span class="suffix">{{ c.suffix }}</span>
          </div>
        </div>
      </div>

      <ChongqingMap class="pos-map" :focus="name" :show-lines="false" />

      <div class="right-col">
        <SubTitle title="还款结构（近6月）" :width="460" />
        <div ref="barEl" class="chart" />
        <SubTitle title="电询转办月度趋势" :width="460" />
        <div ref="lineEl" class="chart" />
        <SubTitle title="调解组织" :width="460" />
        <ScrollTable :columns="ORG_COLUMNS" :rows="(detail.orgs as unknown as Record<string, unknown>[])" :height="200" :row-height="36" />
      </div>
    </template>
  </div>
</template>

<style scoped>
.district { position: absolute; inset: 0; overflow: hidden; }
.bg { position: absolute; left: 0; top: 0; width: 1920px; height: 1080px; }
.back {
  position: absolute; left: 36px; top: 110px; z-index: 30; padding: 6px 18px;
  font-family: 'OPPOSans-R'; font-size: 16px; color: #a5bde5; cursor: pointer;
  border: 1px solid rgba(36, 131, 255, 0.5); border-radius: 2px;
  background: linear-gradient(180deg, #1f335e, #111c2e);
}
.back:hover { color: #fff; border-color: #00deff; }
.district-name {
  position: absolute; left: 36px; top: 152px;
  font-family: 'YouSheBiaoTiHei'; font-size: 34px; font-weight: normal; letter-spacing: 2px;
  background: linear-gradient(180deg, #b0dbfa, #ffffff);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.kpi-grid {
  position: absolute; left: 36px; top: 220px; width: 400px;
  display: grid; grid-template-columns: 1fr 1fr; gap: 24px 16px;
}
.kpi-card {
  padding: 14px 16px; border: 1px solid rgba(36, 131, 255, 0.25); border-radius: 2px;
  background: linear-gradient(180deg, rgba(12, 40, 90, 0.5), rgba(5, 20, 50, 0.6));
}
.kpi-card .title { font-family: 'OPPOSans-R'; font-size: 14px; color: #90a3c8; margin-bottom: 8px; }
.kpi-card .value { display: flex; align-items: baseline; gap: 6px; }
.kpi-card .suffix { font-family: 'OPPOSans-R'; font-size: 13px; color: #90a3c8; }
.pos-map { position: absolute; left: 480px; top: 180px; width: 900px; height: 780px; }
.right-col { position: absolute; left: 1420px; top: 180px; width: 460px; display: flex; flex-direction: column; gap: 10px; }
.right-col .chart { width: 460px; height: 230px; }
.center-tip {
  position: absolute; inset: 0; display: flex; flex-direction: column; gap: 20px;
  align-items: center; justify-content: center; font-size: 24px; color: #a5bde5;
}
.center-tip button {
  padding: 8px 28px; font-size: 16px; color: #fff; cursor: pointer;
  background: linear-gradient(180deg, #2a4a8a, #16233d);
  border: 1px solid #2483ff; border-radius: 2px;
}
</style>
```

- [ ] **Step 2: 验证**

```bash
cd /Users/fei/cqbigscreen && npx vue-tsc --noEmit
```
Expected: 通过。dev server 交互验证清单：
1. 主屏点击"江北区" → 子页标题"江北区 · 调解态势"，KPI 6 卡有值
2. 地图上江北区高亮（select 样式），其余区块暗淡，无飞线
3. 右列三个面板渲染（双柱 / 三折线 / 组织表）
4. 子页地图点击"渝中区" → 路由与内容切换到渝中区（watch 生效）
5. "返回总览"与浏览器后退均回主屏
6. 手输 URL `#/district/不存在区` → 显示"未找到该区县"+ 返回按钮

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: 区县下钻子页（KPI/高亮地图/还款结构/趋势/组织表）

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 14: 全链路 QA、视觉校准与构建验证

**Files:**
- Modify: 前序任务产出的任意文件（仅校准性微调：坐标/字号/颜色/图标分配）

**Interfaces:**
- Consumes: `docs/superpowers/reference/nanan-full.png`（视觉基准）、全部前序产出
- Produces: 通过验收的可交付版本

- [ ] **Step 1: 类型与构建验证**

```bash
cd /Users/fei/cqbigscreen && npx vue-tsc --noEmit && npm run build
```
Expected: 均通过；`dist/` 生成。

```bash
npm run preview & SERVER_PID=$!; sleep 2; curl -s -o /dev/null -w '%{http_code}' http://localhost:4173/; echo; kill $SERVER_PID
```
Expected: `200`（构建产物可服务）。

- [ ] **Step 2: 视觉对照（headless browser 截图 vs 基准图）**

启动 dev server，用 gstack `/browse`（或等价 headless 浏览器）以 1920×1080 视口截图主屏，与 `docs/superpowers/reference/nanan-full.png` 并排对照。逐区块检查并修正：
- 顶栏：标题条/时钟/全屏按钮位置
- KPI：数值、字号、图标（若 icon-quality-1..4 等分配与截图不符，对照 `orignal-assets/datav-nanan/preview.html` 里的图片重新分配 Task 1 的 cp 映射并更新组件引用）
- 中列/右列：各面板标题、数字、图表配色（蓝 #2483FF 系、金 #edd892）、表格列宽
- 底部：指导单位文字位置
- 地图：区块描边发光是否美观，38 个 label 若过挤则改为 `label.show: false`（仅 hover 显示）

- [ ] **Step 3: 交互 QA 清单（headless 或人工执行）**

1. 主屏加载 3 秒内所有面板出数，无控制台报错
2. hover 5 个不同区县：高亮 + tooltip 数据正确（与 `src/mocks/district_map.json` 抽查一致）
3. 点击 3 个区县下钻，子页数据随路由切换
4. 子页返回 → 主屏状态完好（图表/滚动动画正常）
5. 浏览器前进/后退各 2 次，路由与页面一致
6. `#/district/不存在区` 错误态正常
7. 窗口缩放到 1280×720 与 2560×1440：等比缩放无布局破碎
8. 全屏按钮进入/退出正常

- [ ] **Step 4: 消费迭代（如有问题）**

对 QA 发现的每个问题：修复 → 重跑 `npx vue-tsc --noEmit` → 重新截图确认。全部通过后进入 Step 5。

- [ ] **Step 5: 最终 Commit**

```bash
git add -A && git commit -m "chore: 全链路 QA 视觉校准与构建验证通过

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## 执行注意事项（Plan 级）

1. **顺序执行**：Task 1→14 有依赖链（资源→数据→组件→视图→QA），不可乱序；Task 7-11 之间彼此独立，可并行。
2. **坐标是逆向近似值**：布局速查表来自 DataV 配置逆向 + 截图核对，执行中以 `docs/superpowers/reference/nanan-full.png` 为最终视觉裁决，允许 ±10px 微调，无需回改本计划。
3. **图标分配是推测**：144×144 图标集与面板的对应关系（icon-quality-1..4 等）按尺寸/引用推断，Task 14 视觉对照时统一校正。
4. **禁止引入额外依赖**：不加 UI 库、不加 Pinia、不加 axios（mock 层为静态 import）。
5. **地图 label 拥挤**是已知风险：38 区县在主城九区非常密集，Task 12/14 中若确认拥挤，主屏默认关 label（hover 显示），子页同样处理。

## Self-Review 记录（写计划时已核对）

- **Spec 覆盖**：spec §1 技术栈/结构 → Task 1-5；§2 主屏布局 → Task 6-11；§2 子页 → Task 13；§3 地图交互 → Task 4+12；§4 数据层 → Task 2-3；§5 视觉还原 → Task 1+6-11+14；§6 错误处理 → 各面板 err 态 + 子页 notFound + 地图 err 覆盖；§7 验证 → 各任务 verify 步骤 + Task 14。范围外三项（视频监控 ez-player 用视频横幅原样呈现顶栏、南海诸岛不做、移动端不做）均未出现在任务中。✓
- **数据一致性**：12 接口字段名与 `orignal-assets/api-snapshots/*.json` 实测一致（dxmonth 三系列=询问/转办/有责；kejifuneng content=外呼/失联修复/情绪监控；huankuan 34 省双系列）。✓
- **类型一致性**：`XYItem`/`DistrictMapItem`/`DistrictDetail`/`ScrollColumn` 等在 Task 2/3/5/7-13 间签名一致；`buildDoubleBarOption`/`buildMultiLineOption` 的调用处（Task 8/10/13）与定义（Task 5）参数一致；`ChongqingMap` props（Task 12 定义，Task 13 消费 `:focus`/`:show-lines`）一致。✓
- **占位符扫描**：无 TBD/TODO/"稍后实现"；所有代码步骤给出完整代码；图标分配的不确定性已显式声明为 Task 14 的校准项而非留白。✓




