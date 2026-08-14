import { describe, expect, it } from 'vitest'
import {
  analyzeSwipe,
  keeperCommitTime,
  mapSwipe,
  releaseSpeed,
  speedToPower,
  swipeQuality,
  type SwipePoint,
} from './controls'
import { EARLY_COMMIT_MARGIN, ballFlightTime, isEarlyCommit } from './physics'

const desktop = { width: 1280, height: 800 }
const phone = { width: 380, height: 780 }

/** სინთეზური მოსმა: სწორი ხაზი, სუფთა აჩქარება */
function cleanFlick(
  length = 300,
  durationMs = 240,
  steps = 14,
  angleRad = -Math.PI / 2,
): SwipePoint[] {
  const pts: SwipePoint[] = []
  for (let i = 0; i <= steps; i++) {
    const u = i / steps
    // ease-in — flick აჩქარებით მთავრდება
    const d = length * u * u
    pts.push({
      x: 200 + Math.cos(angleRad) * d,
      y: 600 + Math.sin(angleRad) * d,
      t: durationMs * u,
    })
  }
  return pts
}

describe('mapSwipe (aim)', () => {
  it('sends an upward swipe high and central', () => {
    const s = mapSwipe(0, -400, desktop)
    expect(s.aim.x).toBeCloseTo(0, 6)
    expect(s.aim.y).toBe(1)
  })

  it('sends a sideways swipe to the matching post, along the ground', () => {
    expect(mapSwipe(400, 0, desktop).aim.x).toBe(1)
    expect(mapSwipe(400, 0, desktop).aim.y).toBe(0)
    expect(mapSwipe(-400, 0, desktop).aim.x).toBe(-1)
  })

  it('never aims below the ground line', () => {
    expect(mapSwipe(30, 200, desktop).aim.y).toBe(0)
  })

  it('rejects a tap as too short to be a shot', () => {
    expect(mapSwipe(4, -6, phone).valid).toBe(false)
    expect(mapSwipe(0, -90, phone).valid).toBe(true)
  })
})

describe('speedToPower', () => {
  it('maps a comfortable flick (~2 screens/s) to ≈0.7', () => {
    const p = speedToPower(2)
    expect(p).toBeGreaterThan(0.6)
    expect(p).toBeLessThan(0.8)
  })

  it('saturates at 1 for a violent swipe', () => {
    expect(speedToPower(3)).toBe(1)
    expect(speedToPower(6)).toBe(1)
  })

  it('gives little power to a slow push', () => {
    expect(speedToPower(0.5)).toBeLessThan(0.3)
    expect(speedToPower(0)).toBe(0)
  })

  it('is monotonic', () => {
    expect(speedToPower(1)).toBeLessThan(speedToPower(2))
    expect(speedToPower(2)).toBeLessThan(speedToPower(2.8))
  })
})

describe('releaseSpeed', () => {
  it('measures the speed of the final window, not the whole drag', () => {
    // ნელი დასაწყისი, სწრაფი დასასრული — flick-ის ტიპური პროფილი
    const pts: SwipePoint[] = [
      { x: 0, y: 0, t: 0 },
      { x: 10, y: 0, t: 300 },
      { x: 20, y: 0, t: 600 },
      { x: 120, y: 0, t: 650 },
      { x: 260, y: 0, t: 700 },
    ]
    // ბოლო 100მწმ-ში ≈240px → ≈2400px/წმ
    expect(releaseSpeed(pts)).toBeGreaterThan(1800)
  })

  it('is zero for a single point', () => {
    expect(releaseSpeed([{ x: 0, y: 0, t: 0 }])).toBe(0)
  })
})

describe('swipeQuality', () => {
  it('rates a perfectly straight fast swipe high', () => {
    expect(swipeQuality(cleanFlick())).toBeGreaterThan(0.85)
  })

  it('rates a zigzag low', () => {
    const pts = cleanFlick().map((p, i) => ({ ...p, x: p.x + (i % 2 === 0 ? 22 : -22) }))
    expect(swipeQuality(pts)).toBeLessThan(0.4)
  })

  it('rates a too-slow crawl low, even a straight one', () => {
    expect(swipeQuality(cleanFlick(300, 1600))).toBeLessThan(0.4)
  })

  it('punishes a stuttering speed curve', () => {
    // იგივე გზა, მაგრამ დრო კრთება: სწრაფი-გაჩერდი-სწრაფი
    const stutter = cleanFlick().map((p, i) => ({
      ...p,
      t: p.t + (i % 3 === 0 ? 55 : 0),
    }))
    expect(swipeQuality(stutter)).toBeLessThan(swipeQuality(cleanFlick()))
  })

  it('is direction-independent', () => {
    const up = swipeQuality(cleanFlick(300, 240, 14, -Math.PI / 2))
    const diagonal = swipeQuality(cleanFlick(300, 240, 14, -Math.PI / 3))
    expect(Math.abs(up - diagonal)).toBeLessThan(0.05)
  })

  it('stays in [0,1] on degenerate input', () => {
    expect(swipeQuality([])).toBeLessThanOrEqual(1)
    expect(swipeQuality([{ x: 0, y: 0, t: 0 }])).toBeLessThanOrEqual(1)
    const q = swipeQuality([
      { x: 0, y: 0, t: 0 },
      { x: 0, y: 0, t: 10 },
      { x: 0, y: 0, t: 20 },
    ])
    expect(q).toBeGreaterThanOrEqual(0)
    expect(q).toBeLessThanOrEqual(1)
  })
})

describe('analyzeSwipe', () => {
  it('combines aim, speed power and quality from one gesture', () => {
    // მოსმა ზევით 300px 240მწმ-ში 780px ეკრანზე
    const pts = cleanFlick(300, 240)
    const s = analyzeSwipe(pts, phone)
    expect(s.valid).toBe(true)
    expect(s.aim.y).toBeGreaterThan(0.5)
    expect(Math.abs(s.aim.x)).toBeLessThan(0.15)
    expect(s.power).toBeGreaterThan(0.5)
    expect(s.quality).toBeGreaterThan(0.85)
  })

  it('marks a tiny gesture invalid', () => {
    const pts: SwipePoint[] = [
      { x: 0, y: 0, t: 0 },
      { x: 2, y: -3, t: 40 },
      { x: 4, y: -6, t: 80 },
    ]
    expect(analyzeSwipe(pts, phone).valid).toBe(false)
  })

  it('gives a violent flick full power', () => {
    const pts = cleanFlick(430, 130)
    expect(analyzeSwipe(pts, phone).power).toBe(1)
  })
})

describe('keeperCommitTime', () => {
  const tBall = ballFlightTime(40)

  it('turns bad quality into an early commit and good quality into a late one', () => {
    expect(isEarlyCommit(keeperCommitTime(0, tBall), tBall)).toBe(true)
    expect(isEarlyCommit(keeperCommitTime(1, tBall), tBall)).toBe(false)
  })

  it('never commits after the ball has arrived', () => {
    for (const q of [0, 0.25, 0.5, 0.75, 1]) {
      expect(keeperCommitTime(q, tBall)).toBeLessThanOrEqual(tBall)
    }
  })

  it('is monotonic in quality', () => {
    expect(keeperCommitTime(0.2, tBall)).toBeLessThan(keeperCommitTime(0.8, tBall))
  })

  it('leaves a middling swipe safely past the penalty threshold', () => {
    expect(keeperCommitTime(0.5, tBall)).toBeGreaterThan(tBall - EARLY_COMMIT_MARGIN)
  })
})
