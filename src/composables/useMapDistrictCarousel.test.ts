import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.resetModules()
})

describe('useMapDistrictCarousel', () => {
  it('shares an enabled-by-default session switch without persistence', async () => {
    const { useMapDistrictCarousel } = await import('./useMapDistrictCarousel')
    const first = useMapDistrictCarousel()
    const second = useMapDistrictCarousel()

    expect(first.enabled.value).toBe(true)
    first.toggle()
    expect(first.enabled.value).toBe(false)
    expect(second.enabled.value).toBe(false)

    vi.resetModules()
    const { useMapDistrictCarousel: reloaded } = await import('./useMapDistrictCarousel')
    expect(reloaded().enabled.value).toBe(true)
  })
})
