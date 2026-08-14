/**
 * მოედნის გეომეტრია — ნორმალიზებული კარის კოორდინატებიდან სამყაროში.
 * სუფთა რიცხვები, three.js-ის გარეშე.
 */

import type { Vec2 } from './physics'

/** კარის სიგანე (მ) — FIFA */
export const GOAL_WIDTH = 7.32
export const GOAL_HALF_WIDTH = GOAL_WIDTH / 2
/** კარის სიმაღლე (მ) */
export const GOAL_HEIGHT = 2.44
/** ბადის სიღრმე (მ) */
export const GOAL_DEPTH = 2.0
/** ბოძის რადიუსი (მ) */
export const POST_RADIUS = 0.06
/** ბურთის რადიუსი (მ) */
export const BALL_RADIUS = 0.11
/** პენალტის წერტილი კარის ხაზიდან (მ) */
export const PENALTY_SPOT_Z = 11
/** საჯარიმო მოედანი */
export const PENALTY_BOX_DEPTH = 16.5
export const PENALTY_BOX_HALF_WIDTH = 20.16
export const GOAL_AREA_DEPTH = 5.5
export const GOAL_AREA_HALF_WIDTH = 9.16
export const LINE_WIDTH = 0.12

export interface Vec3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

/** ნორმალიზებული კარის წერტილი → სამყაროს კოორდინატები (კარის სიბრტყეზე) */
export function goalToWorld(p: Vec2): Vec3 {
  return { x: p.x * GOAL_HALF_WIDTH, y: p.y * GOAL_HEIGHT, z: 0 }
}

/** სამყაროს კოორდინატები → ნორმალიზებული კარის წერტილი */
export function worldToGoal(x: number, y: number): Vec2 {
  return { x: x / GOAL_HALF_WIDTH, y: y / GOAL_HEIGHT }
}

export function toTuple(v: Vec3): [number, number, number] {
  return [v.x, v.y, v.z]
}

/** ბურთის საწყისი მდებარეობა */
export const BALL_START: Vec3 = { x: 0, y: BALL_RADIUS, z: PENALTY_SPOT_Z }
