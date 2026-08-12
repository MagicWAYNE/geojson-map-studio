export type Point2 = [number, number]
export type Ring = Point2[]
export type Segment = [Point2, Point2]

export interface RegionOuter {
  ring: Ring
  holes: Ring[]
}

export interface Region {
  name: string
  outers: RegionOuter[]
}

export interface ProjectionResult {
  regions: Region[]
  scale: number
  center: Point2
}

export interface BoundarySegments {
  outer: Segment[]
  inner: Segment[]
  byRegion: Map<string, Segment[]>
}

export function parsePathD(d: string): Ring[] {
  const rings: Ring[] = []
  let current: Ring = []
  for (const match of d.matchAll(/([MLZ])([^MLZ]*)/g)) {
    if (match[1] === 'Z') {
      if (current.length) rings.push(current)
      current = []
      continue
    }
    const nums = match[2].trim().split(/[\s,]+/).filter(Boolean).map(Number)
    const points: Ring = []
    for (let i = 0; i + 1 < nums.length; i += 2) points.push([nums[i], nums[i + 1]])
    if (match[1] === 'M') {
      if (current.length) rings.push(current)
      current = points
    } else {
      current.push(...points)
    }
  }
  if (current.length) rings.push(current)
  return rings
}

function pointInRing([x, y]: Point2, ring: Ring): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[j]
    if (y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) {
      inside = !inside
    }
  }
  return inside
}

/** Returns whether a point lies in an outer ring and outside all of its holes. */
export function pointInRegion(point: Point2, region: Region): boolean {
  return region.outers.some((outer) =>
    pointInRing(point, outer.ring) && !outer.holes.some((hole) => pointInRing(point, hole))
  )
}

function signedRingArea(ring: Ring): number {
  return ring.reduce((area, [x1, y1], index) => {
    const [x2, y2] = ring[(index + 1) % ring.length]
    return area + x1 * y2 - x2 * y1
  }, 0) / 2
}

function ringAreaWeightedMean(ring: Ring): Point2 | null {
  const area = signedRingArea(ring)
  if (Math.abs(area) < Number.EPSILON) return null

  const [x, y] = ring.reduce<[number, number]>(([sumX, sumY], [x1, y1], index) => {
    const [x2, y2] = ring[(index + 1) % ring.length]
    const cross = x1 * y2 - x2 * y1
    return [sumX + (x1 + x2) * cross, sumY + (y1 + y2) * cross]
  }, [0, 0])
  return [x / (6 * area), y / (6 * area)]
}

function regionAreaWeightedMean(rings: Ring[]): Point2 | null {
  let totalArea = 0
  let weightedX = 0
  let weightedY = 0
  for (const ring of rings) {
    const area = signedRingArea(ring)
    const mean = ringAreaWeightedMean(ring)
    if (!mean) continue
    totalArea += area
    weightedX += mean[0] * area
    weightedY += mean[1] * area
  }
  return Math.abs(totalArea) < Number.EPSILON
    ? null
    : [weightedX / totalArea, weightedY / totalArea]
}

function pointBounds(points: Point2[]): {
  minX: number
  maxX: number
  minY: number
  maxY: number
} {
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const [x, y] of points) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { minX, maxX, minY, maxY }
}

/**
 * Finds a deterministic point usable for labels or map-local resources.  A
 * concave polygon's centroid and bounds centre can both be outside the region,
 * so both are followed by a stable grid fallback.
 */
export function findRegionInteriorPoint(region: Region): Point2 | null {
  const outerRings = region.outers.map((outer) => outer.ring).filter((ring) => ring.length)
  const aggregate = regionAreaWeightedMean(outerRings)
  const candidates = aggregate ? [aggregate] : []

  const points = outerRings.flat()
  if (!points.length) return null
  const { minX, maxX, minY, maxY } = pointBounds(points)
  candidates.push([(minX + maxX) / 2, (minY + maxY) / 2])

  for (let row = 0; row < 9; row++) {
    for (let column = 0; column < 9; column++) {
      candidates.push([
        minX + ((column + 0.5) / 9) * (maxX - minX),
        minY + ((row + 0.5) / 9) * (maxY - minY)
      ])
    }
  }

  return candidates.find((point) => pointInRegion(point, region)) ?? null
}

export function parseSvgRegions(svgText: string): Region[] {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  return Array.from(doc.querySelectorAll('path[data-name]')).map((path) => {
    const rings = parsePathD(path.getAttribute('d') ?? '')
    const outerRings = rings.filter((ring) =>
      !rings.some((candidate) => candidate !== ring && pointInRing(ring[0], candidate))
    )
    const holeRings = rings.filter((ring) => !outerRings.includes(ring))
    return {
      name: path.getAttribute('data-name') ?? '',
      outers: outerRings.map((ring) => ({
        ring,
        holes: holeRings.filter((hole) => pointInRing(hole[0], ring))
      }))
    }
  }).filter((region) => region.name && region.outers.length)
}

export function projectRegions(regions: Region[], planeMax: number): ProjectionResult {
  const points = regions.flatMap((region) =>
    region.outers.flatMap((outer) => [outer.ring, ...outer.holes].flat())
  )
  if (!points.length) throw new Error('地图轮廓为空')

  const { minX, maxX, minY, maxY } = pointBounds(points)
  const scale = planeMax / Math.max(maxX - minX, maxY - minY)
  const center: Point2 = [(minX + maxX) / 2, (minY + maxY) / 2]
  const project = ([x, y]: Point2): Point2 => [
    (x - center[0]) * scale,
    (center[1] - y) * scale
  ]

  return {
    scale,
    center,
    regions: regions.map((region) => ({
      name: region.name,
      outers: region.outers.map((outer) => ({
        ring: outer.ring.map(project),
        holes: outer.holes.map((hole) => hole.map(project))
      }))
    }))
  }
}

function ringSegments(ring: Ring): Segment[] {
  return ring.map((point, index) => [point, ring[(index + 1) % ring.length]])
}

function pointKey([x, y]: Point2): string {
  return `${x},${y}`
}

function segmentKey([start, end]: Segment): string {
  const a = pointKey(start)
  const b = pointKey(end)
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

export function classifyBoundarySegments(regions: Region[]): BoundarySegments {
  const buckets = new Map<string, { segment: Segment; count: number }>()
  const byRegion = new Map<string, Segment[]>()

  for (const region of regions) {
    const segments = region.outers.flatMap((outer) =>
      [outer.ring, ...outer.holes].flatMap(ringSegments)
    )
    byRegion.set(region.name, segments)
    for (const segment of segments) {
      const key = segmentKey(segment)
      const bucket = buckets.get(key)
      if (bucket) bucket.count += 1
      else buckets.set(key, { segment, count: 1 })
    }
  }

  const outer: Segment[] = []
  const inner: Segment[] = []
  for (const bucket of buckets.values()) {
    if (bucket.count === 1) outer.push(bucket.segment)
    else inner.push(bucket.segment)
  }
  return { outer, inner, byRegion }
}
