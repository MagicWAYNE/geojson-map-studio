// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyTextToClipboard } from './copyText'

function rejectClipboard(): void {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockRejectedValue(new Error('clipboard unavailable')) }
  })
}

afterEach(() => {
  document.body.replaceChildren()
  Reflect.deleteProperty(document, 'execCommand')
  Reflect.deleteProperty(navigator, 'clipboard')
  vi.restoreAllMocks()
})

describe('copyTextToClipboard', () => {
  it('reports execCommand false as failure and removes its textarea', async () => {
    rejectClipboard()
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn(() => false)
    })

    await expect(copyTextToClipboard('effect json')).resolves.toBe(false)
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('reports a thrown fallback as failure and still removes its textarea', async () => {
    rejectClipboard()
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn(() => { throw new Error('copy denied') })
    })

    await expect(copyTextToClipboard('effect json')).resolves.toBe(false)
    expect(document.querySelector('textarea')).toBeNull()
  })
})
