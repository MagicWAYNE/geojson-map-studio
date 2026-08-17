import { createHash } from 'node:crypto'
import { inflateSync } from 'node:zlib'

export const OFFICIAL_SOURCE = Object.freeze({
  stacCollection: 'sentinel-2-global-mosaics',
  sentinelHubCollection: 'byoc-5460de54-082e-473a-b6ea-d5cbe3c17cca',
  requiredBands: ['B02', 'B03', 'B04', 'B08', 'observations'],
  allowedItemAssets: ['B02', 'B03', 'B04', 'B08', 'observations', 'Product', 'userdata']
})

export const QUARTERS = Object.freeze({
  '2025-Q2': { from: '2025-04-01T00:00:00Z', to: '2025-06-30T23:59:59Z' },
  '2025-Q3': { from: '2025-07-01T00:00:00Z', to: '2025-09-30T23:59:59Z' },
  '2025-Q4': { from: '2025-10-01T00:00:00Z', to: '2025-12-31T23:59:59Z' }
})

export const QUALITY_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["dataMask", "observations"] }],
    output: { bands: 1, sampleType: "UINT8" }
  };
}

function evaluatePixel(sample) {
  return [sample.dataMask > 0 && sample.observations > 0 ? 255 : 0];
}
`

export const RGB_EVALSCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B02", "B03", "B04"] }],
    output: { bands: 3, sampleType: "AUTO" }
  };
}

function tone(value) {
  return Math.pow(Math.min(1, Math.max(0, value / 10000 * 2.5)), 0.9);
}

function evaluatePixel(sample) {
  return [tone(sample.B04), tone(sample.B03), tone(sample.B02)];
}
`

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

export function quarterTimeRange(quarter) {
  assert(typeof quarter === 'string' && quarter !== 'latest', 'quarter must be an explicit pinned release')
  const range = QUARTERS[quarter]
  assert(range, `unknown quarterly mosaic release: ${quarter}`)
  return range
}

export function validateOfficialCollection(value) {
  assert(value?.id === OFFICIAL_SOURCE.sentinelHubCollection, 'unexpected Sentinel Hub collection id')
  assert(value?.title === 'Sentinel-2 Quarterly Mosaics', 'unexpected Sentinel Hub collection title')
  const bands = value?.summaries?.['eo:bands']?.map((band) => band?.name)
  assert(Array.isArray(bands), 'Sentinel Hub collection does not advertise eo:bands')
  assert(
    bands.length === OFFICIAL_SOURCE.requiredBands.length &&
    OFFICIAL_SOURCE.requiredBands.every((band) => bands.includes(band)),
    `Sentinel Hub collection bands changed: ${bands.join(',')}`
  )
  return value
}

export function validateOfficialStacCollection(value) {
  assert(value?.id === OFFICIAL_SOURCE.stacCollection, 'unexpected STAC collection id')
  assert(value?.title === 'Sentinel-2 Global Mosaics', 'unexpected STAC collection title')
  return value
}

export function validateQuarterlyItems(value, requiredQuarters) {
  assert(Array.isArray(value?.features) && value.features.length > 0, 'STAC search returned no quarterly mosaic items')
  const seen = new Set()
  for (const [index, item] of value.features.entries()) {
    const match = String(item?.id ?? '').match(/Sentinel-2_mosaic_(\d{4})_Q([1-4])_/)
    assert(match, `STAC item ${index} has an unknown quarterly id`)
    const quarter = `${match[1]}-Q${match[2]}`
    const expectedRange = QUARTERS[quarter]
    if (!expectedRange) continue
    assert(item.properties?.start_datetime === expectedRange.from, `${item.id}: quarterly start changed`)
    assert(item.properties?.end_datetime === expectedRange.to, `${item.id}: quarterly end changed`)
    const assets = Object.keys(item.assets ?? {})
    assert(OFFICIAL_SOURCE.requiredBands.every((band) => assets.includes(band)), `${item.id}: required band asset missing`)
    assert(assets.every((asset) => OFFICIAL_SOURCE.allowedItemAssets.includes(asset)), `${item.id}: unknown band or asset advertised`)
    seen.add(quarter)
  }
  for (const quarter of requiredQuarters) {
    quarterTimeRange(quarter)
    assert(seen.has(quarter), `STAC search did not return ${quarter}`)
  }
  return { quarters: [...seen].sort(), itemCount: value.features.length }
}

export function estimateProbeBudget({
  targetCount,
  targets = null,
  quarterCount,
  minimumLongDimension = 128,
  maximumMetersPerPixel = 1590,
  inputBandCount = 2
}) {
  const resolvedTargetCount = targets?.length ?? targetCount
  assert(Number.isInteger(resolvedTargetCount) && resolvedTargetCount > 0, 'invalid probe target count')
  assert(Number.isInteger(quarterCount) && quarterCount > 0, 'invalid probe quarter count')
  assert(Number.isInteger(minimumLongDimension) && minimumLongDimension > 0 && minimumLongDimension <= 2500, 'invalid probe dimension')
  const requestCount = resolvedTargetCount * quarterCount
  const pixelsPerQuarter = targets
    ? targets.reduce((sum, target) => {
        const dimensions = probeDimensions(target, minimumLongDimension, maximumMetersPerPixel)
        return sum + dimensions.width * dimensions.height
      }, 0)
    : resolvedTargetCount * minimumLongDimension * minimumLongDimension
  const outputPixels = pixelsPerQuarter * quarterCount
  return {
    requestCount,
    maximumOutputPixels: outputPixels,
    estimatedProcessingUnits: Number((outputPixels / (512 * 512) * inputBandCount / 3).toFixed(3))
  }
}

export function assertWithinBudget(estimate, { maximumRequests, maximumProcessingUnits }) {
  assert(estimate.requestCount <= maximumRequests, `request budget exceeded: ${estimate.requestCount} > ${maximumRequests}`)
  assert(estimate.estimatedProcessingUnits <= maximumProcessingUnits, `PU budget exceeded: ${estimate.estimatedProcessingUnits} > ${maximumProcessingUnits}`)
  return estimate
}

export function probeDimensions(target, minimumLongDimension, maximumMetersPerPixel = 1590) {
  const scale = minimumLongDimension / Math.max(target.width, target.height)
  const spanX = target.projectedBounds[2] - target.projectedBounds[0]
  const spanY = target.projectedBounds[3] - target.projectedBounds[1]
  const width = Math.max(1, Math.round(target.width * scale), Math.ceil(spanX / maximumMetersPerPixel))
  const height = Math.max(1, Math.round(target.height * scale), Math.ceil(spanY / maximumMetersPerPixel))
  assert(width <= 2500 && height <= 2500, 'quality probe exceeds Process API dimensions')
  return { width, height }
}

export function buildQualityProbeRequest(
  target,
  quarter,
  minimumLongDimension = 128,
  maximumMetersPerPixel = 1590
) {
  const dimensions = probeDimensions(target, minimumLongDimension, maximumMetersPerPixel)
  return buildQualityProcessRequest(target.projectedBounds, dimensions, quarter)
}

export function buildQualityProcessRequest(projectedBounds, dimensions, quarter) {
  const timeRange = quarterTimeRange(quarter)
  return {
    request: {
      input: {
        bounds: {
          bbox: projectedBounds,
          properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/3857' }
        },
        data: [{
          type: OFFICIAL_SOURCE.sentinelHubCollection,
          dataFilter: { timeRange },
          processing: { upsampling: 'BILINEAR', downsampling: 'BILINEAR' }
        }]
      },
      output: {
        width: dimensions.width,
        height: dimensions.height,
        responses: [{ identifier: 'default', format: { type: 'image/png' } }]
      },
      evalscript: QUALITY_EVALSCRIPT
    },
    dimensions,
    evalscriptSha256: createHash('sha256').update(QUALITY_EVALSCRIPT).digest('hex')
  }
}

export function buildRgbProcessRequest(target, quarter, dimensions = null, projectedBounds = target.projectedBounds) {
  const timeRange = quarterTimeRange(quarter)
  const output = dimensions ?? { width: target.width, height: target.height }
  assert(
    Number.isInteger(output.width) && Number.isInteger(output.height) &&
    output.width > 0 && output.height > 0 && output.width <= 2500 && output.height <= 2500,
    'invalid RGB output dimensions'
  )
  return {
    request: {
      input: {
        bounds: {
          bbox: projectedBounds,
          properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/3857' }
        },
        data: [{
          type: OFFICIAL_SOURCE.sentinelHubCollection,
          dataFilter: { timeRange },
          processing: { upsampling: 'BILINEAR', downsampling: 'BILINEAR' }
        }]
      },
      output: {
        width: output.width,
        height: output.height,
        responses: [{ identifier: 'default', format: { type: 'image/jpeg', quality: 90 } }]
      },
      evalscript: RGB_EVALSCRIPT
    },
    dimensions: output,
    evalscriptSha256: createHash('sha256').update(RGB_EVALSCRIPT).digest('hex')
  }
}

export function jpegDimensions(buffer) {
  const bytes = Buffer.from(buffer)
  assert(bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8, 'response is not a JPEG')
  let offset = 2
  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1
      continue
    }
    const marker = bytes[offset + 1]
    offset += 2
    if (marker === 0xd8 || marker === 0xd9) continue
    const length = bytes.readUInt16BE(offset)
    assert(length >= 2 && offset + length <= bytes.length, 'truncated JPEG segment')
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { width: bytes.readUInt16BE(offset + 5), height: bytes.readUInt16BE(offset + 3) }
    }
    offset += length
  }
  throw new Error('JPEG dimensions not found')
}

function paeth(left, up, upperLeft) {
  const prediction = left + up - upperLeft
  const leftDistance = Math.abs(prediction - left)
  const upDistance = Math.abs(prediction - up)
  const upperLeftDistance = Math.abs(prediction - upperLeft)
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left
  if (upDistance <= upperLeftDistance) return up
  return upperLeft
}

export function decodePngSamples(buffer) {
  const bytes = Buffer.from(buffer)
  assert(bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), 'response is not a PNG')
  let offset = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  let interlace = 0
  const dataChunks = []
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset)
    const type = bytes.toString('ascii', offset + 4, offset + 8)
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    assert(dataEnd + 4 <= bytes.length, 'truncated PNG chunk')
    if (type === 'IHDR') {
      width = bytes.readUInt32BE(dataStart)
      height = bytes.readUInt32BE(dataStart + 4)
      bitDepth = bytes[dataStart + 8]
      colorType = bytes[dataStart + 9]
      interlace = bytes[dataStart + 12]
    } else if (type === 'IDAT') dataChunks.push(bytes.subarray(dataStart, dataEnd))
    else if (type === 'IEND') break
    offset = dataEnd + 4
  }
  assert(width > 0 && height > 0 && bitDepth === 8 && interlace === 0, 'unsupported PNG layout')
  const channels = ({ 0: 1, 2: 3, 4: 2, 6: 4 })[colorType]
  assert(channels, `unsupported PNG color type ${colorType}`)
  const rowBytes = width * channels
  const inflated = inflateSync(Buffer.concat(dataChunks))
  assert(inflated.length === height * (rowBytes + 1), 'unexpected PNG data length')
  const decoded = Buffer.alloc(width * height * channels)
  for (let row = 0; row < height; row += 1) {
    const filter = inflated[row * (rowBytes + 1)]
    const sourceStart = row * (rowBytes + 1) + 1
    const targetStart = row * rowBytes
    for (let column = 0; column < rowBytes; column += 1) {
      const raw = inflated[sourceStart + column]
      const left = column >= channels ? decoded[targetStart + column - channels] : 0
      const up = row > 0 ? decoded[targetStart + column - rowBytes] : 0
      const upperLeft = row > 0 && column >= channels
        ? decoded[targetStart + column - rowBytes - channels]
        : 0
      let value
      if (filter === 0) value = raw
      else if (filter === 1) value = raw + left
      else if (filter === 2) value = raw + up
      else if (filter === 3) value = raw + Math.floor((left + up) / 2)
      else if (filter === 4) value = raw + paeth(left, up, upperLeft)
      else throw new Error(`unsupported PNG filter ${filter}`)
      decoded[targetStart + column] = value & 0xff
    }
  }
  const samples = new Uint8Array(width * height)
  for (let index = 0; index < samples.length; index += 1) samples[index] = decoded[index * channels]
  return { width, height, samples }
}

export function qualityFromPng(buffer) {
  const decoded = decodePngSamples(buffer)
  let noDataPixels = 0
  for (const sample of decoded.samples) if (sample === 0) noDataPixels += 1
  return {
    width: decoded.width,
    height: decoded.height,
    pixelCount: decoded.samples.length,
    noDataPixels,
    noDataRatio: Number((noDataPixels / decoded.samples.length).toFixed(6))
  }
}
