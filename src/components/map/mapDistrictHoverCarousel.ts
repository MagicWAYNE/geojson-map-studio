export const MAP_DISTRICT_CAROUSEL_INTERVAL_MS = 5_000
export const MAP_DISTRICT_CAROUSEL_RESUME_DELAY_MS = 10_000

export interface MapDistrictHoverCarousel {
  current(): string | null
  tick(now: number): string | null
  pointerEnter(): string | null
  pointerMove(name: string | null): string | null
  pointerLeave(now: number): string | null
  setAuthoringActive(active: boolean, now: number): string | null
  setEnabled(enabled: boolean, now: number): string | null
  resetTiming(now: number): string | null
}

function finiteNow(value: number): number {
  return Number.isFinite(value) ? value : 0
}

export function createMapDistrictHoverCarousel(
  districtNames: readonly string[],
  initiallyEnabled: boolean,
  createdAt: number
): MapDistrictHoverCarousel {
  const names = [...new Set(districtNames.filter(Boolean))]
  let enabled = initiallyEnabled
  let pointerInside = false
  let pointerName: string | null = null
  let authoringActive = false
  let currentIndex = names.length ? 0 : -1
  let lastManualIndex: number | null = null
  let nextAt: number | null = enabled && currentIndex >= 0
    ? finiteNow(createdAt) + MAP_DISTRICT_CAROUSEL_INTERVAL_MS
    : null
  let resumeAt: number | null = null

  function automaticName(): string | null {
    return currentIndex >= 0 ? names[currentIndex] ?? null : null
  }

  function current(): string | null {
    if (pointerInside) return pointerName
    if (authoringActive || !enabled || resumeAt !== null) return null
    return automaticName()
  }

  function tick(nowValue: number): string | null {
    const now = finiteNow(nowValue)
    if (pointerInside) return pointerName
    if (authoringActive || !enabled || currentIndex < 0) return null

    if (resumeAt !== null) {
      if (now < resumeAt) return null
      const baseIndex = lastManualIndex ?? currentIndex
      currentIndex = (baseIndex + 1) % names.length
      lastManualIndex = null
      resumeAt = null
      nextAt = now + MAP_DISTRICT_CAROUSEL_INTERVAL_MS
      return automaticName()
    }

    if (nextAt === null) {
      nextAt = now + MAP_DISTRICT_CAROUSEL_INTERVAL_MS
      return automaticName()
    }
    if (now >= nextAt) {
      currentIndex = (currentIndex + 1) % names.length
      nextAt = now + MAP_DISTRICT_CAROUSEL_INTERVAL_MS
    }
    return automaticName()
  }

  function suspendAutomaticHover(): void {
    pointerInside = true
    nextAt = null
    resumeAt = null
  }

  function pointerEnter(): string | null {
    suspendAutomaticHover()
    pointerName = null
    return null
  }

  function pointerMove(name: string | null): string | null {
    suspendAutomaticHover()
    const index = name === null ? -1 : names.indexOf(name)
    pointerName = index >= 0 ? names[index] : null
    if (index >= 0) lastManualIndex = index
    return pointerName
  }

  function pointerLeave(nowValue: number): string | null {
    pointerInside = false
    pointerName = null
    nextAt = null
    resumeAt = enabled && currentIndex >= 0
      && !authoringActive
      ? finiteNow(nowValue) + MAP_DISTRICT_CAROUSEL_RESUME_DELAY_MS
      : null
    return null
  }

  function setAuthoringActive(active: boolean, nowValue: number): string | null {
    if (authoringActive === active) return current()
    authoringActive = active
    nextAt = null
    resumeAt = null
    if (authoringActive || pointerInside || !enabled || currentIndex < 0) return current()
    resumeAt = finiteNow(nowValue) + MAP_DISTRICT_CAROUSEL_RESUME_DELAY_MS
    return null
  }

  function setEnabled(nextEnabled: boolean, nowValue: number): string | null {
    if (enabled === nextEnabled) return current()
    enabled = nextEnabled
    nextAt = null
    resumeAt = null
    if (!enabled || pointerInside || authoringActive || currentIndex < 0) return current()
    currentIndex = ((lastManualIndex ?? currentIndex) + 1) % names.length
    lastManualIndex = null
    nextAt = finiteNow(nowValue) + MAP_DISTRICT_CAROUSEL_INTERVAL_MS
    return automaticName()
  }

  function resetTiming(nowValue: number): string | null {
    if (pointerInside || authoringActive || !enabled || currentIndex < 0) return current()
    const now = finiteNow(nowValue)
    if (resumeAt !== null) {
      return now >= resumeAt ? tick(now) : null
    }
    nextAt = now + MAP_DISTRICT_CAROUSEL_INTERVAL_MS
    return automaticName()
  }

  return {
    current,
    tick,
    pointerEnter,
    pointerMove,
    pointerLeave,
    setAuthoringActive,
    setEnabled,
    resetTiming
  }
}
