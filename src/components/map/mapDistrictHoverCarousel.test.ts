import { describe, expect, it } from 'vitest'
import {
  MAP_DISTRICT_CAROUSEL_INTERVAL_MS,
  MAP_DISTRICT_CAROUSEL_RESUME_DELAY_MS,
  createMapDistrictHoverCarousel
} from './mapDistrictHoverCarousel'

const DISTRICTS = ['渝中区', '两江新区', '南岸区', '九龙坡区'] as const

describe('map district hover carousel', () => {
  it('activates the first district immediately and advances one district every five seconds', () => {
    const carousel = createMapDistrictHoverCarousel(DISTRICTS, true, 1_000)

    expect(carousel.current()).toBe('渝中区')
    expect(carousel.tick(1_000 + MAP_DISTRICT_CAROUSEL_INTERVAL_MS - 1)).toBe('渝中区')
    expect(carousel.tick(1_000 + MAP_DISTRICT_CAROUSEL_INTERVAL_MS)).toBe('两江新区')

    // Background tabs must not trigger catch-up through several districts at once.
    expect(carousel.tick(60_000)).toBe('南岸区')
    expect(carousel.tick(60_000 + MAP_DISTRICT_CAROUSEL_INTERVAL_MS)).toBe('九龙坡区')
    expect(carousel.tick(60_000 + MAP_DISTRICT_CAROUSEL_INTERVAL_MS * 2)).toBe('渝中区')
  })

  it('gives pointer hover priority and resumes ten seconds after leaving from the following district', () => {
    const carousel = createMapDistrictHoverCarousel(DISTRICTS, true, 0)

    expect(carousel.pointerEnter()).toBeNull()
    expect(carousel.pointerMove('南岸区')).toBe('南岸区')
    expect(carousel.tick(30_000)).toBe('南岸区')

    expect(carousel.pointerLeave(30_100)).toBeNull()
    expect(carousel.tick(30_100 + MAP_DISTRICT_CAROUSEL_RESUME_DELAY_MS - 1)).toBeNull()
    expect(carousel.tick(30_100 + MAP_DISTRICT_CAROUSEL_RESUME_DELAY_MS)).toBe('九龙坡区')
    expect(carousel.tick(
      30_100 + MAP_DISTRICT_CAROUSEL_RESUME_DELAY_MS + MAP_DISTRICT_CAROUSEL_INTERVAL_MS
    )).toBe('渝中区')
  })

  it('keeps automatic hover suspended over map whitespace and cancels resume when re-entered', () => {
    const carousel = createMapDistrictHoverCarousel(DISTRICTS, true, 0)

    carousel.pointerEnter()
    expect(carousel.pointerMove(null)).toBeNull()
    expect(carousel.tick(20_000)).toBeNull()

    carousel.pointerLeave(20_100)
    expect(carousel.tick(25_000)).toBeNull()
    expect(carousel.pointerEnter()).toBeNull()
    expect(carousel.tick(40_000)).toBeNull()

    carousel.pointerLeave(40_100)
    expect(carousel.tick(50_099)).toBeNull()
    expect(carousel.tick(50_100)).toBe('两江新区')
  })

  it('disables only automatic hover and starts immediately when explicitly enabled again', () => {
    const carousel = createMapDistrictHoverCarousel(DISTRICTS, true, 0)

    expect(carousel.setEnabled(false, 100)).toBeNull()
    expect(carousel.tick(20_000)).toBeNull()

    carousel.pointerEnter()
    expect(carousel.pointerMove('南岸区')).toBe('南岸区')
    expect(carousel.setEnabled(true, 20_120)).toBe('南岸区')
    expect(carousel.setEnabled(false, 20_130)).toBe('南岸区')

    carousel.pointerLeave(20_200)
    expect(carousel.tick(50_000)).toBeNull()
    expect(carousel.setEnabled(true, 50_100)).toBe('九龙坡区')
  })

  it('re-enables outside at the district after the last automatic one when no region was pointed', () => {
    const carousel = createMapDistrictHoverCarousel(DISTRICTS, true, 0)

    carousel.pointerEnter()
    carousel.pointerMove(null)
    expect(carousel.setEnabled(false, 100)).toBeNull()
    carousel.pointerLeave(200)

    expect(carousel.setEnabled(true, 300)).toBe('两江新区')
  })

  it('restarts the active deadline when a visible browser tab resumes', () => {
    const carousel = createMapDistrictHoverCarousel(DISTRICTS, true, 0)

    expect(carousel.resetTiming(100_000)).toBe('渝中区')
    expect(carousel.tick(100_000 + MAP_DISTRICT_CAROUSEL_INTERVAL_MS - 1)).toBe('渝中区')
    expect(carousel.tick(100_000 + MAP_DISTRICT_CAROUSEL_INTERVAL_MS)).toBe('两江新区')

    carousel.pointerEnter()
    carousel.pointerLeave(110_100)
    expect(carousel.resetTiming(200_000)).toBe('南岸区')
    expect(carousel.tick(200_000 + MAP_DISTRICT_CAROUSEL_INTERVAL_MS - 1)).toBe('南岸区')
    expect(carousel.tick(200_000 + MAP_DISTRICT_CAROUSEL_INTERVAL_MS)).toBe('九龙坡区')
  })
})
