import { useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE } from '../lib/palette'
import { GOAL_HALF_WIDTH, GOAL_HEIGHT, PENALTY_SPOT_Z } from '../lib/geometry'
import type { Vec2 } from '../lib/physics'
import type { Phase, RoundRecord } from '../game/store'
import { Lights } from './Lights'
import { Pitch } from './Pitch'
import { AimReticle } from './AimReticle'
import { Replay } from './Replay'

export interface SceneProps {
  phase: Phase
  round: RoundRecord | null
  /** მიმდინარე დამიზნება — რეტიკულისთვის */
  aim: Vec2 | null
  aimPower: number
  tone: 'sodium' | 'floodlight'
  reducedMotion: boolean
  onAnimationEnd: () => void
}

const LOOK_AT = new THREE.Vector3(0, GOAL_HEIGHT * 0.53, 3.5)
/** კადრში კარი + მარჯვნივ/მარცხნივ სუნთქვა */
const FRAME_HALF_WIDTH = GOAL_HALF_WIDTH + 1.2
const CAM_HEIGHT = 3.4
const CAM_Z = PENALTY_SPOT_Z + 8.5

/**
 * კამერა დამრტყმელის უკნიდან, ოდნავ აწეული (§8).
 * კადრი ეკრანის პროპორციას ეგუება: ჯერ fov, თუ არ ეყო — უკან წევა.
 * ასე ~380px სიგანეზეც კარი მთლიანად ჩანს და ბურთიც კადრშია.
 */
function Rig({ focus, reducedMotion }: { focus: number; reducedMotion: boolean }) {
  const { camera, size } = useThree()
  const current = useRef(0)

  useFrame((_, delta) => {
    const cam = camera as THREE.PerspectiveCamera
    const aspect = size.width / Math.max(1, size.height)

    const wanted = THREE.MathUtils.clamp(
      THREE.MathUtils.radToDeg(2 * Math.atan(FRAME_HALF_WIDTH / CAM_Z / aspect)),
      32,
      68,
    )
    if (Math.abs(cam.fov - wanted) > 0.01) {
      cam.fov = wanted
      cam.updateProjectionMatrix()
    }
    const tanH = Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * aspect
    const distance = Math.max(CAM_Z, FRAME_HALF_WIDTH / tanH)

    // §8 — სანელებელი ბურთის ფრენაზე; reduced-motion-ზე მყისიერი
    current.current = reducedMotion
      ? focus
      : THREE.MathUtils.damp(current.current, focus, 3.4, delta)
    const f = current.current

    cam.position.set(0, CAM_HEIGHT - 0.22 * f, distance - 1.5 * f)
    cam.lookAt(LOOK_AT)
  })

  return null
}

export function Scene({
  phase,
  round,
  aim,
  aimPower,
  tone,
  reducedMotion,
  onAnimationEnd,
}: SceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 46, position: [0, CAM_HEIGHT, CAM_Z], near: 0.1, far: 200 }}
      onCreated={({ gl, scene }) => {
        gl.setClearColor(PALETTE.night)
        scene.fog = new THREE.Fog(PALETTE.night, 22, 78)
      }}
    >
      <Rig focus={phase === 'animating' ? 1 : 0} reducedMotion={reducedMotion} />
      <Lights />
      <Pitch />
      <AimReticle aim={aim} power={aimPower} tone={tone} />
      <Replay
        phase={phase}
        round={round}
        reducedMotion={reducedMotion}
        onFinish={onAnimationEnd}
      />
    </Canvas>
  )
}
