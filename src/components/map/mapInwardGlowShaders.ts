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
uniform float uWaveActive;
uniform float uWavePhase;
uniform float uWaveWidthRatio;
uniform float uWaveStrength;
uniform float uWaveTravelRatio;
uniform float uWaveDecay;
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
  float depth = clamp(1.0 - 2.0 * farBand / max(mask, 0.0001), 0.0, 1.0);
  float center = uWavePhase * uWaveTravelRatio;
  float halfWidth = max(clamp(uWaveWidthRatio, 0.01, 1.0) * 0.5, 0.0001);
  float wavePeak = 1.0 - smoothstep(0.0, halfWidth, abs(depth - center));
  float waveDecay = uWaveDecay <= 0.0 ? 1.0 : pow(max(1.0 - uWavePhase, 0.0), uWaveDecay);
  float waveEnvelope = shaped * wavePeak * waveDecay * insideGate;
  float waveAlpha = uWaveActive > 0.5 ? waveEnvelope * clamp(uWaveStrength, 0.0, 2.0) : 0.0;
  float outsideGuard = step(0.0001, mask);
  float alpha = min((baseAlpha + waveAlpha) * outsideGuard, uMaxAlpha);
  gl_FragColor = vec4(uColor, alpha);
}
`

const DEFAULT_NEAR_OPACITY = 0
const DEFAULT_FAR_OPACITY = 0
const DEFAULT_FALLOFF = 1
const DEFAULT_EDGE_SOFTNESS = 0.96
const DEFAULT_MAX_ALPHA = 1
const DEFAULT_BASE_RATIO = 0.7
const DEFAULT_WAVE_PHASE = 0
const DEFAULT_WAVE_WIDTH_RATIO = 0.24
const DEFAULT_WAVE_STRENGTH = 0
const DEFAULT_WAVE_TRAVEL_RATIO = 1
const DEFAULT_WAVE_DECAY = 0.65

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
  waveActive: boolean
  wavePhase: number
  waveWidthRatio: number
  waveStrength: number
  waveTravelRatio: number
  waveDecay: number
}

export interface InwardWaveSampleInputs {
  depth: number
  phase: number
  widthRatio: number
  travelRatio: number
  decay: number
}

export interface InwardWaveSample {
  center: number
  peak: number
  amplitude: number
  value: number
}

function finiteClamped(value: number, fallback: number, min: number, max: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback
}

export function evaluateInwardWaveSample(inputs: InwardWaveSampleInputs): InwardWaveSample {
  const depth = finiteClamped(inputs.depth, 0, 0, 1)
  const phase = finiteClamped(inputs.phase, DEFAULT_WAVE_PHASE, 0, 1)
  const widthRatio = finiteClamped(inputs.widthRatio, DEFAULT_WAVE_WIDTH_RATIO, 0.01, 1)
  const travelRatio = finiteClamped(inputs.travelRatio, DEFAULT_WAVE_TRAVEL_RATIO, 0.25, 2)
  const decay = finiteClamped(inputs.decay, DEFAULT_WAVE_DECAY, 0, 4)
  const center = phase * travelRatio
  const halfWidth = Math.max(widthRatio * 0.5, 0.0001)
  const distanceRatio = Math.min(1, Math.max(0, Math.abs(depth - center) / halfWidth))
  const smoothDistance = distanceRatio * distanceRatio * (3 - 2 * distanceRatio)
  const peak = 1 - smoothDistance
  const amplitude = decay <= 0 ? 1 : Math.pow(Math.max(1 - phase, 0), decay)

  return { center, peak, amplitude, value: peak * amplitude }
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
      uBaseRatio: { value: DEFAULT_BASE_RATIO },
      uWaveActive: { value: 0 },
      uWavePhase: { value: DEFAULT_WAVE_PHASE },
      uWaveWidthRatio: { value: DEFAULT_WAVE_WIDTH_RATIO },
      uWaveStrength: { value: DEFAULT_WAVE_STRENGTH },
      uWaveTravelRatio: { value: DEFAULT_WAVE_TRAVEL_RATIO },
      uWaveDecay: { value: DEFAULT_WAVE_DECAY }
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
  material.uniforms.uWaveActive.value = inputs.waveActive ? 1 : 0
  material.uniforms.uWavePhase.value = finiteClamped(inputs.wavePhase, DEFAULT_WAVE_PHASE, 0, 1)
  material.uniforms.uWaveWidthRatio.value = finiteClamped(
    inputs.waveWidthRatio,
    DEFAULT_WAVE_WIDTH_RATIO,
    0.01,
    1
  )
  material.uniforms.uWaveStrength.value = finiteClamped(
    inputs.waveStrength,
    DEFAULT_WAVE_STRENGTH,
    0,
    2
  )
  material.uniforms.uWaveTravelRatio.value = finiteClamped(
    inputs.waveTravelRatio,
    DEFAULT_WAVE_TRAVEL_RATIO,
    0.25,
    2
  )
  material.uniforms.uWaveDecay.value = finiteClamped(inputs.waveDecay, DEFAULT_WAVE_DECAY, 0, 4)
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
