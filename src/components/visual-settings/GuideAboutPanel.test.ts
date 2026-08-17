// @vitest-environment happy-dom
import { createApp } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import GuideAboutPanel from './GuideAboutPanel.vue'

afterEach(() => {
  document.body.replaceChildren()
})

describe('GuideAboutPanel', () => {
  it('renders the introduction and the complete usage guide', () => {
    const root = document.createElement('div')
    const app = createApp(GuideAboutPanel)
    app.mount(root)

    expect(root.querySelectorAll('.guide-about__section')).toHaveLength(3)
    expect(root.textContent).toContain('选择区域或导入 GeoJSON')
    expect(root.textContent).toContain('数据大屏、指挥舱页面、PPT、公众号、小红书')
    expect(root.textContent).toContain('分块数据配置')
    expect(root.textContent).toContain('鼠标左键拖动可旋转模型角度')
    expect(root.textContent).toContain('鼠标中键拖动可调整缩放')
    expect(root.textContent).toContain('鼠标右键拖动可调整位置')

    const steps = root.querySelector<HTMLOListElement>('.guide-about__steps')!
    expect(steps.tagName).toBe('OL')
    expect(steps.querySelectorAll(':scope > li')).toHaveLength(4)

    const dataV = root.querySelector<HTMLAnchorElement>(
      'a[href="https://datav.aliyun.com/portal/school/atlas/area_selector"]'
    )!
    expect(dataV.textContent).toContain('阿里云 DataV')
    expect(dataV.target).toBe('_blank')
    expect(dataV.rel).toBe('noreferrer')
    app.unmount()
  })

  it('keeps three accessible contact icons without the removed service message', () => {
    const root = document.createElement('div')
    const app = createApp(GuideAboutPanel)
    app.mount(root)

    const footer = root.querySelector('footer')!
    expect(root.textContent).not.toContain('如需定制化服务可以通过以下方式联系我。')
    expect(footer.querySelector('p')).toBeNull()
    const links = [...footer.querySelectorAll<HTMLAnchorElement>('a')]
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'https://github.com/MagicWAYNE/geojson-map-studio',
      'https://x.com/Wolfrid10888630',
      'mailto:wei.mingda@outlook.com'
    ])
    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
      '在 GitHub 查看本项目',
      '在 X 联系我',
      '发送邮件至 wei.mingda@outlook.com'
    ])
    expect(footer.querySelectorAll('svg')).toHaveLength(3)
    app.unmount()
  })
})
