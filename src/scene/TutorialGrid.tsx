import { PALETTE } from '../lib/palette'
import { GOAL_HALF_WIDTH, GOAL_HEIGHT } from '../lib/geometry'

/**
 * სასწავლო 3×3 ბადე კარზე — ახალი სესიის პირველ სამ დარტყმაზე.
 * განიერი ნახევრადგამჭვირვალე ზოლები (წვრილი ხაზები ბადეში იკარგებოდა).
 * სამი დარტყმის შემდეგ სამუდამოდ ქრება (localStorage დროშა).
 */
export function TutorialGrid({ visible }: { visible: boolean }) {
  if (!visible) return null

  const W = GOAL_HALF_WIDTH * 2
  const bar = { color: PALETTE.floodlight, transparent: true, opacity: 0.42, depthWrite: false }

  return (
    <group position={[0, 0, 0.07]}>
      {[1, 2].map((i) => (
        <mesh key={`v${i}`} position={[-GOAL_HALF_WIDTH + (W * i) / 3, GOAL_HEIGHT / 2, 0]}>
          <planeGeometry args={[0.13, GOAL_HEIGHT]} />
          <meshBasicMaterial {...bar} />
        </mesh>
      ))}
      {[1, 2].map((i) => (
        <mesh key={`h${i}`} position={[0, (GOAL_HEIGHT * i) / 3, 0]}>
          <planeGeometry args={[W, 0.13]} />
          <meshBasicMaterial {...bar} />
        </mesh>
      ))}
      {/* ჩარჩოს მსუბუქი შევსება, რომ ზონები უჯრებად იკითხებოდეს */}
      <mesh position={[0, GOAL_HEIGHT / 2, -0.005]}>
        <planeGeometry args={[W, GOAL_HEIGHT]} />
        <meshBasicMaterial color={PALETTE.floodlight} transparent opacity={0.07} depthWrite={false} />
      </mesh>
    </group>
  )
}
