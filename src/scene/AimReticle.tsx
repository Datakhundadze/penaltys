import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import { PALETTE } from '../lib/palette'
import { goalToWorld } from '../lib/geometry'
import type { Vec2 } from '../lib/physics'

export interface AimReticleProps {
  /** ნორმალიზებული კარის წერტილი, null — დამიზნება არ მიმდინარეობს */
  aim: Vec2 | null
  /** მოსმის სიგრძე 0..1 — რგოლის სისქეს ზრდის */
  power: number
  tone: 'sodium' | 'floodlight'
}

/**
 * მინიშნება დამიზნებისას — მოთამაშემ მოსმისა და კარის შესაბამისობა
 * პირველივე დარტყმაზე უნდა ისწავლოს (§8: არა დეკორაცია, არამედ სწავლება).
 */
export function AimReticle({ aim, power, tone }: AimReticleProps) {
  const group = useRef<THREE.Group>(null)
  const color = tone === 'sodium' ? PALETTE.sodium : PALETTE.floodlight

  useFrame(({ clock }) => {
    const g = group.current
    if (!g || !aim) return
    const p = goalToWorld(aim)
    g.position.set(p.x, p.y, 0.05)
    const pulse = 1 + Math.sin(clock.elapsedTime * 5) * 0.04
    g.scale.setScalar((0.7 + power * 0.5) * pulse)
  })

  if (!aim) return null

  return (
    <group ref={group}>
      <mesh>
        <ringGeometry args={[0.24, 0.3, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} />
      </mesh>
      <mesh>
        <ringGeometry args={[0.05, 0.08, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </mesh>
    </group>
  )
}
