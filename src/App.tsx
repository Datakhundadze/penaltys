import { useReducedMotion } from './hooks/useReducedMotion'
import { playerRole, useGame } from './game/store'
import { Scene } from './scene/Scene'
import { AimSurface } from './ui/AimSurface'
import { Finished } from './ui/Finished'
import { Hud } from './ui/Hud'
import { Menu } from './ui/Menu'
import { RoundResult } from './ui/RoundResult'
import { TimingBar } from './ui/TimingBar'
import { T } from './ui/strings'

export default function App() {
  const reducedMotion = useReducedMotion()

  const screen = useGame((s) => s.screen)
  const phase = useGame((s) => s.phase)
  const kicks = useGame((s) => s.kicks)
  const roundIndex = useGame((s) => s.roundIndex)
  const aim = useGame((s) => s.aim)
  const round = useGame((s) => s.round)
  const difficulty = useGame((s) => s.difficulty)

  const startMatch = useGame((s) => s.startMatch)
  const setAim = useGame((s) => s.setAim)
  const commitAim = useGame((s) => s.commitAim)
  const commitTiming = useGame((s) => s.commitTiming)
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
  // ერთი ორკესტრირებული მომენტი: ბურთის ფრენისას chrome ჩუმდება
  const muted = phase === 'animating' || phase === 'resolving'

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-night select-none"
      data-screen={screen}
      data-phase={phase}
    >
      <Scene
        phase={phase}
        round={round}
        aim={inMatch && (phase === 'aiming' || phase === 'timing') ? (aim?.aim ?? null) : null}
        aimPower={aim?.power ?? 0}
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
              opacity: phase === 'aiming' || phase === 'timing' ? 0.9 : 0,
              color: tone === 'sodium' ? 'var(--color-sodium)' : 'var(--color-floodlight)',
            }}
          >
            {role === 'shooter' ? T.shootTurn : T.keepTurn}
          </p>

          {phase === 'aiming' && (
            <AimSurface
              onPreview={setAim}
              onCommit={commitAim}
              tone={tone}
              hint={role === 'shooter' ? T.aimHintShoot : T.aimHintKeep}
            />
          )}

          {phase === 'timing' && (
            <TimingBar
              onStop={commitTiming}
              tone={tone}
              hint={role === 'shooter' ? T.timingHintShoot : T.timingHintKeep}
            />
          )}

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
