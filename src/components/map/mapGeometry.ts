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

  const xs = points.map(([x]) => x)
  const ys = points.map(([, y]) => y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
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
