import { describe, expect, it, vi } from 'vitest'
import { MAP_DISTRICT_BAR_LABEL_DEFAULTS } from './mapDistrictBarLabelConfig'
import {
  formatDistrictCaseCount,
  loadDistrictBarLabelAssets,
  renderDistrictBarLabelCanvas
} from './mapDistrictBarLabelTexture'

describe('mapDistrictBarLabelTexture', () => {
  it('formats case totals using the approved compact notation', () => {
    expect(formatDistrictCaseCount(980, 1)).toBe('980')
    expect(formatDistrictCaseCount(1_000, 1)).toBe('1k')
    expect(formatDistrictCaseCount(2_400, 1)).toBe('2.4k')
    expect(formatDistrictCaseCount(59_437, 1)).toBe('59.4k')
    expect(formatDistrictCaseCount(999_999, 1)).toBe('1m')
    expect(formatDistrictCaseCount(1_250_000, 1)).toBe('1.3m')
    expect(formatDistrictCaseCount(Number.NaN, 1)).toBe('0')
  })

  it('respects the configured decimal count and trims trailing zeros', () => {
    expect(formatDistrictCaseCount(1_234, 0)).toBe('1k')
    expect(formatDistrictCaseCount(1_234, 2)).toBe('1.23k')
    expect(formatDistrictCaseCount(2_000, 2)).toBe('2k')
  })

  it('composes the approved background, icon, district, metric, and compact value at 2x', () => {
    const calls: Array<[string, ...unknown[]]> = []
    const context = {
      save: () => calls.push(['save']),
      restore: () => calls.push(['restore']),
      clearRect: (...args: unknown[]) => calls.push(['clearRect', ...args]),
      drawImage: (...args: unknown[]) => calls.push(['drawImage', ...args]),
      fillRect: (...args: unknown[]) => calls.push(['fillRect', ...args]),
      fillText: (...args: unknown[]) => calls.push(['fillText', ...args]),
      measureText: (text: string) => ({ width: text.length * 12 }),
      globalAlpha: 1,
      globalCompositeOperation: 'source-over',
      filter: 'none',
      fillStyle: '#ffffff',
      font: '',
      textAlign: 'left',
      textBaseline: 'alphabetic'
    }
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => context
    }
    const background = { id: 'background' }
    const icon = { id: 'icon' }

    renderDistrictBarLabelCanvas(
      canvas as unknown as HTMLCanvasElement,
      { background: background as unknown as CanvasImageSource, icon: icon as unknown as CanvasImageSource },
      { name: '南岸区', value: 2_400 },
      MAP_DISTRICT_BAR_LABEL_DEFAULTS
    )

    expect(canvas).toMatchObject({ width: 472, height: 72 })
    expect(calls).toContainEqual(['drawImage', background, 0, 8, 472, 56])
    expect(calls).toContainEqual(['drawImage', icon, 6, 0, 72, 72])
    expect(calls.filter(([kind]) => kind === 'fillText').map(([, text]) => text))
      .toEqual(['南岸区', '案件量', '2.4k'])
  })

  it('retries asset loading after a transient image failure', async () => {
    let shouldFail = true
    class FakeImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null

      set src(_value: string) {
        queueMicrotask(() => shouldFail ? this.onerror?.() : this.onload?.())
      }
    }
    vi.stubGlobal('Image', FakeImage)

    await expect(loadDistrictBarLabelAssets()).rejects.toThrow('柱体标签素材加载失败')
    shouldFail = false
    await expect(loadDistrictBarLabelAssets()).resolves.toEqual({
      background: expect.any(FakeImage),
      icon: expect.any(FakeImage)
    })
    vi.unstubAllGlobals()
  })
})
