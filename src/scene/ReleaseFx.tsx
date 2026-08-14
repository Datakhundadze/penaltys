import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PALETTE } from '../lib/palette'
import { GOAL_HALF_WIDTH, GOAL_HEIGHT, goalToWorld } from '../lib/geometry'
import { distance } from '../lib/physics'
import type { Phase, RoundRecord } from '../game/store'

export interface ReleaseFxProps {
  phase: Phase
  round: RoundRecord | null
}

/** მარკერის ქრობა (წმ) */
const MARK_FADE = 0.6
/** ზონის ქრობა (წმ) — „ეს რისკი შექმნა შენმა მოსმამ" */
const ZONE_FADE = 1.1

/**
 * აშვების შემდგომი უკუკავშირი — დამიზნებაში არასდროს ეხმარება,
 * მხოლოდ ასწავლის:
 *
 * - პატარა მარკერი იმ წერტილში, სადაც flick-მა დაუმიზნა (ქრება 0.6წმ-ში),
 *   რომ მოთამაშემ დააკავშიროს „ასე ავუსვი → იქ დაუმიზნა".
 * - გაფანტვის ზონა aim-ის გარშემო — მერყევი მოსმა ზონას თვალსაჩინოდ
 *   აფართოებს. ბურთის დაშვების წერტილი ყოველთვის ზონის შიგნითაა,
 *   ამიტომ შედეგი ყოველთვის ახსნადია.
 *
 * მეკარის რაუნდში მხოლოდ მარკერი ჩანს (დივის ზონა) — გაფანტვა იქ
 * მოსმას არ ეკუთვნის.
 */
export function ReleaseFx({ phase, round }: ReleaseFxProps) {
  const group = useRef<THREE.Group>(null)
  const mark = useRef<THREE.Mesh>(null)
  const zoneFill = useRef<THREE.Mesh>(null)
  const zoneEdge = useRef<THREE.Mesh>(null)
  const startedAt = useRef<number | null>(null)

  useFrame(({ clock }) => {
    const g = group.current
    if (!g) return

    if (phase !== 'animating' || !round) {
      g.visible = false
      startedAt.current = null
      return
    }
    if (startedAt.current === null) startedAt.current = clock.elapsedTime
    const t = clock.elapsedTime - startedAt.current

    const isShot = round.shooterSide === 'player'
    const isDive = round.shooterSide === 'bot'
    if (!isShot && !isDive) {
      g.visible = false
      return
    }

    const point = isShot ? round.shooter.aim : round.keeper.dive
    const world = goalToWorld(point)
    g.visible = t < ZONE_FADE
    g.position.set(world.x, Math.max(0.12, world.y), 0.08)

    const markFade = Math.max(0, 1 - t / MARK_FADE)
    if (mark.current) {
      const m = mark.current.material as THREE.MeshBasicMaterial
      m.opacity = 0.9 * markFade
    }

    // ზონა მხოლოდ დარტყმაზე — flick-ის სისუფთავე გაფანტვას მართავს
    const showZone = isShot
    const zoneFadeV = Math.max(0, 1 - t / ZONE_FADE)
    // რადიუსი: σ-ს ფარავს და გარანტირებულად იტევს რეალურ დაშვების წერტილს
    const sigma = round.resolution.detail.sigma
    const spread = Math.max(
      sigma * 2.2,
      distance(round.resolution.landing, round.shooter.aim) * 1.15,
      0.06,
    )
    for (const [ref, base] of [
      [zoneFill, 0.14],
      [zoneEdge, 0.55],
    ] as const) {
      const mesh = ref.current
      if (!mesh) continue
      mesh.visible = showZone
      mesh.scale.set(spread * GOAL_HALF_WIDTH, spread * GOAL_HEIGHT, 1)
      const m = mesh.material as THREE.MeshBasicMaterial
      m.opacity = base * zoneFadeV
    }
  })

  return (
    <group ref={group} visible={false}>
      {/* გაფანტვის ზონა — ერთეულოვანი წრე, scale აანისოტროპებს */}
      <mesh ref={zoneFill}>
        <circleGeometry args={[1, 40]} />
        <meshBasicMaterial color={PALETTE.sodium} transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh ref={zoneEdge}>
        <ringGeometry args={[0.94, 1, 48]} />
        <meshBasicMaterial color={PALETTE.sodium} transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* დამიზნების მარკერი */}
      <mesh ref={mark}>
        <ringGeometry args={[0.055, 0.09, 24]} />
        <meshBasicMaterial color={PALETTE.chalk} transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}
