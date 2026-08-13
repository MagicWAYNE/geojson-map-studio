// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import router from './router'

describe('map authoring route compatibility', () => {
  it('旧地图上传地址进入首页同页工作区', () => {
    const legacyRoute = router.getRoutes().find((route) => route.path === '/map-loader')
    expect(legacyRoute?.redirect).toBe('/')
    expect(legacyRoute?.components).toEqual(undefined)
  })
})
