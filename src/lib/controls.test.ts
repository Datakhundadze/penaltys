import { describe, expect, it } from 'vitest'
import {
  TIMING_PERIOD,
  isPerfectTiming,
  keeperCommitTime,
  mapSwipe,
  markerPosition,
  timingQuality,
} from './controls'
import { EARLY_COMMIT_MARGIN, ballFlightTime, isEarlyCommit } from './physics'

const desktop = { width: 1280, height: 800 }
const phone = { width: 380, height: 780 }

describe('mapSwipe', () => {
  it('sends an upward swipe high and central', () => {
    const s = mapSwipe(0, -400, desktop)
    expect(s.aim.x).toBeCloseTo(0, 6)
    expect(s.aim.y).toBe(1)
    expect(s.power).toBe(1)
  })

  it('sends a sideways swipe to the matching post, along the ground', () => {
    const right = mapSwipe(400, 0, desktop)
    expect(right.aim.x).toBe(1)
    expect(right.aim.y).toBe(0)
    expect(mapSwipe(-400, 0, desktop).aim.x).toBe(-1)
  })

  it('never aims below the ground line', () => {
    expect(mapSwipe(30, 200, desktop).aim.y).toBe(0)
  })

  it('scales power with drag length and saturates', () => {
    expect(mapSwipe(0, -40, desktop).power).toBeLessThan(mapSwipe(0, -120, desktop).power)
    expect(mapSwipe(0, -5000, desktop).power).toBe(1)
  })

  it('reaches full power before the aim runs out of room', () => {
    // ერთი და იგივე მიმართულებით სრული ძალა უფრო ადრე დგება, ვიდრე კიდე
    const s = mapSwipe(0.2 * 800, -0.02 * 800, desktop)
    expect(s.power).toBe(1)
    expect(Math.abs(s.aim.x)).toBeLessThan(1)
  })

  it('rejects a tap as too short to be a shot', () => {
    expect(mapSwipe(4, -6, phone).valid).toBe(false)
    expect(mapSwipe(0, -90, phone).valid).toBe(true)
  })

  it('keeps the same gesture equivalent across viewports', () => {
    const a = mapSwipe(0.15 * 800, 0, desktop)
    const b = mapSwipe(0.15 * 380, 0, phone)
    expect(a.aim.x).toBeCloseTo(b.aim.x, 6)
    expect(a.power).toBeCloseTo(b.power, 6)
  })
})

describe('timing bar', () => {
  it('sweeps 0 -> 1 -> 0 over one period', () => {
    expect(markerPosition(0)).toBeCloseTo(0, 6)
    expect(markerPosition(TIMING_PERIOD / 2)).toBeCloseTo(1, 6)
    expect(markerPosition(TIMING_PERIOD)).toBeCloseTo(0, 6)
    expect(markerPosition(TIMING_PERIOD * 2.25)).toBeCloseTo(0.5, 6)
  })

  it('stays inside the bar for any elapsed time', () => {
    for (let t = 0; t < 12; t += 0.017) {
      const m = markerPosition(t)
      expect(m).toBeGreaterThanOrEqual(0)
      expect(m).toBeLessThanOrEqual(1)
    }
  })

  it('rewards the centre and punishes the edges', () => {
    expect(timingQuality(0.5)).toBe(1)
    expect(timingQuality(0)).toBe(0)
    expect(timingQuality(1)).toBe(0)
    expect(timingQuality(0.35)).toBeCloseTo(0.7, 6)
  })

  it('marks only a narrow centre band as perfect', () => {
    expect(isPerfectTiming(0.5)).toBe(true)
    expect(isPerfectTiming(0.56)).toBe(true)
    expect(isPerfectTiming(0.7)).toBe(false)
  })
})

describe('keeperCommitTime', () => {
  const tBall = ballFlightTime(40)

  it('turns bad timing into an early commit and good timing into a late one', () => {
    expect(isEarlyCommit(keeperCommitTime(0, tBall), tBall)).toBe(true)
    expect(isEarlyCommit(keeperCommitTime(1, tBall), tBall)).toBe(false)
  })

  it('never commits after the ball has arrived', () => {
    for (const q of [0, 0.25, 0.5, 0.75, 1]) {
      expect(keeperCommitTime(q, tBall)).toBeLessThanOrEqual(tBall)
    }
  })

  it('is monotonic in timing quality', () => {
    expect(keeperCommitTime(0.2, tBall)).toBeLessThan(keeperCommitTime(0.8, tBall))
  })

  it('leaves a middling stop safely past the penalty threshold', () => {
    expect(keeperCommitTime(0.5, tBall)).toBeGreaterThan(tBall - EARLY_COMMIT_MARGIN)
  })
})
