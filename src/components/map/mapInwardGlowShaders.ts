import * as THREE from 'three'
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js'

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
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
uniform float uBaseRatio;
varying vec2 vUv;
void main() {
  float mask = clamp(texture2D(tMask, vUv).r, 0.0, 1.0);
  float nearValue = clamp(texture2D(tNear, vUv).r, 0.0, 1.0);
  float farValue = clamp(texture2D(tFar, vUv).r, 0.0, 1.0);
  float nearBand = max(mask - nearValue, 0.0);
  float farBand = max(mask - farValue, 0.0);
  float softThreshold = mix(0.0001, 0.25, clamp(uEdgeSoftness, 0.0, 1.0));
  float insideGate = smoothstep(0.0, softThreshold, mask);
  float combined = clamp(
    nearBand * clamp(uNearOpacity, 0.0, 2.0)
    + farBand * clamp(uFarOpacity, 0.0, 2.0),
    0.0,
    1.0
  );
  float shaped = pow(combined, clamp(uFalloff, 0.25, 4.0));
  float baseAlpha = shaped * clamp(uBaseRatio, 0.0, 1.0) * insideGate;
  float outsideGuard = step(0.0001, mask);
  float alpha = min(baseAlpha * outsideGuard, uMaxAlpha);
  gl_FragColor = vec4(uColor, alpha);
}
`

const DEFAULT_NEAR_OPACITY = 0
const DEFAULT_FAR_OPACITY = 0
const DEFAULT_FALLOFF = 1
const DEFAULT_EDGE_SOFTNESS = 0.96
const DEFAULT_MAX_ALPHA = 1
const DEFAULT_BASE_RATIO = 0.7

export interface InwardGlowShaderResources {
  material: THREE.ShaderMaterial
  quad: FullScreenQuad
  disposed: boolean
}

export interface InwardCompositeInputs {
  mask: THREE.Texture
  near: THREE.Texture
  far: THREE.Texture
  color: THREE.ColorRepresentation
  nearOpacity: number
  farOpacity: number
  falloff: number
  edgeSoftness: number
  maxAlpha: number
  baseRatio: number
}

function finiteClamped(value: number, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback
}

export function createInwardGlowShaderResources(): InwardGlowShaderResources {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      tMask: { value: null },
      tNear: { value: null },
      tFar: { value: null },
      uColor: { value: new THREE.Color() },
      uNearOpacity: { value: DEFAULT_NEAR_OPACITY },
      uFarOpacity: { value: DEFAULT_FAR_OPACITY },
      uFalloff: { value: DEFAULT_FALLOFF },
      uEdgeSoftness: { value: DEFAULT_EDGE_SOFTNESS },
      uMaxAlpha: { value: DEFAULT_MAX_ALPHA },
      uBaseRatio: { value: DEFAULT_BASE_RATIO }
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
    material,
    quad: new FullScreenQuad(material),
    disposed: false
  }
}

export function renderInwardComposite(
  renderer: THREE.WebGLRenderer,
  resources: InwardGlowShaderResources,
  inputs: InwardCompositeInputs
): void {
  const { material, quad } = resources
  material.uniforms.tMask.value = inputs.mask
  material.uniforms.tNear.value = inputs.near
  material.uniforms.tFar.value = inputs.far
  material.uniforms.uColor.value.set(inputs.color)
  material.uniforms.uNearOpacity.value = finiteClamped(inputs.nearOpacity, DEFAULT_NEAR_OPACITY, 0, 2)
  material.uniforms.uFarOpacity.value = finiteClamped(inputs.farOpacity, DEFAULT_FAR_OPACITY, 0, 2)
  material.uniforms.uFalloff.value = finiteClamped(inputs.falloff, DEFAULT_FALLOFF, 0.25, 4)
  material.uniforms.uEdgeSoftness.value = finiteClamped(
    inputs.edgeSoftness,
    DEFAULT_EDGE_SOFTNESS,
    0,
    1
  )
  material.uniforms.uMaxAlpha.value = finiteClamped(inputs.maxAlpha, DEFAULT_MAX_ALPHA, 0.1, 1)
  material.uniforms.uBaseRatio.value = finiteClamped(inputs.baseRatio, DEFAULT_BASE_RATIO, 0, 1)
  quad.material = material
  renderer.setRenderTarget(null)
  quad.render(renderer)
}

export function disposeInwardGlowShaderResources(resources: InwardGlowShaderResources): void {
  if (resources.disposed) return

  resources.disposed = true
  resources.material.dispose()
  resources.quad.dispose()
}
