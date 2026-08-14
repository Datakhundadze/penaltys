import { PALETTE } from '../lib/palette'
import { ledgerFor, seriesStatus, type Kick } from '../game/series'
import { Ledger } from './Ledger'
import { T } from './strings'

export interface FinishedProps {
  kicks: readonly Kick[]
  onAgain: () => void
  onMenu: () => void
}

export function Finished({ kicks, onAgain, onMenu }: FinishedProps) {
  const status = seriesStatus(kicks)
  const won = status.winner === 'player'
  const color = won ? PALETTE.sodium : PALETTE.card

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-night/82 px-6 backdrop-blur-[2px]">
      <p className="display text-lg leading-none sm:text-xl" style={{ color }}>
        {won ? T.won : T.lost}
      </p>
      <p className="tabular mt-5 text-xl leading-none">
        {status.player}–{status.bot}
      </p>

      <div className="mt-9 flex w-full max-w-xs flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-2xs opacity-60">{T.you}</span>
          <Ledger cells={ledgerFor(kicks, 'player', null)} tone="sodium" align="right" />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-2xs opacity-60">{T.bot}</span>
          <Ledger cells={ledgerFor(kicks, 'bot', null)} tone="floodlight" align="right" />
        </div>
      </div>

      <div className="mt-10 flex w-full max-w-xs gap-3">
        <button
          type="button"
          onClick={onAgain}
          autoFocus
          className="flex-1 rounded-sm bg-sodium px-4 py-3.5 text-sm font-semibold text-night"
        >
          {T.again}
        </button>
        <button
          type="button"
          onClick={onMenu}
          className="rounded-sm border border-chalk/20 px-5 py-3.5 text-sm"
        >
          {T.menu}
        </button>
      </div>
    </div>
  )
}
