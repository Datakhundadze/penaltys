import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import { PALETTE } from '../lib/palette'
import { GOAL_HALF_WIDTH, GOAL_HEIGHT } from '../lib/geometry'
import type { Vec2 } from '../lib/physics'
import { Figure, type FigureHandle } from './Figure'
import { NEUTRAL, clonePose, lerpPose, type Pose } from './pose'

/**
 * მეკარე.
 *
 * ინტერფეისი უცვლელია ფაზა 0-დან: dive + progress. ფაზა 3-ში შიგთავსი
 * იცვლება glTF ავატარით, გარეთა კონტრაქტი რჩება.
 *
 * პოზები: მზადყოფნის ჩაჯდომა → გაწვდილი დივი → დაშვება/დაჯდომა.
 * დივის მიმართულებას resolveShot-ის შედეგი კარნახობს — აქ არაფერი წყდება.
 */
export interface KeeperProps {
  /** დივის სამიზნე ნორმალიზებულ კარის კოორდინატებში */
  dive: Vec2
  /** დივის პროგრესი: 0 — დგას, 1 — სრულად გაწვდილი */
  progress: number
  /** ფეხების მოძრაობა დგომისას */
  idle?: boolean
  /** §8 — ცივი ლურჯი ყოველთვის მეკარეა */
  color?: string
}

// ─── პოზები ─────────────────────────────────────────────────

/** მზადყოფნა — დაბალი ჩაჯდომა, ხელები გაშლილი */
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

/** გაწვდილი დივი — მთელი სხეული ერთ ხაზზეა */
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

/** დაბალი დივი — ხელები წინ, ფეხები ხრილი */
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

const STANCE_Z = 0.35

export function Keeper({ dive, progress, idle = true, color = PALETTE.floodlight }: KeeperProps) {
  const group = useRef<THREE.Group>(null)
  const fig = useRef<FigureHandle>(null)
  const scratch = useMemo(() => clonePose(NEUTRAL), [])

  useFrame(({ clock }) => {
    const g = group.current
    if (!g || !fig.current) return
    const p = Math.max(0, Math.min(1, progress))
    // ease-out — დივი სწრაფად იწყება და წვდომაზე ჩერდება
    const e = 1 - (1 - p) * (1 - p)

    const targetX = dive.x * GOAL_HALF_WIDTH
    const targetY = dive.y * GOAL_HEIGHT
    const low = targetY < 0.55
    const side = Math.sign(targetX) || 1

    if (p <= 0) {
      // მზადყოფნის რხევა — წონა ფეხიდან ფეხზე
      const t = idle ? clock.elapsedTime : 0
      const sway = Math.sin(t * 2.1)
      lerpPose(READY, STRETCH, 0.03 + Math.abs(Math.sin(t * 1.1)) * 0.03, scratch)
      scratch.root[2] = sway * 0.045
      fig.current.apply(scratch)
      g.position.set(sway * 0.07, 0, STANCE_Z)
      g.rotation.set(0, 0, 0)
      return
    }

    // დივი: მზადყოფნიდან გაწვდილში
    lerpPose(READY, low ? LOW_DIVE : STRETCH, e, scratch)
    // თავი ბურთისკენ იხრება
    scratch.head[2] = -side * 0.3 * e
    fig.current.apply(scratch)

    // სხეული მიზნისკენ გადადის და ჰორიზონტალურად წვება
    const reachY = low ? -0.1 * e : Math.max(0, targetY - 1.1) * e * 0.65
    g.position.set(targetX * e * 0.82, reachY, STANCE_Z)
    g.rotation.set(low ? 0.12 * e : 0, -side * 0.25 * e, -side * e * (low ? 1.35 : 0.95))
  })

  return (
    <group ref={group} position={[0, 0, STANCE_Z]}>
      <Figure ref={fig} kit={color} gloves />
      <mesh position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        <circleGeometry args={[0.42, 18]} />
        <meshBasicMaterial color={PALETTE.night} transparent opacity={0.3} depthWrite={false} />
      </mesh>
    </group>
  )
}
