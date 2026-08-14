import { BALL_START } from './lib/geometry'
import { useReducedMotion } from './hooks/useReducedMotion'
import { Scene } from './scene/Scene'

export default function App() {
  const reducedMotion = useReducedMotion()

  return (
    <div className="relative h-full w-full overflow-hidden bg-night">
      <Scene
        ballPosition={BALL_START}
        ballSpin={0}
        shooterSwing={0}
        shooterLean={0}
        keeperDive={{ x: 0, y: 0 }}
        keeperProgress={0}
        netImpact={null}
        focus={0}
        reducedMotion={reducedMotion}
      />
    </div>
  )
}
