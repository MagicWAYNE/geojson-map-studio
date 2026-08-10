import { describe, expect, it } from 'vitest'
import {
  formatWeeklyMonthLabel,
  toEntrepreneurshipOrganizations,
  toEntrepreneurshipRequests,
  toEntrepreneurshipTraining,
  toServiceTrendSeries,
  toSupportSeries,
  toDemoWeeklySupportSeries
} from './entrepreneurshipTheme'

describe('entrepreneurship theme adapters', () => {
  it('renames chart series without mutating the source values', () => {
    const supportSource = [{ x: '重庆', y: 12, colorField: '全额还款' }]
    const trendSource = [{ x: '1月', y: 8, colorField: '询问' }]

    expect(toSupportSeries(supportSource)).toEqual([
      { x: '重庆', y: 12, colorField: '场地支持' }
    ])
    expect(toServiceTrendSeries(trendSource)).toEqual([
      { x: '1月', y: 8, colorField: '咨询' }
    ])
    expect(supportSource[0].colorField).toBe('全额还款')
    expect(trendSource[0].colorField).toBe('询问')
  })

  it('replaces organization and request copy at the display boundary', () => {
    const organizations = toEntrepreneurshipOrganizations([
      { id: 1, lx: '旧名称', bwt: 1, rs: 2, bl: '90%', dx: 3 }
    ])
    const requests = toEntrepreneurshipRequests([
      { zb: 1, sl: 7, lx: '旧诉求', base: 1, czjg: '旧措施', dw: '旧措施', img: '' }
    ])

    expect(organizations[0].lx).toBe('星火创业服务站')
    expect(requests[0]).toMatchObject({
      lx: '政策申报材料咨询',
      czjg: '提供申报清单，安排专员协助完善材料'
    })
  })

  it('builds six months of weekly support bars with month-first labels', () => {
    const weekly = toDemoWeeklySupportSeries([
      { x: '重庆', y: 12, colorField: '场地支持' },
      { x: '重庆', y: 8, colorField: '资源对接' },
      { x: '四川', y: 15, colorField: '场地支持' }
    ])

    expect(weekly).toHaveLength(24)
    expect(weekly.slice(0, 5).map((item) => item.x)).toEqual([
      '1月·第1周', '1月·第2周', '1月·第3周', '1月·第4周', '2月·第1周'
    ])
    expect(new Set(weekly.map((item) => item.colorField))).toEqual(new Set(['周扶持企业']))
    expect(weekly.slice(0, 4).map((item) => item.y)).toEqual([20, 15, 20, 15])
    expect(formatWeeklyMonthLabel(weekly[0].x)).toBe('1月')
    expect(formatWeeklyMonthLabel(weekly[1].x)).toBe('')
  })

  it('expands the entrepreneurship training schedule to six visible sessions', () => {
    const training = toEntrepreneurshipTraining([
      { zt: '旧主题1', rs: 17, rq: '2026-04-20 09:30:31' },
      { zt: '旧主题2', rs: 13, rq: '2026-06-15 17:10:00' },
      { zt: '旧主题3', rs: 12, rq: '2026-05-18 09:30:00' }
    ])

    expect(training).toHaveLength(6)
    expect(training.map((item) => item.zt)).toContain('创业项目路演表达训练')
    expect(training.map((item) => item.zt)).toContain('企业用工与团队建设走访')
    expect(training.map((item) => item.zt)).toContain('孵化空间运营实务交流')
  })
})
