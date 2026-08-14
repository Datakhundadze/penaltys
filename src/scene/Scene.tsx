import { useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { PALETTE } from '../lib/palette'
import { GOAL_HALF_WIDTH, GOAL_HEIGHT, PENALTY_SPOT_Z } from '../lib/geometry'
import type { Phase, RoundRecord } from '../game/store'
import { useQuality } from '../hooks/useQuality'
import { Lights } from './Lights'
import { Pitch } from './Pitch'
import { Stadium } from './Stadium'
import { AimReticle } from './AimReticle'
import { Replay } from './Replay'

export interface SceneProps {
  phase: Phase
  round: RoundRecord | null
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
 * დამიზნებისას ძალიან მსუბუქი „ხელის" რხევა აქვს; reduced-motion თიშავს.
 */
function Rig({ focus, reducedMotion }: { focus: number; reducedMotion: boolean }) {
  const { camera, size } = useThree()
  const current = useRef(0)
  const look = useRef(LOOK_AT.clone())

  useFrame(({ clock }, delta) => {
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

    // ხელის დრიფტი — ორი შეუთავსებელი სიხშირე, შესამჩნევი მაგრამ მშვიდი
    let dx = 0
    let dy = 0
    if (!reducedMotion) {
      const t = clock.elapsedTime
      const calm = 1 - f * 0.85
      dx = (Math.sin(t * 0.43) * 0.05 + Math.sin(t * 1.13) * 0.018) * calm
      dy = (Math.sin(t * 0.61 + 1.7) * 0.035 + Math.sin(t * 1.51) * 0.012) * calm
    }

    cam.position.set(dx, CAM_HEIGHT - 0.22 * f + dy, distance - 1.5 * f)
    look.current.set(LOOK_AT.x + dx * 0.6, LOOK_AT.y + dy * 0.6, LOOK_AT.z)
    cam.lookAt(look.current)
  })

  return null
}

export function Scene({ phase, round, tone, reducedMotion, onAnimationEnd }: SceneProps) {
  const quality = useQuality()
  const [flareAt, setFlareAt] = useState<number | null>(null)

  return (
    <Canvas
      shadows
      dpr={quality === 'high' ? [1, 2] : [1, 1.5]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 46, position: [0, CAM_HEIGHT, CAM_Z], near: 0.1, far: 300 }}
      onCreated={({ gl, scene }) => {
        gl.setClearColor('#04080a')
        gl.shadowMap.type = THREE.PCFSoftShadowMap
        scene.fog = new THREE.Fog(PALETTE.night, 30, 110)
      }}
    >
      <Rig focus={phase === 'animating' ? 1 : 0} reducedMotion={reducedMotion} />
      <Lights quality={quality} />
      <Stadium quality={quality} flareAt={flareAt} reducedMotion={reducedMotion} />
      <Pitch quality={quality} />
      <AimReticle phase={phase} tone={tone} />
      <Replay
        phase={phase}
        round={round}
        reducedMotion={reducedMotion}
        onFinish={onAnimationEnd}
        onGoalImpact={setFlareAt}
      />

      {/* პოსტპროცესინგი მხოლოდ მაღალ ხარისხზე — მობილურზე ითიშება */}
      {quality === 'high' && (
        <EffectComposer>
          <Bloom
            intensity={0.38}
            luminanceThreshold={0.88}
            luminanceSmoothing={0.2}
            mipmapBlur
          />
          <Vignette eskil={false} offset={0.24} darkness={0.58} />
        </EffectComposer>
      )}
    </Canvas>
  )
}
