import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import { PALETTE } from '../lib/palette'
import { goalToWorld } from '../lib/geometry'
import type { Phase } from '../game/store'
import { aimPreview } from '../ui/aimPreview'

export interface AimReticleProps {
  phase: Phase
  tone: 'sodium' | 'floodlight'
}

/**
 * მინიშნება დამიზნებისას — მოთამაშემ მოსმისა და კარის შესაბამისობა
 * პირველივე დარტყმაზე უნდა ისწავლოს (§8).
 *
 * პოზიცია aimPreview-დან პირდაპირ useFrame-ში იკითხება და დაუყოვნებლივ
 * ისმება — არანაირი დაგლუვება, არანაირი React-ის შუალედური რენდერი.
 * დაგლუვება კამერას ეკუთვნის, შეყვანის უკუკავშირს — არასდროს.
 */
export function AimReticle({ phase, tone }: AimReticleProps) {
  const group = useRef<THREE.Group>(null)
  const color = tone === 'sodium' ? PALETTE.sodium : PALETTE.floodlight

  useFrame(() => {
    const g = group.current
    if (!g) return

    const active = phase === 'aiming'
    if (!active) {
      // ფაზის მიღმა პრევიუც იშლება, რომ შემდეგი რაუნდი ძველს არ აჩენდეს
      aimPreview.swipe = null
      g.visible = false
      return
    }

    const swipe = aimPreview.swipe
    if (!swipe) {
      g.visible = false
      return
    }

    g.visible = true
    const p = goalToWorld(swipe.aim)
    g.position.set(p.x, p.y, 0.05)
    g.scale.setScalar(0.7 + swipe.power * 0.5)
  })

  return (
    <group ref={group} visible={false}>
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
