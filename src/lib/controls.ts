/**
 * კონტროლის მათემატიკა — swipe → დამიზნება/ძალა, timing ზოლი → ხარისხი.
 * სუფთა ფუნქციები, რომ ტესტირებადი იყოს და UI-სგან დამოუკიდებელი.
 */

import { clamp, type Vec2 } from './physics'

/** დამიზნების რადიუსი ეკრანის მოკლე გვერდის წილად */
export const AIM_RADIUS_FRACTION = 0.3
/** სრული ძალის რადიუსი ეკრანის მოკლე გვერდის წილად */
export const POWER_RADIUS_FRACTION = 0.18
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

function shortSide(v: Viewport): number {
  return Math.max(1, Math.min(v.width, v.height))
}

/**
 * მოსმა → დამიზნება და ძალა.
 *
 * `dx`/`dy` პიქსელებია ეკრანის კოორდინატებში (dy დადებითია ქვევით).
 * მიმართულება წყვეტს სად მიდის ბურთი, სიგრძე — რამდენად ძლიერად.
 * ძალა ადრე ივსება, ვიდრე დამიზნება კიდეს აღწევს, ასე რომ სრული
 * ძალის შენარჩუნებით კარის დიდ ნაწილში მიზნის არჩევა შეიძლება.
 */
export function mapSwipe(dx: number, dy: number, viewport: Viewport): Swipe {
  const s = shortSide(viewport)
  const aimR = s * AIM_RADIUS_FRACTION
  const powerR = s * POWER_RADIUS_FRACTION
  const length = Math.sqrt(dx * dx + dy * dy)

  return {
    aim: {
      x: clamp(dx / aimR, -1, 1),
      // ეკრანზე ზევით = კარში მაღლა (Math.max აშორებს −0-ს)
      y: Math.max(0, Math.min(1, -dy / aimR)),
    },
    power: clamp(length / powerR, 0, 1),
    valid: length >= s * MIN_DRAG_FRACTION,
  }
}

/** timing ზოლის სრულყოფილი ზონის ნახევარსიგანე */
export const TIMING_PERFECT_BAND = 0.075
/** მარკერის სრული მოძრაობის პერიოდი (წმ) */
export const TIMING_PERIOD = 1.15

/** მარკერის პოზიცია 0..1 — სამკუთხა ტალღა, თანაბარი სიჩქარით */
export function markerPosition(elapsed: number, period = TIMING_PERIOD): number {
  const phase = ((elapsed / period) % 1 + 1) % 1
  return phase < 0.5 ? phase * 2 : 2 - phase * 2
}

/** მარკერის პოზიცია → timing ∈ [0,1], ცენტრი საუკეთესოა */
export function timingQuality(marker: number): number {
  return clamp(1 - Math.abs(clamp(marker, 0, 1) - 0.5) / 0.5, 0, 1)
}

/** მოხვდა თუ არა სრულყოფილ ზონაში (§6 „ცივი სისხლი") */
export function isPerfectTiming(marker: number): boolean {
  return Math.abs(marker - 0.5) <= TIMING_PERFECT_BAND
}

/**
 * როცა მოთამაშე კარშია, იგივე ზოლი დივის მომენტს წყვეტს.
 * ცუდი ხარისხი = ადრე დაწოლა და §5-ის −0.15 ჯარიმა.
 */
export function keeperCommitTime(quality: number, tBall: number): number {
  return tBall * clamp(0.35 + 0.7 * clamp(quality, 0, 1), 0, 1)
}
