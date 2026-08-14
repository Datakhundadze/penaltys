/**
 * ბურთის ტრაექტორია — უკვე გადაწყვეტილი შედეგის დეტერმინისტული გათამაშება.
 *
 * აქ არაფერი წყდება. `planFlight` იღებს დამთავრებულ `ShotResolution`-ს და
 * აბრუნებს გზას, რომელსაც render loop მხოლოდ კითხულობს (§4).
 * სუფთა ფუნქციები, three.js-ის გარეშე.
 */

import { BALL_RADIUS, BALL_START, GOAL_DEPTH, goalToWorld, type Vec3 } from './geometry'
import type { ShotResolution, ShotResult } from './physics'

export interface FlightPlan {
  readonly start: Vec3
  /** კარის სიბრტყეზე შეხების წერტილი */
  readonly impact: Vec3
  /** სად ჩერდება ბურთი შეხების შემდეგ */
  readonly rest: Vec3
  /** რკალის სიმაღლე ფრენის შუაში (მ) */
  readonly arc: number
  /** ფრენის დრო კარამდე (წმ) */
  readonly tBall: number
  /** შეხების შემდგომი მონაკვეთის ხანგრძლივობა (წმ) */
  readonly tail: number
  readonly result: ShotResult
}

const TAIL: Readonly<Record<ShotResult, number>> = {
  goal: 0.5,
  save: 0.4,
  rebound: 0.7,
  post: 0.6,
  out: 0.5,
}

export function planFlight(res: ShotResolution): FlightPlan {
  const target = goalToWorld(res.landing)
  const impact: Vec3 = { x: target.x, y: Math.max(BALL_RADIUS, target.y), z: 0 }
  const side = res.landing.x < 0 ? -1 : 1

  return {
    start: BALL_START,
    impact,
    rest: restingPoint(res.result, impact, side),
    // დაბალი დარტყმა მიწისძირა და ბრტყელია, მაღალი — რკალით ადის
    arc: 0.05 + 0.6 * Math.pow(Math.max(0, res.landing.y), 1.4),
    tBall: res.tBall,
    tail: TAIL[res.result],
    result: res.result,
  }
}

function restingPoint(result: ShotResult, impact: Vec3, side: number): Vec3 {
  switch (result) {
    case 'goal':
      // ბადეში შედის და ცვივა
      return { x: impact.x * 1.05, y: BALL_RADIUS, z: -GOAL_DEPTH + 0.35 }
    case 'out':
      // კარს გვერდით/ზემოთ ჩაუფრინდა და გაქრა
      return { x: impact.x * 1.6, y: Math.max(BALL_RADIUS, impact.y * 1.2), z: -6 }
    case 'post':
      // ბოძიდან გვერდზე ხტება — ვიზუალურად აღებას არ ჰგავს
      return { x: impact.x + side * 1.8, y: BALL_RADIUS, z: 2.6 }
    case 'save':
      // მეკარემ დაიჭირა
      return { x: impact.x, y: Math.max(BALL_RADIUS, impact.y - 0.25), z: 0.3 }
    case 'rebound':
      // მოიგერია, ბურთი ისევ თამაშშია
      return { x: impact.x + side * 2.4, y: BALL_RADIUS, z: 4.2 }
  }
}

export function flightDuration(plan: FlightPlan): number {
  return plan.tBall + plan.tail
}

function lerp(a: number, b: number, u: number): number {
  return a + (b - a) * u
}

/** ბურთის მდებარეობა დარტყმიდან t წამში */
export function sampleFlight(plan: FlightPlan, t: number): Vec3 {
  if (t <= 0) return plan.start

  if (t < plan.tBall) {
    const u = t / plan.tBall
    return {
      x: lerp(plan.start.x, plan.impact.x, u),
      y: lerp(plan.start.y, plan.impact.y, u) + plan.arc * Math.sin(Math.PI * u),
      z: lerp(plan.start.z, plan.impact.z, u),
    }
  }

  const u = Math.min(1, (t - plan.tBall) / plan.tail)
  // შეხების შემდეგ ენერგია სწრაფად ქრება
  const e = 1 - (1 - u) * (1 - u)
  const y = lerp(plan.impact.y, plan.rest.y, e)
  return {
    x: lerp(plan.impact.x, plan.rest.x, e),
    // ბოძსა და რიკოშეტზე ბურთი ერთხელ ხტება
    y:
      plan.result === 'post' || plan.result === 'rebound'
        ? y + Math.sin(Math.PI * u) * 0.45 * (1 - u)
        : y,
    z: lerp(plan.impact.z, plan.rest.z, e),
  }
}

/**
 * ბადის ტალღა შეხების წერტილიდან — 0-ზე მიდის დროთა განმავლობაში.
 * `elapsed` არის წამები შეხებიდან.
 */
export function netRipple(
  dx: number,
  dy: number,
  elapsed: number,
  strength: number,
  duration = 1.1,
): number {
  if (elapsed <= 0 || elapsed > duration) return 0
  const r = Math.sqrt(dx * dx + dy * dy)
  const wave = Math.sin(r * 5.5 - elapsed * 16)
  const spatial = Math.exp(-r * 1.6)
  const decay = Math.exp(-elapsed * 4.2) * (1 - elapsed / duration)
  return strength * wave * spatial * decay
}
