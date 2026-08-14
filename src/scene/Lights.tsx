import { PALETTE } from '../lib/palette'
import { PENALTY_SPOT_Z } from '../lib/geometry'
import type { Quality } from './textures'

/**
 * §8 — ორი ტემპერატურის შუქი.
 * თბილი ნატრიუმი ანძებიდან (Stadium-ის კონუსები ამავე წყაროს ყალბი
 * ვოლუმეტრიკაა), ცივი ჰალოგენი კარის უკნიდან.
 * ამბერი ყოველთვის დამრტყმელია, ცივი ლურჯი ყოველთვის მეკარე.
 */
export function Lights({ quality = 'high' }: { quality?: Quality }) {
  const shadowSize = quality === 'high' ? 2048 : 1024

  return (
    <>
      <ambientLight intensity={0.22} color="#3a5c48" />
      <hemisphereLight args={['#5c8a80', '#1c3d26', 0.4]} />

      {/* მთავარი ნატრიუმი — მარჯვენა ანძიდან, ჩრდილს აგდებს */}
      <spotLight
        position={[13.5, 11.5, -20]}
        angle={0.62}
        penumbra={1}
        decay={1.8}
        intensity={1150}
        color={PALETTE.sodium}
        castShadow
        shadow-mapSize={[shadowSize, shadowSize]}
        shadow-camera-near={6}
        shadow-camera-far={60}
        shadow-bias={-0.0011}
        shadow-radius={7}
        target-position={[0, 0, PENALTY_SPOT_Z - 2]}
      />

      {/* მეორე ნატრიუმი — მარცხენა ანძიდან, ჩრდილის გარეშე */}
      <spotLight
        position={[-13.5, 11.5, -20]}
        angle={0.66}
        penumbra={1}
        decay={1.9}
        intensity={620}
        color={PALETTE.sodium}
        target-position={[0, 0, PENALTY_SPOT_Z]}
      />

      {/* რბილი თბილი შევსება დამრტყმელის მხრიდან */}
      <spotLight
        position={[6, 12, PENALTY_SPOT_Z + 8]}
        angle={0.8}
        penumbra={1}
        decay={2}
        intensity={850}
        color={PALETTE.sodium}
      />

      {/* ცივი ანარეკლი — კარის უკნიდან, მეკარეს კიდეს უსვამს */}
      <spotLight
        position={[-7, 7, -8]}
        angle={0.95}
        penumbra={1}
        decay={2}
        intensity={950}
        color={PALETTE.floodlight}
      />
      {/* ცივი შევსება კარის წინ — მეკარე ლურჯად უნდა იკითხებოდეს */}
      <pointLight position={[0, 3.4, 5.5]} decay={2} intensity={95} color={PALETTE.floodlight} />
    </>
  )
}
