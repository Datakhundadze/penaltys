import { forwardRef, useImperativeHandle, useRef } from 'react'
import type * as THREE from 'three'
import { PALETTE } from '../lib/palette'
import type { Pose } from './pose'

/**
 * სტილიზებული დაბალპოლიგონიანი ჰუმანოიდი პრიმიტივებისგან —
 * თავი, ტანი, ორნაწილიანი ხელები/ფეხები, ბუცები, სურვილისამებრ ხელთათმანები.
 *
 * პოზა ცალკე ტიპია და გარედან იმართება lerpPose-ით. ფაზა 3-ში მთელი
 * ეს ფაილი glTF ავატარით იცვლება — Shooter/Keeper-ის ინტერფეისები
 * ამაზე არ არის დამოკიდებული.
 */

/** სახსრების სახელურები იმპერატიული პოზირებისთვის */
export interface FigureHandle {
  apply: (pose: Pose) => void
}

export interface FigureProps {
  /** მაისურის ფერი — §8-ის ორი ტემპერატურიდან ერთ-ერთი */
  kit: string
  gloves?: boolean
}

// პროპორციები (მ) — პატარა ათლეტური ფიგურა, არა თილისმა
const PELVIS_Y = 0.96
const TORSO_LEN = 0.5
const HEAD_R = 0.115
const UPPER_ARM = 0.3
const FOREARM = 0.28
const THIGH = 0.44
const SHIN = 0.42
const LIMB_R = 0.055
const SKIN = '#c9a184'
const SHORTS = '#101a16'

export const Figure = forwardRef<FigureHandle, FigureProps>(function Figure({ kit, gloves }, ref) {
  const root = useRef<THREE.Group>(null)
  const pelvis = useRef<THREE.Group>(null)
  const torso = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const shL = useRef<THREE.Group>(null)
  const elL = useRef<THREE.Group>(null)
  const shR = useRef<THREE.Group>(null)
  const elR = useRef<THREE.Group>(null)
  const hipL = useRef<THREE.Group>(null)
  const kneeL = useRef<THREE.Group>(null)
  const hipR = useRef<THREE.Group>(null)
  const kneeR = useRef<THREE.Group>(null)

  useImperativeHandle(ref, () => ({
    apply(pose: Pose) {
      root.current?.rotation.set(pose.root[0], pose.root[1], pose.root[2])
      if (pelvis.current) pelvis.current.position.y = PELVIS_Y + pose.pelvisY
      torso.current?.rotation.set(pose.torso[0], pose.torso[1], pose.torso[2])
      head.current?.rotation.set(pose.head[0], pose.head[1], pose.head[2])
      shL.current?.rotation.set(pose.shoulderL[0], 0, pose.shoulderL[1])
      shR.current?.rotation.set(pose.shoulderR[0], 0, pose.shoulderR[1])
      if (elL.current) elL.current.rotation.x = -pose.elbowL
      if (elR.current) elR.current.rotation.x = -pose.elbowR
      hipL.current?.rotation.set(pose.hipL[0], 0, pose.hipL[1])
      hipR.current?.rotation.set(pose.hipR[0], 0, pose.hipR[1])
      if (kneeL.current) kneeL.current.rotation.x = pose.kneeL
      if (kneeR.current) kneeR.current.rotation.x = pose.kneeR
    },
  }))

  const limb = (len: number, color: string) => (
    <mesh position={[0, -len / 2, 0]} castShadow>
      <capsuleGeometry args={[LIMB_R, len - LIMB_R * 2, 3, 10]} />
      <meshStandardMaterial color={color} roughness={0.75} />
    </mesh>
  )

  const arm = (
    side: -1 | 1,
    sh: React.RefObject<THREE.Group | null>,
    el: React.RefObject<THREE.Group | null>,
  ) => (
    <group ref={sh} position={[side * 0.24, TORSO_LEN - 0.06, 0]}>
      {limb(UPPER_ARM, kit)}
      <group ref={el} position={[0, -UPPER_ARM, 0]}>
        {limb(FOREARM, SKIN)}
        {/* მტევანი / ხელთათმანი */}
        <mesh position={[0, -FOREARM - 0.02, 0]} castShadow>
          {gloves ? (
            <boxGeometry args={[0.11, 0.14, 0.07]} />
          ) : (
            <sphereGeometry args={[0.055, 10, 8]} />
          )}
          <meshStandardMaterial color={gloves ? PALETTE.chalk : SKIN} roughness={0.65} />
        </mesh>
      </group>
    </group>
  )

  const leg = (
    side: -1 | 1,
    hip: React.RefObject<THREE.Group | null>,
    knee: React.RefObject<THREE.Group | null>,
  ) => (
    <group ref={hip} position={[side * 0.115, 0, 0]}>
      {limb(THIGH, SHORTS)}
      <group ref={knee} position={[0, -THIGH, 0]}>
        {limb(SHIN, '#d8dcd4')}
        {/* ბუცი */}
        <mesh position={[0, -SHIN - 0.01, 0.05]} castShadow>
          <boxGeometry args={[0.1, 0.08, 0.24]} />
          <meshStandardMaterial color="#151515" roughness={0.4} metalness={0.1} />
        </mesh>
      </group>
    </group>
  )

  return (
    <group ref={root}>
      <group ref={pelvis} position={[0, PELVIS_Y, 0]}>
        {/* მენჯი */}
        <mesh castShadow>
          <boxGeometry args={[0.3, 0.17, 0.17]} />
          <meshStandardMaterial color={SHORTS} roughness={0.85} />
        </mesh>

        <group ref={torso} position={[0, 0.06, 0]}>
          {/* ტანი — ოდნავ ვიწროვდება წელში */}
          <mesh position={[0, TORSO_LEN / 2 + 0.03, 0]} castShadow>
            <capsuleGeometry args={[0.155, TORSO_LEN - 0.2, 4, 12]} />
            <meshStandardMaterial color={kit} roughness={0.7} />
          </mesh>
          {/* მხრების ხაზი */}
          <mesh position={[0, TORSO_LEN - 0.04, 0]} castShadow>
            <boxGeometry args={[0.36, 0.1, 0.13]} />
            <meshStandardMaterial color={kit} roughness={0.7} />
          </mesh>

          <group ref={head} position={[0, TORSO_LEN + 0.1, 0]}>
            <mesh position={[0, HEAD_R * 0.6, 0]} castShadow>
              <sphereGeometry args={[HEAD_R, 14, 12]} />
              <meshStandardMaterial color={SKIN} roughness={0.8} />
            </mesh>
            {/* თმა — უბრალო ქუდივით ნახევარსფერო */}
            <mesh position={[0, HEAD_R * 0.85, -0.012]}>
              <sphereGeometry args={[HEAD_R * 1.02, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
              <meshStandardMaterial color="#241d18" roughness={0.9} />
            </mesh>
          </group>

          {arm(-1, shL, elL)}
          {arm(1, shR, elR)}
        </group>

        <group position={[0, -0.09, 0]}>
          {leg(-1, hipL, kneeL)}
          {leg(1, hipR, kneeR)}
        </group>
      </group>
    </group>
  )
})
