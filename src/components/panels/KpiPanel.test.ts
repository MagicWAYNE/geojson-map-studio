// @vitest-environment happy-dom
import { createApp, nextTick } from 'vue'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/api', () => ({
  getDashboardData: vi.fn().mockResolvedValue({
    tj_year_tj: '12.3',
    tj_year_kl: '8.6',
    tj_year_tc: '4.2',
    tj_month_tj: '1.1'
  })
}))

describe('KpiPanel', () => {
  it('renders only the four core hero metrics', async () => {
    const { default: KpiPanel } = await import('./KpiPanel.vue')
    const host = document.createElement('div')
    const app = createApp(KpiPanel)
    app.mount(host)
    await nextTick()

    expect([...host.querySelectorAll('.item .title')].map((item) => item.textContent)).toEqual([
      '累计扶持企业',
      '活跃服务企业',
      '成功孵化企业',
      '当月新增企业'
    ])
    expect(host.querySelectorAll('.item')).toHaveLength(4)

    app.unmount()
  })
})
