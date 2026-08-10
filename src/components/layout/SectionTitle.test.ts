// @vitest-environment happy-dom
import { createApp } from 'vue'
import { describe, expect, it } from 'vitest'
import SectionTitle from './SectionTitle.vue'
import sectionTitleSource from './SectionTitle.vue?raw'

describe('SectionTitle', () => {
  it('reuses the original animated title asset without exposing its legacy watermark as text', () => {
    const host = document.createElement('div')
    const app = createApp(SectionTitle, { title: '扶持成效分析' })
    app.mount(host)

    const image = host.querySelector<HTMLImageElement>('.title-bg')
    expect(image?.getAttribute('src')).toContain('b571ad71f533861c910b290f714bd65f-1dc3fda187.png')
    expect(host.querySelector('.watermark-mask')).not.toBeNull()
    expect(host.querySelector('.title-scan')).not.toBeNull()
    expect(sectionTitleSource).toContain('animation: title-breathe')
    expect(sectionTitleSource).toContain('animation: title-scan')
    expect(sectionTitleSource).toContain('left: 248px; top: 14px; z-index: 4')
    expect(sectionTitleSource).toContain('width: 164px; height: 28px')
    expect(host.textContent).toBe('扶持成效分析')

    app.unmount()
  })
})
