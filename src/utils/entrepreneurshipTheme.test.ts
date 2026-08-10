import { describe, expect, it } from 'vitest'
import {
  toEntrepreneurshipOrganizations,
  toEntrepreneurshipRequests,
  toServiceTrendSeries,
  toSupportSeries
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
})
