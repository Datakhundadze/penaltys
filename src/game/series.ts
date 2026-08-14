/**
 * სერიის წესები — 5+5, შემდეგ გადამწყვეტი წყვილები.
 * სუფთა ფუნქციები, რომ ტესტირებადი იყოს და ფაზა 2-ში სერვერზეც გამოდგეს.
 */

import type { ShotResult } from '../lib/physics'

export type Side = 'player' | 'bot'

export interface Kick {
  /** რიგითობა სერიაში, 0-იდან */
  readonly index: number
  /** ვინ ურტყამდა */
  readonly side: Side
  readonly result: ShotResult
  readonly scored: boolean
}

/** რეგულარული სერიის დარტყმები თითო მხარეს */
export const REGULATION_KICKS = 5

/** როლები ყოველ დარტყმაზე იცვლება — ლუწი ინდექსი მოთამაშისაა */
export function shooterFor(index: number): Side {
  return index % 2 === 0 ? 'player' : 'bot'
}

export interface SeriesStatus {
  readonly player: number
  readonly bot: number
  readonly playerKicks: number
  readonly botKicks: number
  readonly decided: boolean
  readonly winner: Side | null
  readonly suddenDeath: boolean
}

export function seriesStatus(kicks: readonly Kick[]): SeriesStatus {
  let player = 0
  let bot = 0
  let playerKicks = 0
  let botKicks = 0

  for (const k of kicks) {
    if (k.side === 'player') {
      playerKicks++
      if (k.scored) player++
    } else {
      botKicks++
      if (k.scored) bot++
    }
  }

  const regulationDone = playerKicks >= REGULATION_KICKS && botKicks >= REGULATION_KICKS
  let winner: Side | null = null

  if (!regulationDone) {
    // ვერ დაეწევა? სერია აქვე მთავრდება
    const playerLeft = Math.max(0, REGULATION_KICKS - playerKicks)
    const botLeft = Math.max(0, REGULATION_KICKS - botKicks)
    if (player > bot + botLeft) winner = 'player'
    else if (bot > player + playerLeft) winner = 'bot'
  } else if (playerKicks === botKicks && player !== bot) {
    // რეგულარულის ან გადამწყვეტი წყვილის ბოლოს
    winner = player > bot ? 'player' : 'bot'
  }

  const suddenDeath =
    playerKicks > REGULATION_KICKS ||
    botKicks > REGULATION_KICKS ||
    (playerKicks === REGULATION_KICKS && botKicks === REGULATION_KICKS && player === bot)

  return {
    player,
    bot,
    playerKicks,
    botKicks,
    decided: winner !== null,
    winner,
    suddenDeath,
  }
}

/** §8 — ledger-ის უჯრა */
export type LedgerCell = 'scored' | 'missed' | 'current' | 'pending'

/**
 * ერთი მხარის რიგი: ●●○●◐
 * რეგულარულ 5-ს ემატება გადამწყვეტში ნათამაშები დარტყმები.
 */
export function ledgerFor(
  kicks: readonly Kick[],
  side: Side,
  currentIndex: number | null,
): LedgerCell[] {
  const own = kicks.filter((k) => k.side === side)
  const currentIsOurs = currentIndex !== null && shooterFor(currentIndex) === side

  const cells: LedgerCell[] = own.map((k) => (k.scored ? 'scored' : 'missed'))
  if (currentIsOurs) cells.push('current')
  while (cells.length < REGULATION_KICKS) cells.push('pending')
  return cells
}
