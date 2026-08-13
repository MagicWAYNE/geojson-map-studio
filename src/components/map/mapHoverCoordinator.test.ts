import { describe, expect, it } from 'vitest'
import { MAP_DISTRICT_CAROUSEL_RESUME_DELAY_MS } from './mapDistrictHoverCarousel'
import { createMapHoverCoordinator } from './mapHoverCoordinator'

describe('map hover coordinator', () => {
  it('arbitrates pointer including whitespace over editor focus over carousel', () => {
    const hover = createMapHoverCoordinator(['A', 'B', 'C'], true, 0)
    expect(hover.current()).toBe('A')

    expect(hover.setAuthoringFocus('B', 100)).toBe('B')
    expect(hover.tick(20_000)).toBe('B')

    expect(hover.pointerEnter()).toBeNull()
    expect(hover.pointerMove('C')).toBe('C')
    expect(hover.pointerMove(null)).toBeNull()
    expect(hover.pointerLeave(20_100)).toBe('B')

    expect(hover.setAuthoringFocus(null, 20_200)).toBeNull()
    expect(hover.tick(20_200 + MAP_DISTRICT_CAROUSEL_RESUME_DELAY_MS - 1)).toBeNull()
    expect(hover.tick(20_200 + MAP_DISTRICT_CAROUSEL_RESUME_DELAY_MS)).toBe('A')
  })

  it('ignores stale authoring keys without changing the carousel preference', () => {
    const hover = createMapHoverCoordinator(['A', 'B'], true, 0)
    expect(hover.setAuthoringFocus('旧地图区域', 100)).toBe('A')
    expect(hover.setCarouselEnabled(false, 200)).toBeNull()
    expect(hover.setAuthoringFocus('B', 300)).toBe('B')
    expect(hover.setAuthoringFocus(null, 400)).toBeNull()
    expect(hover.tick(50_000)).toBeNull()
  })
})
