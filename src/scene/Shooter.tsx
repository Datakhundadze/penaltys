import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import { PALETTE } from '../lib/palette'
import { PENALTY_SPOT_Z } from '../lib/geometry'

/**
 * დამრტყმელის განთავსება.
 *
 * ფაზა 0-ში ეს კაფსულებისა და კუბების პლეისჰოლდერია. ფაზა 3-ში მისი
 * შიგთავსი იცვლება glTF ავატარით (§7) — ინტერფეისი უცვლელი რჩება,
 * ამიტომ ჩანაცვლება ერთ ფაილშია.
 */
export interface ShooterProps {
  /** ფეხის მოქნევა: 0 — დგას, 1 — დარტყმის შემდგომი მოძრაობა */
  swing: number
  /** სხეულის გახსნა: -1 მარცხნივ, 1 მარჯვნივ */
  lean: number
  /** სად დგას — ნაგულისხმევად ბურთის უკან */
  position?: [number, number, number]
  /** §8 — ამბერი ყოველთვის დამრტყმელია */
  color?: string
}

export function Shooter({
  swing,
  lean,
  position = [1.45, 0, PENALTY_SPOT_Z + 1.7],
  color = PALETTE.sodium,
}: ShooterProps) {
  const group = useRef<THREE.Group>(null)
  const kickLeg = useRef<THREE.Group>(null)
  const torso = useRef<THREE.Group>(null)

  useFrame(() => {
    const s = Math.max(0, Math.min(1, swing))
    if (group.current) group.current.rotation.y = -lean * 0.22
    if (kickLeg.current) {
      // მოქნევა: უკან → წინ
      kickLeg.current.rotation.x = -1.15 * Math.sin(Math.PI * s) - 0.15 * s
    }
    if (torso.current) {
      torso.current.rotation.x = 0.18 * Math.sin(Math.PI * s)
      torso.current.rotation.z = -lean * 0.18 * s
    }
  })

  return (
    <group ref={group} position={position} rotation={[0, Math.PI, 0]}>
      <group ref={torso} position={[0, 0.95, 0]}>
        {/* ტანი */}
        <mesh position={[0, 0.16, 0]} castShadow>
          <capsuleGeometry args={[0.19, 0.42, 4, 12]} />
          <meshStandardMaterial color={color} roughness={0.7} emissive={color} emissiveIntensity={0.16} />
        </mesh>
        {/* თავი */}
        <mesh position={[0, 0.66, 0]} castShadow>
          <sphereGeometry args={[0.14, 16, 12]} />
          <meshStandardMaterial color={PALETTE.chalk} roughness={0.85} />
        </mesh>
        {/* მხრები */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.27, 0.18, 0]} rotation={[0, 0, s * 0.25]} castShadow>
            <capsuleGeometry args={[0.062, 0.4, 3, 8]} />
            <meshStandardMaterial color={color} roughness={0.8} emissive={color} emissiveIntensity={0.14} />
          </mesh>
        ))}
      </group>

      {/* დასაყრდენი ფეხი */}
      <mesh position={[-0.14, 0.47, 0]} castShadow>
        <capsuleGeometry args={[0.085, 0.62, 3, 8]} />
        <meshStandardMaterial color={PALETTE.night} roughness={0.9} />
      </mesh>

      {/* დამრტყმელი ფეხი — ბარძაყიდან ტრიალებს */}
      <group ref={kickLeg} position={[0.14, 0.8, 0]}>
        <mesh position={[0, -0.32, 0]} castShadow>
          <capsuleGeometry args={[0.085, 0.6, 3, 8]} />
          <meshStandardMaterial color={PALETTE.night} roughness={0.9} />
        </mesh>
        <mesh position={[0, -0.66, -0.06]} castShadow>
          <boxGeometry args={[0.13, 0.09, 0.26]} />
          <meshStandardMaterial color={color} roughness={0.6} />
        </mesh>
      </group>

      {/* ჩრდილი მიწაზე — რბილი, დეკორაციის გარეშე */}
      <mesh position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.42, 20]} />
        <meshBasicMaterial color={PALETTE.night} transparent opacity={0.35} />
      </mesh>
    </group>
  )
}
