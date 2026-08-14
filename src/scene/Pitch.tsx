import { useMemo } from 'react'
import { PALETTE } from '../lib/palette'
import {
  GOAL_AREA_DEPTH,
  GOAL_AREA_HALF_WIDTH,
  LINE_WIDTH,
  PENALTY_BOX_DEPTH,
  PENALTY_BOX_HALF_WIDTH,
  PENALTY_SPOT_Z,
} from '../lib/geometry'

/** ცარცის ხაზი მიწაზე — თხელი ფირფიტა, არა გეომეტრიული ხრიკი */
function ChalkLine({
  x = 0,
  z = 0,
  width,
  depth,
}: {
  x?: number
  z?: number
  width: number
  depth: number
}) {
  return (
    <mesh position={[x, 0.012, z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={false}>
      <planeGeometry args={[width, depth]} />
      <meshBasicMaterial color={PALETTE.chalk} opacity={0.28} transparent />
    </mesh>
  )
}

export function Pitch() {
  // საჯარიმო რკალის ის ნაწილი, რომელიც მოედნის გარეთაა
  const arc = useMemo(() => {
    const radius = 9.15
    const outside = PENALTY_BOX_DEPTH - PENALTY_SPOT_Z
    const half = Math.acos(Math.min(1, outside / radius))
    // ბრუნვის შემდეგ ლოკალური −Y იყურება მოედნის შუაში (+Z), რკალიც იქითაა
    return { radius, thetaStart: -Math.PI / 2 - half, thetaLength: half * 2 }
  }, [])

  return (
    <group>
      {/* გაზონი */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color={PALETTE.turf} roughness={1} metalness={0} />
      </mesh>

      {/* კარის ხაზი */}
      <ChalkLine z={0} width={80} depth={LINE_WIDTH} />

      {/* საჯარიმო მოედანი */}
      <ChalkLine z={PENALTY_BOX_DEPTH} width={PENALTY_BOX_HALF_WIDTH * 2} depth={LINE_WIDTH} />
      <ChalkLine
        x={-PENALTY_BOX_HALF_WIDTH}
        z={PENALTY_BOX_DEPTH / 2}
        width={LINE_WIDTH}
        depth={PENALTY_BOX_DEPTH}
      />
      <ChalkLine
        x={PENALTY_BOX_HALF_WIDTH}
        z={PENALTY_BOX_DEPTH / 2}
        width={LINE_WIDTH}
        depth={PENALTY_BOX_DEPTH}
      />

      {/* ვრატარის მოედანი */}
      <ChalkLine z={GOAL_AREA_DEPTH} width={GOAL_AREA_HALF_WIDTH * 2} depth={LINE_WIDTH} />
      <ChalkLine
        x={-GOAL_AREA_HALF_WIDTH}
        z={GOAL_AREA_DEPTH / 2}
        width={LINE_WIDTH}
        depth={GOAL_AREA_DEPTH}
      />
      <ChalkLine
        x={GOAL_AREA_HALF_WIDTH}
        z={GOAL_AREA_DEPTH / 2}
        width={LINE_WIDTH}
        depth={GOAL_AREA_DEPTH}
      />

      {/* პენალტის წერტილი */}
      <mesh position={[0, 0.013, PENALTY_SPOT_Z]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.13, 20]} />
        <meshBasicMaterial color={PALETTE.chalk} opacity={0.45} transparent />
      </mesh>

      {/* საჯარიმო რკალი */}
      <mesh
        position={[0, 0.012, PENALTY_SPOT_Z]}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={1}
      >
        <ringGeometry
          args={[arc.radius - LINE_WIDTH / 2, arc.radius + LINE_WIDTH / 2, 64, 1, arc.thetaStart, arc.thetaLength]}
        />
        <meshBasicMaterial color={PALETTE.chalk} opacity={0.22} transparent />
      </mesh>
    </group>
  )
}
