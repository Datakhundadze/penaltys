/**
 * პოზის ტიპი და ინტერპოლაცია — Figure-ისგან ცალკე, რომ კომპონენტის
 * ფაილში მხოლოდ კომპონენტი დარჩეს.
 */

export interface Pose {
  /** მენჯის სიმაღლის წანაცვლება ნეიტრალურიდან (მ) — ჩაჯდომა/ახტომა */
  pelvisY: number
  /** მთელი სხეულის დახრა [x, y, z] */
  root: [number, number, number]
  torso: [number, number, number]
  head: [number, number, number]
  /** მხრები [x, z] და იდაყვის მოხრა */
  shoulderL: [number, number]
  elbowL: number
  shoulderR: [number, number]
  elbowR: number
  /** თეძოები [x, z] და მუხლის მოხრა */
  hipL: [number, number]
  kneeL: number
  hipR: [number, number]
  kneeR: number
}

export const NEUTRAL: Pose = {
  pelvisY: 0,
  root: [0, 0, 0],
  torso: [0, 0, 0],
  head: [0, 0, 0],
  shoulderL: [0.08, 0.1],
  elbowL: 0.25,
  shoulderR: [0.08, -0.1],
  elbowR: 0.25,
  hipL: [0, 0.03],
  kneeL: 0.08,
  hipR: [0, -0.03],
  kneeR: 0.08,
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function lerpPose(a: Pose, b: Pose, t: number, out: Pose): Pose {
  out.pelvisY = lerp(a.pelvisY, b.pelvisY, t)
  for (let i = 0; i < 3; i++) {
    out.root[i] = lerp(a.root[i] ?? 0, b.root[i] ?? 0, t)
    out.torso[i] = lerp(a.torso[i] ?? 0, b.torso[i] ?? 0, t)
    out.head[i] = lerp(a.head[i] ?? 0, b.head[i] ?? 0, t)
  }
  for (let i = 0; i < 2; i++) {
    out.shoulderL[i] = lerp(a.shoulderL[i] ?? 0, b.shoulderL[i] ?? 0, t)
    out.shoulderR[i] = lerp(a.shoulderR[i] ?? 0, b.shoulderR[i] ?? 0, t)
    out.hipL[i] = lerp(a.hipL[i] ?? 0, b.hipL[i] ?? 0, t)
    out.hipR[i] = lerp(a.hipR[i] ?? 0, b.hipR[i] ?? 0, t)
  }
  out.elbowL = lerp(a.elbowL, b.elbowL, t)
  out.elbowR = lerp(a.elbowR, b.elbowR, t)
  out.kneeL = lerp(a.kneeL, b.kneeL, t)
  out.kneeR = lerp(a.kneeR, b.kneeR, t)
  return out
}

export function clonePose(p: Pose): Pose {
  return JSON.parse(JSON.stringify(p)) as Pose
}

