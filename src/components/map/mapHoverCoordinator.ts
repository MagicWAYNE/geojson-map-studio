import { createMapDistrictHoverCarousel } from './mapDistrictHoverCarousel'

export interface MapHoverCoordinator {
  current(): string | null
  tick(now: number): string | null
  pointerEnter(now: number): string | null
  pointerMove(name: string | null, now: number): string | null
  pointerLeave(now: number): string | null
  setAuthoringFocus(name: string | null, now: number): string | null
  setCarouselEnabled(enabled: boolean, now: number): string | null
  resetTiming(now: number): string | null
}

export function createMapHoverCoordinator(
  regionKeys: readonly string[],
  carouselEnabled: boolean,
  createdAt: number
): MapHoverCoordinator {
  const keys = new Set(regionKeys)
  const carousel = createMapDistrictHoverCarousel(regionKeys, carouselEnabled, createdAt)
  let pointerKey: string | null = null
  let authoringKey: string | null = null
  let carouselKey = carousel.current()

  const effective = () => pointerKey ?? authoringKey ?? carouselKey

  return {
    current: effective,
    tick(now) {
      carouselKey = carousel.tick(now)
      return effective()
    },
    pointerEnter(now) {
      pointerKey = null
      carouselKey = carousel.pointerEnter(now)
      return effective()
    },
    pointerMove(name, now) {
      pointerKey = name !== null && keys.has(name) ? name : null
      carouselKey = carousel.pointerMove(pointerKey, now)
      return effective()
    },
    pointerLeave(now) {
      pointerKey = null
      carouselKey = carousel.pointerLeave(now)
      return effective()
    },
    setAuthoringFocus(name, now) {
      const next = name !== null && keys.has(name) ? name : null
      const activeChanged = (authoringKey === null) !== (next === null)
      authoringKey = next
      if (activeChanged) carouselKey = carousel.setAuthoringActive(next !== null, now)
      return effective()
    },
    setCarouselEnabled(enabled, now) {
      carouselKey = carousel.setEnabled(enabled, now)
      return effective()
    },
    resetTiming(now) {
      carouselKey = carousel.resetTiming(now)
      return effective()
    }
  }
}
