#!/usr/bin/env node

/**
 * Fetch the public map-view GeoJSON used by TianDiTu's official
 * administrative-division visualization page.
 *
 * The /region/map response is a gzip-compressed, four-byte packed JSON stream.
 * Its decoder below mirrors the current public page bundle. No account cookie
 * or API token is read or sent.
 */

import assert from 'node:assert/strict'
import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { gunzipSync } from 'node:zlib'

const SOURCE_PAGE = 'https://cloudcenter.tianditu.gov.cn/administrativeDivision/'
const API_ROOT = 'https://cloudcenter.tianditu.gov.cn/api/portal'
const MENU_URL = `${API_ROOT}/region/menu`
const MAP_URL = `${API_ROOT}/region/map`
const COUNTRY_GB = '156000000'
const DEFAULT_OUTPUT = path.resolve('output/tianditu-administrative-geojson-2025-09')
const DEFAULT_CONCURRENCY = 4
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504])

class FetchError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'FetchError'
    this.details = details
  }
}

function parseArgs(argv) {
  const args = {
    all: false,
    province: null,
    out: DEFAULT_OUTPUT,
    concurrency: DEFAULT_CONCURRENCY,
    refresh: false,
    help: false,
  }
  for (const argument of argv) {
    if (argument === '--all') args.all = true
    else if (argument === '--refresh') args.refresh = true
    else if (argument === '--help' || argument === '-h') args.help = true
    else if (argument.startsWith('--province=')) args.province = argument.slice('--province='.length).trim()
    else if (argument.startsWith('--out=')) args.out = path.resolve(argument.slice('--out='.length))
    else if (argument.startsWith('--concurrency=')) args.concurrency = Number(argument.slice('--concurrency='.length))
    else throw new FetchError(`未知参数：${argument}`)
  }
  if (!args.all && !args.province && !args.help) {
    throw new FetchError('请指定 --all 或 --province=<省级行政区名称>')
  }
  if (args.all && args.province) throw new FetchError('--all 与 --province 不能同时使用')
  if (!args.out) throw new FetchError('--out 不能为空')
  if (!Number.isInteger(args.concurrency) || args.concurrency < 1 || args.concurrency > 8) {
    throw new FetchError('--concurrency 必须是 1 到 8 的整数')
  }
  return args
}

function printHelp() {
  console.log(`天地图官方行政区划 GeoJSON 抓取器

用法：
  node scripts/fetch-tianditu-administrative-geojson.mjs --province=河北省
  node scripts/fetch-tianditu-administrative-geojson.mjs --all

选项：
  --out=<path>       输出目录，默认 ${DEFAULT_OUTPUT}
  --concurrency=4    并发请求数，范围 1-8
  --refresh          忽略已缓存的官方原始响应并重新请求

脚本会保留官方压缩响应并支持断点重跑。不会读取账号 Cookie 或 API Token。`)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeName(value = '') {
  return value
    .replace(/特别行政区$/, '')
    .replace(/维吾尔自治区$/, '')
    .replace(/壮族自治区$/, '')
    .replace(/回族自治区$/, '')
    .replace(/自治区$/, '')
    .replace(/[省市]$/, '')
}

function adminCode(gb) {
  const digits = String(gb ?? '').replace(/\D/g, '')
  return digits.startsWith('156') && digits.length === 9 ? digits.slice(3) : digits
}

function isPrefectureCode(gb) {
  const code = adminCode(gb)
  return code.length === 6 && code.endsWith('00') && !code.endsWith('0000')
}

function safeName(value) {
  return String(value ?? 'unknown').replace(/[\\/:*?"<>|\s]+/g, '-')
}

function isAreaFeature(feature) {
  return ['Polygon', 'MultiPolygon'].includes(feature?.geometry?.type)
}

function featureKey(feature) {
  return String(feature?.properties?.gb ?? feature?.id ?? JSON.stringify(feature))
}

function uniqueAreaFeatures(features) {
  const output = []
  const seen = new Set()
  for (const feature of features) {
    if (!isAreaFeature(feature)) continue
    const key = featureKey(feature)
    if (seen.has(key)) continue
    seen.add(key)
    output.push(feature)
  }
  return output
}

function collection(features, properties) {
  return { type: 'FeatureCollection', properties, features: uniqueAreaFeatures(features) }
}

function decodePackedGeoJson(buffer) {
  const inflated = gunzipSync(buffer)
  if (inflated.length % 4 !== 0) {
    throw new FetchError('官方地图响应解压后的字节长度不能被 4 整除', { inflatedBytes: inflated.length })
  }
  const decoded = new Uint8Array(inflated.length / 4)
  for (let inputIndex = 0, outputIndex = 0; inputIndex < inflated.length; inputIndex += 4, outputIndex += 1) {
    let packed = 0
    for (let offset = 0; offset < 4; offset += 1) {
      packed += (inflated[inputIndex + offset] & 0xff) << (8 * (3 - offset))
    }
    decoded[outputIndex] = packed >> 2
  }
  const result = JSON.parse(new TextDecoder('utf-8').decode(decoded))
  if (result?.type !== 'FeatureCollection' || !Array.isArray(result.features)) {
    throw new FetchError('官方地图响应不是 GeoJSON FeatureCollection')
  }
  return result
}

async function exists(filePath) {
  try {
    await stat(filePath)
    return true
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}

async function atomicWrite(filePath, data) {
  await mkdir(path.dirname(filePath), { recursive: true })
  const temporary = `${filePath}.partial-${process.pid}`
  await writeFile(temporary, data)
  await rename(temporary, filePath)
}

async function writeJson(filePath, value) {
  await atomicWrite(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

async function fetchWithRetry(url, responseType, attempt = 1) {
  let response
  try {
    response = await fetch(url, {
      headers: { accept: 'application/json', referer: SOURCE_PAGE },
      signal: AbortSignal.timeout(60_000),
    })
  } catch (error) {
    if (attempt < 4) {
      await sleep(600 * 2 ** (attempt - 1))
      return fetchWithRetry(url, responseType, attempt + 1)
    }
    throw new FetchError(`请求失败：${error.message}`, { url, attempt })
  }
  if (RETRYABLE_STATUS.has(response.status) && attempt < 4) {
    await sleep(700 * 2 ** (attempt - 1))
    return fetchWithRetry(url, responseType, attempt + 1)
  }
  if (!response.ok) throw new FetchError(`请求返回 HTTP ${response.status}`, { url, httpStatus: response.status })
  return responseType === 'json' ? response.json() : Buffer.from(await response.arrayBuffer())
}

async function loadMenu(outputDirectory, refresh) {
  const filePath = path.join(outputDirectory, 'raw', 'region-menu.json')
  if (!refresh && await exists(filePath)) return JSON.parse(await readFile(filePath, 'utf8'))
  const response = await fetchWithRetry(MENU_URL, 'json')
  if (response?.status !== 200 || !Array.isArray(response.data)) {
    throw new FetchError('官方行政区菜单接口返回异常', { status: response?.status, message: response?.message })
  }
  await writeJson(filePath, response)
  return response
}

async function loadMap(outputDirectory, gb, level, refresh) {
  const filePath = path.join(outputDirectory, 'raw', 'region-map', `${gb}-level-${level}.bin.gz`)
  let buffer
  if (!refresh && await exists(filePath)) buffer = await readFile(filePath)
  else {
    const url = new URL(MAP_URL)
    url.searchParams.set('gb', gb)
    url.searchParams.set('level', String(level))
    buffer = await fetchWithRetry(url, 'buffer')
    await atomicWrite(filePath, buffer)
  }
  return decodePackedGeoJson(buffer)
}

function locateCountry(menuResponse) {
  const all = menuResponse.data.flatMap((item) => [item, ...(item.children ?? [])])
  const country = all.find((item) => item.gb === COUNTRY_GB || item.name === '中国')
  if (!country || !Array.isArray(country.children)) throw new FetchError('行政区菜单中没有找到中国根节点')
  return country
}

function locateProvince(country, requestedName) {
  const matches = country.children.filter((item) => normalizeName(item.name) === normalizeName(requestedName))
  if (matches.length !== 1) {
    throw new FetchError(`无法唯一定位省级行政区“${requestedName}”`, { matches: matches.map((item) => item.name) })
  }
  return matches[0]
}

function cityJobsForProvince(province) {
  const prefectures = (province.children ?? []).filter((item) => isPrefectureCode(item.gb))
  if (prefectures.length > 0) return prefectures.map((city) => ({ province, city, provinceEquivalent: false }))
  if ((province.children ?? []).length > 0) return [{ province, city: province, provinceEquivalent: true }]
  return []
}

async function mapConcurrent(items, concurrency, worker) {
  const output = new Array(items.length)
  let cursor = 0
  async function run() {
    while (true) {
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      output[index] = await worker(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()))
  return output
}

function analyzeFeatures(features) {
  const geometryTypes = {}
  const codes = new Set()
  let duplicateCodes = 0
  for (const feature of features) {
    const geometryType = feature?.geometry?.type ?? 'null'
    geometryTypes[geometryType] = (geometryTypes[geometryType] ?? 0) + 1
    const code = featureKey(feature)
    if (codes.has(code)) duplicateCodes += 1
    codes.add(code)
  }
  return { featureCount: features.length, duplicateCodes, geometryTypes }
}

function validateCollection(label, value) {
  assert.equal(value.type, 'FeatureCollection', `${label}: type`)
  assert.ok(value.features.every(isAreaFeature), `${label}: derived output contains non-area geometry`)
  assert.equal(new Set(value.features.map(featureKey)).size, value.features.length, `${label}: duplicate feature code`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) return printHelp()
  await mkdir(args.out, { recursive: true })

  console.log(`输出目录：${args.out}`)
  console.log('读取官方行政区菜单（公开接口，不使用账号 Cookie 或 API Token）…')
  const menuResponse = await loadMenu(args.out, args.refresh)
  const country = locateCountry(menuResponse)
  const provinces = args.all ? country.children : [locateProvince(country, args.province)]
  const cityJobs = provinces.flatMap(cityJobsForProvince)

  console.log(`范围：${args.all ? '全国' : provinces[0].name}；省级 ${provinces.length}，地市级任务 ${cityJobs.length}`)
  const countryRaw = await loadMap(args.out, COUNTRY_GB, 2, args.refresh)
  const countryCollection = collection(countryRaw.features, {
    scope: 'country-contains-provinces',
    name: '中国',
    gb: COUNTRY_GB,
    source: SOURCE_PAGE,
    sourceDataUpdatedAt: '2025-09',
    coverage: args.all ? 'all-34-province-level-divisions' : 'selected-province-only',
  })
  if (!args.all) {
    const requestedCodes = new Set(provinces.map((item) => item.gb))
    countryCollection.features = countryCollection.features.filter((feature) => requestedCodes.has(feature.properties?.gb))
  }
  validateCollection('country', countryCollection)
  await writeJson(path.join(args.out, '01-country-provinces.geojson'), countryCollection)

  console.log('抓取省级的地市视图与省直管县视图…')
  const provinceMaps = await mapConcurrent(provinces, args.concurrency, async (province, index) => {
    const [prefectures, directCounties] = await Promise.all([
      loadMap(args.out, province.gb, 1, args.refresh),
      loadMap(args.out, province.gb, 0, args.refresh),
    ])
    console.log(`[省 ${index + 1}/${provinces.length}] ${province.name}`)
    return { province, prefectures, directCounties }
  })

  console.log('抓取各地市包含区县的视图…')
  const cityMaps = await mapConcurrent(cityJobs, args.concurrency, async (job, index) => {
    const counties = await loadMap(args.out, job.city.gb, 0, args.refresh)
    console.log(`[市 ${index + 1}/${cityJobs.length}] ${job.province.name} / ${job.city.name}`)
    return { ...job, counties }
  })

  const provinceSummaries = []
  const citySummaries = []
  for (const item of provinceMaps) {
    const provincePrefix = `${adminCode(item.province.gb)}-${safeName(item.province.name)}`
    const prefectureCollection = collection(item.prefectures.features, {
      scope: 'province-contains-prefectures',
      province: item.province.name,
      provinceGb: item.province.gb,
      source: SOURCE_PAGE,
      sourceLevel: 1,
    })
    validateCollection(`${item.province.name} prefectures`, prefectureCollection)
    await writeJson(path.join(args.out, '02-provinces-prefectures', `${provincePrefix}.geojson`), prefectureCollection)

    const countiesFromCities = cityMaps
      .filter((cityItem) => cityItem.province.gb === item.province.gb)
      .flatMap((cityItem) => cityItem.counties.features)
    const countyCollection = collection([...item.directCounties.features, ...countiesFromCities], {
      scope: 'province-contains-counties',
      province: item.province.name,
      provinceGb: item.province.gb,
      source: SOURCE_PAGE,
      composition: 'province-level-0 plus every prefecture-level-0 response, deduplicated by feature.properties.gb',
    })
    validateCollection(`${item.province.name} counties`, countyCollection)
    await writeJson(path.join(args.out, '03-provinces-counties', `${provincePrefix}.geojson`), countyCollection)
    provinceSummaries.push({
      province: item.province.name,
      gb: item.province.gb,
      prefectures: analyzeFeatures(prefectureCollection.features),
      counties: analyzeFeatures(countyCollection.features),
      directProvinceLevel0AreaFeatures: uniqueAreaFeatures(item.directCounties.features).length,
    })
  }

  for (const item of cityMaps) {
    const provinceDirectory = `${adminCode(item.province.gb)}-${safeName(item.province.name)}`
    const cityFile = `${adminCode(item.city.gb)}-${safeName(item.city.name)}.geojson`
    const countyCollection = collection(item.counties.features, {
      scope: 'prefecture-contains-counties',
      province: item.province.name,
      provinceGb: item.province.gb,
      prefecture: item.city.name,
      prefectureGb: item.city.gb,
      provinceEquivalent: item.provinceEquivalent,
      source: SOURCE_PAGE,
      sourceLevel: 0,
    })
    validateCollection(`${item.city.name} counties`, countyCollection)
    await writeJson(path.join(args.out, '04-prefectures-counties', provinceDirectory, cityFile), countyCollection)
    citySummaries.push({
      province: item.province.name,
      prefecture: item.city.name,
      gb: item.city.gb,
      provinceEquivalent: item.provinceEquivalent,
      counties: analyzeFeatures(countyCollection.features),
    })
  }

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: {
      platform: '国家地理信息公共服务平台（天地图）',
      page: SOURCE_PAGE,
      menuEndpoint: MENU_URL,
      mapEndpoint: MAP_URL,
      pageDataUpdatedAt: '2025-09',
      pageUsageNotice: '该数据仅供地图可视化使用',
      authentication: 'Public map-view endpoints; no account cookie or API token used.',
    },
    run: {
      mode: args.all ? 'all' : 'province',
      requestedProvince: args.province,
      provinceCount: provinces.length,
      prefectureTaskCount: cityJobs.length,
      refresh: args.refresh,
      complete: true,
    },
    conversion: {
      packedResponseDecoder: 'gzip inflate, then one decoded byte from every four packed bytes using signed right shift by 2',
      coordinateReprojection: false,
      coordinateSimplification: false,
      areaFeaturePolicy: 'Derived GeoJSON keeps Polygon and MultiPolygon features; official boundary-line features remain available in raw responses.',
      provinceCountyComposition: 'Province level-0 plus all prefecture level-0 results, deduplicated by feature.properties.gb.',
    },
    outputs: {
      countryContainsProvinces: analyzeFeatures(countryCollection.features),
      provinceContainsPrefectures: provinceSummaries.reduce((sum, item) => sum + item.prefectures.featureCount, 0),
      provinceContainsCounties: provinceSummaries.reduce((sum, item) => sum + item.counties.featureCount, 0),
      prefectureContainsCountiesFiles: citySummaries.length,
      prefectureContainsCounties: citySummaries.reduce((sum, item) => sum + item.counties.featureCount, 0),
    },
    provinceSummaries,
    citySummaries,
  }
  await writeJson(path.join(args.out, 'manifest.json'), manifest)
  await atomicWrite(path.join(args.out, 'README.md'), `# 天地图官方行政区划 GeoJSON\n\n数据来自：${SOURCE_PAGE}\n\n- 页面标注数据更新时间：2025 年 9 月\n- 页面使用限制：该数据仅供地图可视化使用\n- 01：全国包含各省\n- 02：各省包含地市（直辖市等特殊省级行政区按官网同级视图输出）\n- 03：各省包含全部区县，由省直管县与各地市区县合成\n- 04：各地市包含区县，可用于省级视图双击地市下钻\n- raw：官方菜单响应及压缩的地图响应，用于来源审计和断点续跑\n\n派生文件仅保留 Polygon/MultiPolygon；官网响应中的境界线 MultiLineString 保留在 raw 中。坐标未做投影转换、简化或数值修改。\n`)

  console.log(JSON.stringify({ result: 'PASS', outputDirectory: args.out, outputs: manifest.outputs }, null, 2))
}

main().catch((error) => {
  console.error(JSON.stringify({ result: 'BLOCKED', message: error.message, ...(error.details ?? {}) }, null, 2))
  process.exitCode = 1
})
