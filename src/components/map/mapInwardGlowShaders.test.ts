import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'
import {
  createInwardGlowShaderResources,
  disposeInwardGlowShaderResources,
  evaluateInwardWaveSample,
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
    waveActive: true,
    wavePhase: 0.75,
    waveWidthRatio: 0.24,
    waveStrength: 0.45,
    waveTravelRatio: 1,
    waveDecay: 0.65,
    ...overrides
  }
}

describe('mapInwardGlowShaders', () => {
  it('binds inward composite textures and wave uniforms without owning blur resources', () => {
    const resources = createInwardGlowShaderResources()
    const renderer = recordingRenderer()
    const inputs = compositeInputs()

    renderInwardComposite(renderer, resources, inputs)

    expect(resources.material.uniforms).toMatchObject({
      tMask: { value: inputs.mask },
      tNear: { value: inputs.near },
      tFar: { value: inputs.far },
      uBaseRatio: { value: 0.7 },
      uWavePhase: { value: 0.75 },
      uWaveWidthRatio: { value: 0.24 },
      uWaveStrength: { value: 0.45 },
      uWaveTravelRatio: { value: 1 },
      uWaveDecay: { value: 0.65 },
      uWaveActive: { value: 1 }
    })
    expect(resources.material.uniforms.uColor.value).toMatchObject(new THREE.Color('#ffffff'))
    expect(renderer.targets).toEqual([null])
    expect(renderer.renders).toHaveLength(1)
    expect(resources).not.toHaveProperty('blurMaterial')

    disposeInwardGlowShaderResources(resources)
  })

  it('uses strict inward clipping, an inside softness gate, and an inward travelling wave', () => {
    const resources = createInwardGlowShaderResources()
    const fragmentShader = resources.material.fragmentShader

    expect(fragmentShader).toContain('float mask = clamp(texture2D(tMask, vUv).r, 0.0, 1.0);')
    expect(fragmentShader).toContain('float nearValue = clamp(texture2D(tNear, vUv).r, 0.0, 1.0);')
    expect(fragmentShader).toContain('float farValue = clamp(texture2D(tFar, vUv).r, 0.0, 1.0);')
    expect(fragmentShader).toContain('float nearBand = max(mask - nearValue, 0.0);')
    expect(fragmentShader).toContain('float farBand = max(mask - farValue, 0.0);')
    expect(fragmentShader).toContain(
      'float softThreshold = mix(0.0001, 0.25, clamp(uEdgeSoftness, 0.0, 1.0));'
    )
    expect(fragmentShader).toContain('float insideGate = smoothstep(0.0, softThreshold, mask);')
    expect(fragmentShader).toContain(
      'float depth = clamp(1.0 - 2.0 * farBand / max(mask, 0.0001), 0.0, 1.0);'
    )
    expect(fragmentShader).toContain(
      'float wavePeak = 1.0 - smoothstep(0.0, halfWidth, abs(depth - center));'
    )
    expect(fragmentShader).toContain('float center = uWavePhase * uWaveTravelRatio;')
    expect(fragmentShader).toContain(
      'float waveDecay = uWaveDecay <= 0.0 ? 1.0 : pow(max(1.0 - uWavePhase, 0.0), uWaveDecay);'
    )
    expect(fragmentShader).toContain('float baseAlpha = shaped * clamp(uBaseRatio, 0.0, 1.0) * insideGate;')
    expect(fragmentShader).toContain(
      'float waveAlpha = uWaveActive > 0.5 ? waveEnvelope * clamp(uWaveStrength, 0.0, 2.0) : 0.0;'
    )
    expect(fragmentShader).toContain('float outsideGuard = step(0.0001, mask);')
    expect(fragmentShader).toContain(
      'float alpha = min((baseAlpha + waveAlpha) * outsideGuard, uMaxAlpha);'
    )
    expect(fragmentShader).not.toContain(
      '1.0 - smoothstep(0.5 - halfBand, 0.5 + halfBand, mask)'
    )

    disposeInwardGlowShaderResources(resources)
  })

  it('lets travel ratio set the full wave-center depth and naturally moves beyond the map', () => {
    expect(evaluateInwardWaveSample({
      depth: 1,
      phase: 0.75,
      widthRatio: 0.24,
      travelRatio: 2,
      decay: 0
    })).toMatchObject({ center: 1.5, peak: 0 })

    const edge = evaluateInwardWaveSample({
      depth: 1,
      phase: 0.5,
      widthRatio: 0.24,
      travelRatio: 2,
      decay: 0
    })
    expect(edge.center).toBe(1)
    expect(edge.peak).toBe(1)
  })

  it('keeps zero-decay amplitude finite at the end of travel', () => {
    const sample = evaluateInwardWaveSample({
      depth: 1,
      phase: 1,
      widthRatio: 0.24,
      travelRatio: 1,
      decay: 0
    })

    expect(sample).toEqual({ center: 1, peak: 1, amplitude: 1, value: 1 })
    expect(Object.values(sample).every(Number.isFinite)).toBe(true)
  })

  it('finite-clamps every scalar composite uniform and disables the wave when inactive', () => {
    const resources = createInwardGlowShaderResources()
    const renderer = recordingRenderer()

    renderInwardComposite(renderer, resources, compositeInputs({
      nearOpacity: Number.NaN,
      farOpacity: Number.POSITIVE_INFINITY,
      falloff: Number.NEGATIVE_INFINITY,
      edgeSoftness: Number.NaN,
      maxAlpha: Number.POSITIVE_INFINITY,
      baseRatio: Number.NaN,
      waveActive: false,
      wavePhase: Number.POSITIVE_INFINITY,
      waveWidthRatio: Number.NaN,
      waveStrength: Number.NEGATIVE_INFINITY,
      waveTravelRatio: Number.NaN,
      waveDecay: Number.POSITIVE_INFINITY
    }))

    expect(resources.material.uniforms).toMatchObject({
      uNearOpacity: { value: 0 },
      uFarOpacity: { value: 0 },
      uFalloff: { value: 1 },
      uEdgeSoftness: { value: 0.96 },
      uMaxAlpha: { value: 1 },
      uBaseRatio: { value: 0.7 },
      uWaveActive: { value: 0 },
      uWavePhase: { value: 0 },
      uWaveWidthRatio: { value: 0.24 },
      uWaveStrength: { value: 0 },
      uWaveTravelRatio: { value: 1 },
      uWaveDecay: { value: 0.65 }
    })
    expect(Object.values(resources.material.uniforms)
      .filter((uniform) => typeof uniform.value === 'number')
      .every((uniform) => Number.isFinite(uniform.value))).toBe(true)

    disposeInwardGlowShaderResources(resources)
  })

  it('uses additive blending and disposes its composite resources exactly once', () => {
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
