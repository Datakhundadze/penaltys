import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type * as THREE from 'three'
import { PALETTE } from '../lib/palette'
import { BALL_RADIUS, type Vec3 } from '../lib/geometry'

export interface BallProps {
  /** ბურთის მდებარეობა — გარედან მოდის, აქ არაფერი წყდება */
  position: Vec3
  /** ბრუნვის სიჩქარე, 0 როცა ბურთი დგას */
  spin?: number
}

export function Ball({ position, spin = 0 }: BallProps) {
  const mesh = useRef<THREE.Mesh>(null)
  const shadow = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    const m = mesh.current
    if (!m) return
    m.position.set(position.x, position.y, position.z)
    m.rotation.x -= spin * delta
    m.rotation.z += spin * delta * 0.35

    if (shadow.current) {
      shadow.current.position.set(position.x, 0.016, position.z)
      const height = Math.max(0, position.y - BALL_RADIUS)
      const s = Math.max(0.35, 1 - height * 0.22)
      shadow.current.scale.setScalar(s)
      const mat = shadow.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.4 * s
    }
  })

  return (
    <>
      <mesh ref={mesh} castShadow position={[position.x, position.y, position.z]}>
        <sphereGeometry args={[BALL_RADIUS, 24, 18]} />
        <meshStandardMaterial
          color={PALETTE.chalk}
          roughness={0.42}
          metalness={0.02}
          emissive={PALETTE.sodium}
          emissiveIntensity={0.09}
        />
      </mesh>
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.016, 0]}>
        <circleGeometry args={[BALL_RADIUS * 1.5, 16]} />
        <meshBasicMaterial color={PALETTE.night} transparent opacity={0.4} />
      </mesh>
    </>
  )
}
