import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import { PALETTE } from '../lib/palette'
import { GOAL_HALF_WIDTH, GOAL_HEIGHT } from '../lib/geometry'
import type { Vec2 } from '../lib/physics'

/**
 * მეკარის განთავსება.
 *
 * ფაზა 0-ში კაფსულების პლეისჰოლდერია; ფაზა 3-ში glTF ავატარით იცვლება (§7).
 * ინტერფეისი განზრახ ვიწროა: სად ეშვება და რამდენად შორსაა დივი წასული.
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

const STANCE_Y = 0.92
/** მეკარე კარის ხაზზე ცოტა წინაა */
const KEEPER_Z = 0.35

export function Keeper({ dive, progress, idle = true, color = PALETTE.floodlight }: KeeperProps) {
  const group = useRef<THREE.Group>(null)
  const arms = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return
    const p = Math.max(0, Math.min(1, progress))
    // ease-out — დივი სწრაფად იწყება და წვდომაზე ჩერდება
    const e = 1 - (1 - p) * (1 - p)

    const targetX = dive.x * GOAL_HALF_WIDTH
    const targetY = dive.y * GOAL_HEIGHT
    const sway = idle && p === 0 ? Math.sin(clock.elapsedTime * 2.1) * 0.07 : 0

    g.position.x = targetX * e + sway
    // დაბალი დივი კორპუსს ძირს სწევს, მაღალი — ხტება
    g.position.y = (targetY < 0.6 ? -0.25 * e : 0.35 * e * targetY) + Math.abs(sway) * 0.05
    g.rotation.z = -Math.sign(targetX) * e * (targetY < 0.9 ? 1.15 : 0.7)

    if (arms.current) arms.current.rotation.x = -0.4 - 0.9 * e
  })

  return (
    <group ref={group} position={[0, STANCE_Y, KEEPER_Z]}>
      {/* ტანი */}
      <mesh castShadow>
        <capsuleGeometry args={[0.2, 0.46, 4, 12]} />
        <meshStandardMaterial color={color} roughness={0.65} emissive={color} emissiveIntensity={0.28} />
      </mesh>
      {/* თავი */}
      <mesh position={[0, 0.52, 0]} castShadow>
        <sphereGeometry args={[0.14, 16, 12]} />
        <meshStandardMaterial color={PALETTE.chalk} roughness={0.85} />
      </mesh>
      {/* ხელები — დივზე იშლება */}
      <group ref={arms} position={[0, 0.28, 0]}>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.42, 0.1, 0]} rotation={[0, 0, s * 1.05]} castShadow>
            <capsuleGeometry args={[0.07, 0.56, 3, 8]} />
            <meshStandardMaterial color={color} roughness={0.7} emissive={color} emissiveIntensity={0.22} />
          </mesh>
        ))}
        {/* ხელთათმანები */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.66, 0.26, 0]} castShadow>
            <boxGeometry args={[0.15, 0.19, 0.07]} />
            <meshStandardMaterial color={PALETTE.chalk} roughness={0.6} />
          </mesh>
        ))}
      </group>
      {/* ფეხები */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 0.11, -0.58, 0]} castShadow>
          <capsuleGeometry args={[0.085, 0.6, 3, 8]} />
          <meshStandardMaterial color={PALETTE.night} roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}
