import { PALETTE } from '../lib/palette'
import type { ShotResult } from '../lib/physics'
import type { Side } from '../game/series'
import { RESULT_LABEL, T } from './strings'

export interface RoundResultProps {
  result: ShotResult
  /** ვინ ურტყამდა — ფერი §8-ის ორ ტემპერატურას მიჰყვება */
  shooterSide: Side
  onNext: () => void
}

/** ბოძს და აუტს წითელი ბარათის ფერი აქვს, გოლს — მოურტყმელის ფერი */
function toneFor(result: ShotResult, shooterSide: Side): string {
  if (result === 'goal') return shooterSide === 'player' ? PALETTE.sodium : PALETTE.floodlight
  if (result === 'post' || result === 'out') return PALETTE.card
  return shooterSide === 'player' ? PALETTE.floodlight : PALETTE.sodium
}

export function RoundResult({ result, shooterSide, onNext }: RoundResultProps) {
  const color = toneFor(result, shooterSide)

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-end pb-12">
      <p
        className="display text-lg leading-none sm:text-xl"
        style={{ color, textShadow: `0 0 34px ${color}55` }}
      >
        {RESULT_LABEL[result]}
      </p>
      <button
        type="button"
        onClick={onNext}
        autoFocus
        className="mt-7 rounded-sm border border-chalk/20 px-7 py-3 text-sm"
      >
        {T.next}
      </button>
    </div>
  )
}
