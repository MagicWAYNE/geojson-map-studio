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
