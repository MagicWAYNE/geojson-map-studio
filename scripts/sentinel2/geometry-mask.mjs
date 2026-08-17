const EARTH_RADIUS = 6_378_137
const MAX_LATITUDE = 85.0511287798066

function assert(condition, message) {
  if (!condition) throw new Error(message)
}
function project([longitude, latitude]) {
  const clamped = Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, latitude))
  return [
    EARTH_RADIUS * longitude * Math.PI / 180,
    EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + clamped * Math.PI / 360))
  ]
}

function geometryPolygons(geometry, label) {
  assert(geometry && ['Polygon', 'MultiPolygon'].includes(geometry.type), `${label}: unsupported geometry`)
  const source = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  assert(Array.isArray(source) && source.length > 0, `${label}: empty geometry`)
  return source.map((polygon, polygonIndex) => {
    assert(Array.isArray(polygon) && polygon.length > 0, `${label}: empty polygon ${polygonIndex}`)
    return polygon.map((ring, ringIndex) => {
      assert(Array.isArray(ring) && ring.length >= 4, `${label}: invalid ring ${polygonIndex}.${ringIndex}`)
      return ring.map((position) => {
        assert(
          Array.isArray(position) && position.length >= 2 &&
          Number.isFinite(position[0]) && Number.isFinite(position[1]),
          `${label}: invalid coordinate`
        )
        return project(position)
      })
    })
  })
}

export function projectedPolygonsFromGeoJson(value, label = 'GeoJSON') {
  assert(value?.type === 'FeatureCollection' && Array.isArray(value.features), `${label}: expected FeatureCollection`)
  assert(value.features.length > 0, `${label}: empty FeatureCollection`)
  return value.features.flatMap((feature, index) => geometryPolygons(feature.geometry, `${label}.features[${index}]`))
}

function scanlineIntersections(rings, y) {
  const intersections = []
  for (const ring of rings) {
    for (let index = 0; index < ring.length - 1; index += 1) {
      const [x1, y1] = ring[index]
      const [x2, y2] = ring[index + 1]
      if ((y1 > y) === (y2 > y)) continue
      intersections.push(x1 + (y - y1) * (x2 - x1) / (y2 - y1))
    }
  }
  return intersections.sort((left, right) => left - right)
}

export function rasterizeProjectedCoverage(polygons, projectedBounds, width, height) {
  assert(Array.isArray(polygons) && polygons.length > 0, 'coverage polygons must not be empty')
  assert(Array.isArray(projectedBounds) && projectedBounds.length === 4 && projectedBounds.every(Number.isFinite), 'invalid projected bounds')
  assert(Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0, 'invalid coverage dimensions')
  const [minX, minY, maxX, maxY] = projectedBounds
  assert(maxX > minX && maxY > minY, 'empty projected bounds')
  const pixelWidth = (maxX - minX) / width
  const pixelHeight = (maxY - minY) / height
  const coverage = new Uint8Array(width * height)
  for (let row = 0; row < height; row += 1) {
    const y = maxY - (row + 0.5) * pixelHeight
    for (const polygon of polygons) {
      const intersections = scanlineIntersections(polygon, y)
      assert(intersections.length % 2 === 0, 'invalid polygon scanline intersection count')
      for (let index = 0; index < intersections.length; index += 2) {
        const intervalMin = Math.min(intersections[index], intersections[index + 1])
        const intervalMax = Math.max(intersections[index], intersections[index + 1])
        const firstColumn = Math.max(0, Math.ceil((intervalMin - minX) / pixelWidth - 0.5))
        const lastColumn = Math.min(width - 1, Math.ceil((intervalMax - minX) / pixelWidth - 0.5) - 1)
        for (let column = firstColumn; column <= lastColumn; column += 1) {
          coverage[row * width + column] = 1
        }
      }
    }
  }
  return coverage
}

export function geometryMaskedQuality(samples, coverage) {
  assert(samples instanceof Uint8Array && coverage instanceof Uint8Array, 'quality inputs must be byte arrays')
  assert(samples.length === coverage.length, 'quality sample and coverage lengths differ')
  let coveredPixels = 0
  let noDataPixels = 0
  for (let index = 0; index < samples.length; index += 1) {
    if (!coverage[index]) continue
    coveredPixels += 1
    if (samples[index] === 0) noDataPixels += 1
  }
  assert(coveredPixels > 0, 'target geometry covers no quality-probe pixels')
  return {
    coveredPixels,
    noDataPixels,
    noDataRatio: Number((noDataPixels / coveredPixels).toFixed(6))
  }
}
