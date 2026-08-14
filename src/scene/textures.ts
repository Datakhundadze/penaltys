/**
 * პროცედურული ტექსტურები — ყველაფერი კოდში იხატება, გარე ფაილების გარეშე.
 *
 * ყველა შემთხვევითობა mulberry32-იდან მოდის (იგივე PRNG, რაც ფიზიკაში),
 * ასე რომ ერთი და იგივე გარემო ყოველ ჩატვირთვაზე ერთნაირად გამოიყურება.
 * თითოეული ტექსტურა ერთხელ იქმნება და კეშირდება.
 */

import * as THREE from 'three'
import { mulberry32 } from '../lib/physics'
import {
  GOAL_AREA_DEPTH,
  GOAL_AREA_HALF_WIDTH,
  LINE_WIDTH,
  PENALTY_BOX_DEPTH,
  PENALTY_BOX_HALF_WIDTH,
  PENALTY_SPOT_Z,
} from '../lib/geometry'
import { PALETTE } from '../lib/palette'

export type Quality = 'high' | 'low'

const cache = new Map<string, unknown>()
function memo<T>(key: string, build: () => T): T {
  const hit = cache.get(key)
  if (hit) return hit as T
  const made = build()
  cache.set(key, made)
  return made
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const el = document.createElement('canvas')
  el.width = w
  el.height = h
  const ctx = el.getContext('2d')
  if (!ctx) throw new Error('2d context unavailable')
  return [el, ctx]
}

function texture(el: HTMLCanvasElement, srgb = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(el)
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  t.anisotropy = 8
  return t
}

// ─────────────────────────────────────────────────────────────
// ხმაური — tileable value noise
// ─────────────────────────────────────────────────────────────

function lattice(size: number, seed: number): Float32Array {
  const rng = mulberry32(seed)
  const a = new Float32Array(size * size)
  for (let i = 0; i < a.length; i++) a[i] = rng()
  return a
}

function sampleLattice(a: Float32Array, size: number, x: number, y: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  // smoothstep — რბილი გადასვლები, კვადრატული ბადის გარეშე
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const i = (xx: number, yy: number) =>
    a[(((yy % size) + size) % size) * size + (((xx % size) + size) % size)] ?? 0
  const top = i(x0, y0) * (1 - sx) + i(x0 + 1, y0) * sx
  const bot = i(x0, y0 + 1) * (1 - sx) + i(x0 + 1, y0 + 1) * sx
  return top * (1 - sy) + bot * sy
}

/** ფრაქტალური ხმაური, გამეორებადი კიდეებით */
function fbm(octaves: readonly { cells: number; amp: number; seed: number }[]) {
  const layers = octaves.map((o) => ({ ...o, data: lattice(o.cells, o.seed) }))
  const total = octaves.reduce((s, o) => s + o.amp, 0)
  return (u: number, v: number): number => {
    let sum = 0
    for (const l of layers) sum += sampleLattice(l.data, l.cells, u * l.cells, v * l.cells) * l.amp
    return sum / total
  }
}

// ─────────────────────────────────────────────────────────────
// გაზონი — გათიბვის ზოლები + ხმაური
// ─────────────────────────────────────────────────────────────

/** ერთ tile-ზე ორი ზოლი; repeat-ით მთელ მოედანზე გადადის */
export const GRASS_STRIPES_PER_TILE = 2

export interface GrassMaps {
  map: THREE.Texture
  roughnessMap: THREE.Texture
  normalMap: THREE.Texture
}

export function grassMaps(quality: Quality): GrassMaps {
  return memo(`grass:${quality}`, () => {
    const S = quality === 'high' ? 512 : 256
    const [albedoEl, albedo] = canvas(S, S)
    const [roughEl, rough] = canvas(S, S)
    const [normEl, norm] = canvas(S, S)

    const detail = fbm([
      { cells: 8, amp: 1, seed: 0x51ed },
      { cells: 24, amp: 0.5, seed: 0x77a1 },
      { cells: 96, amp: 0.28, seed: 0x1c9f },
    ])
    // ცალკეული ბალახის ღერების მიმართულება — ძალიან წვრილი
    const blades = fbm([{ cells: quality === 'high' ? 96 : 56, amp: 1, seed: 0x2be3 }])

    const light = new THREE.Color('#2b7245')
    const dark = new THREE.Color('#1a522c')
    const c = new THREE.Color()

    const aImg = albedo.createImageData(S, S)
    const rImg = rough.createImageData(S, S)
    const height = new Float32Array(S * S)

    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const u = x / S
        const v = y / S
        const n = detail(u, v)
        const b = blades(u * 3, v * 0.6)

        // გათიბვის ზოლი — რბილი კიდით, რომ ხაზი არ გამოჩნდეს
        const band = Math.sin(v * Math.PI * 2 * GRASS_STRIPES_PER_TILE)
        const stripe = 0.5 + 0.5 * Math.tanh(band * 2.6)

        c.copy(dark).lerp(light, stripe * 0.75 + n * 0.22)
        // ღეროების წვრილი ვარიაცია
        const shade = 0.96 + b * 0.08
        const i = (y * S + x) * 4
        aImg.data[i] = Math.min(255, c.r * 255 * shade)
        aImg.data[i + 1] = Math.min(255, c.g * 255 * (shade * 0.35 + 0.65))
        aImg.data[i + 2] = Math.min(255, c.b * 255 * shade)
        aImg.data[i + 3] = 255

        // გათიბვის მიმართულება ცვლის ბზინვას — სწორედ ამიტომ ჩანს ზოლები
        const r = 0.93 - stripe * 0.09 - n * 0.07 + b * 0.04
        const rv = Math.max(0, Math.min(255, r * 255))
        rImg.data[i] = rv
        rImg.data[i + 1] = rv
        rImg.data[i + 2] = rv
        rImg.data[i + 3] = 255

        height[y * S + x] = n * 0.7 + b * 0.3
      }
    }
    albedo.putImageData(aImg, 0, 0)
    rough.putImageData(rImg, 0, 0)

    // ნორმალები სიმაღლის ველიდან
    const nImg = norm.createImageData(S, S)
    const at = (x: number, y: number) => height[((y + S) % S) * S + ((x + S) % S)] ?? 0
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const dx = at(x + 1, y) - at(x - 1, y)
        const dy = at(x, y + 1) - at(x, y - 1)
        const n = new THREE.Vector3(-dx * 3, -dy * 3, 1).normalize()
        const i = (y * S + x) * 4
        nImg.data[i] = (n.x * 0.5 + 0.5) * 255
        nImg.data[i + 1] = (n.y * 0.5 + 0.5) * 255
        nImg.data[i + 2] = (n.z * 0.5 + 0.5) * 255
        nImg.data[i + 3] = 255
      }
    }
    norm.putImageData(nImg, 0, 0)

    const map = texture(albedoEl, true)
    const roughnessMap = texture(roughEl)
    const normalMap = texture(normEl)
    for (const t of [map, roughnessMap, normalMap]) {
      t.wrapS = THREE.RepeatWrapping
      t.wrapT = THREE.RepeatWrapping
    }
    return { map, roughnessMap, normalMap }
  })
}

// ─────────────────────────────────────────────────────────────
// ცარცის ხაზები — უსწორო კიდეებით, ვექტორული სისუფთავის გარეშე
// ─────────────────────────────────────────────────────────────

/** მონიშნული არეალი მეტრებში, რომელსაც ტექსტურა ფარავს */
export const MARKINGS_HALF_WIDTH = 23
export const MARKINGS_FRONT_Z = -1.5
export const MARKINGS_BACK_Z = 21.5
export const MARKINGS_WIDTH = MARKINGS_HALF_WIDTH * 2
export const MARKINGS_DEPTH = MARKINGS_BACK_Z - MARKINGS_FRONT_Z

export function pitchMarkings(quality: Quality): THREE.Texture {
  return memo(`markings:${quality}`, () => {
    const W = quality === 'high' ? 2048 : 1024
    const H = Math.round((W * MARKINGS_DEPTH) / MARKINGS_WIDTH)
    const [el, ctx] = canvas(W, H)
    const rng = mulberry32(0x9a17c3)
    const pxPerM = W / MARKINGS_WIDTH

    // მეტრები → ტექსტურის პიქსელები
    const px = (x: number) => ((x + MARKINGS_HALF_WIDTH) / MARKINGS_WIDTH) * W
    const py = (z: number) => ((z - MARKINGS_FRONT_Z) / MARKINGS_DEPTH) * H

    ctx.clearRect(0, 0, W, H)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = PALETTE.chalk
    ctx.fillStyle = PALETTE.chalk

    /** ცარცი ხელით არის დაყრილი — სამი გავლა, ყოველი ოდნავ გადახრილი */
    const chalk = (pts: readonly (readonly [number, number])[]) => {
      const passes = [
        { w: 1.0, a: 0.42 },
        { w: 0.62, a: 0.22 },
        { w: 1.45, a: 0.1 },
      ]
      for (const pass of passes) {
        ctx.globalAlpha = pass.a
        ctx.lineWidth = LINE_WIDTH * pxPerM * pass.w
        ctx.beginPath()
        pts.forEach(([x, z], i) => {
          const jx = (rng() - 0.5) * pxPerM * 0.05
          const jz = (rng() - 0.5) * pxPerM * 0.05
          const cx = px(x) + jx
          const cz = py(z) + jz
          if (i === 0) ctx.moveTo(cx, cz)
          else ctx.lineTo(cx, cz)
        })
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    /** გრძელი მონაკვეთი წვრილ ნაწილებად, რომ გადახრა შუაშიც გამოჩნდეს */
    const segment = (a: readonly [number, number], b: readonly [number, number], steps = 26) => {
      const pts: [number, number][] = []
      for (let i = 0; i <= steps; i++) {
        pts.push([a[0] + (b[0] - a[0]) * (i / steps), a[1] + (b[1] - a[1]) * (i / steps)])
      }
      chalk(pts)
    }

    // კარის ხაზი
    segment([-MARKINGS_HALF_WIDTH + 1, 0], [MARKINGS_HALF_WIDTH - 1, 0], 60)
    // საჯარიმო მოედანი
    segment([-PENALTY_BOX_HALF_WIDTH, 0], [-PENALTY_BOX_HALF_WIDTH, PENALTY_BOX_DEPTH])
    segment([PENALTY_BOX_HALF_WIDTH, 0], [PENALTY_BOX_HALF_WIDTH, PENALTY_BOX_DEPTH])
    segment(
      [-PENALTY_BOX_HALF_WIDTH, PENALTY_BOX_DEPTH],
      [PENALTY_BOX_HALF_WIDTH, PENALTY_BOX_DEPTH],
      50,
    )
    // ვრატარის მოედანი
    segment([-GOAL_AREA_HALF_WIDTH, 0], [-GOAL_AREA_HALF_WIDTH, GOAL_AREA_DEPTH], 14)
    segment([GOAL_AREA_HALF_WIDTH, 0], [GOAL_AREA_HALF_WIDTH, GOAL_AREA_DEPTH], 14)
    segment([-GOAL_AREA_HALF_WIDTH, GOAL_AREA_DEPTH], [GOAL_AREA_HALF_WIDTH, GOAL_AREA_DEPTH], 30)

    // საჯარიმო რკალი — მხოლოდ მოედნის გარეთა ნაწილი
    {
      const radius = 9.15
      const half = Math.acos(Math.min(1, (PENALTY_BOX_DEPTH - PENALTY_SPOT_Z) / radius))
      const pts: [number, number][] = []
      const steps = 40
      for (let i = 0; i <= steps; i++) {
        const a = -half + (2 * half * i) / steps
        pts.push([radius * Math.sin(a), PENALTY_SPOT_Z + radius * Math.cos(a)])
      }
      chalk(pts)
    }

    // პენალტის წერტილი — უსწორო კიდით
    {
      ctx.globalAlpha = 0.5
      ctx.beginPath()
      const r = 0.12 * pxPerM
      for (let i = 0; i <= 22; i++) {
        const a = (i / 22) * Math.PI * 2
        const rr = r * (0.82 + rng() * 0.36)
        const x = px(0) + Math.cos(a) * rr
        const y = py(PENALTY_SPOT_Z) + Math.sin(a) * rr
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.fill()
      ctx.globalAlpha = 1
    }

    // ეროზია — ცარცი ბალახში ჯდება და ლაქებად იშლება
    ctx.globalCompositeOperation = 'destination-out'
    const specks = quality === 'high' ? 26000 : 9000
    for (let i = 0; i < specks; i++) {
      const x = rng() * W
      const y = rng() * H
      const r = rng() * pxPerM * 0.05 + 0.4
      ctx.globalAlpha = 0.05 + rng() * 0.5
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'

    const t = texture(el, true)
    t.wrapS = THREE.ClampToEdgeWrapping
    t.wrapT = THREE.ClampToEdgeWrapping
    return t
  })
}

// ─────────────────────────────────────────────────────────────
// ბურთი — ჭრილი იკოსაედრის პანელები სფეროზე
// ─────────────────────────────────────────────────────────────

/** 12 ხუთკუთხედის და 20 ექვსკუთხედის ცენტრი ერთეულოვან სფეროზე */
function panelCenters(): { dir: THREE.Vector3; pentagon: boolean }[] {
  const centers: { dir: THREE.Vector3; pentagon: boolean }[] = []
  const geo = new THREE.IcosahedronGeometry(1, 0)
  const pos = geo.getAttribute('position')

  // ხუთკუთხედები — იკოსაედრის წვეროებზე
  const seen: THREE.Vector3[] = []
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i).normalize()
    if (!seen.some((s) => s.distanceToSquared(v) < 1e-6)) {
      seen.push(v)
      centers.push({ dir: v, pentagon: true })
    }
  }
  // ექვსკუთხედები — წახნაგების ცენტრებში
  for (let i = 0; i < pos.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(pos, i)
    const b = new THREE.Vector3().fromBufferAttribute(pos, i + 1)
    const c = new THREE.Vector3().fromBufferAttribute(pos, i + 2)
    centers.push({ dir: a.add(b).add(c).normalize(), pentagon: false })
  }
  geo.dispose()
  return centers
}

export function ballMaps(): { map: THREE.Texture; roughnessMap: THREE.Texture } {
  return memo('ball', () => {
    const W = 512
    const H = 256
    const [el, ctx] = canvas(W, H)
    const [rel, rctx] = canvas(W, H)
    const centers = panelCenters()

    const img = ctx.createImageData(W, H)
    const rimg = rctx.createImageData(W, H)
    const white = new THREE.Color(PALETTE.chalk)
    const black = new THREE.Color('#101a16')
    const dir = new THREE.Vector3()

    for (let y = 0; y < H; y++) {
      const theta = (y / (H - 1)) * Math.PI
      const st = Math.sin(theta)
      const ct = Math.cos(theta)
      for (let x = 0; x < W; x++) {
        const phi = (x / W) * Math.PI * 2
        dir.set(st * Math.cos(phi), ct, st * Math.sin(phi))

        let best = -2
        let second = -2
        let pentagon = false
        for (const c of centers) {
          const d = c.dir.dot(dir)
          if (d > best) {
            second = best
            best = d
            pentagon = c.pentagon
          } else if (d > second) {
            second = d
          }
        }

        // ნაკერი — იქ, სადაც ორი პანელი თანაბრად ახლოსაა
        const seam = 1 - Math.min(1, (best - second) / 0.055)
        const base = pentagon ? black : white
        const i = (y * W + x) * 4
        const shade = 1 - seam * (pentagon ? 0.35 : 0.82)
        img.data[i] = base.r * 255 * shade
        img.data[i + 1] = base.g * 255 * shade
        img.data[i + 2] = base.b * 255 * shade
        img.data[i + 3] = 255

        // ნაკერი უფრო მქრქალია, პანელი — გლუვი
        const r = seam > 0.4 ? 210 : 96
        rimg.data[i] = r
        rimg.data[i + 1] = r
        rimg.data[i + 2] = r
        rimg.data[i + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
    rctx.putImageData(rimg, 0, 0)
    return { map: texture(el, true), roughnessMap: texture(rel) }
  })
}

// ─────────────────────────────────────────────────────────────
// ცა და პროჟექტორის კონუსი
// ─────────────────────────────────────────────────────────────

/** ღამის გრადიენტი — ჰორიზონტთან ოდნავ ღია */
export function skyGradient(): THREE.Texture {
  return memo('sky', () => {
    const [el, ctx] = canvas(4, 256)
    const g = ctx.createLinearGradient(0, 0, 0, 256)
    g.addColorStop(0, '#04080a')
    g.addColorStop(0.55, '#06100e')
    g.addColorStop(0.82, '#0b1a18')
    g.addColorStop(1, '#122421')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 4, 256)
    const t = texture(el, true)
    t.wrapS = THREE.RepeatWrapping
    return t
  })
}

/** რბილი წერტილი — ვარსკვლავებისა და ბრბოსთვის */
export function dotSprite(): THREE.Texture {
  return memo('dot', () => {
    const [el, ctx] = canvas(64, 64)
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.55)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
    return texture(el)
  })
}

/** სინათლის კონუსის გამჭვირვალობა — ლამპასთან ძლიერი, მიწასთან ნული */
export function coneAlpha(): THREE.Texture {
  return memo('cone', () => {
    const [el, ctx] = canvas(8, 256)
    const g = ctx.createLinearGradient(0, 0, 0, 256)
    // v=0 კონუსის წვერო (ლამპა), v=1 ფუძე (მიწა)
    g.addColorStop(0, 'rgba(255,255,255,0.95)')
    g.addColorStop(0.25, 'rgba(255,255,255,0.42)')
    g.addColorStop(0.7, 'rgba(255,255,255,0.12)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 8, 256)
    return texture(el)
  })
}

/** მიწისპირა ნისლის ზოლი — ქვევით მკვრივი, ზევით ქრება */
export function fogBand(): THREE.Texture {
  return memo('fog', () => {
    const [el, ctx] = canvas(256, 128)
    const g = ctx.createLinearGradient(0, 0, 0, 128)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(0.55, 'rgba(255,255,255,0.16)')
    g.addColorStop(0.85, 'rgba(255,255,255,0.34)')
    g.addColorStop(1, 'rgba(255,255,255,0.42)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 128)
    // კიდეებზე რბილად ქრება, რომ პანელი არ იკითხებოდეს
    const side = ctx.createLinearGradient(0, 0, 256, 0)
    side.addColorStop(0, 'rgba(0,0,0,1)')
    side.addColorStop(0.2, 'rgba(0,0,0,0)')
    side.addColorStop(0.8, 'rgba(0,0,0,0)')
    side.addColorStop(1, 'rgba(0,0,0,1)')
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = side
    ctx.fillRect(0, 0, 256, 128)
    ctx.globalCompositeOperation = 'source-over'
    return texture(el)
  })
}

/**
 * მაისურის ზურგი — სახელი რკალზე + ნომერი. Fira GO/Noto Sans Georgian
 * ქართულ და ლათინურ ასოებს ერთნაირად ფარავს. ერთი ტექსტურა ორივე
 * ხარისხის დონეზე საკმარისად მკვეთრია.
 */
export function jerseyTexture(name: string, num: string, kitColor: string): THREE.Texture {
  return memo(`jersey:${name}:${num}:${kitColor}`, () => {
    const W = 512
    const H = 512
    const [el, ctx] = canvas(W, H)

    ctx.fillStyle = kitColor
    ctx.fillRect(0, 0, W, H)
    // ქსოვილის ძალიან მსუბუქი ტონი, რომ ერთფეროვნად არ ბრწყინავდეს
    const rng = mulberry32(0x77f2a1)
    ctx.globalAlpha = 0.05
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = rng() < 0.5 ? '#000000' : '#ffffff'
      ctx.fillRect(rng() * W, rng() * H, 2, 2)
    }
    ctx.globalAlpha = 1

    const text = name.toUpperCase()
    ctx.fillStyle = PALETTE.chalk
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // სახელი — ოდნავ რკალზე გამოწყობილი, ასო-ასო
    const fontSize = Math.min(92, 380 / Math.max(1, text.length * 0.62))
    ctx.font = `800 ${fontSize}px "Fira GO", "Noto Sans Georgian", system-ui, sans-serif`
    const arcR = 620
    const arcY = 168 + arcR
    const widths = [...text].map((ch) => ctx.measureText(ch).width)
    const gap = fontSize * 0.08
    const total = widths.reduce((s, w) => s + w + gap, -gap)
    let acc = -total / 2
    for (let i = 0; i < text.length; i++) {
      const w = widths[i] ?? 0
      const centre = acc + w / 2
      const angle = centre / arcR
      ctx.save()
      ctx.translate(W / 2 + Math.sin(angle) * arcR, arcY - Math.cos(angle) * arcR)
      ctx.rotate(angle)
      ctx.fillText(text[i] ?? '', 0, 0)
      ctx.restore()
      acc += w + gap
    }

    // ნომერი
    ctx.font = `900 240px "Archivo", "Fira GO", system-ui, sans-serif`
    ctx.fillText(num, W / 2, 360)

    const t = texture(el, true)
    t.wrapS = THREE.ClampToEdgeWrapping
    t.wrapT = THREE.ClampToEdgeWrapping
    return t
  })
}
