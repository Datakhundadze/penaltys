import { REGULATION_KICKS, ledgerFor, seriesStatus, type Kick } from '../game/series'
import { kickNumber } from '../game/store'
import { Ledger } from './Ledger'
import { T } from './strings'

export interface HudProps {
  kicks: readonly Kick[]
  currentIndex: number | null
  /** ბურთის ფრენისას UI ჩუმდება (§8) */
  muted: boolean
}

/**
 * მინიმალური HUD — ორი ledger რიგი და დარტყმის ნომერი.
 * §8: ledger არის ერთადერთი პროგრესის ენა, ციფრებს ის ცვლის.
 */
export function Hud({ kicks, currentIndex, muted }: HudProps) {
  const status = seriesStatus(kicks)

  return (
    <header
      className="pointer-events-none absolute inset-x-0 top-0 z-20 px-4 pt-[max(1rem,env(safe-area-inset-top))] transition-opacity duration-500"
      style={{ opacity: muted ? 0.12 : 1 }}
    >
      <div className="mx-auto flex w-full max-w-md items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-2xs tracking-wide opacity-60">{T.you}</p>
          <Ledger cells={ledgerFor(kicks, 'player', currentIndex)} tone="sodium" />
        </div>

        <div className="pt-0.5 text-center">
          <p className="tabular text-base leading-none">
            {status.player}–{status.bot}
          </p>
          {currentIndex !== null && (
            <p className="mt-1.5 text-2xs opacity-50">
              {status.suddenDeath
                ? T.suddenDeath
                : `${T.kick} ${kickNumber(currentIndex)}/${REGULATION_KICKS}`}
            </p>
          )}
        </div>

        <div>
          <p className="mb-2 text-right text-2xs tracking-wide opacity-60">{T.bot}</p>
          <Ledger cells={ledgerFor(kicks, 'bot', currentIndex)} tone="floodlight" align="right" />
        </div>
      </div>
    </header>
  )
}
