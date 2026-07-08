import { mkdirSync, writeFileSync } from 'node:fs'
import { DISTRICTS } from './districts.mjs'

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月']
const map = []
const detail = {}

DISTRICTS.forEach((name, i) => {
  const rnd = mulberry32(i + 1)
  const aj = Math.round(3000 + rnd() * 90000)
  const ztje = Math.round(aj * (1.8 + rnd() * 1.5) * 100) / 100
  const zzs = 1 + Math.floor(rnd() * 8)
  map.push({ name, aj, ztje, zzs })

  const tj = aj / 10000
  const kpi = {
    tj: tj.toFixed(2),
    kl: (tj * (0.28 + rnd() * 0.1)).toFixed(2),
    tc: (tj * (0.1 + rnd() * 0.05)).toFixed(2),
    month_tj: (tj * (0.05 + rnd() * 0.03)).toFixed(2),
    yx: (ztje * (0.35 + rnd() * 0.15)).toFixed(2),
    month_yx: (ztje * (0.02 + rnd() * 0.02)).toFixed(2)
  }
  const huankuan = MONTHS.flatMap((m) => [
    { x: m, y: Math.round(aj * (0.01 + rnd() * 0.02)), colorField: '全额还款' },
    { x: m, y: Math.round(aj * (0.05 + rnd() * 0.08)), colorField: '分期还款' }
  ])
  const trend = MONTHS.flatMap((m) => [
    { x: m, y: Math.round(30 + rnd() * 260), colorField: '询问' },
    { x: m, y: Math.round(rnd() * 30), colorField: '转办' },
    { x: m, y: Math.round(rnd() * 8), colorField: '有责' }
  ])
  const orgs = Array.from({ length: 2 + Math.floor(rnd() * 3) }, (_, k) => {
    const bwt = Math.round(aj * (0.1 + rnd() * 0.3))
    const dx = Math.round(bwt * (0.001 + rnd() * 0.002))
    return {
      lx: `${name}调解工作站${k + 1}`,
      rs: 3 + Math.floor(rnd() * 60),
      dx,
      bwt,
      bl: `${((dx / bwt) * 100).toFixed(2)}%`
    }
  })
  detail[name] = { kpi, huankuan, trend, orgs }
})

if (map.length !== 38 || Object.keys(detail).length !== 38) {
  console.error(`区县数量错误: map=${map.length} detail=${Object.keys(detail).length}，应为 38`)
  process.exit(1)
}

mkdirSync('src/mocks', { recursive: true })
writeFileSync('src/mocks/district_map.json', JSON.stringify(map, null, 2))
writeFileSync('src/mocks/district_detail.json', JSON.stringify(detail, null, 2))
console.log(`OK: district_map ${map.length} 条, district_detail ${Object.keys(detail).length} 键`)
