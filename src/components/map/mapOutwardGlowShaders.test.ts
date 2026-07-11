import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import {
  createGlowShaderResources,
  disposeGlowShaderResources,
  renderOutwardComposite,
  renderSeparableBlur
} from './mapOutwardGlowShaders'

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

describe('mapOutwardGlowShaders', () => {
  it('runs horizontal and vertical blur passes without clearing the final screen', () => {
    const resources = createGlowShaderResources()
    const source = new THREE.Texture()
    const ping = new THREE.WebGLRenderTarget(32, 32)
    const output = new THREE.WebGLRenderTarget(32, 32)
    const renderer = recordingRenderer()

    renderSeparableBlur(renderer, resources, source, ping, output, 12, 2)

    expect(renderer.targets).toEqual([ping, output, ping, output])
    expect(renderer.renders).toHaveLength(4)
    expect(resources.blurMaterial.uniforms.uRadius.value).toBeCloseTo(12 / Math.sqrt(2))
    expect(resources.blurMaterial.uniforms.uTexelSize.value).toMatchObject({ x: 1 / 32, y: 1 / 32 })
    expect(resources.blurMaterial.uniforms.uDirection.value).toMatchObject({ x: 0, y: 1 })

    disposeGlowShaderResources(resources)
    ping.dispose()
    output.dispose()
  })

  it('binds mask, near, far, color and B3 opacity for outward composition', () => {
    const resources = createGlowShaderResources()
    const renderer = recordingRenderer()
    const mask = new THREE.Texture()
    const near = new THREE.Texture()
    const far = new THREE.Texture()

    renderOutwardComposite(renderer, resources, {
      mask,
      near,
      far,
      color: '#27a7ff',
      nearOpacity: 0.1909,
      farOpacity: 0.23
    })

    expect(resources.compositeMaterial.uniforms).toMatchObject({
      tMask: { value: mask },
      tNear: { value: near },
      tFar: { value: far },
      uNearOpacity: { value: 0.1909 },
      uFarOpacity: { value: 0.23 }
    })
    expect(resources.compositeMaterial.uniforms.uColor.value).toMatchObject(
      new THREE.Color('#27a7ff')
    )
    expect(renderer.targets.at(-1)).toBe(null)
    expect(renderer.renders).toHaveLength(1)
    expect(resources.compositeMaterial).toMatchObject({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false
    })

    disposeGlowShaderResources(resources)
  })

  it('uses the exact 9-tap blur weights and subtracts the mask from the composite', () => {
    const resources = createGlowShaderResources()

    expect(resources.blurMaterial.fragmentShader).toContain('0.227027')
    expect(resources.blurMaterial.fragmentShader).toContain('1.384615')
    expect(resources.blurMaterial.fragmentShader).toContain('0.316216')
    expect(resources.blurMaterial.fragmentShader).toContain('3.230769')
    expect(resources.blurMaterial.fragmentShader).toContain('0.070270')
    expect(resources.compositeMaterial.fragmentShader).toContain(
      'float outside = 1.0 - smoothstep(0.02, 0.98, mask);'
    )
    expect(resources.compositeMaterial.fragmentShader).toContain(
      'float alpha = clamp((nearGlow + farGlow) * outside, 0.0, 1.0);'
    )

    disposeGlowShaderResources(resources)
  })

  it('disposes every shared resource exactly once', () => {
    const resources = createGlowShaderResources()
    const disposeBlurMaterial = vi.spyOn(resources.blurMaterial, 'dispose')
    const disposeCompositeMaterial = vi.spyOn(resources.compositeMaterial, 'dispose')
    const disposeQuad = vi.spyOn(resources.quad, 'dispose')

    disposeGlowShaderResources(resources)
    disposeGlowShaderResources(resources)

    expect(disposeBlurMaterial).toHaveBeenCalledOnce()
    expect(disposeCompositeMaterial).toHaveBeenCalledOnce()
    expect(disposeQuad).toHaveBeenCalledOnce()
  })
})
