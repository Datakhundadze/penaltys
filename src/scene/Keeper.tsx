import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import { PALETTE } from '../lib/palette'
import { GOAL_HALF_WIDTH, GOAL_HEIGHT } from '../lib/geometry'
import type { ShotResult, Vec2 } from '../lib/physics'
import { Figure, type FigureHandle } from './Figure'
import { KEEPER_NAME, KEEPER_NUMBER } from '../game/names'
import { NEUTRAL, clonePose, easeInCubic, easeOutBack, easeOutCubic, lerpPose, type Pose } from './pose'

/**
 * მეკარე.
 *
 * ძირითადი ინტერფეისი უცვლელია (dive + progress); ფაზა 3-ში შიგთავსი
 * იცვლება glTF ავატარით. მოძრაობის ფაზები:
 *
 *   progress ≤ 0   მზადყოფნა — ცოცხალი წონის გადატანა ფეხიდან ფეხზე
 *   anticipation   ჩაჯდომა ღრმავდება ერთი დარტყმით დივის წინ
 *   0 → 1          დივი მიზნისკენ: დაბალი კუთხე — გაშლა მიწისკენ,
 *                  მაღალი — გაჭიმვა ჰაერში
 *   1 → 2          დაშვება: დაბალზე გადაგორება, მაღალზე ჩამოჯდომა
 *   hold           შედეგის ეკრანზე: აღებაზე ბურთს ეხვევა, მოგერიებაზე
 *                  ხელები გაშვერილი რჩება
 *
 * ყველაფერი resolveShot-ის შედეგით იმართება — აქ არაფერი წყდება.
 */
export interface KeeperProps {
  /** დივის სამიზნე ნორმალიზებულ კარის კოორდინატებში */
  dive: Vec2
  /** დივის პროგრესი: 0 — დგას, 1 — გაწვდილი, >1 — დაშვება/დაჯდომა */
  progress: number
  /** ფეხების მოძრაობა დგომისას */
  idle?: boolean
  /** §8 — ცივი ლურჯი ყოველთვის მეკარეა */
  color?: string
  /** ჩაჯდომის გაღრმავება დივის წინ, 0..1 */
  anticipation?: number
  /** რაუნდის შედეგი — დაშვების პოზას არჩევს (აღება/მოგერიება) */
  outcome?: ShotResult | null
  /** გოლი ძლივს ასცდა ხელს — თითის წვერებზე გაჭიმული რჩება */
  nearMiss?: boolean
}

// ─── პოზები ─────────────────────────────────────────────────

/** მზადყოფნა — დაბალი ჩაჯდომა, ხელები წინ */
const READY: Pose = {
  ...clonePose(NEUTRAL),
  pelvisY: -0.18,
  torso: [0.38, 0, 0],
  head: [-0.28, 0, 0],
  shoulderL: [0.95, 0.5],
  elbowL: 1.35,
  shoulderR: [0.95, -0.5],
  elbowR: 1.35,
  hipL: [-0.5, 0.14],
  kneeL: 0.85,
  hipR: [-0.5, -0.14],
  kneeR: 0.85,
}

/** ღრმა ჩაჯდომა — ზამბარა იჭიმება დივის წინ */
const COILED: Pose = {
  ...clonePose(NEUTRAL),
  pelvisY: -0.3,
  torso: [0.52, 0, 0],
  head: [-0.4, 0, 0],
  shoulderL: [0.7, 0.6],
  elbowL: 1.5,
  shoulderR: [0.7, -0.6],
  elbowR: 1.5,
  hipL: [-0.75, 0.16],
  kneeL: 1.15,
  hipR: [-0.75, -0.16],
  kneeR: 1.15,
}

/** გაწვდილი დივი მაღალ კუთხეში — მთელი სხეული ერთ ხაზზეა */
const STRETCH: Pose = {
  ...clonePose(NEUTRAL),
  pelvisY: 0,
  torso: [0.05, 0, 0],
  head: [0, 0, 0],
  shoulderL: [2.6, 0.35],
  elbowL: 0.15,
  shoulderR: [2.6, -0.35],
  elbowR: 0.15,
  hipL: [0.15, 0.1],
  kneeL: 0.25,
  hipR: [-0.2, -0.1],
  kneeR: 0.45,
}

/** დაბალი დივი — ხელები წინ მიწისკენ */
const LOW_DIVE: Pose = {
  ...clonePose(NEUTRAL),
  pelvisY: -0.1,
  torso: [0.25, 0, 0],
  shoulderL: [1.9, 0.5],
  elbowL: 0.3,
  shoulderR: [1.9, -0.5],
  elbowR: 0.3,
  hipL: [-0.35, 0.12],
  kneeL: 0.8,
  hipR: [0.1, -0.12],
  kneeR: 0.5,
}

/** დაბალი დაშვება — გადაგორება, ფეხები იკეცება */
const LOW_LAND: Pose = {
  ...clonePose(NEUTRAL),
  pelvisY: -0.06,
  torso: [0.35, 0.15, 0],
  head: [0.1, 0, 0],
  shoulderL: [1.5, 0.4],
  elbowL: 0.7,
  shoulderR: [1.6, -0.4],
  elbowR: 0.6,
  hipL: [-0.7, 0.1],
  kneeL: 1.1,
  hipR: [-0.3, -0.1],
  kneeR: 0.9,
}

/** აღება — ბურთს ეხვევა */
const HOLD_BALL: Pose = {
  ...clonePose(NEUTRAL),
  pelvisY: -0.08,
  torso: [0.45, 0, 0],
  head: [0.15, 0, 0],
  shoulderL: [1.35, 0.15],
  elbowL: 1.6,
  shoulderR: [1.35, -0.15],
  elbowR: 1.6,
  hipL: [-0.6, 0.1],
  kneeL: 1.0,
  hipR: [-0.4, -0.1],
  kneeR: 0.85,
}

/** მოგერიება — ხელები გაშვერილი რჩება */
const PARRY: Pose = {
  ...clonePose(NEUTRAL),
  pelvisY: -0.05,
  torso: [0.2, 0, 0],
  head: [0, 0, 0],
  shoulderL: [2.3, 0.55],
  elbowL: 0.1,
  shoulderR: [2.4, -0.45],
  elbowR: 0.1,
  hipL: [-0.3, 0.12],
  kneeL: 0.7,
  hipR: [0, -0.1],
  kneeR: 0.5,
}

const STANCE_Z = 0.35

export function Keeper({
  dive,
  progress,
  idle = true,
  color = PALETTE.floodlight,
  anticipation = 0,
  outcome = null,
  nearMiss = false,
}: KeeperProps) {
  const group = useRef<THREE.Group>(null)
  const fig = useRef<FigureHandle>(null)
  const scratch = useMemo(() => clonePose(NEUTRAL), [])
  const scratch2 = useMemo(() => clonePose(NEUTRAL), [])

  useFrame(({ clock }) => {
    const g = group.current
    if (!g || !fig.current) return

    const targetX = dive.x * GOAL_HALF_WIDTH
    const targetY = dive.y * GOAL_HEIGHT
    const low = targetY < 0.55
    const side = Math.sign(targetX) || 1

    if (progress <= 0) {
      // მზადყოფნა: წონა ფეხიდან ფეხზე, ხელები ცოცხალი; დივის წინ
      // ჩაჯდომა ღრმავდება (anticipation)
      const t = idle ? clock.elapsedTime : 0
      const sway = Math.sin(t * 2.1)
      const breathe = 0.03 + Math.abs(Math.sin(t * 1.1)) * 0.03
      lerpPose(READY, STRETCH, breathe, scratch)
      // წონის გადატანა: მენჯი გვერდზე, მხრები საპირისპიროდ
      scratch.root[2] = sway * 0.05
      scratch.hipL[1] = (scratch.hipL[1] ?? 0) + sway * 0.05
      scratch.hipR[1] = (scratch.hipR[1] ?? 0) + sway * 0.05
      scratch.shoulderL[1] = (scratch.shoulderL[1] ?? 0) - sway * 0.06
      scratch.shoulderR[1] = (scratch.shoulderR[1] ?? 0) - sway * 0.06
      // ხელების მიკრო-მოძრაობა — მზადაა, არა გაშეშებული
      scratch.elbowL += Math.sin(t * 3.3) * 0.06
      scratch.elbowR += Math.sin(t * 3.3 + 1.2) * 0.06

      if (anticipation > 0) {
        lerpPose(scratch, COILED, easeInCubic(anticipation), scratch2)
        fig.current.apply(scratch2)
      } else {
        fig.current.apply(scratch)
      }
      g.position.set(sway * 0.07, 0, STANCE_Z)
      g.rotation.set(0, 0, 0)
      return
    }

    const p = Math.min(1, progress)
    // easeOutBack — გაწვდომას ინერციული გადავარდნა აქვს, წრფივი არ არის
    const e = Math.min(1, easeOutBack(p) * 0.97 + p * 0.03)
    /** დაშვების ფაზა: progress 1 → 2 */
    const land = easeOutCubic(Math.max(0, Math.min(1, progress - 1)))

    // დივი ღრმა ჩაჯდომიდან იწყება — ზამბარა ჯერ იჭიმება
    const from = anticipation > 0 || progress > 0 ? COILED : READY
    lerpPose(from, low ? LOW_DIVE : STRETCH, e, scratch)

    let pose = scratch
    if (land > 0) {
      // დაშვება: დაბალზე გადაგორება, მაღალზეც ჩამოშვება; შედეგი პოზას არჩევს
      const settle =
        outcome === 'save'
          ? HOLD_BALL
          : outcome === 'rebound'
            ? PARRY
            : outcome === 'goal' && nearMiss
              ? STRETCH // თითის წვერებზე — ძლივს ვერ მისწვდა
              : low
                ? LOW_LAND
                : PARRY
      lerpPose(scratch, settle, land, scratch2)
      pose = scratch2
    }

    // თავი ბურთისკენ
    pose.head[2] = -side * 0.3 * e * (1 - land * 0.5)
    fig.current.apply(pose)

    // სხეული მიზნისკენ; დაშვებაზე მიწაზე რჩება
    const reachY = low ? -0.1 * e : Math.max(0, targetY - 1.1) * e * 0.65 * (1 - land * 0.85)
    const roll = low ? land * 0.55 : 0
    g.position.set(targetX * e * 0.82, reachY, STANCE_Z)
    g.rotation.set(
      (low ? 0.12 * e : 0) + roll * 0.4,
      -side * (0.25 * e + roll * 0.5),
      -side * (e * (low ? 1.35 : 0.95) + roll * 0.15),
    )
  })

  return (
    <group ref={group} position={[0, 0, STANCE_Z]}>
      <Figure ref={fig} kit={color} gloves name={KEEPER_NAME} number={KEEPER_NUMBER} />
      <mesh position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        <circleGeometry args={[0.42, 18]} />
        <meshBasicMaterial color={PALETTE.night} transparent opacity={0.3} depthWrite={false} />
      </mesh>
    </group>
  )
}
