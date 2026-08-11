import { describe, expect, it } from 'vitest'
import homeViewSource from './HomeView.vue?raw'

describe('HomeView map-only presentation', () => {
  it('keeps only the background layers and centered map shell', () => {
    expect(homeViewSource).toContain('<img class="bg-main"')
    expect(homeViewSource).toContain('<img class="bg-terrain"')
    expect(homeViewSource).toContain('<ChongqingMap3D class="pos-map" />')
    expect(homeViewSource).not.toContain('<HeaderBar')
    expect(homeViewSource).not.toContain('<KpiPanel')
    expect(homeViewSource).not.toContain('<aside')
    expect(homeViewSource).not.toContain('<MapDebugDrawer')
  })
})
