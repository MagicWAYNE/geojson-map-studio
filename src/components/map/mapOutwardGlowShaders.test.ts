import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import {
  createGlowShaderResources,
  disposeGlowShaderResources,
  renderOutwardComposite,
  renderSeparableBlur
} from './mapOutwardGlowShaders'

function recordingRenderer(throwOnRender = false) {
  const state = {
    targets: [] as Array<THREE.WebGLRenderTarget | null>,
    renders: [] as Array<[THREE.Object3D, THREE.Camera]>,
    snapshots: [] as Array<{
      target: THREE.WebGLRenderTarget | null
      tDiffuse: THREE.Texture | null | undefined
      uDirection: THREE.Vector2 | undefined
    }>
  }
  let target: THREE.WebGLRenderTarget | null = null
  return Object.assign({
    setRenderTarget(renderTarget: THREE.WebGLRenderTarget | null) {
      target = renderTarget
      state.targets.push(renderTarget)
    },
    render(object: THREE.Object3D, camera: THREE.Camera) {
      state.renders.push([object, camera])
      const material = (object as THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>).material
      state.snapshots.push({
        target,
        tDiffuse: material.uniforms.tDiffuse?.value,
        uDirection: material.uniforms.uDirection?.value.clone()
      })
      if (throwOnRender) throw new Error('unexpected renderer call')
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
    expect(renderer.snapshots).toEqual([
      { target: ping, tDiffuse: source, uDirection: new THREE.Vector2(1, 0) },
      { target: output, tDiffuse: ping.texture, uDirection: new THREE.Vector2(0, 1) },
      { target: ping, tDiffuse: output.texture, uDirection: new THREE.Vector2(1, 0) },
      { target: output, tDiffuse: ping.texture, uDirection: new THREE.Vector2(0, 1) }
    ])
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

  it('uses the exact blur sampling statements and subtracts the mask from the composite', () => {
    const resources = createGlowShaderResources()

    expect(resources.blurMaterial.fragmentShader).toContain(
      'float value = texture2D(tDiffuse, vUv).r * 0.227027;'
    )
    expect(resources.blurMaterial.fragmentShader).toContain(
      'value += texture2D(tDiffuse, vUv + stepUv * 1.384615).r * 0.316216;'
    )
    expect(resources.blurMaterial.fragmentShader).toContain(
      'value += texture2D(tDiffuse, vUv - stepUv * 1.384615).r * 0.316216;'
    )
    expect(resources.blurMaterial.fragmentShader).toContain(
      'value += texture2D(tDiffuse, vUv + stepUv * 3.230769).r * 0.070270;'
    )
    expect(resources.blurMaterial.fragmentShader).toContain(
      'value += texture2D(tDiffuse, vUv - stepUv * 3.230769).r * 0.070270;'
    )
    expect(resources.compositeMaterial.fragmentShader).toContain(
      'float outside = 1.0 - smoothstep(0.02, 0.98, mask);'
    )
    expect(resources.compositeMaterial.fragmentShader).toContain(
      'float alpha = clamp((nearGlow + farGlow) * outside, 0.0, 1.0);'
    )

    disposeGlowShaderResources(resources)
  })

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects invalid blur pass count %s before rendering',
    (passes) => {
      const resources = createGlowShaderResources()
      const source = new THREE.Texture()
      const ping = new THREE.WebGLRenderTarget(32, 32)
      const output = new THREE.WebGLRenderTarget(32, 32)
      const renderer = recordingRenderer(true)

      expect(() => renderSeparableBlur(renderer, resources, source, ping, output, 12, passes))
        .toThrowError(new RangeError('passes must be a finite positive integer'))
      expect(renderer.targets).toEqual([])
      expect(renderer.renders).toEqual([])

      disposeGlowShaderResources(resources)
      ping.dispose()
      output.dispose()
    }
  )

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects invalid blur radius %s before rendering',
    (radiusTexels) => {
      const resources = createGlowShaderResources()
      const source = new THREE.Texture()
      const ping = new THREE.WebGLRenderTarget(32, 32)
      const output = new THREE.WebGLRenderTarget(32, 32)
      const renderer = recordingRenderer(true)

      expect(() => renderSeparableBlur(renderer, resources, source, ping, output, radiusTexels, 1))
        .toThrowError(new RangeError('radiusTexels must be a finite non-negative number'))
      expect(renderer.targets).toEqual([])
      expect(renderer.renders).toEqual([])

      disposeGlowShaderResources(resources)
      ping.dispose()
      output.dispose()
    }
  )

  it('rejects illegal ping-pong texture feedback before rendering', () => {
    const resources = createGlowShaderResources()
    const source = new THREE.Texture()
    const ping = new THREE.WebGLRenderTarget(32, 32)
    const output = new THREE.WebGLRenderTarget(32, 32)
    const separateOutput = new THREE.WebGLRenderTarget(32, 32)
    const renderer = recordingRenderer(true)

    expect(() => renderSeparableBlur(renderer, resources, source, ping, ping, 12, 1))
      .toThrowError(new RangeError('ping and output must be distinct render targets'))
    output.texture = ping.texture
    expect(() => renderSeparableBlur(renderer, resources, source, ping, output, 12, 1))
      .toThrowError(new RangeError('ping and output must not share a texture'))
    expect(() => renderSeparableBlur(renderer, resources, ping.texture, ping, separateOutput, 12, 1))
      .toThrowError(new RangeError('source must not be ping.texture'))
    expect(renderer.targets).toEqual([])
    expect(renderer.renders).toEqual([])

    disposeGlowShaderResources(resources)
    ping.dispose()
    output.dispose()
    separateOutput.dispose()
  })

  it('allows output.texture as the initial source because the ping-pong passes remain safe', () => {
    const resources = createGlowShaderResources()
    const ping = new THREE.WebGLRenderTarget(32, 32)
    const output = new THREE.WebGLRenderTarget(32, 32)
    const renderer = recordingRenderer()

    expect(() => renderSeparableBlur(renderer, resources, output.texture, ping, output, 12, 2))
      .not.toThrow()
    expect(renderer.targets).toEqual([ping, output, ping, output])

    disposeGlowShaderResources(resources)
    ping.dispose()
    output.dispose()
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
