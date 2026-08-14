/**
 * კონტროლის მათემატიკა — ერთი მოსმა ატარებს ყველაფერს:
 * მიმართულება → aim, სიჩქარე აშვებისას → power, ხარისხი → timing.
 *
 * ფიზიკის ფორმულები და ხელმოწერები არ იცვლება — მხოლოდ ის, თუ საიდან
 * მოდის `timing` პარამეტრი: timing ზოლის ნაცვლად ახლა მოსმის ხარისხია.
 * სუფთა ფუნქციები, UI-სგან დამოუკიდებელი და ტესტირებადი.
 */

import { clamp, type Vec2 } from './physics'

/** დამიზნების რადიუსი ეკრანის მოკლე გვერდის წილად */
export const AIM_RADIUS_FRACTION = 0.3
/** ამაზე მოკლე მოსმა დარტყმად არ ჩაითვლება */
export const MIN_DRAG_FRACTION = 0.045

export interface Viewport {
  readonly width: number
  readonly height: number
}

export interface Swipe {
  readonly aim: Vec2
  readonly power: number
  /** მოსმა საკმარისად გრძელია, რომ დარტყმა იყოს? */
  readonly valid: boolean
}

/** ერთი მოსმის სრული ანალიზი — store-ში ეს ხვდება */
export interface AnalyzedSwipe extends Swipe {
  /** მოსმის ხარისხი ∈ [0,1] — ფიზიკის `timing` პარამეტრი */
  readonly quality: number
}

/** მოსმის ერთი წერტილი: ელემენტის პიქსელები + დრო მილიწამებში */
export interface SwipePoint {
  readonly x: number
  readonly y: number
  readonly t: number
}

function shortSide(v: Viewport): number {
  return Math.max(1, Math.min(v.width, v.height))
}

/**
 * მოსმის მიმართულება → დამიზნება ნორმალიზებულ კარის კოორდინატებში.
 * `dy` დადებითია ქვევით (ეკრანის კოორდინატები), ზევით მოსმა = კარში მაღლა.
 */
export function mapSwipe(dx: number, dy: number, viewport: Viewport): Swipe {
  const s = shortSide(viewport)
  const aimR = s * AIM_RADIUS_FRACTION
  const length = Math.sqrt(dx * dx + dy * dy)

  return {
    aim: {
      x: clamp(dx / aimR, -1, 1),
      y: Math.max(0, Math.min(1, -dy / aimR)),
    },
    power: 0,
    valid: length >= s * MIN_DRAG_FRACTION,
  }
}

// ─────────────────────────────────────────────────────────────
// სიჩქარე → ძალა
// ─────────────────────────────────────────────────────────────

/**
 * კომფორტული flick ≈ 2 ეკრანი/წმ → ≈0.7; ძალადობრივი მოსმა (≥3) → 1.0.
 * სიჩქარე იზომება ეკრანის მოკლე გვერდის ერთეულებში, რომ ყველა
 * ეკრანზე ერთნაირად იგრძნობოდეს.
 */
export const POWER_FULL_SPEED = 2.9
/** ბოლო რამდენი მილიწამი ითვლება „აშვების სიჩქარედ" */
export const RELEASE_WINDOW_MS = 90

export function speedToPower(screensPerSecond: number): number {
  return clamp(Math.pow(Math.max(0, screensPerSecond) / POWER_FULL_SPEED, 0.85), 0, 1)
}

/** აშვების სიჩქარე — ბოლო ფანჯრის საშუალო, პიქსელი/წმ */
export function releaseSpeed(points: readonly SwipePoint[]): number {
  if (points.length < 2) return 0
  const last = points[points.length - 1]
  if (!last) return 0
  let i = points.length - 2
  while (i > 0 && last.t - (points[i]?.t ?? 0) < RELEASE_WINDOW_MS) i--
  const from = points[i]
  if (!from) return 0
  const dt = (last.t - from.t) / 1000
  if (dt <= 0) return 0
  return Math.hypot(last.x - from.x, last.y - from.y) / dt
}

// ─────────────────────────────────────────────────────────────
// მოსმის ხარისხი — ფიზიკის `timing` პარამეტრი
// ─────────────────────────────────────────────────────────────

/**
 * ხარისხი = გზის სისწორე × (სიჩქარის მრუდის სიგლუვე + ტემპი).
 *
 * - სისწორე: გვერდითი გადახრა მთავარი მიმართულებიდან, სიგრძესთან
 *   შეფარდებით. ზიგზაგი მკვეთრად ჯარიმდება.
 * - სიგლუვე: მეზობელ სეგმენტებს შორის სიჩქარის ნახტომები (ჩქამი).
 * - ტემპი: მთლიანი ხანგრძლივობა — თავდაჯერებული flick მოკლეა;
 *   გაწელილი ხოხვა ვერასდროს იქნება „სუფთა".
 *
 * თავდაჯერებული სუფთა flick ≈ 0.9+, მოკანკალე ზიგზაგი ≈ 0.3.
 */
export function swipeQuality(points: readonly SwipePoint[]): number {
  if (points.length < 3) return 0.3
  const a = points[0]
  const b = points[points.length - 1]
  if (!a || !b) return 0

  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  const dur = (b.t - a.t) / 1000
  if (len < 1e-6 || dur <= 0) return 0

  // ── სისწორე ──
  const ux = dx / len
  const uy = dy / len
  let devSum = 0
  let devMax = 0
  for (const p of points) {
    const px = p.x - a.x
    const py = p.y - a.y
    const d = Math.abs(px * uy - py * ux)
    devSum += d
    if (d > devMax) devMax = d
  }
  const meanDev = devSum / points.length
  const straight = clamp(1 - (meanDev / len) * 16 - (devMax / len) * 4, 0, 1)

  // ── სიჩქარის მრუდის სიგლუვე ──
  const speeds: number[] = []
  for (let i = 1; i < points.length; i++) {
    const p = points[i]
    const q = points[i - 1]
    if (!p || !q) continue
    const dt = (p.t - q.t) / 1000
    if (dt <= 0) continue
    speeds.push(Math.hypot(p.x - q.x, p.y - q.y) / dt)
  }
  if (speeds.length === 0) return 0
  const mean = speeds.reduce((s, v) => s + v, 0) / speeds.length
  let jump = 0
  for (let i = 1; i < speeds.length; i++) {
    jump += Math.abs((speeds[i] ?? 0) - (speeds[i - 1] ?? 0))
  }
  jump /= Math.max(1, speeds.length - 1) * Math.max(mean, 1e-6)
  const smooth = clamp(1 - jump * 0.8, 0, 1)

  // ── ტემპი ──
  // ≤0.55წმ სრული ქულა; 1.4წმ-ზე გაწელილი — თითქმის ნული
  const pace = clamp((1.4 - dur) / 0.85, 0, 1)

  const q = Math.pow(straight, 0.8) * (0.45 * smooth + 0.55 * pace)
  // ძალიან ნელი ხოხვა ვერასდროს არის კარგი, რაც არ უნდა სწორი იყოს
  const crawlCap = dur > 1.1 ? 0.35 : 1
  return clamp(Math.min(q, crawlCap), 0, 1)
}

/** სრული ანალიზი აშვებისას */
export function analyzeSwipe(points: readonly SwipePoint[], viewport: Viewport): AnalyzedSwipe {
  const a = points[0]
  const b = points[points.length - 1]
  if (!a || !b) return { aim: { x: 0, y: 0 }, power: 0, quality: 0, valid: false }

  const base = mapSwipe(b.x - a.x, b.y - a.y, viewport)
  const power = speedToPower(releaseSpeed(points) / shortSide(viewport))
  return { ...base, power, quality: swipeQuality(points) }
}

/**
 * როცა მოთამაშე კარშია, იგივე მოსმა დივის მომენტს წყვეტს.
 * ცუდი ხარისხი = ადრე დაწოლა და §5-ის −0.15 ჯარიმა.
 */
export function keeperCommitTime(quality: number, tBall: number): number {
  return tBall * clamp(0.35 + 0.7 * clamp(quality, 0, 1), 0, 1)
}

/** უკუკავშირის ზღვრები — „სუფთა დარტყმა" და „მერყევი მოსმა" */
export const QUALITY_CLEAN = 0.85
export const QUALITY_SHAKY = 0.35
