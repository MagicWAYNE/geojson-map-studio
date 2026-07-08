import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { geoMercator, geoPath } from 'd3-geo'
import { DISTRICTS } from './districts.mjs'

const CACHE = 'scripts/data/chongqing.geo.json'
const SOURCE = 'https://geo.datav.aliyun.com/areas_v3/bound/500000_full.json'
const W = 1000
const H = 950
const PAD = 20

let geojson
if (existsSync(CACHE)) {
  geojson = JSON.parse(readFileSync(CACHE, 'utf8'))
} else {
  const res = await fetch(SOURCE)
  if (!res.ok) throw new Error(`GeoJSON 下载失败: HTTP ${res.status}`)
  geojson = await res.json()
  mkdirSync('scripts/data', { recursive: true })
  writeFileSync(CACHE, JSON.stringify(geojson))
  console.log(`已缓存 GeoJSON → ${CACHE}`)
}

// 环绕方向修正：阿里 DataV Atlas 导出的环方向与 d3-geo 期望（RFC7946 外环逆时针）相反，
// 若不修正会导致 path.bounds/centroid/area 把每个区县算成"整个球面减去自身"（geoArea ≈ 4π 的整数倍），
// 渲染出的 path 也会带上绕整个画布边界走一圈的多余线段。统一反转每个环的坐标顺序即可修正。
for (const f of geojson.features) {
  const g = f.geometry
  if (g.type === 'Polygon') {
    g.coordinates = g.coordinates.map((ring) => ring.slice().reverse())
  } else if (g.type === 'MultiPolygon') {
    g.coordinates = g.coordinates.map((poly) => poly.map((ring) => ring.slice().reverse()))
  }
}

// 名称断言：GeoJSON 区县名与 DISTRICTS（mock 数据 key）双向一致
const names = geojson.features.map((f) => f.properties.name)
const got = new Set(names)
const want = new Set(DISTRICTS)
const missing = DISTRICTS.filter((n) => !got.has(n))
const extra = names.filter((n) => !want.has(n))
if (missing.length || extra.length) {
  console.error('区县名不一致！', JSON.stringify({ missing, extra }, null, 2))
  process.exit(1)
}

const projection = geoMercator().fitExtent([[PAD, PAD], [W - PAD, H - PAD]], geojson)
const path = geoPath(projection)

const paths = geojson.features
  .map((f) => `  <path name="${f.properties.name}" d="${path(f)}" />`)
  .join('\n')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">\n${paths}\n</svg>\n`
mkdirSync('public/maps', { recursive: true })
writeFileSync('public/maps/chongqing.svg', svg)

const centroids = {}
for (const f of geojson.features) {
  const [cx, cy] = path.centroid(f)
  centroids[f.properties.name] = [Math.round(cx * 10) / 10, Math.round(cy * 10) / 10]
}
writeFileSync('src/mocks/district_centroids.json', JSON.stringify(centroids, null, 2))

console.log(`OK: ${names.length} 区县 → public/maps/chongqing.svg + src/mocks/district_centroids.json`)
