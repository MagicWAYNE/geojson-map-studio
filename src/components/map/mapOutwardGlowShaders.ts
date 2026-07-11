import * as THREE from 'three'
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js'

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

const blurFragmentShader = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uTexelSize;
uniform vec2 uDirection;
uniform float uRadius;
varying vec2 vUv;
void main() {
  vec2 stepUv = uTexelSize * uDirection * uRadius;
  float value = texture2D(tDiffuse, vUv).r * 0.227027;
  value += texture2D(tDiffuse, vUv + stepUv * 1.384615).r * 0.316216;
  value += texture2D(tDiffuse, vUv - stepUv * 1.384615).r * 0.316216;
  value += texture2D(tDiffuse, vUv + stepUv * 3.230769).r * 0.070270;
  value += texture2D(tDiffuse, vUv - stepUv * 3.230769).r * 0.070270;
  gl_FragColor = vec4(value, value, value, 1.0);
}
`

const compositeFragmentShader = /* glsl */ `
uniform sampler2D tMask;
uniform sampler2D tNear;
uniform sampler2D tFar;
uniform vec3 uColor;
uniform float uNearOpacity;
uniform float uFarOpacity;
uniform float uFalloff;
uniform float uEdgeSoftness;
uniform float uMaxAlpha;
varying vec2 vUv;
void main() {
  float mask = clamp(texture2D(tMask, vUv).r, 0.0, 1.0);
  float softness = max(clamp(uEdgeSoftness, 0.0, 1.0), 0.001);
  float halfBand = 0.49 * softness;
  float outside = 1.0 - smoothstep(0.5 - halfBand, 0.5 + halfBand, mask);
  float combined = clamp(
    texture2D(tNear, vUv).r * uNearOpacity
    + texture2D(tFar, vUv).r * uFarOpacity,
    0.0,
    1.0
  );
  float clampedFalloff = clamp(uFalloff, 0.25, 4.0);
  float shaped = pow(combined, clampedFalloff);
  float alpha = min(shaped * outside, clamp(uMaxAlpha, 0.1, 1.0));
  gl_FragColor = vec4(uColor, alpha);
}
`

const DEFAULT_COMPOSITE_FALLOFF = 1
const DEFAULT_COMPOSITE_EDGE_SOFTNESS = 0.96
const DEFAULT_COMPOSITE_MAX_ALPHA = 1

export interface GlowShaderResources {
  blurMaterial: THREE.ShaderMaterial
  compositeMaterial: THREE.ShaderMaterial
  quad: FullScreenQuad
  disposed: boolean
}

export interface OutwardCompositeInputs {
  mask: THREE.Texture
  near: THREE.Texture
  far: THREE.Texture
  color: THREE.ColorRepresentation
  nearOpacity: number
  farOpacity: number
  falloff?: number
  edgeSoftness?: number
  maxAlpha?: number
}

function finiteClamped(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number
): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback
}

export function createGlowShaderResources(): GlowShaderResources {
  const blurMaterial = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: null },
      uTexelSize: { value: new THREE.Vector2(1, 1) },
      uDirection: { value: new THREE.Vector2(1, 0) },
      uRadius: { value: 0 }
    },
    vertexShader,
    fragmentShader: blurFragmentShader,
    depthTest: false,
    depthWrite: false,
    toneMapped: false
  })
  const compositeMaterial = new THREE.ShaderMaterial({
    uniforms: {
      tMask: { value: null },
      tNear: { value: null },
      tFar: { value: null },
      uColor: { value: new THREE.Color() },
      uNearOpacity: { value: 0 },
      uFarOpacity: { value: 0 },
      uFalloff: { value: DEFAULT_COMPOSITE_FALLOFF },
      uEdgeSoftness: { value: DEFAULT_COMPOSITE_EDGE_SOFTNESS },
      uMaxAlpha: { value: DEFAULT_COMPOSITE_MAX_ALPHA }
    },
    vertexShader,
    fragmentShader: compositeFragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  })

  return {
    blurMaterial,
    compositeMaterial,
    quad: new FullScreenQuad(blurMaterial),
    disposed: false
  }
}

export function renderSeparableBlur(
  renderer: THREE.WebGLRenderer,
  resources: GlowShaderResources,
  source: THREE.Texture,
  ping: THREE.WebGLRenderTarget,
  output: THREE.WebGLRenderTarget,
  radiusTexels: number,
  passes: number
): void {
  if (!Number.isFinite(passes) || !Number.isInteger(passes) || passes <= 0) {
    throw new RangeError('passes must be a finite positive integer')
  }
  if (!Number.isFinite(radiusTexels) || radiusTexels < 0) {
    throw new RangeError('radiusTexels must be a finite non-negative number')
  }
  if (ping === output) {
    throw new RangeError('ping and output must be distinct render targets')
  }
  if (ping.texture === output.texture) {
    throw new RangeError('ping and output must not share a texture')
  }
  if (source === ping.texture) {
    throw new RangeError('source must not be ping.texture')
  }

  const { blurMaterial, quad } = resources
  const radius = radiusTexels / Math.sqrt(passes)

  let input = source
  for (let pass = 0; pass < passes; pass += 1) {
    blurMaterial.uniforms.uRadius.value = radius
    blurMaterial.uniforms.uTexelSize.value.set(1 / output.width, 1 / output.height)
    blurMaterial.uniforms.tDiffuse.value = input
    blurMaterial.uniforms.uDirection.value.set(1, 0)
    quad.material = blurMaterial
    renderer.setRenderTarget(ping)
    quad.render(renderer)

    blurMaterial.uniforms.tDiffuse.value = ping.texture
    blurMaterial.uniforms.uDirection.value.set(0, 1)
    renderer.setRenderTarget(output)
    quad.render(renderer)

    input = output.texture
  }
}

export function renderOutwardComposite(
  renderer: THREE.WebGLRenderer,
  resources: GlowShaderResources,
  inputs: OutwardCompositeInputs
): void {
  const { compositeMaterial, quad } = resources
  compositeMaterial.uniforms.tMask.value = inputs.mask
  compositeMaterial.uniforms.tNear.value = inputs.near
  compositeMaterial.uniforms.tFar.value = inputs.far
  compositeMaterial.uniforms.uColor.value.set(inputs.color)
  compositeMaterial.uniforms.uNearOpacity.value = inputs.nearOpacity
  compositeMaterial.uniforms.uFarOpacity.value = inputs.farOpacity
  compositeMaterial.uniforms.uFalloff.value = finiteClamped(
    inputs.falloff,
    DEFAULT_COMPOSITE_FALLOFF,
    0.25,
    4
  )
  compositeMaterial.uniforms.uEdgeSoftness.value = finiteClamped(
    inputs.edgeSoftness,
    DEFAULT_COMPOSITE_EDGE_SOFTNESS,
    0,
    1
  )
  compositeMaterial.uniforms.uMaxAlpha.value = finiteClamped(
    inputs.maxAlpha,
    DEFAULT_COMPOSITE_MAX_ALPHA,
    0.1,
    1
  )
  quad.material = compositeMaterial
  renderer.setRenderTarget(null)
  quad.render(renderer)
}

export function disposeGlowShaderResources(resources: GlowShaderResources): void {
  if (resources.disposed) return

  resources.disposed = true
  resources.blurMaterial.dispose()
  resources.compositeMaterial.dispose()
  resources.quad.dispose()
}
