import { describe, expect, it } from 'vitest'
import { MAP_DISTRICT_CAROUSEL_RESUME_DELAY_MS } from './mapDistrictHoverCarousel'
import { createMapHoverCoordinator } from './mapHoverCoordinator'

describe('map hover coordinator', () => {
  it('arbitrates a model hit over editor focus over carousel while whitespace remains idle', () => {
    const hover = createMapHoverCoordinator(['A', 'B', 'C'], true, 0)
    expect(hover.current()).toBe('A')

    expect(hover.setAuthoringFocus('B', 100)).toBe('B')
    expect(hover.tick(20_000)).toBe('B')

    expect(hover.pointerEnter(1_000)).toBe('B')
    expect(hover.pointerMove('C', 1_100)).toBe('C')
    expect(hover.pointerMove(null, 1_200)).toBe('B')
    expect(hover.pointerLeave(20_100)).toBe('B')

    expect(hover.setAuthoringFocus(null, 20_200)).toBeNull()
    expect(hover.tick(20_200 + MAP_DISTRICT_CAROUSEL_RESUME_DELAY_MS - 1)).toBeNull()
    expect(hover.tick(20_200 + MAP_DISTRICT_CAROUSEL_RESUME_DELAY_MS)).toBe('A')
  })

  it('resumes automatic hover after idle delay without whitespace movement resetting the timer', () => {
    const hover = createMapHoverCoordinator(['A', 'B', 'C'], true, 0)

    expect(hover.pointerEnter(100)).toBeNull()
    expect(hover.pointerMove(null, 5_000)).toBeNull()
    expect(hover.tick(10_099)).toBeNull()
    expect(hover.tick(10_100)).toBe('B')
    expect(hover.pointerMove(null, 12_000)).toBe('B')
    expect(hover.tick(15_100)).toBe('C')

    expect(hover.pointerMove('C', 16_000)).toBe('C')
    expect(hover.pointerMove(null, 16_100)).toBeNull()
    expect(hover.tick(26_099)).toBeNull()
    expect(hover.tick(26_100)).toBe('A')
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
