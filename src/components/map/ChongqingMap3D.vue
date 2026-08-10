<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useRouter } from 'vue-router'
import { getDistrictMapData } from '@/api'
import hudStaticUrl from '@/assets/images/map-hud/hud-disc-c5k377sv75.png'
import hudRotatingUrl from '@/assets/images/map-hud/hud-disc-v3809z30i-rotating.png'
import {
  DEFAULT_MAP_EFFECT_RUNTIME_STATUS,
  DEFAULT_MAP_DISTRICT_BAR_RUNTIME_STATUS,
  useMapDebug
} from '@/composables/useMapDebug'
import { useMapDistrictCarousel } from '@/composables/useMapDistrictCarousel'
import type { DistrictMapItem } from '@/types'
import { MAP_EFFECT_DEFAULTS, type MapEffectConfig } from './mapEffectConfig'
import { applyMapEffectConfig } from './mapEffectRuntime'
import { watchMapEffectConfig } from './mapEffectWatcher'
import {
  classifyBoundarySegments,
  parseSvgRegions,
  projectRegions,
  type ProjectionResult
} from './mapGeometry'
import {
  applyDistrictBarConfig,
  createDistrictBarLayer,
  disposeDistrictBarLayer,
  getDistrictBarTopSnapshots,
  setDistrictBarFocus,
  setDistrictBarHoverProgress,
  updateDistrictBarLayer,
  type DistrictBarLayer
} from './mapDistrictBarLayer'
import {
  createMapDistrictHoverCarousel,
  type MapDistrictHoverCarousel
} from './mapDistrictHoverCarousel'
import MapDistrictBarOverlay from './MapDistrictBarOverlay.vue'
import {
  calculateDistrictBarOverlayLayout,
  type DistrictBarOverlayLayout,
  type DistrictBarOverlayMeasuredSizes
} from './mapDistrictBarOverlayLayout'
import {
  createMapOutwardGlowPipeline,
  type MapOutwardGlowPipeline
} from './mapOutwardGlowPipeline'
import {
  createMapMosaicParticles,
  type MapMosaicParticles
} from './mapMosaicParticles'
import {
  createHoverGlowLayers,
  createStaticGlowLayers,
  setHoverGlowProgress,
  setGlowResolution,
  updateHoverVisualState,
  type HoverGlowBundle,
  type StaticGlowBundle
} from './mapGlow'
import {
  advanceMapHud,
  applyMapHudConfig,
  createMapHud,
  type MapHudBundle
} from './mapHud'

/**
 * POC：Three.js 挤出版重庆主城区地图（渝中/两江新区/南岸/九龙坡/沙坪坝/大渡口/北碚/巴南）。
 * 数据源为 public/maps/chongqing-selected-districts-tianditu-imagery-z12.svg（path 的
 * data-name 为板块名，坐标即天地图影像图 tianditu-imagery-z12.png 的像素坐标，顶面据此贴图）。
 * 对外契约与 ChongqingMap.vue 一致；focus / showLines 暂未实现（正式阶段补齐）。
 */
withDefaults(defineProps<{ focus?: string; showLines?: boolean }>(), {
  focus: '',
  showLines: true
})

const PLANE_MAX = 110 // 地图最长边的 world 尺寸，另一边按轮廓比例等比
const DEPTH = 4 // 挤出厚度
const INITIAL_CAMERA_POSITION = [0, 155, 165] as const
const INITIAL_CAMERA_TARGET = [0, 0, 0] as const

const container = ref<HTMLElement | null>(null)
const error = ref('')
const fps = ref(0)
const EMPTY_LAYOUT: DistrictBarOverlayLayout = { badges: [], panel: null }
const districtBarOverlayLayout = shallowRef<DistrictBarOverlayLayout>(EMPTY_LAYOUT)

const router = useRouter()
const {
  cameraView,
  effect,
  hud: hudConfig,
  effectRuntimeStatus,
  updateEffectRuntimeStatus,
  updateDistrictBarRuntimeStatus
} = useMapDebug()
const { enabled: districtCarouselEnabled } = useMapDistrictCarousel()

// three 对象一律放模块级普通变量，避免 Vue 深层代理拖慢渲染
let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let controls: OrbitControls | null = null
let raf = 0
let ro: ResizeObserver | null = null
let staticGlow: StaticGlowBundle | null = null
let outwardGlow: MapOutwardGlowPipeline | null = null
let mosaicParticles: MapMosaicParticles | null = null
let mapHud: MapHudBundle | null = null
let mounted = false
let initGeneration = 0
let pendingInitCleanup: (() => void) | null = null
let districtBars: DistrictBarLayer | null = null
let districtHoverCarousel: MapDistrictHoverCarousel | null = null
let barAnimationStartedAt = 0
let districtBarOverlaySizes: DistrictBarOverlayMeasuredSizes | undefined
const regionMeshes: THREE.Mesh[] = []
const raycaster = new THREE.Raycaster()
const disposedGlowPipelines = new WeakSet<MapOutwardGlowPipeline>()
let glowFailureWarned = false
let mosaicFailureWarned = false
let mosaicDegraded = false

interface RegionVisual {
  name: string
  mesh: THREE.Mesh
  group: THREE.Group
  topMaterial: THREE.MeshStandardMaterial
  hoverGlow: HoverGlowBundle | null
  progress: number
  active: boolean
}

const regionVisuals: RegionVisual[] = []
const visualByMesh = new Map<THREE.Mesh, RegionVisual>()
const visualByName = new Map<string, RegionVisual>()
let glowStatusPublicationPending = false
let districtBarFailureWarned = false
let districtBarOverlayFailureWarned = false
let pointerInsideMap = false

function clearDistrictBarOverlay(): void {
  districtBarOverlayLayout.value = EMPTY_LAYOUT
  districtBarOverlaySizes = undefined
}

function handleDistrictBarOverlaySizesChange(sizes: DistrictBarOverlayMeasuredSizes): void {
  districtBarOverlaySizes = sizes
}

function currentMosaicState(): 'disabled' | 'ready' | 'active' | 'degraded' {
  if (!effect.hover.mosaicParticles.enabled) return 'disabled'
  if (mosaicDegraded) return 'degraded'
  return regionVisuals.some((visual) => visual.progress > 0) ? 'active' : 'ready'
}

function publishMosaicStatus(): void {
  updateEffectRuntimeStatus({
    ...effectRuntimeStatus,
    mosaicState: currentMosaicState()
  })
}

type GlowFailurePhase = 'initialization' | 'runtime'

function disposeGlowPipeline(pipeline: MapOutwardGlowPipeline): void {
  if (disposedGlowPipelines.has(pipeline)) return
  disposedGlowPipelines.add(pipeline)
  try {
    pipeline.dispose()
  } catch {
    // Direct rendering and component teardown must survive glow cleanup failures.
  }
}

function handleGlowPipelineFailure(
  pipeline: MapOutwardGlowPipeline | null,
  cause: unknown,
  phase: GlowFailurePhase
): void {
  if (pipeline && outwardGlow === pipeline) outwardGlow = null
  if (pipeline) disposeGlowPipeline(pipeline)
  updateEffectRuntimeStatus({
    ...DEFAULT_MAP_EFFECT_RUNTIME_STATUS,
    mosaicState: currentMosaicState(),
    degraded: true
  })
  if (glowFailureWarned) return
  glowFailureWarned = true
  console.warn(
    phase === 'initialization'
      ? '外扩柔光初始化失败，保留清晰边界'
      : '外扩柔光运行失败，已关闭柔光并保留清晰边界',
    cause
  )
}

function setGlowConfig(
  pipeline: MapOutwardGlowPipeline,
  config: MapEffectConfig,
  phase: GlowFailurePhase = 'runtime'
): boolean {
  try {
    pipeline.setConfig(config)
    return true
  } catch (cause) {
    handleGlowPipelineFailure(pipeline, cause, phase)
    return false
  }
}

function setCurrentGlowConfig(config: MapEffectConfig): boolean {
  const pipeline = outwardGlow
  return pipeline ? setGlowConfig(pipeline, config) : false
}

function setGlowSize(
  pipeline: MapOutwardGlowPipeline,
  width: number,
  height: number,
  pixelRatio: number,
  phase: GlowFailurePhase = 'runtime'
): boolean {
  try {
    pipeline.setSize(width, height, pixelRatio)
    return true
  } catch (cause) {
    handleGlowPipelineFailure(pipeline, cause, phase)
    return false
  }
}

function setCurrentGlowSize(width: number, height: number, pixelRatio: number): boolean {
  const pipeline = outwardGlow
  return pipeline ? setGlowSize(pipeline, width, height, pixelRatio) : false
}

function markCurrentGlowCameraDirty(): void {
  const pipeline = outwardGlow
  if (!pipeline) return
  try {
    pipeline.markCameraDirty()
  } catch (cause) {
    handleGlowPipelineFailure(pipeline, cause, 'runtime')
  }
}

function publishGlowStatus(phase: GlowFailurePhase = 'runtime'): boolean {
  const pipeline = outwardGlow
  if (!pipeline) return false
  try {
    const status = pipeline.getStatus()
    updateEffectRuntimeStatus({ ...status, mosaicState: currentMosaicState(), degraded: false })
    return true
  } catch (cause) {
    handleGlowPipelineFailure(pipeline, cause, phase)
    return false
  }
}

function setGlowRegionProgress(source: THREE.Mesh, easedProgress: number): boolean {
  const pipeline = outwardGlow
  if (!pipeline) return false
  try {
    return pipeline.setRegionProgress(source, easedProgress)
  } catch (cause) {
    handleGlowPipelineFailure(pipeline, cause, 'runtime')
    return false
  }
}

function renderGlowFrame(
  mainScene: THREE.Scene,
  mainCamera: THREE.Camera
): boolean {
  const pipeline = outwardGlow
  if (!pipeline) return false
  try {
    pipeline.render(mainScene, mainCamera)
    return publishGlowStatus()
  } catch (cause) {
    handleGlowPipelineFailure(pipeline, cause, 'runtime')
    return false
  }
}

type MosaicFailurePhase = 'initialization' | 'runtime'

function handleMosaicFailure(
  particles: MapMosaicParticles | null,
  cause: unknown,
  phase: MosaicFailurePhase
): void {
  if (particles && mosaicParticles === particles) mosaicParticles = null
  mosaicDegraded = true
  try {
    particles?.dispose()
  } catch {
    // Particle cleanup must not interrupt the map or glow pipeline.
  }
  if (!publishGlowStatus()) publishMosaicStatus()
  if (mosaicFailureWarned) return
  mosaicFailureWarned = true
  console.warn(
    phase === 'initialization'
      ? '马赛克粒子初始化失败，已跳过粒子层'
      : '马赛克粒子运行失败，已关闭粒子层',
    cause
  )
}

function setMosaicConfig(config: MapEffectConfig): void {
  const particles = mosaicParticles
  if (!particles) return
  try {
    particles.setConfig(config.hover.mosaicParticles)
  } catch (cause) {
    handleMosaicFailure(particles, cause, 'runtime')
  }
}

function setMosaicRegionProgress(source: THREE.Mesh, progress: number): void {
  const particles = mosaicParticles
  if (!particles) return
  try {
    particles.setRegionProgress(source, progress)
  } catch (cause) {
    handleMosaicFailure(particles, cause, 'runtime')
  }
}

function advanceMosaicParticles(deltaMs: number): void {
  const particles = mosaicParticles
  if (!particles) return
  try {
    particles.advanceTime(deltaMs)
  } catch (cause) {
    handleMosaicFailure(particles, cause, 'runtime')
  }
}

// 顶面贴地形纹理，color 作为染色系数：偏冷的亮色保留地形细节又不脱离深蓝主色
const TOP_COLOR = 0xcfe0ff
const TOP_EMISSIVE = 0x0a2a66
const baseTopColor = new THREE.Color(TOP_COLOR)
const baseTopEmissive = new THREE.Color(TOP_EMISSIVE)
const hoverSurfaceTarget = new THREE.Color(effect.hover.surfaceColor)
const hoverEmissiveTarget = new THREE.Color(effect.hover.emissiveColor)

function applyEffectConfig(): void {
  hoverSurfaceTarget.set(effect.hover.surfaceColor)
  hoverEmissiveTarget.set(effect.hover.emissiveColor)
  applyMapEffectConfig(effect, {
    staticGlow,
    hoverGlows: regionVisuals.map((visual) => visual.hoverGlow)
  })
  const bars = districtBars
  if (bars) {
    try {
      applyDistrictBarConfig(bars, effect.bars)
    } catch (cause) {
      handleDistrictBarFailure(cause, '更新')
    }
  }
  setMosaicConfig(effect)
  const configUpdated = setCurrentGlowConfig(effect)
  updateRegionVisuals(0, true)
  if (configUpdated && outwardGlow) publishGlowStatus()
  else if (!outwardGlow) publishMosaicStatus()
}

const stopEffectWatch = watchMapEffectConfig(effect, applyEffectConfig)

function applyHudConfig(): void {
  if (mapHud && hudConfig) applyMapHudConfig(mapHud, hudConfig)
}

const stopHudWatch = hudConfig ? watch(hudConfig, applyHudConfig, { deep: true }) : () => undefined

const stopDistrictCarouselWatch = watch(districtCarouselEnabled, (enabled) => {
  const carousel = districtHoverCarousel
  if (!carousel) return
  setEffectiveHover(carousel.setEnabled(enabled, performance.now()))
})

function publishDistrictBarRuntimeStatus(layer: DistrictBarLayer, degraded = false): void {
  updateDistrictBarRuntimeStatus({
    renderedCount: layer.byName.size,
    dataMin: layer.range?.min ?? null,
    dataMax: layer.range?.max ?? null,
    degraded
  })
}

function handleDistrictBarFailure(cause: unknown, phase: '初始化' | '更新'): void {
  clearDistrictBarOverlay()
  const layer = districtBars
  districtBars = null
  if (layer) {
    try {
      disposeDistrictBarLayer(layer)
    } catch {
      // The base map must remain available even if bar resource cleanup fails.
    }
  }
  updateDistrictBarRuntimeStatus({ ...DEFAULT_MAP_DISTRICT_BAR_RUNTIME_STATUS, degraded: true })
  if (districtBarFailureWarned) return
  districtBarFailureWarned = true
  console.warn(`区县柱体${phase}失败，保留地图底图`, cause)
}

function updateDistrictBarOverlay(layer: DistrictBarLayer): void {
  const el = container.value
  const currentCamera = camera
  if (!el || !currentCamera) {
    clearDistrictBarOverlay()
    return
  }
  try {
    const snapshots = getDistrictBarTopSnapshots(layer)
    districtBarOverlayLayout.value = calculateDistrictBarOverlayLayout({
      snapshots,
      camera: currentCamera,
      viewport: {
        clientWidth: el.clientWidth,
        clientHeight: el.clientHeight
      },
      hoveredName: hoveredVisual?.mesh.userData.name ?? null,
      config: effect.bars.overlay,
      sizes: districtBarOverlaySizes
    })
  } catch (cause) {
    clearDistrictBarOverlay()
    if (districtBarOverlayFailureWarned) return
    districtBarOverlayFailureWarned = true
    console.warn('区县柱体 DOM overlay 更新失败，已清空并将在下一帧重试', cause)
  }
}

function buildRegions(
  projected: ProjectionResult,
  byName: Map<string, DistrictMapItem>,
  terrainTex: THREE.Texture
) {
  const [cx, cy] = projected.center
  const scale = projected.scale

  // 顶面 UV 是 shape 平面坐标（ExtrudeGeometry 默认），用纹理变换把它映射回地形图像素：
  // world = ((px-cx)·s, (cy-py)·s)，目标 u = px/W、v = 1 - py/H（flipY）
  const texImg = terrainTex.image as { width: number; height: number }
  terrainTex.repeat.set(1 / (scale * texImg.width), 1 / (scale * texImg.height))
  terrainTex.offset.set(cx / texImg.width, 1 - cy / texImg.height)

  const group = new THREE.Group()
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x05173a, roughness: 0.68, metalness: 0.3 })
  const boundaries = classifyBoundarySegments(projected.regions)

  for (const region of projected.regions) {
    const name = region.name
    const shapes: THREE.Shape[] = []

    for (const outer of region.outers) {
      const shape = new THREE.Shape(outer.ring.map(([x, y]) => new THREE.Vector2(x, y)))
      for (const holeRing of outer.holes) {
        shape.holes.push(new THREE.Path(holeRing.map(([x, y]) => new THREE.Vector2(x, y))))
      }
      shapes.push(shape)
    }

    const geometry = new THREE.ExtrudeGeometry(shapes, { depth: DEPTH, bevelEnabled: false })
    const topMat = new THREE.MeshStandardMaterial({
      map: terrainTex,
      color: TOP_COLOR,
      roughness: 0.42,
      metalness: 0.35,
      emissive: TOP_EMISSIVE,
      emissiveIntensity: 0.35
    })
    const mesh = new THREE.Mesh(geometry, [topMat, sideMat])
    mesh.userData = { name, item: byName.get(name) }
    regionMeshes.push(mesh)
    const regionGroup = new THREE.Group()
    regionGroup.add(mesh)
    let hoverGlow: HoverGlowBundle | null = null
    try {
      hoverGlow = createHoverGlowLayers(
        boundaries.byRegion.get(name) ?? [],
        MAP_EFFECT_DEFAULTS,
        DEPTH + 0.12
      )
      regionGroup.add(hoverGlow.group)
    } catch (cause) {
      console.warn(`区块 ${name} 的 hover 宽线初始化失败，保留材质高亮和轻抬`, cause)
    }
    const visual: RegionVisual = {
      name,
      mesh,
      group: regionGroup,
      topMaterial: topMat,
      hoverGlow,
      progress: 0,
      active: false
    }
    regionVisuals.push(visual)
    visualByMesh.set(mesh, visual)
    visualByName.set(name, visual)
    group.add(regionGroup)
  }

  try {
    staticGlow = createStaticGlowLayers(boundaries, MAP_EFFECT_DEFAULTS, DEPTH + 0.06)
    group.add(staticGlow.group)
  } catch (cause) {
    console.warn('宽线光效初始化失败，回退 1px 区界', cause)
    const fallbackMaterial = new THREE.LineBasicMaterial({
      color: 0x3fa9ff,
      transparent: true,
      opacity: 0.85
    })
    for (const region of projected.regions) {
      for (const outer of region.outers) {
        for (const ring of [outer.ring, ...outer.holes]) {
          const geometry = new THREE.BufferGeometry().setFromPoints(
            ring.map(([x, y]) => new THREE.Vector3(x, y, DEPTH + 0.05))
          )
          group.add(new THREE.LineLoop(geometry, fallbackMaterial))
        }
      }
    }
  }

  return group
}

/** ScaleScreen 整页 transform:scale 的实际系数（渲染分辨率要乘进去，否则发糊） */
function screenScale() {
  const el = container.value
  if (!el || !el.clientWidth) return 1
  const w = el.getBoundingClientRect().width
  // 后台 tab / 未渲染时 rect 为 0，此时按 1 处理，避免 setPixelRatio(0) 清空画布
  return w > 0 ? w / el.clientWidth : 1
}

function updatePixelRatio() {
  renderer?.setPixelRatio(Math.min(window.devicePixelRatio * screenScale(), 2))
}

function handleWindowResize(): void {
  updatePixelRatio()
  const el = container.value
  if (!renderer || !el || !el.clientWidth || !el.clientHeight) return
  if (setCurrentGlowSize(el.clientWidth, el.clientHeight, renderer.getPixelRatio())) publishGlowStatus()
}

function updateGlowResolution(): void {
  const el = container.value
  if (!el) return
  if (staticGlow) setGlowResolution(staticGlow, el.clientWidth, el.clientHeight)
  for (const visual of regionVisuals) {
    if (visual.hoverGlow) setGlowResolution(visual.hoverGlow, el.clientWidth, el.clientHeight)
  }
}

function setupScene(mapGroup: THREE.Group) {
  try {
    const el = container.value!
    scene = new THREE.Scene()
    scene.add(mapGroup)

    scene.add(new THREE.AmbientLight(0x88b4ff, 1.0))
    const sun = new THREE.DirectionalLight(0xdfeeff, 1.7)
    sun.position.set(60, 120, 60)
    scene.add(sun)
    const rim = new THREE.DirectionalLight(0x2483ff, 0.8)
    rim.position.set(-80, 40, -60)
    scene.add(rim)

    camera = new THREE.PerspectiveCamera(40, el.clientWidth / el.clientHeight, 1, 1000)
    camera.position.set(...INITIAL_CAMERA_POSITION)

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(el.clientWidth, el.clientHeight, false)
    updateGlowResolution()
    updatePixelRatio()

    mapGroup.updateMatrixWorld(true)
    let pendingMosaicParticles: MapMosaicParticles | null = null
    try {
      pendingMosaicParticles = createMapMosaicParticles(
        {
          getRenderPixelsPerScreenPixel: () => (
            renderer ? renderer.getPixelRatio() / screenScale() : 1
          )
        },
        regionMeshes
      )
      pendingMosaicParticles.setConfig(effect.hover.mosaicParticles)
      mosaicParticles = pendingMosaicParticles
      mosaicDegraded = false
    } catch (cause) {
      handleMosaicFailure(pendingMosaicParticles, cause, 'initialization')
    }
    let pendingOutwardGlow: MapOutwardGlowPipeline | null = null
    try {
      pendingOutwardGlow = createMapOutwardGlowPipeline(renderer, regionMeshes)
      const sizeSucceeded = setGlowSize(
        pendingOutwardGlow,
        el.clientWidth,
        el.clientHeight,
        renderer.getPixelRatio(),
        'initialization'
      )
      const configSucceeded = sizeSucceeded
        ? setGlowConfig(pendingOutwardGlow, effect, 'initialization')
        : false
      if (configSucceeded) {
        outwardGlow = pendingOutwardGlow
        publishGlowStatus('initialization')
      }
    } catch (cause) {
      handleGlowPipelineFailure(pendingOutwardGlow, cause, 'initialization')
    }

    renderer.domElement.className = 'gl'
    el.prepend(renderer.domElement)

    controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(...INITIAL_CAMERA_TARGET)
    controls.enableDamping = true
    controls.dampingFactor = 0.12
    // 视角实时上报到调试抽屉，用户调好后复制参数即可回填为默认视角
    const syncCamView = () => {
      if (!camera || !controls) return
      const p = camera.position
      const t = controls.target
      cameraView.value =
        `{ "pos": [${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}], ` +
        `"target": [${t.x.toFixed(1)}, ${t.y.toFixed(1)}, ${t.z.toFixed(1)}] }`
      markCurrentGlowCameraDirty()
    }
    controls.addEventListener('change', syncCamView)
    syncCamView()

    ro = new ResizeObserver(() => {
      if (!renderer || !camera || !el.clientWidth || !el.clientHeight) return
      renderer.setSize(el.clientWidth, el.clientHeight, false)
      updatePixelRatio()
      if (setCurrentGlowSize(el.clientWidth, el.clientHeight, renderer.getPixelRatio())) {
        publishGlowStatus()
      }
      updateGlowResolution()
      camera.aspect = el.clientWidth / el.clientHeight
      camera.updateProjectionMatrix()
    })
    ro.observe(el)
    window.addEventListener('resize', handleWindowResize)
  } catch (cause) {
    cleanupScene(mapGroup)
    throw cause
  }
}

// —— 自动轮播 / hover / 点击下钻 ——
let hoveredVisual: RegionVisual | null = null
let downX = 0
let downY = 0

function setEffectiveHover(name: string | null): void {
  const next = name ? visualByName.get(name) ?? null : null
  if (districtBars) setDistrictBarFocus(districtBars, next?.name ?? null)
  if (next === hoveredVisual) return
  if (hoveredVisual) hoveredVisual.active = false
  hoveredVisual = next
  if (hoveredVisual) hoveredVisual.active = true
}

function renderRegionVisual(visual: RegionVisual, eased: number): void {
  const hover = effect.hover
  visual.group.position.z = hover.lift * eased
  visual.group.updateMatrixWorld(true)
  visual.topMaterial.color.copy(baseTopColor).lerp(hoverSurfaceTarget, eased)
  visual.topMaterial.emissive.copy(baseTopEmissive).lerp(hoverEmissiveTarget, eased)
  visual.topMaterial.emissiveIntensity = THREE.MathUtils.lerp(0.35, hover.emissiveIntensity, eased)
  if (visual.hoverGlow) setHoverGlowProgress(visual.hoverGlow, effect, eased)
  if (districtBars) setDistrictBarHoverProgress(districtBars, visual.name, eased, hover.lift)
  setMosaicRegionProgress(visual.mesh, eased)
  if (setGlowRegionProgress(visual.mesh, eased)) glowStatusPublicationPending = true
}

function updateRegionVisuals(deltaMs: number, force = false): boolean {
  const hover = effect.hover
  glowStatusPublicationPending = false
  for (const visual of regionVisuals) {
    updateHoverVisualState(
      visual,
      deltaMs,
      hover.enterMs,
      hover.leaveMs,
      renderRegionVisual,
      force
    )
  }
  return glowStatusPublicationPending
}

function pick(e: PointerEvent): RegionVisual | null {
  const el = container.value
  if (!el || !camera) return null
  const rect = el.getBoundingClientRect()
  const rx = (e.clientX - rect.left) / rect.width
  const ry = (e.clientY - rect.top) / rect.height
  raycaster.setFromCamera(new THREE.Vector2(rx * 2 - 1, -(ry * 2 - 1)), camera)
  const hit = raycaster.intersectObjects(regionMeshes, false)[0]
  return hit ? visualByMesh.get(hit.object as THREE.Mesh) ?? null : null
}

function onPointerMove(e: PointerEvent) {
  pointerInsideMap = true
  const visual = pick(e)
  const name = visual?.name
  const carousel = districtHoverCarousel
  setEffectiveHover(carousel ? carousel.pointerMove(name ?? null) : name ?? null)
  if (container.value) container.value.style.cursor = visual ? 'pointer' : 'default'
}

function onPointerEnter() {
  pointerInsideMap = true
  const carousel = districtHoverCarousel
  if (carousel) setEffectiveHover(carousel.pointerEnter())
}

function onPointerDown(e: PointerEvent) {
  downX = e.clientX
  downY = e.clientY
}

function onClick(e: PointerEvent) {
  // 区分拖拽旋转与点击
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return
  const name = pick(e)?.name
  if (name) router.push(`/district/${encodeURIComponent(name)}`)
}

function onPointerLeave() {
  pointerInsideMap = false
  const carousel = districtHoverCarousel
  setEffectiveHover(carousel ? carousel.pointerLeave(performance.now()) : null)
  if (container.value) container.value.style.cursor = 'default'
}

function handleVisibilityChange() {
  if (document.visibilityState !== 'visible') return
  const carousel = districtHoverCarousel
  if (carousel) setEffectiveHover(carousel.resetTiming(performance.now()))
}

// —— 渲染循环 + FPS ——
let frames = 0
let lastFpsAt = 0
let lastFrameAt = 0

function loop(now: number) {
  raf = requestAnimationFrame(loop)
  const deltaMs = lastFrameAt ? Math.min(now - lastFrameAt, 50) : 0
  lastFrameAt = now
  const carousel = districtHoverCarousel
  if (carousel) setEffectiveHover(carousel.tick(now))
  const previousMosaicState = currentMosaicState()
  const glowStatusChanged = updateRegionVisuals(deltaMs)
  advanceMosaicParticles(deltaMs)
  if (mapHud) advanceMapHud(mapHud, hudConfig, deltaMs)
  if (glowStatusChanged) publishGlowStatus()
  else if (!outwardGlow && currentMosaicState() !== previousMosaicState) publishMosaicStatus()
  controls?.update()
  const bars = districtBars
  if (bars) {
    try {
      updateDistrictBarLayer(bars, effect.bars, now - barAnimationStartedAt)
      updateDistrictBarOverlay(bars)
    } catch (cause) {
      handleDistrictBarFailure(cause, '更新')
    }
  }
  if (renderer && scene && camera) {
    if (outwardGlow) {
      if (!renderGlowFrame(scene, camera)) renderer.render(scene, camera)
    } else renderer.render(scene, camera)
  }
  frames++
  if (now - lastFpsAt >= 1000) {
    fps.value = frames
    frames = 0
    lastFpsAt = now
  }
}

function isCurrentInit(generation: number): boolean {
  return mounted && generation === initGeneration && container.value !== null
}

function disposeHudTextures(textures: readonly THREE.Texture[]): void {
  new Set(textures).forEach((texture) => texture.dispose())
}

function loadMapHud(generation: number): void {
  if (!hudConfig) return
  void Promise.allSettled([
    new THREE.TextureLoader().loadAsync(hudStaticUrl),
    new THREE.TextureLoader().loadAsync(hudRotatingUrl)
  ]).then((results) => {
    if (results[0].status !== 'fulfilled' || results[1].status !== 'fulfilled') {
      disposeHudTextures(results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []))
      const cause = results.find((result) => result.status === 'rejected')
      console.warn('地图 HUD 资源加载失败，已跳过 HUD 层', cause?.status === 'rejected' ? cause.reason : undefined)
      return
    }
    const [staticTexture, rotatingTexture] = [results[0].value, results[1].value]
    if (!isCurrentInit(generation) || !scene) {
      disposeHudTextures([staticTexture, rotatingTexture])
      return
    }
    staticTexture.colorSpace = THREE.SRGBColorSpace
    rotatingTexture.colorSpace = THREE.SRGBColorSpace
    try {
      const pendingHud = createMapHud(staticTexture, rotatingTexture)
      applyMapHudConfig(pendingHud, hudConfig)
      scene.add(pendingHud.group)
      mapHud = pendingHud
    } catch (cause) {
      disposeHudTextures([staticTexture, rotatingTexture])
      console.warn('地图 HUD 初始化失败，已跳过 HUD 层', cause)
    }
  })
}

async function init(generation: number) {
  let terrainTex: THREE.Texture | null = null
  let textureOwnedByScene = false
  let textureDisposed = false
  let textureCleanupRequested = false
  const cleanupPendingTexture = () => {
    textureCleanupRequested = true
    if (terrainTex && !textureOwnedByScene && !textureDisposed) {
      textureDisposed = true
      terrainTex.dispose()
    }
  }
  pendingInitCleanup = cleanupPendingTexture
  const terrainTexturePromise = new THREE.TextureLoader()
    .loadAsync(`${import.meta.env.BASE_URL}maps/tianditu-imagery-z12.png`)
    .then((texture) => {
      terrainTex = texture
      if (textureCleanupRequested) cleanupPendingTexture()
      return texture
    })
  try {
    const [svgRes, data, loadedTerrainTex] = await Promise.all([
      fetch(`${import.meta.env.BASE_URL}maps/chongqing-selected-districts-tianditu-imagery-z12.svg`),
      getDistrictMapData(),
      terrainTexturePromise
    ])
    terrainTex = loadedTerrainTex
    if (!isCurrentInit(generation)) return
    if (!svgRes.ok) throw new Error(`地图加载失败: HTTP ${svgRes.status}`)
    terrainTex.colorSpace = THREE.SRGBColorSpace
    const svgText = await svgRes.text()
    if (!isCurrentInit(generation)) return
    const regions = parseSvgRegions(svgText)
    const byName = new Map(data.map((d) => [d.name, d]))
    // 两江新区是国家级新区（≈江北区+渝北区），行政区划数据里没有条目，取两区之和
    const jb = byName.get('江北区')
    const yb = byName.get('渝北区')
    if (jb && yb) {
      byName.set('两江新区', {
        name: '两江新区',
        aj: jb.aj + yb.aj,
        ztje: jb.ztje + yb.ztje,
        zzs: jb.zzs + yb.zzs
      })
    }

    const projected = projectRegions(regions, PLANE_MAX)
    const mapGroup = buildRegions(projected, byName, terrainTex)
    try {
      districtBars = createDistrictBarLayer(projected.regions, byName, effect.bars, DEPTH)
      mapGroup.add(districtBars.group)
      barAnimationStartedAt = performance.now()
      publishDistrictBarRuntimeStatus(districtBars)
    } catch (cause) {
      handleDistrictBarFailure(cause, '初始化')
    }
    mapGroup.rotation.x = -Math.PI / 2 // 放平到 XZ 平面，挤出方向朝上
    if (!isCurrentInit(generation)) {
      disposeSceneResources(mapGroup)
      textureDisposed = true
      return
    }
    textureOwnedByScene = true
    setupScene(mapGroup)
    if (pendingInitCleanup === cleanupPendingTexture) pendingInitCleanup = null
    applyEffectConfig()

    districtHoverCarousel = createMapDistrictHoverCarousel(
      regionVisuals.map((visual) => visual.name),
      districtCarouselEnabled.value,
      performance.now()
    )
    setEffectiveHover(
      pointerInsideMap
        ? districtHoverCarousel.pointerEnter()
        : districtHoverCarousel.current()
    )

    const el = container.value
    if (!el || !isCurrentInit(generation)) return

    lastFpsAt = performance.now()
    raf = requestAnimationFrame(loop)
    loadMapHud(generation)
  } catch (e) {
    clearDistrictBarOverlay()
    if (isCurrentInit(generation)) error.value = e instanceof Error ? e.message : String(e)
  } finally {
    if (!textureOwnedByScene) cleanupPendingTexture()
    if (pendingInitCleanup === cleanupPendingTexture) pendingInitCleanup = null
  }
}

onMounted(() => {
  mounted = true
  districtBarFailureWarned = false
  districtBarOverlayFailureWarned = false
  updateEffectRuntimeStatus({ ...DEFAULT_MAP_EFFECT_RUNTIME_STATUS, degraded: false })
  updateDistrictBarRuntimeStatus({ ...DEFAULT_MAP_DISTRICT_BAR_RUNTIME_STATUS })
  const el = container.value
  el?.addEventListener('pointerenter', onPointerEnter)
  el?.addEventListener('pointermove', onPointerMove)
  el?.addEventListener('pointerdown', onPointerDown)
  el?.addEventListener('click', onClick as EventListener)
  el?.addEventListener('pointerleave', onPointerLeave)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  const generation = ++initGeneration
  void init(generation)
})

function disposeSceneResources(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()

  root.traverse((object) => {
    const renderable = object as THREE.Object3D & {
      geometry?: THREE.BufferGeometry
      material?: THREE.Material | THREE.Material[]
    }
    if (renderable.geometry) geometries.add(renderable.geometry)
    if (!renderable.material) return
    const objectMaterials = Array.isArray(renderable.material)
      ? renderable.material
      : [renderable.material]
    for (const material of objectMaterials) {
      materials.add(material)
      const map = (material as THREE.MeshStandardMaterial).map
      if (map) textures.add(map)
    }
  })

  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
  textures.forEach((texture) => texture.dispose())
}

function cleanupScene(fallbackRoot?: THREE.Object3D): void {
  cancelAnimationFrame(raf)
  raf = 0
  const el = container.value
  el?.removeEventListener('pointerenter', onPointerEnter)
  el?.removeEventListener('pointermove', onPointerMove)
  el?.removeEventListener('pointerdown', onPointerDown)
  el?.removeEventListener('click', onClick as EventListener)
  el?.removeEventListener('pointerleave', onPointerLeave)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  districtHoverCarousel = null
  pointerInsideMap = false
  clearDistrictBarOverlay()
  districtBarOverlayFailureWarned = false
  ro?.disconnect()
  ro = null
  window.removeEventListener('resize', handleWindowResize)
  controls?.dispose()
  controls = null
  const bars = districtBars
  districtBars = null
  if (bars) disposeDistrictBarLayer(bars)
  updateDistrictBarRuntimeStatus({ ...DEFAULT_MAP_DISTRICT_BAR_RUNTIME_STATUS })
  const particles = mosaicParticles
  mosaicParticles = null
  try {
    particles?.dispose()
  } catch {
    // Scene teardown continues even if particle cleanup fails.
  }
  const root = scene ?? fallbackRoot
  if (root) disposeSceneResources(root)
  const pipeline = outwardGlow
  outwardGlow = null
  if (pipeline) disposeGlowPipeline(pipeline)
  renderer?.dispose()
  renderer?.domElement.remove()
  renderer = null
  scene = null
  camera = null
  staticGlow = null
  mapHud = null
  cameraView.value = ''
  regionMeshes.length = 0
  regionVisuals.length = 0
  visualByMesh.clear()
  visualByName.clear()
  hoveredVisual = null
  barAnimationStartedAt = 0
  frames = 0
  lastFpsAt = 0
  lastFrameAt = 0
}

onBeforeUnmount(() => {
  mounted = false
  initGeneration++
  pendingInitCleanup?.()
  pendingInitCleanup = null
  stopEffectWatch()
  stopHudWatch()
  stopDistrictCarouselWatch()
  cleanupScene()
})
</script>

<template>
  <div ref="container" class="cq-map3d">
    <MapDistrictBarOverlay
      :layout="districtBarOverlayLayout"
      :config="effect.bars.overlay"
      @sizes-change="handleDistrictBarOverlaySizesChange"
    />
    <div class="hud">{{ fps }} FPS</div>
    <div v-if="error" class="err">{{ error }}</div>
  </div>
</template>

<style scoped>
.cq-map3d { position: relative; }
.cq-map3d :deep(.gl) { width: 100%; height: 100%; display: block; }

.hud {
  position: absolute; left: 6px; bottom: 4px; z-index: 5; pointer-events: none;
  font-size: 11px; color: rgba(127, 168, 217, 0.75); font-family: monospace;
}

.err {
  position: absolute; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center;
  color: #ff7d57; font-size: 16px; font-family: 'OPPOSans-R';
  background: rgba(6, 18, 40, 0.6);
}
</style>
