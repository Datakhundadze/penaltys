import { useReducedMotion } from './hooks/useReducedMotion'
import { playerRole, useGame } from './game/store'
import { Scene } from './scene/Scene'
import { AimSurface } from './ui/AimSurface'
import { Finished } from './ui/Finished'
import { Hud } from './ui/Hud'
import { Menu } from './ui/Menu'
import { QualityFlash } from './ui/QualityFlash'
import { RoundResult } from './ui/RoundResult'
import { T } from './ui/strings'

export default function App() {
  const reducedMotion = useReducedMotion()

  const screen = useGame((s) => s.screen)
  const phase = useGame((s) => s.phase)
  const kicks = useGame((s) => s.kicks)
  const roundIndex = useGame((s) => s.roundIndex)
  const round = useGame((s) => s.round)
  const difficulty = useGame((s) => s.difficulty)

  const startMatch = useGame((s) => s.startMatch)
  const commitSwipe = useGame((s) => s.commitSwipe)
  const lastQuality = useGame((s) => s.lastQuality)
  const finishAnimation = useGame((s) => s.finishAnimation)
  const nextRound = useGame((s) => s.nextRound)
  const backToMenu = useGame((s) => s.backToMenu)

  // შედეგის ჩვენებისას ledger უკვე შემდეგ დარტყმაზე იყურება
  const pendingIndex =
    phase === 'finished' ? null : phase === 'between-rounds' ? roundIndex + 1 : roundIndex
  const role = playerRole(pendingIndex ?? roundIndex)
  // §8 — ამბერი ყოველთვის დამრტყმელია, ცივი ლურჯი ყოველთვის მეკარე
  const tone = role === 'shooter' ? 'sodium' : 'floodlight'
  const inMatch = screen === 'match'
  // §8 — ერთი ორკესტრირებული მომენტი: ბურთის ფრენისას chrome ჩუმდება.
  // გოლზე ხმა მაშინვე ბრუნდება, გაშვებაზე სიჩუმე ცოტა ხანს რჩება.
  const muted =
    phase === 'animating' ||
    phase === 'resolving' ||
    (phase === 'between-rounds' && round?.resolution.result !== 'goal')

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-night select-none"
      data-screen={screen}
      data-phase={phase}
    >
      <Scene
        phase={phase}
        round={round}
        tone={tone}
        reducedMotion={reducedMotion}
        onAnimationEnd={finishAnimation}
      />

      {inMatch && (
        <>
          <Hud kicks={kicks} currentIndex={pendingIndex} muted={muted} />

          <p
            className="pointer-events-none absolute inset-x-0 top-24 z-20 text-center text-sm transition-opacity duration-500"
            style={{
              opacity: phase === 'aiming' ? 0.9 : 0,
              color: tone === 'sodium' ? 'var(--color-sodium)' : 'var(--color-floodlight)',
            }}
          >
            {role === 'shooter' ? T.shootTurn : T.keepTurn}
          </p>

          {phase === 'aiming' && (
            <AimSurface
              onCommit={commitSwipe}
              tone={tone}
              hint={role === 'shooter' ? T.aimHintShoot : T.aimHintKeep}
            />
          )}

          <QualityFlash
            quality={lastQuality}
            active={phase === 'animating' || phase === 'resolving'}
          />

          {phase === 'between-rounds' && round && (
            <RoundResult
              result={round.resolution.result}
              shooterSide={round.shooterSide}
              onNext={nextRound}
            />
          )}

          {phase === 'finished' && (
            <Finished
              kicks={kicks}
              onAgain={() => startMatch(difficulty)}
              onMenu={backToMenu}
            />
          )}
        </>
      )}

      {screen === 'menu' && <Menu onStart={startMatch} />}
    </div>
  )
}
