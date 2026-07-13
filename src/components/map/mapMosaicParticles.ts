import * as THREE from 'three'
import {
  HOVER_MOSAIC_PARTICLE_DEFAULTS,
  MOSAIC_LOD_STEPS_PER_OCTAVE,
  normalizeMosaicParticleConfig,
  type MapMosaicParticleConfig
} from './mapMosaicParticleConfig'

export interface MapMosaicParticles {
  setConfig(config: Readonly<MapMosaicParticleConfig>): void
  setRegionProgress(source: THREE.Mesh, progress: number): boolean
  advanceTime(deltaMs: number): void
  dispose(): void
}

export interface MosaicDisplayMetrics {
  getRenderPixelsPerScreenPixel(): number
}

interface ParticleEntry {
  source: THREE.Mesh
  overlay: THREE.Mesh<THREE.BufferGeometry, THREE.Material[]>
  material: THREE.ShaderMaterial
  progress: number
}

const VERTEX_SHADER = /* glsl */ `
  uniform float uSurfaceOffset;
  varying vec2 vModelPosition;
  varying float vTopFacing;

  void main() {
    vModelPosition = position.xy;
    vTopFacing = normal.z;
    vec3 displaced = position + vec3(0.0, 0.0, uSurfaceOffset);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`

const FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uPrimaryColor;
  uniform float uDensity;
  uniform float uGapRatio;
  uniform float uOpacity;
  uniform float uBrightness;
  uniform float uProgress;
  uniform float uTime;
  uniform float uTargetCellPx;
  uniform float uMinCellPx;
  uniform float uMaxCellPx;
  uniform float uRenderPixelsPerScreenPixel;
  varying vec2 vModelPosition;
  varying float vTopFacing;

  float hash21(vec2 value) {
    value = fract(value * vec2(123.34, 456.21));
    value += dot(value, value + 45.32);
    return fract(value.x * value.y);
  }

  vec3 selectCellWorlds(float modelUnitsPerRenderPixel) {
    const float lodStepsPerOctave = ${MOSAIC_LOD_STEPS_PER_OCTAVE.toFixed(1)};
    float cssPixelWorld = max(
      modelUnitsPerRenderPixel * max(uRenderPixelsPerScreenPixel, 0.0001),
      0.000001
    );
    float desiredWorld = max(cssPixelWorld * uTargetCellPx, 0.000001);
    float targetLevel = log2(desiredWorld) * lodStepsPerOctave;
    float minLevel = ceil(
      log2(cssPixelWorld * uMinCellPx) * lodStepsPerOctave - 0.000001
    );
    float maxLevel = floor(
      log2(cssPixelWorld * uMaxCellPx) * lodStepsPerOctave + 0.000001
    );
    float lowerLevel = floor(targetLevel);
    float upperLevel = lowerLevel + 1.0;
    if (minLevel <= maxLevel) {
      lowerLevel = clamp(lowerLevel, minLevel, maxLevel);
      upperLevel = clamp(upperLevel, minLevel, maxLevel);
    } else {
      lowerLevel = floor(targetLevel + 0.5);
      upperLevel = lowerLevel;
    }
    float blend = lowerLevel == upperLevel
      ? 0.0
      : smoothstep(0.35, 0.65, fract(targetLevel));
    return vec3(
      exp2(lowerLevel / lodStepsPerOctave),
      exp2(upperLevel / lodStepsPerOctave),
      blend
    );
  }

  float sampleGrid(float cellWorld) {
    vec2 cell = floor(vModelPosition / cellWorld);
    vec2 local = fract(vModelPosition / cellWorld);
    float inset = uGapRatio * 0.5;
    float square = step(inset, local.x) * step(inset, local.y)
      * step(local.x, 1.0 - inset) * step(local.y, 1.0 - inset);
    float phase = hash21(cell + 19.7);
    float selected = step(1.0 - uDensity, hash21(cell + floor(uTime * 1.8)));
    float flicker = 0.35 + 0.65 * (0.5 + 0.5 * sin((uTime + phase) * 6.2831853));
    return square * selected * flicker;
  }

  void main() {
    if (vTopFacing < 0.5) discard;

    float modelUnitsPerRenderPixel = max(
      length(dFdx(vModelPosition)),
      length(dFdy(vModelPosition))
    );
    vec3 lod = selectCellWorlds(modelUnitsPerRenderPixel);
    float mosaic = mix(sampleGrid(lod.x), sampleGrid(lod.y), lod.z);
    float alpha = mosaic * uOpacity * uProgress;
    if (alpha <= 0.001) discard;
    gl_FragColor = vec4(uPrimaryColor * uBrightness, alpha);
  }
`

function createTopMaterial(
  config: Readonly<MapMosaicParticleConfig>,
  renderPixelsPerScreenPixel: number
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uPrimaryColor: { value: new THREE.Color(config.primaryColor) },
      uDensity: { value: config.density },
      uGapRatio: { value: config.gapRatio },
      uOpacity: { value: config.opacity },
      uBrightness: { value: config.brightness },
      uProgress: { value: 0 },
      uTime: { value: 0 },
      uTargetCellPx: { value: config.targetCellPx },
      uMinCellPx: { value: config.minCellPx },
      uMaxCellPx: { value: config.maxCellPx },
      uRenderPixelsPerScreenPixel: { value: renderPixelsPerScreenPixel },
      uSurfaceOffset: { value: config.surfaceOffset }
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    toneMapped: false
  })
}

export function createMapMosaicParticles(
  displayMetrics: MosaicDisplayMetrics,
  sources: readonly THREE.Mesh[]
): MapMosaicParticles {
  let config = normalizeMosaicParticleConfig(HOVER_MOSAIC_PARTICLE_DEFAULTS)
  const entries: ParticleEntry[] = []
  const entryBySource = new Map<THREE.Mesh, ParticleEntry>()
  const hiddenSideMaterial = new THREE.MeshBasicMaterial({ visible: false })
  let disposed = false

  function currentRenderPixelsPerScreenPixel(): number {
    const value = displayMetrics.getRenderPixelsPerScreenPixel()
    return Number.isFinite(value) && value > 0 ? value : 1
  }

  for (const source of sources) {
    let material: THREE.ShaderMaterial | null = null
    try {
      material = createTopMaterial(config, currentRenderPixelsPerScreenPixel())
      const overlay = new THREE.Mesh(source.geometry, [material, hiddenSideMaterial])
      overlay.name = `${source.name || source.userData.name || 'region'}-mosaic-particles`
      overlay.visible = false
      overlay.renderOrder = source.renderOrder + 1
      source.add(overlay)
      const entry = { source, overlay, material, progress: 0 }
      entries.push(entry)
      entryBySource.set(source, entry)
    } catch (cause) {
      material?.dispose()
      console.warn(`区块 ${String(source.userData.name ?? source.name ?? '')} 的马赛克粒子初始化失败，已跳过`, cause)
    }
  }

  function setConfig(next: Readonly<MapMosaicParticleConfig>): void {
    if (disposed) return
    config = normalizeMosaicParticleConfig(next)
    for (const entry of entries) {
      const uniforms = entry.material.uniforms
      uniforms.uPrimaryColor.value.set(config.primaryColor)
      uniforms.uDensity.value = config.density
      uniforms.uGapRatio.value = config.gapRatio
      uniforms.uOpacity.value = config.opacity
      uniforms.uBrightness.value = config.brightness
      uniforms.uTargetCellPx.value = config.targetCellPx
      uniforms.uMinCellPx.value = config.minCellPx
      uniforms.uMaxCellPx.value = config.maxCellPx
      uniforms.uRenderPixelsPerScreenPixel.value = currentRenderPixelsPerScreenPixel()
      uniforms.uSurfaceOffset.value = config.surfaceOffset
      entry.overlay.visible = config.enabled && entry.progress > 0
    }
  }

  function setRegionProgress(source: THREE.Mesh, nextProgress: number): boolean {
    if (disposed) return false
    const entry = entryBySource.get(source)
    if (!entry) return false
    const progress = Number.isFinite(nextProgress)
      ? THREE.MathUtils.clamp(nextProgress, 0, 1)
      : 0
    if (progress === entry.progress) return false
    entry.progress = progress
    entry.material.uniforms.uProgress.value = progress
    entry.overlay.visible = config.enabled && progress > 0
    return true
  }

  function advanceTime(deltaMs: number): void {
    if (disposed) return
    const renderPixelsPerScreenPixel = currentRenderPixelsPerScreenPixel()
    for (const entry of entries) {
      entry.material.uniforms.uRenderPixelsPerScreenPixel.value = renderPixelsPerScreenPixel
    }
    if (!Number.isFinite(deltaMs) || deltaMs <= 0) return
    const deltaSeconds = deltaMs / 1000
    for (const entry of entries) {
      if (entry.overlay.visible) entry.material.uniforms.uTime.value += deltaSeconds
    }
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    for (const entry of entries) {
      entry.source.remove(entry.overlay)
      entry.material.dispose()
    }
    hiddenSideMaterial.dispose()
    entries.length = 0
    entryBySource.clear()
  }

  return { setConfig, setRegionProgress, advanceTime, dispose }
}
