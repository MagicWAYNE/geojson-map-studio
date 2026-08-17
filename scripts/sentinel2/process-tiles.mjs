function assert(condition, message) {
  if (!condition) throw new Error(message)
}
export function planProcessTiles(target, {
  desiredWidth = target.width,
  desiredHeight = target.height,
  maximumMetersPerPixel = 1590,
  maximumTileDimension = 2500
} = {}) {
  const [minX, minY, maxX, maxY] = target.projectedBounds
  const spanX = maxX - minX
  const spanY = maxY - minY
  assert(spanX > 0 && spanY > 0, 'tile target has empty projected bounds')
  assert(Number.isInteger(desiredWidth) && Number.isInteger(desiredHeight) && desiredWidth > 0 && desiredHeight > 0, 'invalid desired tile dimensions')
  assert(maximumMetersPerPixel > 0 && Number.isFinite(maximumMetersPerPixel), 'invalid maximum metres per pixel')
  assert(Number.isInteger(maximumTileDimension) && maximumTileDimension > 0 && maximumTileDimension <= 2500, 'invalid maximum tile dimension')

  const pixelSize = Math.min(
    maximumMetersPerPixel,
    spanX / desiredWidth,
    spanY / desiredHeight
  )
  const sourceWidth = Math.max(desiredWidth, Math.ceil(spanX / pixelSize))
  const sourceHeight = Math.max(desiredHeight, Math.ceil(spanY / pixelSize))
  const columns = Math.ceil(sourceWidth / maximumTileDimension)
  const rows = Math.ceil(sourceHeight / maximumTileDimension)
  const pixelWidth = spanX / sourceWidth
  const pixelHeight = spanY / sourceHeight
  const tiles = []
  for (let row = 0; row < rows; row += 1) {
    const top = row * maximumTileDimension
    const bottom = Math.min(sourceHeight, top + maximumTileDimension)
    for (let column = 0; column < columns; column += 1) {
      const left = column * maximumTileDimension
      const right = Math.min(sourceWidth, left + maximumTileDimension)
      tiles.push({
        index: tiles.length,
        row,
        column,
        left,
        top,
        width: right - left,
        height: bottom - top,
        projectedBounds: [
          minX + left * pixelWidth,
          maxY - bottom * pixelHeight,
          minX + right * pixelWidth,
          maxY - top * pixelHeight
        ].map((value) => Number(value.toFixed(6)))
      })
    }
  }
  return {
    sourceWidth,
    sourceHeight,
    outputWidth: desiredWidth,
    outputHeight: desiredHeight,
    sourcePixelWidthMeters: pixelWidth,
    sourcePixelHeightMeters: pixelHeight,
    tiles
  }
}
