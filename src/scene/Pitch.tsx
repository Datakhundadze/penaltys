import { useMemo } from 'react'
import * as THREE from 'three'
import {
  MARKINGS_BACK_Z,
  MARKINGS_DEPTH,
  MARKINGS_FRONT_Z,
  MARKINGS_WIDTH,
  grassMaps,
  pitchMarkings,
  type Quality,
} from './textures'

/**
 * მოედანი — პროცედურული გაზონი გათიბვის ზოლებით და ცარცის მონიშვნა.
 * ზოლები კარის ხაზის პარალელურია; ბზინვის რუკა მათ სხვადასხვა კუთხით
 * აბრუნებს, ამიტომ შუქზე ნამდვილ გათიბვას ჰგავს.
 */
export function Pitch({ quality }: { quality: Quality }) {
  const grass = useMemo(() => {
    const maps = grassMaps(quality)
    // tile ≈ 7მ — ზოლი ≈ 3.5მ
    const repeat = 120 / 7
    for (const t of [maps.map, maps.roughnessMap, maps.normalMap]) t.repeat.set(repeat, repeat)
    return maps
  }, [quality])

  const markings = useMemo(() => pitchMarkings(quality), [quality])

  return (
    <group>
      {/* გაზონი */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial
          map={grass.map}
          roughnessMap={grass.roughnessMap}
          normalMap={grass.normalMap}
          normalScale={new THREE.Vector2(0.32, 0.32)}
          metalness={0}
        />
      </mesh>

      {/* ცარცის მონიშვნა — ერთი გამჭვირვალე ფენა მიწის ზემოთ */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.015, (MARKINGS_FRONT_Z + MARKINGS_BACK_Z) / 2]}
        renderOrder={1}
        receiveShadow
      >
        <planeGeometry args={[MARKINGS_WIDTH, MARKINGS_DEPTH]} />
        <meshStandardMaterial
          map={markings}
          transparent
          depthWrite={false}
          roughness={0.9}
          metalness={0}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>
    </group>
  )
}
