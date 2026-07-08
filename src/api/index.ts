import type {
  ApiEnvelope, ChuzhiItem, DashboardData, DistrictDetail, DistrictMapItem, DxData, HgpxItem, JeFenbuItem,
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
import districtMapRaw from '@/mocks/district_map.json'
import districtDetailRaw from '@/mocks/district_detail.json'

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

export async function getDistrictMapData(): Promise<DistrictMapItem[]> {
  await delay()
  return districtMapRaw as DistrictMapItem[]
}

export async function getDistrictDetail(name: string): Promise<DistrictDetail | null> {
  await delay()
  const all = districtDetailRaw as unknown as Record<string, DistrictDetail>
  return all[name] ?? null
}
