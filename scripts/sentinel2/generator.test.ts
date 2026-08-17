import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestWithRetry, runImageGeneration } from './generator.mjs'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

describe('resumable imagery generator transport', () => {
  it('honors Retry-After for 429 and returns retry evidence', async () => {
    const oauthClient = {
      authorizedFetch: vi.fn()
        .mockResolvedValueOnce(new Response('slow down', {
          status: 429,
          headers: { 'retry-after': '2' }
        }))
        .mockResolvedValueOnce(new Response('ok', { status: 200 }))
    }
    const wait = vi.fn().mockResolvedValue(undefined)
    const result = await requestWithRetry({
      oauthClient,
      url: 'https://process.example',
      init: { method: 'POST' },
      wait
    })
    expect(result.retryCount).toBe(1)
    expect(wait).toHaveBeenCalledWith(2000)
    expect(oauthClient.authorizedFetch).toHaveBeenCalledTimes(2)
  })

  it('retries transient 5xx with bounded backoff and rejects terminal 400', async () => {
    const wait = vi.fn().mockResolvedValue(undefined)
    const transient = {
      authorizedFetch: vi.fn()
        .mockResolvedValueOnce(new Response('temporary', { status: 503 }))
        .mockResolvedValueOnce(new Response('ok', { status: 200 }))
    }
    expect((await requestWithRetry({
      oauthClient: transient,
      url: 'https://process.example',
      init: {},
      wait
    })).retryCount).toBe(1)
    expect(wait).toHaveBeenCalledWith(1000)

    const terminal = {
      authorizedFetch: vi.fn().mockResolvedValue(new Response('bad request', { status: 400 }))
    }
    await expect(requestWithRetry({
      oauthClient: terminal,
      url: 'https://process.example',
      init: {},
      wait
    })).rejects.toThrow(/HTTP 400/)
    expect(terminal.authorizedFetch).toHaveBeenCalledTimes(1)
  })

  it('does not retry an explicit caller abort', async () => {
    const controller = new AbortController()
    controller.abort(new DOMException('cancelled', 'AbortError'))
    const oauthClient = { authorizedFetch: vi.fn().mockRejectedValue(controller.signal.reason) }
    const wait = vi.fn()
    await expect(requestWithRetry({
      oauthClient,
      url: 'https://process.example',
      init: { signal: controller.signal },
      wait
    })).rejects.toMatchObject({ name: 'AbortError' })
    expect(oauthClient.authorizedFetch).toHaveBeenCalledTimes(1)
    expect(wait).not.toHaveBeenCalled()
  })

  it('resumes only a verified image and quarantines a changed file before replacement', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'sentinel2-generator-'))
    temporaryDirectories.push(root)
    const outputRoot = path.join(root, 'images')
    const checkpointPath = path.join(root, 'checkpoint.json')
    const raw = Buffer.alloc(64 * 64 * 3)
    for (let index = 0; index < raw.length; index += 1) raw[index] = (index * 31) % 256
    const jpeg = await sharp(raw, { raw: { width: 64, height: 64, channels: 3 } }).jpeg({ quality: 90 }).toBuffer()
    const planText = '{"fixture":"resume"}\n'
    const planSha256 = createHash('sha256').update(planText).digest('hex')
    const target = {
      id: 'prefecture:130100', targetKind: 'prefecture', width: 64, height: 64,
      projectedBounds: [0, 0, 6400, 6400], assetPath: 'prefectures/130100.jpg'
    }
    const manifest = {
      sourceContract: {
        sourceDecisionState: 'pinned', colorTransformSha256: '8bda611d6f4aa245df450f0d0077647b9b6b6372ef6004296fe2f9db5e971154'
      },
      targets: [target]
    }
    const qualityCheckpoint = {
      schemaVersion: 1, kind: 'quality-selection', planSha256,
      entries: { [target.id]: { status: 'available', chosenQuarter: '2025-Q2', fallbackUsed: false, noDataRatio: 0 } }
    }
    const response = () => new Response(jpeg, {
      headers: { 'content-type': 'image/jpeg', 'x-processingunits-spent': '0.1' }
    })
    const firstClient = { authorizedFetch: vi.fn().mockImplementation(response) }
    const first = await runImageGeneration({
      manifest, planText, qualityCheckpoint, oauthClient: firstClient,
      processEndpoint: 'https://process.example', checkpointPath, outputRoot
    })
    expect(first.entries[target.id]).toMatchObject({ status: 'complete', width: 64, height: 64, retryCount: 0 })
    expect(firstClient.authorizedFetch).toHaveBeenCalledTimes(1)

    const resumeClient = { authorizedFetch: vi.fn(() => { throw new Error('network must not be used') }) }
    await runImageGeneration({
      manifest, planText, qualityCheckpoint, oauthClient: resumeClient,
      processEndpoint: 'https://process.example', checkpointPath, outputRoot
    })
    expect(resumeClient.authorizedFetch).not.toHaveBeenCalled()

    const outputPath = path.join(outputRoot, target.assetPath)
    await writeFile(outputPath, Buffer.concat([await readFile(outputPath), Buffer.from([0])]))
    const replacementClient = { authorizedFetch: vi.fn().mockImplementation(response) }
    await runImageGeneration({
      manifest, planText, qualityCheckpoint, oauthClient: replacementClient,
      processEndpoint: 'https://process.example', checkpointPath, outputRoot
    })
    expect(replacementClient.authorizedFetch).toHaveBeenCalledTimes(1)
    expect(await readdir(path.dirname(outputPath))).toEqual(expect.arrayContaining(['130100.jpg', '130100.jpg.corrupt-1']))
  })

  it('does not promote or checkpoint a corrupt image response', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'sentinel2-corrupt-response-'))
    temporaryDirectories.push(root)
    const planText = '{"fixture":"corrupt"}\n'
    const planSha256 = createHash('sha256').update(planText).digest('hex')
    const target = {
      id: 'prefecture:130100', targetKind: 'prefecture', width: 64, height: 64,
      projectedBounds: [0, 0, 6400, 6400], assetPath: 'prefectures/130100.jpg'
    }
    const checkpointPath = path.join(root, 'checkpoint.json')
    await expect(runImageGeneration({
      manifest: {
        sourceContract: {
          sourceDecisionState: 'pinned', colorTransformSha256: '8bda611d6f4aa245df450f0d0077647b9b6b6372ef6004296fe2f9db5e971154'
        },
        targets: [target]
      },
      planText,
      qualityCheckpoint: {
        schemaVersion: 1, kind: 'quality-selection', planSha256,
        entries: { [target.id]: { status: 'available', chosenQuarter: '2025-Q2', fallbackUsed: false, noDataRatio: 0 } }
      },
      oauthClient: { authorizedFetch: vi.fn().mockResolvedValue(new Response('not a jpeg', { headers: { 'content-type': 'image/jpeg' } })) },
      processEndpoint: 'https://process.example', checkpointPath,
      outputRoot: path.join(root, 'images')
    })).rejects.toThrow(/JPEG/)
    await expect(readFile(path.join(root, 'images', target.assetPath))).rejects.toMatchObject({ code: 'ENOENT' })
    await expect(readFile(checkpointPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
