import { mkdtemp, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { buildRegionCatalog } from './build-region-catalog.mjs'

const projectRoot = path.resolve(import.meta.dirname, '..')
const sourceRoot = path.join(projectRoot, 'output', 'tianditu-administrative-geojson-2025-09')

describe('region catalog runtime packager', () => {
  it('validates all prepared maps and emits deterministic runtime-only assets', async () => {
    const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'region-catalog-test-'))
    const firstRoot = path.join(temporaryRoot, 'first', 'tianditu-2025-09')
    const secondRoot = path.join(temporaryRoot, 'second', 'tianditu-2025-09')

    const first = await buildRegionCatalog({ sourceRoot, destinationRoot: firstRoot })
    const second = await buildRegionCatalog({ sourceRoot, destinationRoot: secondRoot })

    expect(first).toEqual(second)
    expect(first.country).toMatchObject({ available: true, featureCount: 34 })
    expect(first.provinces).toHaveLength(34)
    expect(first.provinces.flatMap((province) => province.prefectures)).toHaveLength(342)
    expect(first.provinces.find((province) => province.name === '澳门特别行政区')?.counties).toMatchObject({
      available: false,
      assetPath: null,
      featureCount: 0
    })
    const unavailable = first.provinces.flatMap((province) => province.prefectures)
      .filter((prefecture) => !prefecture.counties.available)
    expect(unavailable).toHaveLength(6)
    expect(unavailable.map((entry) => entry.name)).toContain('嘉峪关市')

    const firstCatalog = await readFile(path.join(firstRoot, 'catalog.json'), 'utf8')
    const secondCatalog = await readFile(path.join(secondRoot, 'catalog.json'), 'utf8')
    expect(firstCatalog).toBe(secondCatalog)
    expect(firstCatalog).not.toContain('generatedAt')
    expect(firstCatalog).not.toContain('cloudcenter.tianditu.gov.cn/api')
    expect(await stat(path.join(firstRoot, first.country.assetPath))).toBeTruthy()
  }, 30_000)
})
