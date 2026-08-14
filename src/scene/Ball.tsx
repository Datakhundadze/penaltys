import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE } from '../lib/palette'
import { BALL_RADIUS, type Vec3 } from '../lib/geometry'
import { ballMaps } from './textures'

export interface BallProps {
  /** ბურთის მდებარეობა — გარედან მოდის, აქ არაფერი წყდება */
  position: Vec3
  /** სათადარიგო ბრუნვის სიჩქარე, როცა ბურთი დგას */
  spin?: number
}

const UP = new THREE.Vector3(0, 1, 0)

/**
 * ბურთი — პროცედურული ხუთ/ექვსკუთხა პანელები, მსუბუქი ლაქის ბზინვა.
 * ბრუნვა ტრაექტორიიდან გამოდის: მოძრაობის მიმართულების პერპენდიკულარულ
 * ღერძზე ტრიალებს, სიჩქარის პროპორციულად. თვითონ არაფერს წყვეტს.
 */
export function Ball({ position, spin = 0 }: BallProps) {
  const mesh = useRef<THREE.Mesh>(null)
  const shadow = useRef<THREE.Mesh>(null)
  const prev = useRef(new THREE.Vector3(position.x, position.y, position.z))
  const vel = useRef(new THREE.Vector3())
  const axis = useRef(new THREE.Vector3(1, 0, 0))

  const maps = useMemo(() => ballMaps(), [])

  useFrame((_, delta) => {
    const m = mesh.current
    if (!m) return
    m.position.set(position.x, position.y, position.z)

    if (delta > 0) {
      vel.current.set(
        (position.x - prev.current.x) / delta,
        (position.y - prev.current.y) / delta,
        (position.z - prev.current.z) / delta,
      )
      prev.current.set(position.x, position.y, position.z)

      const speed = vel.current.length()
      if (speed > 0.15) {
        // გორვა მოძრაობის მართობულ ჰორიზონტალურ ღერძზე
        axis.current.crossVectors(UP, vel.current)
        if (axis.current.lengthSq() > 1e-6) {
          axis.current.normalize()
          m.rotateOnWorldAxis(axis.current, -Math.min(speed / BALL_RADIUS / 1.6, 15) * delta)
        }
      } else if (spin > 0) {
        m.rotation.y += spin * delta * 0.2
      }
    }

    if (shadow.current) {
      shadow.current.position.set(position.x, 0.017, position.z)
      const height = Math.max(0, position.y - BALL_RADIUS)
      const s = Math.max(0.35, 1 - height * 0.22)
      shadow.current.scale.setScalar(s)
      const mat = shadow.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.35 * s
    }
  })

  return (
    <>
      <mesh ref={mesh} castShadow position={[position.x, position.y, position.z]}>
        <sphereGeometry args={[BALL_RADIUS, 32, 24]} />
        <meshPhysicalMaterial
          map={maps.map}
          roughnessMap={maps.roughnessMap}
          roughness={1}
          metalness={0}
          clearcoat={0.55}
          clearcoatRoughness={0.35}
        />
      </mesh>
      {/* რბილი კონტაქტური ჩრდილი — shadow map-ის დამატებით */}
      <mesh ref={shadow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.017, 0]} renderOrder={2}>
        <circleGeometry args={[BALL_RADIUS * 1.4, 16]} />
        <meshBasicMaterial color={PALETTE.night} transparent opacity={0.35} depthWrite={false} />
      </mesh>
    </>
  )
}
