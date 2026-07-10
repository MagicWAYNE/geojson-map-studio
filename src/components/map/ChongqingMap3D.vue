<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useRouter } from 'vue-router'
import { getDistrictMapData } from '@/api'
import { useMapDebug } from '@/composables/useMapDebug'
import type { DistrictMapItem } from '@/types'

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

type Ring = [number, number][]
type Region = { name: string; outers: { ring: Ring; holes: Ring[] }[] }

const PLANE_MAX = 110 // 地图最长边的 world 尺寸，另一边按轮廓比例等比
const DEPTH = 4 // 挤出厚度

const container = ref<HTMLElement | null>(null)
const error = ref('')
const fps = ref(0)
const tip = reactive({ show: false, x: 0, y: 0, name: '', aj: 0, ztje: 0, zzs: 0 })

const router = useRouter()
const { cameraView } = useMapDebug()

// three 对象一律放模块级普通变量，避免 Vue 深层代理拖慢渲染
let renderer: THREE.WebGLRenderer | null = null
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let controls: OrbitControls | null = null
let raf = 0
let ro: ResizeObserver | null = null
const regionMeshes: THREE.Mesh[] = []
const raycaster = new THREE.Raycaster()

// 顶面贴地形纹理，color 作为染色系数：偏冷的亮色保留地形细节又不脱离深蓝主色
const TOP_COLOR = 0xcfe0ff
const TOP_EMISSIVE = 0x0a2a66
const HOVER_COLOR = 0x1e7dff
const HOVER_EMISSIVE = 0x00a8d8

/** 解析 path 的 d 属性（生成器只输出 M/L/Z 多边形命令）为环数组 */
function parsePathD(d: string): Ring[] {
  const rings: Ring[] = []
  let cur: Ring = []
  for (const m of d.matchAll(/([MLZ])([^MLZ]*)/g)) {
    if (m[1] === 'Z') {
      if (cur.length) rings.push(cur)
      cur = []
      continue
    }
    const nums = m[2].trim().split(/[\s,]+/).filter(Boolean).map(Number)
    const pts: Ring = []
    for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]])
    if (m[1] === 'M') {
      if (cur.length) rings.push(cur)
      cur = pts
    } else {
      cur.push(...pts)
    }
  }
  if (cur.length) rings.push(cur)
  return rings
}

function pointInRing([x, y]: [number, number], ring: Ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[j]
    if (y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) inside = !inside
  }
  return inside
}

/** 每个 path 一个板块；子路径按环嵌套分类：被包含的环是孔洞（如九龙坡区），独立环是江心岛等 */
function parseSvgRegions(svgText: string): Region[] {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  const regions: Region[] = []
  for (const path of Array.from(doc.querySelectorAll('path[data-name]'))) {
    const rings = parsePathD(path.getAttribute('d') ?? '')
    const outerRings = rings.filter((r) => !rings.some((o) => o !== r && pointInRing(r[0], o)))
    const holeRings = rings.filter((r) => !outerRings.includes(r))
    regions.push({
      name: path.getAttribute('data-name')!,
      outers: outerRings.map((ring) => ({
        ring,
        holes: holeRings.filter((h) => pointInRing(h[0], ring))
      }))
    })
  }
  return regions
}

function buildRegions(
  regions: Region[],
  byName: Map<string, DistrictMapItem>,
  terrainTex: THREE.Texture
) {
  // 按全部板块的内容 bbox 等比适配到 PLANE_MAX 并居中（SVG y 向下 → three 平面 y 向上）
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const rg of regions) {
    for (const o of rg.outers) {
      for (const ring of [o.ring, ...o.holes]) {
        for (const [x, y] of ring) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
      }
    }
  }
  const scale = PLANE_MAX / Math.max(maxX - minX, maxY - minY)
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const project = ([x, y]: [number, number]): [number, number] => [(x - cx) * scale, (cy - y) * scale]

  // 顶面 UV 是 shape 平面坐标（ExtrudeGeometry 默认），用纹理变换把它映射回地形图像素：
  // world = ((px-cx)·s, (cy-py)·s)，目标 u = px/W、v = 1 - py/H（flipY）
  const texImg = terrainTex.image as { width: number; height: number }
  const texW = texImg.width
  const texH = texImg.height
  terrainTex.repeat.set(1 / (scale * texW), 1 / (scale * texH))
  terrainTex.offset.set(cx / texW, 1 - cy / texH)

  const group = new THREE.Group()
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x05173a, roughness: 0.68, metalness: 0.3 })
  const lineMat = new THREE.LineBasicMaterial({ color: 0x3fa9ff, transparent: true, opacity: 0.85 })

  for (const region of regions) {
    const name = region.name
    const shapes: THREE.Shape[] = []
    const rings: [number, number][][] = []

    for (const outer of region.outers) {
      const outerPts = outer.ring.map(project)
      const shape = new THREE.Shape(outerPts.map(([x, y]) => new THREE.Vector2(x, y)))
      rings.push(outerPts)
      for (const holeRing of outer.holes) {
        const hole = holeRing.map(project)
        shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))))
        rings.push(hole)
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
    group.add(mesh)

    // 顶面边界描边（POC 用 1px 线，正式阶段换 Line2 发光粗线）
    for (const ring of rings) {
      const pts = ring.map(([x, y]) => new THREE.Vector3(x, y, DEPTH + 0.05))
      const lineGeo = new THREE.BufferGeometry().setFromPoints(pts)
      group.add(new THREE.LineLoop(lineGeo, lineMat))
    }
  }

  group.rotation.x = -Math.PI / 2 // 放平到 XZ 平面，挤出方向朝上
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

function setupScene(mapGroup: THREE.Group) {
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
  camera.position.set(-51.5, 121.2, 82.0)

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  renderer.setSize(el.clientWidth, el.clientHeight, false)
  updatePixelRatio()
  renderer.domElement.className = 'gl'
  el.prepend(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(1.5, 2.1, 1.7)
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
  }
  controls.addEventListener('change', syncCamView)
  syncCamView()

  ro = new ResizeObserver(() => {
    if (!renderer || !camera || !el.clientWidth || !el.clientHeight) return
    renderer.setSize(el.clientWidth, el.clientHeight, false)
    camera.aspect = el.clientWidth / el.clientHeight
    camera.updateProjectionMatrix()
    updatePixelRatio()
  })
  ro.observe(el)
  window.addEventListener('resize', updatePixelRatio)
}

// —— hover / tooltip / 点击下钻 ——
let hovered: THREE.Mesh | null = null
let downX = 0
let downY = 0

function setHover(mesh: THREE.Mesh | null) {
  if (mesh === hovered) return
  if (hovered) {
    const m = (hovered.material as THREE.Material[])[0] as THREE.MeshStandardMaterial
    m.color.setHex(TOP_COLOR)
    m.emissive.setHex(TOP_EMISSIVE)
  }
  hovered = mesh
  if (mesh) {
    const m = (mesh.material as THREE.Material[])[0] as THREE.MeshStandardMaterial
    m.color.setHex(HOVER_COLOR)
    m.emissive.setHex(HOVER_EMISSIVE)
  }
  if (container.value) container.value.style.cursor = mesh ? 'pointer' : 'default'
}

function pick(e: PointerEvent): THREE.Mesh | null {
  const el = container.value
  if (!el || !camera) return null
  const rect = el.getBoundingClientRect()
  const rx = (e.clientX - rect.left) / rect.width
  const ry = (e.clientY - rect.top) / rect.height
  raycaster.setFromCamera(new THREE.Vector2(rx * 2 - 1, -(ry * 2 - 1)), camera)
  const hit = raycaster.intersectObjects(regionMeshes, false)[0]
  return (hit?.object as THREE.Mesh) ?? null
}

function onPointerMove(e: PointerEvent) {
  const el = container.value
  if (!el) return
  const mesh = pick(e)
  setHover(mesh)
  if (mesh?.userData.item) {
    const rect = el.getBoundingClientRect()
    // tooltip 用布局坐标（除以 ScaleScreen 缩放），跟随鼠标且不越出右缘
    const lx = ((e.clientX - rect.left) / rect.width) * el.clientWidth
    const ly = ((e.clientY - rect.top) / rect.height) * el.clientHeight
    const item = mesh.userData.item as DistrictMapItem
    tip.show = true
    tip.x = lx + 180 > el.clientWidth ? lx - 190 : lx + 16
    tip.y = Math.max(ly - 40, 4)
    tip.name = item.name
    tip.aj = item.aj
    tip.ztje = item.ztje
    tip.zzs = item.zzs
  } else {
    tip.show = false
  }
}

function onPointerDown(e: PointerEvent) {
  downX = e.clientX
  downY = e.clientY
}

function onClick(e: PointerEvent) {
  // 区分拖拽旋转与点击
  if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return
  const mesh = pick(e)
  const name = mesh?.userData.name as string | undefined
  if (name) router.push(`/district/${encodeURIComponent(name)}`)
}

function onPointerLeave() {
  setHover(null)
  tip.show = false
}

// —— 渲染循环 + FPS ——
let frames = 0
let lastFpsAt = 0

function loop(now: number) {
  raf = requestAnimationFrame(loop)
  controls?.update()
  if (renderer && scene && camera) renderer.render(scene, camera)
  frames++
  if (now - lastFpsAt >= 1000) {
    fps.value = frames
    frames = 0
    lastFpsAt = now
  }
}

async function init() {
  try {
    const [svgRes, data, terrainTex] = await Promise.all([
      fetch(`${import.meta.env.BASE_URL}maps/chongqing-selected-districts-tianditu-imagery-z12.svg`),
      getDistrictMapData(),
      new THREE.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}maps/tianditu-imagery-z12.png`)
    ])
    if (!svgRes.ok) throw new Error(`地图加载失败: HTTP ${svgRes.status}`)
    terrainTex.colorSpace = THREE.SRGBColorSpace
    const regions = parseSvgRegions(await svgRes.text())
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

    setupScene(buildRegions(regions, byName, terrainTex))

    const el = container.value!
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('click', onClick as EventListener)
    el.addEventListener('pointerleave', onPointerLeave)

    lastFpsAt = performance.now()
    raf = requestAnimationFrame(loop)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

onMounted(init)

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
  window.removeEventListener('resize', updatePixelRatio)
  cameraView.value = ''
  controls?.dispose()
  scene?.traverse((obj) => {
    const o = obj as THREE.Mesh
    if (o.geometry) o.geometry.dispose()
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      mats.forEach((m) => {
        ;(m as THREE.MeshStandardMaterial).map?.dispose()
        m.dispose()
      })
    }
  })
  renderer?.dispose()
  renderer?.domElement.remove()
  renderer = null
  scene = null
  camera = null
  controls = null
  regionMeshes.length = 0
})
</script>

<template>
  <div ref="container" class="cq-map3d">
    <div v-show="tip.show" class="tip" :style="{ left: tip.x + 'px', top: tip.y + 'px' }">
      <b class="tip-name">{{ tip.name }}</b>
      <div>案件量：<span class="v cyan">{{ tip.aj.toLocaleString() }}</span> 件</div>
      <div>在调金额：<span class="v gold">{{ tip.ztje.toLocaleString() }}</span> 万元</div>
      <div>调解组织：<span class="v green">{{ tip.zzs }}</span> 家</div>
    </div>
    <div class="hud">{{ fps }} FPS</div>
    <div v-if="error" class="err">{{ error }}</div>
  </div>
</template>

<style scoped>
.cq-map3d { position: relative; }
.cq-map3d :deep(.gl) { width: 100%; height: 100%; display: block; }

.tip {
  position: absolute; z-index: 5; pointer-events: none; white-space: nowrap;
  padding: 10px 14px; border: 1px solid #2483ff; border-radius: 4px;
  background: rgba(6, 18, 40, 0.92);
  color: #fff; font-size: 13px; font-family: 'OPPOSans-R'; line-height: 1.7;
}
.tip-name { font-size: 15px; }
.v { font-family: 'Bebas'; font-size: 14px; }
.cyan { color: #00deff; }
.gold { color: #edd892; }
.green { color: #44ffa2; }

.hud {
  position: absolute; left: 6px; bottom: 4px; z-index: 5; pointer-events: none;
  font-size: 11px; color: rgba(127, 168, 217, 0.75); font-family: monospace;
}

.err {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  color: #ff7d57; font-size: 16px; font-family: 'OPPOSans-R';
  background: rgba(6, 18, 40, 0.6);
}
</style>
