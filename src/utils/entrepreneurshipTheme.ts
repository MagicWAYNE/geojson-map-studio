import type {
  ChuzhiItem,
  DistrictDetail,
  HgpxItem,
  KejifunengItem,
  XYItem,
  ZuzhizhixiaoItem
} from '@/types'

const SUPPORT_SERIES: Record<string, string> = {
  '全额还款': '场地支持',
  '分期还款': '资源对接'
}

const SERVICE_TREND_SERIES: Record<string, string> = {
  '询问': '咨询',
  '转办': '跟进',
  '有责': '已解决'
}

export const SERVICE_TREND_COLORS: Record<string, string> = {
  '咨询': '#2e82db',
  '跟进': '#edd892',
  '已解决': '#44ffa2'
}

const SERVICE_ORGANIZATIONS: Record<number, string> = {
  1: '星火创业服务站',
  2: '新程创业服务站',
  3: '启航创业服务站',
  4: '智汇创业服务站',
  5: '渝创创业服务站'
}

const SERVICE_TECHNOLOGY_LABELS: Record<number, string> = {
  1: '智能触达',
  2: '企业画像',
  3: '需求预警'
}

const TRAINING_TOPICS: Record<string, string> = {
  '2026-04-20': '创业政策申报与项目管理培训',
  '2026-06-15': '创业导师服务能力提升培训',
  '2026-05-18': '孵化载体运营经验交流会'
}

const SERVICE_REQUESTS: Record<number, { lx: string; czjg: string }> = {
  1: { lx: '政策申报材料咨询', czjg: '提供申报清单，安排专员协助完善材料' },
  2: { lx: '创业导师预约', czjg: '完成需求登记，匹配对应领域创业导师' },
  3: { lx: '办公场地申请', czjg: '核对入驻条件，推荐可用孵化空间' },
  4: { lx: '项目路演报名', czjg: '确认项目阶段，安排近期路演专场' },
  6: { lx: '创业服务进度查询', czjg: '同步当前办理节点与下一步服务安排' },
  7: { lx: '企业信息变更', czjg: '更新企业联络信息并同步服务档案' },
  8: { lx: '暂停服务申请', czjg: '确认企业需求，暂停后续服务提醒' },
  10: { lx: '服务建议反馈', czjg: '记录改进建议，交由服务团队跟进' },
  11: { lx: '联系人信息修正', czjg: '核实企业联系人并更新服务档案' }
}

export function toSupportSeries(list: XYItem[]): XYItem[] {
  return list.map((item) => ({
    ...item,
    colorField: SUPPORT_SERIES[item.colorField] ?? item.colorField
  }))
}

export function toServiceTrendSeries(list: XYItem[]): XYItem[] {
  return list.map((item) => ({
    ...item,
    colorField: SERVICE_TREND_SERIES[item.colorField] ?? item.colorField
  }))
}

export function toEntrepreneurshipTech(list: KejifunengItem[]): KejifunengItem[] {
  return list.map((item) => ({
    ...item,
    content: SERVICE_TECHNOLOGY_LABELS[item.id] ?? `服务工具${item.id}`,
    child: {
      ...item.child,
      mc: '累计服务',
      mc1: item.child.mc1 === '今日' ? '今日新增' : '本月新增'
    }
  }))
}

export function toEntrepreneurshipOrganizations<
  T extends Pick<ZuzhizhixiaoItem, 'lx'> & { id?: number }
>(
  list: T[],
  districtName = ''
): T[] {
  return list.map((item, index) => ({
    ...item,
    lx: districtName
      ? `${districtName}创业服务站${index + 1}`
      : SERVICE_ORGANIZATIONS[item.id ?? -1] ?? `创业服务站${index + 1}`
  }))
}

export function toEntrepreneurshipRequests(list: ChuzhiItem[]): ChuzhiItem[] {
  return list.map((item) => {
    const copy = SERVICE_REQUESTS[item.zb] ?? {
      lx: '创业服务咨询',
      czjg: '记录企业需求，安排服务专员跟进'
    }
    return { ...item, lx: copy.lx, czjg: copy.czjg, dw: copy.czjg }
  })
}

export function toEntrepreneurshipTraining(list: HgpxItem[]): HgpxItem[] {
  return list.map((item) => ({
    ...item,
    zt: TRAINING_TOPICS[item.rq.slice(0, 10)] ?? '创业服务能力提升培训'
  }))
}

export function toEntrepreneurshipDistrictDetail(
  detail: DistrictDetail,
  districtName: string
): DistrictDetail {
  return {
    ...detail,
    huankuan: toSupportSeries(detail.huankuan),
    trend: toServiceTrendSeries(detail.trend),
    orgs: toEntrepreneurshipOrganizations(detail.orgs, districtName)
  }
}
