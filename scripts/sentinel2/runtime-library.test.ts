import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildRuntimeManifest,
  packageRuntimeLibrary,
  serializeRuntimeManifest,
  verifyRuntimeLibrary
} from './runtime-library.mjs'

const temporaryDirectories: string[] = []
const digest = (value: Uint8Array | string) => createHash('sha256').update(value).digest('hex')

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'sentinel2-runtime-library-'))
  temporaryDirectories.push(root)
  const imageRoot = path.join(root, 'source')
  await mkdir(path.join(imageRoot, 'country'), { recursive: true })
  const image = await sharp({
    create: { width: 4, height: 3, channels: 3, background: { r: 20, g: 80, b: 120 } }
  }).jpeg().toBuffer()
  await writeFile(path.join(imageRoot, 'country/100000.jpg'), image)
  const plan = {
    schemaVersion: 1,
    geometryCatalog: { schemaVersion: 1, dataVersion: 'test', catalogSha256: 'a'.repeat(64) },
    sourceContract: {
      stacCollection: 'sentinel-2-global-mosaics', sentinelHubCollection: 'byoc-test',
      datasetVersion: 'sentinel2-quarterly-2025q2-v1', sourceYear: 2025,
      primaryQuarter: '2025-Q2', fallbackQuarters: ['2025-Q4', '2025-Q3'],
      maxNoDataRatio: 0.02, colorTransformSha256: 'b'.repeat(64)
    },
    targets: [
      {
        id: 'country:100000', targetKind: 'country', gb: '100000', catalogGb: null, label: '全国',
        selection: { kind: 'country-provinces' }, geographicBounds: [0, 0, 2, 1],
        projectedBounds: [0, 0, 200, 100], projection: 'EPSG:3857', pixelSizeMeters: 50,
        width: 4, height: 3, assetPath: 'country/100000.jpg'
      },
      {
        id: 'prefecture:460300', targetKind: 'prefecture', gb: '460300', catalogGb: '156460300', label: '三沙市',
        selection: { kind: 'prefecture-counties' }, geographicBounds: [1, 1, 2, 2],
        projectedBounds: [100, 100, 200, 200], projection: 'EPSG:3857', pixelSizeMeters: 50,
        width: 4, height: 4, assetPath: 'prefectures/460300.jpg'
      }
    ]
  }
  const planText = `${JSON.stringify(plan)}\n`
  const planSha256 = digest(planText)
  const imageCheckpoint = {
    schemaVersion: 1, kind: 'image-generation', planSha256,
    entries: {
      'country:100000': {
        status: 'complete', assetPath: 'country/100000.jpg', chosenQuarter: '2025-Q2', fallbackUsed: false,
        noDataRatio: 0.001, width: 4, height: 3, bytes: image.length, sha256: digest(image),
        evalscriptSha256: 'b'.repeat(64)
      },
      'prefecture:460300': { status: 'unavailable', reason: 'no-data-threshold-exceeded-after-fallbacks', noDataRatio: 0.12 }
    }
  }
  const qualityCheckpoint = {
    schemaVersion: 1, kind: 'quality-selection', planSha256,
    entries: {
      'country:100000': { status: 'available', chosenQuarter: '2025-Q2', fallbackUsed: false, noDataRatio: 0.001 },
      'prefecture:460300': {
        status: 'unavailable', reason: 'no-data-threshold-exceeded-after-fallbacks', noDataRatio: 0.12,
        attempts: [{ quarter: '2025-Q2', noDataRatio: 0.2 }, { quarter: '2025-Q3', noDataRatio: 0.12 }]
      }
    }
  }
  return { root, imageRoot, image, plan, planText, imageCheckpoint, qualityCheckpoint }
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('Sentinel-2 runtime library', () => {
  it('builds deterministic metadata with explicit unavailable waivers', async () => {
    const input = await fixture()
    const one = buildRuntimeManifest({ ...input, expectedTargetCount: 2 })
    const two = buildRuntimeManifest({ ...input, expectedTargetCount: 2 })
    expect(serializeRuntimeManifest(one)).toBe(serializeRuntimeManifest(two))
    expect(one.summary).toEqual({ targetCount: 2, availableCount: 1, unavailableCount: 1, totalBytes: input.image.length })
    expect(one.entries[1]).toMatchObject({ status: 'unavailable', bestQuarter: '2025-Q3', waiver: { decision: 'accepted' } })
    expect(one.entries[0]).not.toHaveProperty('requestSetSha256')
  })

  it('packages only runtime-safe files and verifies hashes, dimensions and inventory', async () => {
    const input = await fixture()
    const packageRoot = path.join(input.root, 'package')
    const result = await packageRuntimeLibrary({ ...input, packageRoot, expectedTargetCount: 2 })
    expect(result).toMatchObject({ targetCount: 2, availableCount: 1, unavailableCount: 1, fileCount: 4 })
    const manifest = JSON.parse(await readFile(path.join(packageRoot, 'manifest.json'), 'utf8'))
    expect(manifest.entries[0].assetPath).toBe('images/country/100000.jpg')
    expect(await readFile(path.join(packageRoot, 'NOTICE-DATA.md'), 'utf8')).toContain('Contains modified Copernicus Sentinel data 2025')
  })

  it('rejects corrupt, missing, unsafe and orphan files', async () => {
    const corruptInput = await fixture()
    const corruptRoot = path.join(corruptInput.root, 'package')
    await packageRuntimeLibrary({ ...corruptInput, packageRoot: corruptRoot, expectedTargetCount: 2 })
    await writeFile(path.join(corruptRoot, 'images/country/100000.jpg'), Buffer.concat([corruptInput.image, Buffer.from([0])]))
    await expect(verifyRuntimeLibrary({ packageRoot: corruptRoot, expectedTargetCount: 2 })).rejects.toThrow(/byte length changed/)

    const missingInput = await fixture()
    const missingRoot = path.join(missingInput.root, 'package')
    await packageRuntimeLibrary({ ...missingInput, packageRoot: missingRoot, expectedTargetCount: 2 })
    await unlink(path.join(missingRoot, 'images/country/100000.jpg'))
    await expect(verifyRuntimeLibrary({ packageRoot: missingRoot, expectedTargetCount: 2 })).rejects.toThrow(/image is missing/)

    const unsafeInput = await fixture()
    const manifest = buildRuntimeManifest({ ...unsafeInput, expectedTargetCount: 2 })
    manifest.entries[0].assetPath = '../outside.jpg'
    expect(() => serializeRuntimeManifest(manifest)).toThrow(/unsafe runtime asset path/)

    const orphanInput = await fixture()
    const orphanRoot = path.join(orphanInput.root, 'package')
    await packageRuntimeLibrary({ ...orphanInput, packageRoot: orphanRoot, expectedTargetCount: 2 })
    await writeFile(path.join(orphanRoot, 'orphan.txt'), 'unexpected')
    await expect(verifyRuntimeLibrary({ packageRoot: orphanRoot, expectedTargetCount: 2 })).rejects.toThrow(/orphan or forbidden/)
  })
})
