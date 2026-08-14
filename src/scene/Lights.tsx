import { PALETTE } from '../lib/palette'
import { PENALTY_SPOT_Z } from '../lib/geometry'

/**
 * §8 — ორი ტემპერატურის შუქი.
 * თბილი ნატრიუმი დამრტყმელის მხრიდან, ცივი ჰალოგენი კარის უკნიდან.
 * ამბერი ყოველთვის დამრტყმელია, ცივი ლურჯი ყოველთვის მეკარე.
 */
export function Lights({ shadows = true }: { shadows?: boolean }) {
  return (
    <>
      <ambientLight intensity={0.12} color={PALETTE.floodlight} />
      <hemisphereLight args={[PALETTE.floodlight, PALETTE.turf, 0.18]} />

      {/* პროჟექტორი — თბილი, დამრტყმელის მხარეს, ჩრდილს აგდებს */}
      <spotLight
        position={[6, 12, PENALTY_SPOT_Z - 2]}
        angle={0.72}
        penumbra={1}
        decay={2}
        intensity={2000}
        color={PALETTE.sodium}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={4}
        shadow-camera-far={45}
        shadow-bias={-0.0015}
      />

      {/* მეორე პროჟექტორი მარცხნიდან — სუსტი, ჩრდილს არ აგდებს */}
      <spotLight
        position={[-10, 11, PENALTY_SPOT_Z + 3]}
        angle={0.85}
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
