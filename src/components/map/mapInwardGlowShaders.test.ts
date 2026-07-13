import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import {
  createInwardGlowShaderResources,
  disposeInwardGlowShaderResources,
  renderInwardComposite,
  type InwardCompositeInputs
} from './mapInwardGlowShaders'

function recordingRenderer() {
  const state = {
    targets: [] as Array<THREE.WebGLRenderTarget | null>,
    renders: [] as Array<[THREE.Object3D, THREE.Camera]>
  }

  return Object.assign({
    setRenderTarget(target: THREE.WebGLRenderTarget | null) {
      state.targets.push(target)
    },
    render(object: THREE.Object3D, camera: THREE.Camera) {
      state.renders.push([object, camera])
    }
  }, state) as typeof state & THREE.WebGLRenderer
}

function compositeInputs(overrides: Partial<InwardCompositeInputs> = {}): InwardCompositeInputs {
  return {
    mask: new THREE.Texture(),
    near: new THREE.Texture(),
    far: new THREE.Texture(),
    color: '#ffffff',
    nearOpacity: 0.15,
    farOpacity: 0.18,
    falloff: 1,
    edgeSoftness: 0.96,
    maxAlpha: 0.5,
    baseRatio: 0.7,
    ...overrides
  }
}

describe('mapInwardGlowShaders', () => {
  it('binds stable inward composite inputs without wave uniforms', () => {
    const resources = createInwardGlowShaderResources()
    const renderer = recordingRenderer()
    const inputs = compositeInputs()

    renderInwardComposite(renderer, resources, inputs)

    expect(resources.material.uniforms).toMatchObject({
      tMask: { value: inputs.mask },
      tNear: { value: inputs.near },
      tFar: { value: inputs.far },
      uNearOpacity: { value: 0.15 },
      uFarOpacity: { value: 0.18 },
      uBaseRatio: { value: 0.7 }
    })
    expect(Object.keys(resources.material.uniforms).some((key) => /wave/i.test(key))).toBe(false)
    expect(resources.material.uniforms.uColor.value).toMatchObject(new THREE.Color('#ffffff'))
    expect(renderer.targets).toEqual([null])
    expect(renderer.renders).toHaveLength(1)

    disposeInwardGlowShaderResources(resources)
  })

  it('uses strict inward clipping and stable base alpha only', () => {
    const resources = createInwardGlowShaderResources()
    const fragmentShader = resources.material.fragmentShader

    expect(fragmentShader).toContain('float mask = clamp(texture2D(tMask, vUv).r, 0.0, 1.0);')
    expect(fragmentShader).toContain('float nearBand = max(mask - nearValue, 0.0);')
    expect(fragmentShader).toContain('float farBand = max(mask - farValue, 0.0);')
    expect(fragmentShader).toContain('float insideGate = smoothstep(0.0, softThreshold, mask);')
    expect(fragmentShader).toContain(
      'float baseAlpha = shaped * clamp(uBaseRatio, 0.0, 1.0) * insideGate;'
    )
    expect(fragmentShader).toContain('float outsideGuard = step(0.0001, mask);')
    expect(fragmentShader).toContain('float alpha = min(baseAlpha * outsideGuard, uMaxAlpha);')
    expect(fragmentShader).not.toMatch(/wave/i)

    disposeInwardGlowShaderResources(resources)
  })

  it('finite-clamps every scalar composite uniform', () => {
    const resources = createInwardGlowShaderResources()
    const renderer = recordingRenderer()

    renderInwardComposite(renderer, resources, compositeInputs({
      nearOpacity: Number.NaN,
      farOpacity: Number.POSITIVE_INFINITY,
      falloff: Number.NEGATIVE_INFINITY,
      edgeSoftness: Number.NaN,
      maxAlpha: Number.POSITIVE_INFINITY,
      baseRatio: Number.NaN
    }))

    expect(resources.material.uniforms).toMatchObject({
      uNearOpacity: { value: 0 },
      uFarOpacity: { value: 0 },
      uFalloff: { value: 1 },
      uEdgeSoftness: { value: 0.96 },
      uMaxAlpha: { value: 1 },
      uBaseRatio: { value: 0.7 }
    })
    expect(Object.values(resources.material.uniforms)
      .filter((uniform) => typeof uniform.value === 'number')
      .every((uniform) => Number.isFinite(uniform.value))).toBe(true)

    disposeInwardGlowShaderResources(resources)
  })

  it('uses additive blending and disposes resources exactly once', () => {
    const resources = createInwardGlowShaderResources()
    const disposeMaterial = vi.spyOn(resources.material, 'dispose')
    const disposeQuad = vi.spyOn(resources.quad, 'dispose')

    expect(resources.material).toMatchObject({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    })

    disposeInwardGlowShaderResources(resources)
    disposeInwardGlowShaderResources(resources)

    expect(disposeMaterial).toHaveBeenCalledOnce()
    expect(disposeQuad).toHaveBeenCalledOnce()
  })
})
