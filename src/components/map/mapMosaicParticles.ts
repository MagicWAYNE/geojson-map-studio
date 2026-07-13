import * as THREE from 'three'
import {
  HOVER_MOSAIC_PARTICLE_DEFAULTS,
  MOSAIC_LOD_STEPS_PER_OCTAVE,
  normalizeMosaicParticleConfig,
  type MapMosaicParticleConfig
} from './mapMosaicParticleConfig'
import {
  deriveMosaicActivationSeed,
  mosaicBurstEnvelope,
  MOSAIC_RANDOM_SCALE,
  MOSAIC_RANDOM_SEED,
  MOSAIC_RANDOM_X,
  MOSAIC_RANDOM_Y
} from './mapMosaicDynamics'

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
  regionId: string
  activationOrdinal: number
  burstAgeMs: number
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
  uniform vec3 uAccentColor;
  uniform float uAccentRatio;
  uniform float uDensity;
  uniform float uClusterChance;
  uniform float uClusterRadius;
  uniform float uClusterStrength;
  uniform float uAccentClusterBias;
  uniform float uGapRatio;
  uniform float uOpacity;
  uniform float uBrightness;
  uniform float uFlickerHz;
  uniform float uDutyCycle;
  uniform float uPulseSharpness;
  uniform float uClusterFlickerScale;
  uniform float uBurstStrength;
  uniform float uBurstDensityBoost;
  uniform float uBurstEnvelope;
  uniform float uActivationSeed;
  uniform float uProgress;
  uniform float uTime;
  uniform float uTargetCellPx;
  uniform float uMinCellPx;
  uniform float uMaxCellPx;
  uniform float uRenderPixelsPerScreenPixel;
  varying vec2 vModelPosition;
  varying float vTopFacing;

  float mosaicRandom(vec2 cell, float seed) {
    return fract(sin(
      cell.x * ${MOSAIC_RANDOM_X.toFixed(1)}
      + cell.y * ${MOSAIC_RANDOM_Y.toFixed(1)}
      + seed * ${MOSAIC_RANDOM_SEED.toFixed(1)}
    ) * ${MOSAIC_RANDOM_SCALE});
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

  float clusterInfluence(float distanceInCells, float radius, float active) {
    return active * clamp(1.0 - distanceInCells / (radius + 0.5), 0.0, 1.0);
  }

  float sampleClusterField(vec2 cell) {
    float radius = max(uClusterRadius, 1.0);
    float spacing = radius * 2.0 + 1.0;
    vec2 coarseCell = floor(cell / spacing);
    float field = 0.0;
    for (int offsetX = -1; offsetX <= 1; offsetX++) {
      for (int offsetY = -1; offsetY <= 1; offsetY++) {
        vec2 candidate = coarseCell + vec2(float(offsetX), float(offsetY));
        float active = step(
          1.0 - uClusterChance,
          mosaicRandom(candidate + 31.7, uActivationSeed)
        );
        vec2 center = (candidate + 0.5) * spacing;
        field = max(field, clusterInfluence(length(cell - center), radius, active));
      }
    }
    return field;
  }

  vec4 sampleGrid(float cellWorld) {
    vec2 cell = floor(vModelPosition / cellWorld);
    vec2 local = fract(vModelPosition / cellWorld);
    float inset = uGapRatio * 0.5;
    float square = step(inset, local.x) * step(inset, local.y)
      * step(local.x, 1.0 - inset) * step(local.y, 1.0 - inset);
    float clusterField = sampleClusterField(cell);
    float density = clamp(uDensity + uBurstDensityBoost * uBurstEnvelope, 0.0, 1.0);
    density = clamp(
      density * (1.0 + clusterField * max(uClusterStrength, 0.0)),
      0.0,
      1.0
    );
    float selected = step(1.0 - density, mosaicRandom(cell + 7.3, uActivationSeed));

    float phase = mosaicRandom(cell + 19.7, uActivationSeed);
    float frequency = uFlickerHz * mix(1.0, uClusterFlickerScale, clusterField);
    float cycle = fract(uTime * frequency + phase);
    float pulseBase = clamp(
      (uDutyCycle - cycle) / max(uDutyCycle, 0.0001),
      0.0,
      1.0
    );
    float pulse = uDutyCycle <= 0.0 ? 0.0 : pow(pulseBase, uPulseSharpness);

    float accentThreshold = clamp(
      uAccentRatio + clusterField * uAccentClusterBias * (1.0 - uAccentRatio),
      0.0,
      1.0
    );
    float accent = step(mosaicRandom(cell + 53.1, uActivationSeed), accentThreshold);
    vec3 color = mix(uPrimaryColor, uAccentColor, accent);
    return vec4(color, square * selected * pulse);
  }

  void main() {
    if (vTopFacing < 0.5) discard;

    float modelUnitsPerRenderPixel = max(
      length(dFdx(vModelPosition)),
      length(dFdy(vModelPosition))
    );
    vec3 lod = selectCellWorlds(modelUnitsPerRenderPixel);
    vec4 mosaic = mix(sampleGrid(lod.x), sampleGrid(lod.y), lod.z);
    float alpha = mosaic.a * uOpacity * uProgress;
    if (alpha <= 0.001) discard;
    float burstBrightness = mix(1.0, max(1.0, uBurstStrength), uBurstEnvelope);
    gl_FragColor = vec4(mosaic.rgb * uBrightness * burstBrightness, alpha);
  }
`

function createTopMaterial(
  config: Readonly<MapMosaicParticleConfig>,
  renderPixelsPerScreenPixel: number,
  activationSeed: number
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uPrimaryColor: { value: new THREE.Color(config.primaryColor) },
      uAccentColor: { value: new THREE.Color(config.accentColor) },
      uAccentRatio: { value: config.accentRatio },
      uDensity: { value: config.density },
      uClusterChance: { value: config.clusterChance },
      uClusterRadius: { value: config.clusterRadius },
      uClusterStrength: { value: config.clusterStrength },
      uAccentClusterBias: { value: config.accentClusterBias },
      uGapRatio: { value: config.gapRatio },
      uOpacity: { value: config.opacity },
      uBrightness: { value: config.brightness },
      uFlickerHz: { value: config.flickerHz },
      uDutyCycle: { value: config.dutyCycle },
      uPulseSharpness: { value: config.pulseSharpness },
      uClusterFlickerScale: { value: config.clusterFlickerScale },
      uBurstStrength: { value: config.burstStrength },
      uBurstDensityBoost: { value: config.burstDensityBoost },
      uBurstEnvelope: { value: 0 },
      uActivationSeed: { value: activationSeed },
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
      const regionId = source.userData.name
      if (typeof regionId !== 'string' || regionId.trim() === '') {
        throw new Error('马赛克粒子需要稳定的行政区名称')
      }
      material = createTopMaterial(
        config,
        currentRenderPixelsPerScreenPixel(),
        deriveMosaicActivationSeed(config.seed, regionId, 0)
      )
      const overlay = new THREE.Mesh(source.geometry, [material, hiddenSideMaterial])
      overlay.name = `${source.name || source.userData.name || 'region'}-mosaic-particles`
      overlay.visible = false
      overlay.renderOrder = source.renderOrder + 1
      source.add(overlay)
      const entry = {
        source,
        overlay,
        material,
        progress: 0,
        regionId,
        activationOrdinal: -1,
        burstAgeMs: Number.POSITIVE_INFINITY
      }
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
      uniforms.uAccentColor.value.set(config.accentColor)
      uniforms.uAccentRatio.value = config.accentRatio
      uniforms.uDensity.value = config.density
      uniforms.uClusterChance.value = config.clusterChance
      uniforms.uClusterRadius.value = config.clusterRadius
      uniforms.uClusterStrength.value = config.clusterStrength
      uniforms.uAccentClusterBias.value = config.accentClusterBias
      uniforms.uGapRatio.value = config.gapRatio
      uniforms.uOpacity.value = config.opacity
      uniforms.uBrightness.value = config.brightness
      uniforms.uFlickerHz.value = config.flickerHz
      uniforms.uDutyCycle.value = config.dutyCycle
      uniforms.uPulseSharpness.value = config.pulseSharpness
      uniforms.uClusterFlickerScale.value = config.clusterFlickerScale
      uniforms.uBurstStrength.value = config.burstStrength
      uniforms.uBurstDensityBoost.value = config.burstDensityBoost
      uniforms.uBurstEnvelope.value = mosaicBurstEnvelope(
        entry.burstAgeMs,
        config.burstDurationMs
      )
      uniforms.uActivationSeed.value = deriveMosaicActivationSeed(
        config.seed,
        entry.regionId,
        config.reseedOnEnter ? Math.max(0, entry.activationOrdinal) : 0
      )
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
    const entering = entry.progress <= 0 && progress > 0
    entry.progress = progress
    if (entering) {
      entry.activationOrdinal += 1
      entry.burstAgeMs = 0
      entry.material.uniforms.uTime.value = 0
      entry.material.uniforms.uActivationSeed.value = deriveMosaicActivationSeed(
        config.seed,
        entry.regionId,
        config.reseedOnEnter ? entry.activationOrdinal : 0
      )
      entry.material.uniforms.uBurstEnvelope.value = mosaicBurstEnvelope(
        0,
        config.burstDurationMs
      )
    }
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
      if (entry.progress <= 0) continue
      entry.material.uniforms.uTime.value += deltaSeconds
      entry.burstAgeMs += deltaMs
      entry.material.uniforms.uBurstEnvelope.value = mosaicBurstEnvelope(
        entry.burstAgeMs,
        config.burstDurationMs
      )
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
