// @vitest-environment happy-dom
import { createApp, h, nextTick, reactive } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import CollapsibleAlert from './CollapsibleAlert.vue'

afterEach(() => {
  document.body.replaceChildren()
})

describe('CollapsibleAlert', () => {
  it('starts collapsed for non-blocking status and remains user-toggleable', async () => {
    const root = document.createElement('div')
    const app = createApp({
      setup: () => () => h(CollapsibleAlert, {
        title: '加载成功',
        tone: 'success',
        defaultOpen: false
      }, () => '详细摘要')
    })
    app.mount(root)
    await nextTick()

    const button = root.querySelector<HTMLButtonElement>('button')!
    const body = root.querySelector<HTMLElement>('[data-alert-body]')!
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(button.getAttribute('aria-controls')).toBe(body.id)
    expect(body.style.display).toBe('none')

    button.click()
    await nextTick()
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(body.style.display).not.toBe('none')
    app.unmount()
  })

  it('starts expanded for failures and resets when a new result arrives', async () => {
    const state = reactive({ defaultOpen: true, resetKey: 1 })
    const root = document.createElement('div')
    const app = createApp({
      setup: () => () => h(CollapsibleAlert, {
        title: '加载失败',
        tone: 'error',
        defaultOpen: state.defaultOpen,
        resetKey: state.resetKey
      }, () => '错误详情')
    })
    app.mount(root)
    await nextTick()

    const button = root.querySelector<HTMLButtonElement>('button')!
    expect(button.getAttribute('aria-expanded')).toBe('true')
    button.click()
    await nextTick()
    expect(button.getAttribute('aria-expanded')).toBe('false')

    state.resetKey += 1
    await nextTick()
    expect(button.getAttribute('aria-expanded')).toBe('true')
    app.unmount()
  })
})
