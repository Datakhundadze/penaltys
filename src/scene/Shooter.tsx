import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import { PALETTE } from '../lib/palette'
import { PENALTY_SPOT_Z } from '../lib/geometry'
import { Figure, type FigureHandle } from './Figure'
import { NEUTRAL, clonePose, lerpPose, type Pose } from './pose'

/**
 * დამრტყმელი.
 *
 * ინტერფეისი უცვლელია ფაზა 0-დან: swing + lean. ფაზა 3-ში შიგთავსი
 * იცვლება glTF ავატარით, გარეთა კონტრაქტი რჩება.
 *
 * swing-ის დროის ხაზი (Replay აწვდის, აქ მხოლოდ ინტერპრეტაცია ხდება):
 *   0        — იდლი, მსუბუქი რხევა
 *   0 → 1    — შერბენა ბურთისკენ + მოქნევა (1 = დარტყმის მომენტი)
 *   1 → 1.6  — დარტყმის შემდგომი მოძრაობა, გაჩერება
 */
export interface ShooterProps {
  /** ფეხის მოქნევა: 0 — დგას; 1 — დარტყმის მომენტი; >1 — follow-through */
  swing: number
  /** სხეულის გახსნა: -1 მარცხნივ, 1 მარჯვნივ */
  lean: number
  /** სად დგას — ნაგულისხმევად ბურთის უკან */
  position?: [number, number, number]
  /** §8 — ამბერი ყოველთვის დამრტყმელია */
  color?: string
}

// ─── პოზები ─────────────────────────────────────────────────

const IDLE: Pose = {
  ...clonePose(NEUTRAL),
  torso: [0.05, 0, 0],
  shoulderL: [0.06, 0.14],
  shoulderR: [0.06, -0.14],
  elbowL: 0.18,
  elbowR: 0.18,
}

/** შერბენის შუა ნაბიჯი */
const RUN: Pose = {
  ...clonePose(NEUTRAL),
  pelvisY: -0.04,
  torso: [0.3, 0, 0],
  head: [-0.12, 0, 0],
  shoulderL: [-0.7, 0.12],
  elbowL: 1.1,
  shoulderR: [0.6, -0.12],
  elbowR: 0.9,
  hipL: [-0.55, 0.03],
  kneeL: 0.9,
  hipR: [0.4, -0.03],
  kneeR: 0.35,
}

/** მოქნევა უკან — საყრდენი ფეხი დარგულია, დამრტყმელი უკანაა */
const BACKSWING: Pose = {
  ...clonePose(NEUTRAL),
  pelvisY: -0.09,
  root: [0, 0, 0],
  torso: [0.34, 0.12, -0.06],
  head: [-0.2, 0, 0],
  shoulderL: [-0.9, 0.35],
  elbowL: 0.6,
  shoulderR: [0.5, -0.3],
  elbowR: 0.7,
  hipL: [-0.25, 0.04],
  kneeL: 0.5,
  hipR: [0.85, -0.05],
  kneeR: 1.25,
}

/** დარტყმის მომენტი — ფეხი გატყორცნილია */
const STRIKE: Pose = {
  ...clonePose(NEUTRAL),
  pelvisY: -0.05,
  torso: [-0.08, -0.2, 0.08],
  head: [0.08, 0, 0],
  shoulderL: [0.7, 0.5],
  elbowL: 0.35,
  shoulderR: [-0.8, -0.4],
  elbowR: 0.5,
  hipL: [-0.12, 0.05],
  kneeL: 0.22,
  hipR: [-1.25, -0.06],
  kneeR: 0.12,
}

/** დარტყმის შემდეგ — ინერცია მიაქვს */
const FOLLOW: Pose = {
  ...clonePose(NEUTRAL),
  pelvisY: -0.02,
  torso: [-0.15, -0.4, 0.12],
  head: [0.05, -0.15, 0],
  shoulderL: [0.45, 0.6],
  elbowL: 0.3,
  shoulderR: [-0.5, -0.5],
  elbowR: 0.4,
  hipL: [0, 0.05],
  kneeL: 0.15,
  hipR: [-0.75, -0.08],
  kneeR: 0.45,
}

/** შერბენის მანძილი ბურთამდე (მ) */
const RUNUP_DIST = 1.15

export function Shooter({
  swing,
  lean,
  position = [0.85, 0, PENALTY_SPOT_Z + 0.4],
  color = PALETTE.sodium,
}: ShooterProps) {
  const group = useRef<THREE.Group>(null)
  const fig = useRef<FigureHandle>(null)
  const scratch = useMemo(() => clonePose(NEUTRAL), [])

  useFrame(({ clock }) => {
    const g = group.current
    if (!g || !fig.current) return

    const s = Math.max(0, swing)
    let travel = 0

    if (s <= 0) {
      // იდლი — მსუბუქი სუნთქვა და წონის გადატანა
      const t = clock.elapsedTime
      lerpPose(IDLE, RUN, 0.06 + Math.sin(t * 1.7) * 0.05, scratch)
      scratch.root[2] = Math.sin(t * 0.9) * 0.02
      travel = RUNUP_DIST
    } else if (s < 0.55) {
      // შერბენა: იდლიდან ნაბიჯში, ბურთისკენ მოძრაობით
      const u = s / 0.55
      const stride = Math.sin(u * Math.PI * 3)
      lerpPose(IDLE, RUN, Math.min(1, u * 2.4), scratch)
      // ნაბიჯების მონაცვლეობა — ფეხები საპირისპიროდ ქანაობს
      scratch.hipL[0] = (scratch.hipL[0] ?? 0) * stride
      scratch.hipR[0] = -(scratch.hipR[0] ?? 0) * stride
      scratch.kneeL = 0.35 + Math.max(0, stride) * 0.7
      scratch.kneeR = 0.35 + Math.max(0, -stride) * 0.7
      scratch.shoulderL[0] = (scratch.shoulderL[0] ?? 0) * stride
      scratch.shoulderR[0] = (scratch.shoulderR[0] ?? 0) * stride
      travel = RUNUP_DIST * (1 - u * u)
    } else if (s < 0.82) {
      const u = (s - 0.55) / 0.27
      lerpPose(RUN, BACKSWING, u, scratch)
      travel = 0
    } else if (s < 1) {
      const u = (s - 0.82) / 0.18
      // მოქნევა სწრაფია — ease-in
      lerpPose(BACKSWING, STRIKE, u * u, scratch)
      travel = 0
    } else {
      const u = Math.min(1, (s - 1) / 0.6)
      lerpPose(STRIKE, FOLLOW, 1 - (1 - u) * (1 - u), scratch)
      travel = -0.3 * u
    }

    // გახსნა მიზნის მხარეს
    scratch.root[1] = -lean * 0.28
    fig.current.apply(scratch)
    // ჯგუფი Y-ზე 180°-ითაა შებრუნებული — ლოკალური travel z-ში პირდაპირ ჯდება
    g.position.set(position[0], position[1], position[2] + travel)
  })

  return (
    <group ref={group} position={position} rotation={[0, Math.PI, 0]}>
      <Figure ref={fig} kit={color} />
      {/* რბილი კონტაქტური ჩრდილი */}
      <mesh position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        <circleGeometry args={[0.4, 18]} />
        <meshBasicMaterial color={PALETTE.night} transparent opacity={0.3} depthWrite={false} />
      </mesh>
    </group>
  )
}
