/*
  Procedural 3D cockpit for the leather configurator.
  Loaded on demand (dynamic import) so three.js never weighs on first paint.

  Everything is generated in code: the dashboard is a lofted surface (a closed side
  profile swept across the car's width), leather grain is a generated normal map,
  and stitching is real geometry — one instanced capsule per stitch — so a seam can
  be "sewn" in, stitch by stitch, whenever the thread changes.
*/
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { type Look, leatherOf, threadOf } from '../data'

export type View = 'driver' | 'center' | 'seam' | 'wheel'
export interface Cockpit {
  setLook: (look: Look, sew: boolean) => void
  setView: (v: View) => void
  dispose: () => void
}

const VIEWS: Record<View, { pos: [number, number, number]; target: [number, number, number] }> = {
  driver: { pos: [-0.62, 1.34, 1.35], target: [-0.08, 0.93, 0] },
  center: { pos: [0.18, 1.42, 1.55], target: [0, 0.9, 0] },
  seam: { pos: [0.34, 1.07, 0.36], target: [0.14, 0.985, 0.02] },
  wheel: { pos: [-0.28, 1.12, 0.92], target: [-0.42, 0.9, 0.3] },
}

/* ---------------- procedural textures ---------------- */

function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
}

/** Pebble grain: tileable Voronoi cells → height → normal map. */
function grainNormalMap(size: number, cells: number, depth: number, seed: number) {
  const r = rng(seed)
  const pts: [number, number][] = Array.from({ length: cells }, () => [r() * size, r() * size])
  const h = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let d1 = 1e9
      let d2 = 1e9
      for (const [px, py] of pts) {
        // wrap distance for seamless tiling
        let dx = Math.abs(x - px); dx = Math.min(dx, size - dx)
        let dy = Math.abs(y - py); dy = Math.min(dy, size - dy)
        const d = dx * dx + dy * dy
        if (d < d1) { d2 = d1; d1 = d } else if (d < d2) d2 = d
      }
      // edge between cells is a crease; cell centres are slightly domed
      const e = Math.min(1, (Math.sqrt(d2) - Math.sqrt(d1)) / 5)
      h[y * size + x] = Math.sqrt(e) * 0.85 + r() * 0.05
    }
  }
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(size, size)
  const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)]
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * depth
      const dy = (at(x, y + 1) - at(x, y - 1)) * depth
      const len = Math.hypot(dx, dy, 1)
      const i = (y * size + x) * 4
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255
      img.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.NoColorSpace
  t.anisotropy = 8
  return t
}

/** Perforation: white tile with a dark hole, multiplied into the leather colour. */
function perforationMap() {
  const c = document.createElement('canvas')
  c.width = c.height = 32
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, 32, 32)
  const g = ctx.createRadialGradient(16, 16, 1, 16, 16, 6)
  g.addColorStop(0, '#000')
  g.addColorStop(0.7, '#222')
  g.addColorStop(1, '#fff')
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(16, 16, 6, 0, Math.PI * 2); ctx.fill()
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Infotainment / cluster UI drawn on a canvas, used as an emissive screen. */
function screenTexture(w: number, h: number, kind: 'centre' | 'cluster') {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')!
  const bg = ctx.createLinearGradient(0, 0, w, h)
  bg.addColorStop(0, '#0b1420'); bg.addColorStop(1, '#101a28')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#3d7fe0'; ctx.fillStyle = '#3d7fe0'
  if (kind === 'centre') {
    ctx.globalAlpha = 0.9
    ctx.lineWidth = 3
    ctx.beginPath()
    const pts = [0.06, 0.62, 0.2, 0.48, 0.34, 0.56, 0.5, 0.34, 0.66, 0.42, 0.82, 0.24, 0.94, 0.3]
    for (let i = 0; i < pts.length; i += 2) ctx.lineTo(pts[i] * w, pts[i + 1] * h)
    ctx.stroke()
    ctx.globalAlpha = 0.35
    for (let i = 0; i < 4; i++) ctx.fillRect(0.06 * w + i * 0.23 * w, 0.76 * h, 0.18 * w, 0.12 * h)
    ctx.globalAlpha = 0.85
    ctx.fillStyle = '#e8eef8'
    ctx.font = `600 ${h * 0.11}px sans-serif`
    ctx.fillText('21°', 0.06 * w, 0.2 * h)
  } else {
    ctx.lineWidth = 4
    for (const cx of [0.27, 0.73]) {
      ctx.globalAlpha = 0.25
      ctx.beginPath(); ctx.arc(cx * w, 0.55 * h, 0.32 * h, Math.PI * 0.75, Math.PI * 2.25); ctx.stroke()
      ctx.globalAlpha = 0.95
      ctx.beginPath(); ctx.arc(cx * w, 0.55 * h, 0.32 * h, Math.PI * 0.75, Math.PI * (cx < 0.5 ? 1.45 : 1.2)); ctx.stroke()
    }
    ctx.fillStyle = '#e8eef8'
    ctx.font = `600 ${h * 0.2}px sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText('0', 0.27 * w, 0.62 * h)
    ctx.font = `500 ${h * 0.12}px sans-serif`
    ctx.fillText('P', 0.5 * w, 0.6 * h)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/* ---------------- lofted dashboard surfaces ---------------- */

type Profile = (t: number) => THREE.Vector2 // (z, y) around a closed loop, t in [0,1)

function closedProfile(points: [number, number][]): Profile {
  const curve = new THREE.CatmullRomCurve3(points.map(([z, y]) => new THREE.Vector3(z, y, 0)), true, 'centripetal')
  return (t) => { const p = curve.getPoint(((t % 1) + 1) % 1); return new THREE.Vector2(p.x, p.y) }
}

interface Loft {
  geometry: THREE.BufferGeometry
  at: (x: number, t: number) => THREE.Vector3
  normal: (x: number, t: number) => THREE.Vector3
}

/**
 * Sweeps a closed (z,y) profile along x. `shape` returns the profile scale and
 * offsets for a given x, so the ends taper into the doors and the centre bows forward.
 */
function loft(profile: Profile, x0: number, x1: number, nx: number, nt: number,
  shape: (x: number) => { s: number; dz: number; dy: number; cz: number; cy: number }, uvScale = 7): Loft {
  const at = (x: number, t: number) => {
    const p = profile(t)
    const { s, dz, dy, cz, cy } = shape(x)
    return new THREE.Vector3(x, cy + (p.y - cy) * s + dy, cz + (p.x - cz) * s + dz)
  }
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= nx; i++) {
    const x = x0 + ((x1 - x0) * i) / nx
    let arc = 0
    let prev = at(x, 0)
    for (let j = 0; j <= nt; j++) {
      const p = at(x, j / nt)
      arc += p.distanceTo(prev); prev = p
      pos.push(p.x, p.y, p.z)
      uv.push(x * uvScale, arc * uvScale)
    }
  }
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nt; j++) {
      const a = i * (nt + 1) + j, b = (i + 1) * (nt + 1) + j
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  const normal = (x: number, t: number) => {
    const e = 0.002
    const dx = at(x + e, t).sub(at(x - e, t))
    const dt = at(x, t + e).sub(at(x, t - e))
    return new THREE.Vector3().crossVectors(dx, dt).normalize()
  }
  return { geometry: g, at, normal }
}

/** Primitive geometries come with 0..1 UVs; scale them so the grain has a real-world size. */
function scaleUV(g: THREE.BufferGeometry, k: number) {
  const uv = g.getAttribute('uv') as THREE.BufferAttribute | undefined
  if (!uv) return g
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * k)
  uv.needsUpdate = true
  return g
}
const LEATHER_UV = 7 // texture tiles per metre on lofted surfaces

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

/* ---------------- stitching ---------------- */

interface Seam { mesh: THREE.InstancedMesh; count: number }

function seamAlong(points: THREE.Vector3[], normals: THREE.Vector3[], material: THREE.Material, pitch = 0.0085): Seam {
  // resample by arc length so stitches are evenly spaced
  const curve = new THREE.CatmullRomCurve3(points)
  const len = curve.getLength()
  const n = Math.floor(len / pitch)
  const geo = new THREE.CapsuleGeometry(0.0011, pitch * 0.55, 2, 6)
  geo.rotateZ(Math.PI / 2) // capsule along x
  const mesh = new THREE.InstancedMesh(geo, material, n)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const xAxis = new THREE.Vector3(1, 0, 0)
  for (let i = 0; i < n; i++) {
    const u = (i + 0.5) / n
    const p = curve.getPointAt(u)
    const tan = curve.getTangentAt(u)
    const ni = Math.min(normals.length - 1, Math.round(u * (normals.length - 1)))
    const nrm = normals[ni]
    q.setFromUnitVectors(xAxis, tan)
    m.compose(p.clone().addScaledVector(nrm, 0.0007), q, new THREE.Vector3(1, 1, 1))
    mesh.setMatrixAt(i, m)
  }
  mesh.castShadow = false
  return { mesh, count: n }
}

/* ---------------- scene ---------------- */

export function createCockpit(canvas: HTMLCanvasElement, initial: Look, opts: { reducedMotion: boolean; onReady?: () => void }): Cockpit {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const scene = new THREE.Scene()
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environmentIntensity = 0.55

  const camera = new THREE.PerspectiveCamera(34, 1, 0.02, 20)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = !opts.reducedMotion
  controls.dampingFactor = 0.08
  controls.enablePan = false
  controls.minDistance = 0.25
  controls.maxDistance = 2.4
  controls.minPolarAngle = 0.35
  controls.maxPolarAngle = 1.62
  controls.minAzimuthAngle = -1.1
  controls.maxAzimuthAngle = 1.1
  controls.zoomSpeed = 0.6
  // On touch screens one finger must keep scrolling the page; two fingers turn and zoom.
  const coarse = window.matchMedia('(pointer: coarse)').matches
  if (coarse) {
    controls.touches = { ONE: null as unknown as THREE.TOUCH, TWO: THREE.TOUCH.DOLLY_ROTATE }
    canvas.style.touchAction = 'pan-y'
  }
  // No mouse-wheel zoom: the wheel must keep scrolling the page. Close-ups come from the view buttons.
  controls.enableZoom = coarse

  /* lights */
  const key = new THREE.DirectionalLight('#fff4e6', 2.4)
  key.position.set(-1.2, 2.6, 1.8)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.camera.left = -1.2; key.shadow.camera.right = 1.2
  key.shadow.camera.top = 1.2; key.shadow.camera.bottom = -1.2
  key.shadow.bias = -0.0004
  key.shadow.normalBias = 0.01
  key.shadow.radius = 4
  scene.add(key)
  const rim = new THREE.DirectionalLight('#9fc0ff', 1.1)
  rim.position.set(1.6, 1.6, -1.4)
  scene.add(rim)
  const fill = new THREE.DirectionalLight('#ffffff', 0.5)
  fill.position.set(0.8, 0.9, 2)
  scene.add(fill)
  scene.add(new THREE.HemisphereLight('#c9d4e6', '#1a1714', 0.35))

  /* materials */
  const grain = grainNormalMap(256, 1600, 2.2, 7)
  const fineGrain = grainNormalMap(256, 3200, 1.6, 13)
  const perf = perforationMap()
  perf.repeat.set(26, 26)

  const leather = new THREE.MeshPhysicalMaterial({ color: '#1b1c1e', roughness: 0.5, normalMap: grain, normalScale: new THREE.Vector2(0.2, 0.2), clearcoat: 0.12, clearcoatRoughness: 0.55 })
  leather.side = THREE.DoubleSide // end caps are single planes
  const padLeather = leather.clone()
  const threadMat = new THREE.MeshStandardMaterial({ color: '#f2c230', roughness: 0.55 })
  const piano = new THREE.MeshPhysicalMaterial({ color: '#08090a', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05 })
  const satin = new THREE.MeshStandardMaterial({ color: '#141518', roughness: 0.75, metalness: 0 })
  const alu = new THREE.MeshStandardMaterial({ color: '#b9bdc4', roughness: 0.28, metalness: 1 })
  const ventMat = new THREE.MeshStandardMaterial({ color: '#0c0d0f', roughness: 0.8 })

  const root = new THREE.Group()
  scene.add(root)

  // the whole dash bows forward towards the cabin centre
  const bow = (x: number) => 0.05 * (1 - (x / 0.86) ** 2)
  const flat = (cz: number, cy: number) => (x: number) => ({ s: 1, dz: bow(x), dy: 0, cz, cy })

  /** Close the open ends of a loft with a flat cap cut from the profile. */
  const capEnds = (profile: Profile, x: number, material: THREE.Material) => {
    const shape = new THREE.Shape()
    for (let i = 0; i <= 64; i++) {
      const p = profile(i / 64)
      if (i === 0) shape.moveTo(p.x, p.y); else shape.lineTo(p.x, p.y)
    }
    const geo = new THREE.ShapeGeometry(shape, 4)
    scaleUV(geo, 7)
    for (const sx of [-x, x]) {
      const cap = new THREE.Mesh(geo, material)
      cap.rotation.y = -Math.PI / 2
      cap.position.set(sx, 0, bow(sx))
      cap.castShadow = true
      root.add(cap)
    }
  }

  /** Find the profile parameter on the upper side where the surface reaches depth z. */
  const tAtDepth = (profile: Profile, z: number) => {
    let best = 0, bestD = 1e9
    for (let t = 0; t < 0.6; t += 0.0005) {
      const p = profile(t)
      const d = Math.abs(p.x - z) + (p.y < 0.95 ? 1 : 0)
      if (d < bestD) { bestD = d; best = t }
    }
    return best
  }

  /* upper pad — the part he re-trims */
  const padProfile = closedProfile([
    [-0.52, 0.955], [-0.3, 0.99], [-0.08, 1.002], [0.03, 0.996], [0.072, 0.976], [0.08, 0.948],
    [0.05, 0.922], [-0.1, 0.91], [-0.52, 0.9],
  ])
  const PAD_X = 0.86
  const pad = loft(padProfile, -PAD_X, PAD_X, 200, 110, flat(-0.15, 0.95), LEATHER_UV)
  const padMesh = new THREE.Mesh(pad.geometry, padLeather)
  padMesh.castShadow = padMesh.receiveShadow = true
  root.add(padMesh)
  capEnds(padProfile, PAD_X, padLeather)
  const SEAM_A = tAtDepth(padProfile, 0.05)
  const SEAM_B = tAtDepth(padProfile, 0.034)

  /* instrument hood on the driver side */
  const hoodProfile = closedProfile([[-0.16, 0.99], [-0.1, 1.055], [0.0, 1.08], [0.07, 1.068], [0.082, 1.045], [0.05, 1.032], [-0.02, 1.024], [-0.12, 0.99]])
  const hoodShape = (x: number) => {
    const u = (x + 0.42) / 0.2 // -1..1 across the hood
    const e = smooth(0.55, 1, Math.abs(u))
    return { s: 1, dz: bow(x) - 0.01, dy: -e * 0.075, cz: -0.04, cy: 1.0 }
  }
  const hood = loft(hoodProfile, -0.62, -0.22, 90, 70, hoodShape, LEATHER_UV)
  const hoodMesh = new THREE.Mesh(hood.geometry, padLeather)
  hoodMesh.castShadow = hoodMesh.receiveShadow = true
  root.add(hoodMesh)

  /* lower dash */
  const lowerProfile = closedProfile([[-0.4, 0.912], [0.04, 0.914], [0.064, 0.89], [0.066, 0.76], [0.02, 0.64], [-0.2, 0.6], [-0.42, 0.64]])
  const LOWER_X = 0.84
  const lower = loft(lowerProfile, -LOWER_X, LOWER_X, 160, 70, flat(-0.15, 0.76), LEATHER_UV)
  const lowerMesh = new THREE.Mesh(lower.geometry, leather)
  lowerMesh.castShadow = lowerMesh.receiveShadow = true
  root.add(lowerMesh)
  capEnds(lowerProfile, LOWER_X, leather)

  /* piano-black trim strip at the joint between pad and lower dash */
  const stripPts: THREE.Vector3[] = []
  for (let x = -0.8; x <= 0.801; x += 0.02) stripPts.push(new THREE.Vector3(x, 0.913, 0.058 + bow(x)))
  const strip = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stripPts), 160, 0.006, 8), piano)
  root.add(strip)

  /* vents set into the lower face */
  const ventAt = (x: number, w: number) => {
    const g = new THREE.Group()
    const frame = new THREE.Mesh(new RoundedBoxGeometry(w, 0.058, 0.02, 3, 0.01), ventMat)
    g.add(frame)
    for (let i = 0; i < 4; i++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.0035, 0.016), satin)
      slat.position.set(0, -0.019 + i * 0.0127, 0.006)
      slat.rotation.x = -0.25
      g.add(slat)
    }
    const trim = new THREE.Mesh(new THREE.BoxGeometry(w * 0.96, 0.0025, 0.004), alu)
    trim.position.set(0, 0.031, 0.008)
    g.add(trim)
    g.position.set(x, 0.85, 0.06 + bow(x))
    root.add(g)
  }
  ventAt(-0.7, 0.12); ventAt(-0.07, 0.11); ventAt(0.07, 0.11); ventAt(0.7, 0.12)

  /* glovebox shut line */
  const glove = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.0025, 0.004), ventMat)
  glove.position.set(0.44, 0.79, 0.07 + bow(0.44))
  root.add(glove)

  /* car around the dash: windscreen, A-pillars, door tops */
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.8), new THREE.MeshPhysicalMaterial({ color: '#0d1217', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.35, envMapIntensity: 1.4 }))
  glass.position.set(0, 1.2, -0.82)
  glass.rotation.x = -1.0
  root.add(glass)
  for (const sx of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.8, 4, 12), satin)
    pillar.scale.set(0.6, 1, 1)
    pillar.position.set(sx * 0.95, 1.24, -0.8)
    pillar.rotation.set(-1.0, 0, sx * -0.1)
    root.add(pillar)
    const door = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.14, 1.5, 5, 0.04), leather)
    scaleUV(door.geometry, 8)
    door.position.set(sx * 0.95, 0.9, 0.35)
    door.castShadow = door.receiveShadow = true
    root.add(door)
  }

  /* centre screen */
  const screen = new THREE.Group()
  const bezel = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.15, 0.016, 4, 0.01), piano)
  const display = new THREE.Mesh(new THREE.PlaneGeometry(0.322, 0.132), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffffff', emissiveMap: screenTexture(640, 260, 'centre'), emissiveIntensity: 0.9, roughness: 0.15 }))
  display.position.z = 0.0085
  screen.add(bezel, display)
  screen.position.set(0.04, 1.085, -0.06)
  screen.rotation.x = -0.12
  bezel.castShadow = true
  root.add(screen)

  /* instrument cluster under the hood */
  const cluster = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.075), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffffff', emissiveMap: screenTexture(512, 128, 'cluster'), emissiveIntensity: 0.85 }))
  cluster.position.set(-0.42, 1.03, 0.04)
  cluster.rotation.x = -0.35
  root.add(cluster)

  /* centre console */
  const centreConsole = new THREE.Mesh(scaleUV(new RoundedBoxGeometry(0.26, 0.24, 0.62, 5, 0.05), 4.2), leather)
  centreConsole.position.set(0, 0.5, 0.3)
  centreConsole.castShadow = centreConsole.receiveShadow = true
  root.add(centreConsole)
  const consoleTop = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.02, 0.3, 3, 0.008), piano)
  consoleTop.position.set(0, 0.625, 0.24)
  root.add(consoleTop)
  const selector = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.05, 24), alu)
  selector.position.set(0, 0.655, 0.2)
  root.add(selector)

  /* steering wheel */
  const wheel = new THREE.Group()
  const rimGeo = scaleUV(new THREE.TorusGeometry(0.185, 0.019, 24, 140), 1)
  { const uv = rimGeo.getAttribute('uv') as THREE.BufferAttribute; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.16 * 7, uv.getY(i) * 0.12 * 7) }
  const wheelRim = new THREE.Mesh(rimGeo, leather)
  wheelRim.castShadow = true
  const hub = new THREE.Mesh(scaleUV(new THREE.SphereGeometry(0.072, 48, 24), 3.5), leather)
  hub.scale.set(1.15, 1, 0.38)
  hub.position.z = 0.012
  hub.castShadow = true
  const badge = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0015, 8, 40), alu)
  badge.position.z = 0.04
  wheel.add(wheelRim, hub, badge)
  for (const a of [Math.PI, 0, -Math.PI / 2]) {
    const spoke = new THREE.Mesh(new RoundedBoxGeometry(0.12, a === -Math.PI / 2 ? 0.03 : 0.045, 0.022, 3, 0.008), satin)
    spoke.position.set(Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0)
    spoke.rotation.z = a
    spoke.castShadow = true
    wheel.add(spoke)
  }
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.32, 24), satin)
  column.rotation.x = Math.PI / 2
  column.position.z = -0.17
  wheel.add(column)
  wheel.position.set(-0.42, 0.92, 0.36)
  wheel.rotation.x = -0.32
  root.add(wheel)

  /* floor + soft contact shadow */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.ShadowMaterial({ opacity: 0.35 }))
  floor.rotation.x = -Math.PI / 2
  floor.position.y = 0.38
  floor.receiveShadow = true
  scene.add(floor)

  /* seams: two rows along the front lip, one around the hood, one round the wheel rim */
  const seamRow = (t: number, x0: number, x1: number) => {
    const pts: THREE.Vector3[] = [], nrm: THREE.Vector3[] = []
    for (let x = x0; x <= x1 + 1e-6; x += 0.01) { pts.push(pad.at(x, t)); nrm.push(pad.normal(x, t)) }
    return seamAlong(pts, nrm, threadMat)
  }
  const hoodRow = () => {
    const pts: THREE.Vector3[] = [], nrm: THREE.Vector3[] = []
    const ht = tAtDepth(hoodProfile, 0.055)
    for (let x = -0.58; x <= -0.26; x += 0.004) { pts.push(hood.at(x, ht)); nrm.push(hood.normal(x, ht)) }
    return seamAlong(pts, nrm, threadMat)
  }
  const wheelRow = (off: number) => {
    const pts: THREE.Vector3[] = [], nrm: THREE.Vector3[] = []
    wheel.updateMatrixWorld()
    for (let a = 0; a <= Math.PI * 2 + 1e-6; a += Math.PI / 120) {
      const local = new THREE.Vector3(Math.cos(a) * (0.185 - 0.019 * Math.cos(off)), Math.sin(a) * (0.185 - 0.019 * Math.cos(off)), 0.019 * Math.sin(off))
      pts.push(local.clone().applyMatrix4(wheel.matrixWorld))
      nrm.push(new THREE.Vector3(-Math.cos(a) * Math.cos(off), -Math.sin(a) * Math.cos(off), Math.sin(off)).transformDirection(wheel.matrixWorld))
    }
    return seamAlong(pts, nrm, threadMat, 0.0095)
  }
  const seamsSingle = [seamRow(SEAM_A, -0.8, 0.8), hoodRow(), wheelRow(0.9)]
  const seamsDouble = [seamRow(SEAM_B, -0.8, 0.8), wheelRow(1.3)]
  for (const s of [...seamsSingle, ...seamsDouble]) root.add(s.mesh)

  /* ---------------- state + render loop ---------------- */
  let look = initial
  let sewStart = -1
  let colourFrom = new THREE.Color(leatherOf(initial.leather).hex)
  let colourTo = colourFrom.clone()
  let colourStart = -1
  let raf = 0
  let camAnim: { from: THREE.Vector3; to: THREE.Vector3; tFrom: THREE.Vector3; tTo: THREE.Vector3; start: number } | null = null

  const SEW_MS = opts.reducedMotion ? 0 : 1400
  const COLOUR_MS = opts.reducedMotion ? 0 : 450

  function applyMaterials() {
    const fin = look.finish
    for (const m of [leather, padLeather]) {
      m.roughness = fin === 'alcantara' ? 0.97 : 0.5
      m.clearcoat = fin === 'alcantara' ? 0 : 0.12
      m.sheen = fin === 'alcantara' ? 1 : 0
      m.sheenRoughness = 0.55
      m.sheenColor.set(leatherOf(look.leather).hi)
      m.normalMap = fin === 'alcantara' ? fineGrain : grain
      m.normalScale.setScalar(fin === 'alcantara' ? 0.22 : 0.2)
      m.needsUpdate = true
    }
    padLeather.map = fin === 'perforated' ? perf : null
    padLeather.needsUpdate = true
    threadMat.color.set(threadOf(look.thread, look.leather))
    for (const s of seamsDouble) s.mesh.visible = look.seam === 'double'
  }

  function setLook(next: Look, sew: boolean) {
    const leatherChanged = next.leather !== look.leather
    look = next
    if (leatherChanged) {
      colourFrom = leather.color.clone()
      colourTo = new THREE.Color(leatherOf(next.leather).hex)
      colourStart = performance.now()
    }
    applyMaterials()
    if (sew && SEW_MS > 0) sewStart = performance.now()
    kick()
  }

  function setView(v: View) {
    const { pos, target } = VIEWS[v]
    const to = new THREE.Vector3(...pos), tTo = new THREE.Vector3(...target)
    if (opts.reducedMotion) { camera.position.copy(to); controls.target.copy(tTo); controls.update(); kick(); return }
    camAnim = { from: camera.position.clone(), to, tFrom: controls.target.clone(), tTo, start: performance.now() }
    kick()
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    // keep the whole dashboard in frame on narrow screens
    camera.fov = w / h < 1.2 ? 46 : 34
    camera.updateProjectionMatrix()
    kick()
  }

  let running = false
  function kick() { if (!running) { running = true; raf = requestAnimationFrame(frame) } }
  function frame(now: number) {
    let busy = false
    if (colourStart >= 0) {
      const k = COLOUR_MS ? Math.min(1, (now - colourStart) / COLOUR_MS) : 1
      const c = colourFrom.clone().lerp(colourTo, k * k * (3 - 2 * k))
      leather.color.copy(c); padLeather.color.copy(c)
      if (k < 1) busy = true; else colourStart = -1
    }
    if (sewStart >= 0) {
      const k = Math.min(1, (now - sewStart) / SEW_MS)
      const e = 1 - (1 - k) ** 3
      for (const s of [...seamsSingle, ...seamsDouble]) s.mesh.count = Math.max(1, Math.floor(s.count * e))
      if (k < 1) busy = true; else sewStart = -1
    }
    if (camAnim) {
      const k = Math.min(1, (now - camAnim.start) / 900)
      const e = k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2
      camera.position.lerpVectors(camAnim.from, camAnim.to, e)
      controls.target.lerpVectors(camAnim.tFrom, camAnim.tTo, e)
      if (k < 1) busy = true; else camAnim = null
    }
    if (controls.update()) busy = true
    renderer.render(scene, camera)
    if (busy) raf = requestAnimationFrame(frame)
    else running = false
  }

  controls.addEventListener('change', kick)
  controls.addEventListener('start', () => { camAnim = null })
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)

  // initial state
  leather.color.copy(colourTo); padLeather.color.copy(colourTo)
  applyMaterials()
  camera.position.set(...VIEWS.driver.pos)
  controls.target.set(...VIEWS.driver.target)
  controls.update()
  resize()
  renderer.compile(scene, camera)
  requestAnimationFrame(() => { kick(); opts.onReady?.() })

  return {
    setLook,
    setView,
    dispose() {
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      scene.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose()
        const mat = m.material as THREE.Material | THREE.Material[] | undefined
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose()
      })
      for (const t of [grain, fineGrain, perf]) t.dispose()
      pmrem.dispose()
      renderer.dispose()
    },
  }
}
