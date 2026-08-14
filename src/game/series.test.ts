import { describe, expect, it } from 'vitest'
import { REGULATION_KICKS, ledgerFor, seriesStatus, shooterFor, type Kick } from './series'

/**
 * ორი რიგი — მოთამაშისა და ბოტის. 'g' = გოლი, '.' = არა.
 * დარტყმები ენაცვლება, მოთამაშე იწყებს.
 */
function series(player: string, bot: string): Kick[] {
  const kicks: Kick[] = []
  for (let i = 0; i < Math.max(player.length, bot.length); i++) {
    for (const [row, side] of [
      [player, 'player'],
      [bot, 'bot'],
    ] as const) {
      const c = row[i]
      if (c === undefined) continue
      const index = kicks.length
      // ინდექსი და მხარე თანმიმდევრობით უნდა ემთხვეოდეს shooterFor-ს
      expect(shooterFor(index)).toBe(side)
      kicks.push({
        index,
        side,
        result: c === 'g' ? 'goal' : 'save',
        scored: c === 'g',
      })
    }
  }
  return kicks
}

describe('shooterFor', () => {
  it('alternates roles every kick, player first', () => {
    expect([0, 1, 2, 3, 4].map(shooterFor)).toEqual(['player', 'bot', 'player', 'bot', 'player'])
  })
})

describe('seriesStatus', () => {
  it('starts level and undecided', () => {
    const s = seriesStatus([])
    expect(s).toMatchObject({ player: 0, bot: 0, decided: false, winner: null, suddenDeath: false })
  })

  it('counts only scored kicks per side', () => {
    const s = seriesStatus(series('gg', 'g.'))
    expect(s.player).toBe(2)
    expect(s.bot).toBe(1)
    expect(s.playerKicks).toBe(2)
    expect(s.botKicks).toBe(2)
  })

  it('decides a full 5+5 when the scores differ', () => {
    const s = seriesStatus(series('ggggg', 'ggg..'))
    expect(s.decided).toBe(true)
    expect(s.winner).toBe('player')
    expect(s.player).toBe(5)
    expect(s.bot).toBe(3)
  })

  it('stops early once a side cannot be caught', () => {
    // მოთამაშემ 3/3, ბოტმა 0/3 — ბოტს 2 დარჩა, ვერ დაეწევა
    const s = seriesStatus(series('ggg', '...'))
    expect(s.decided).toBe(true)
    expect(s.winner).toBe('player')
    expect(s.playerKicks).toBe(3)
  })

  it('does not decide while the trailing side can still catch up', () => {
    const s = seriesStatus(series('gg', '..'))
    expect(s.decided).toBe(false)
  })

  it('lets the bot win early too', () => {
    const s = seriesStatus(series('...', 'ggg'))
    expect(s.decided).toBe(true)
    expect(s.winner).toBe('bot')
  })

  it('goes to sudden death on a tie after regulation', () => {
    const s = seriesStatus(series('ggg..', 'ggg..'))
    expect(s.player).toBe(3)
    expect(s.bot).toBe(3)
    expect(s.decided).toBe(false)
    expect(s.suddenDeath).toBe(true)
  })

  it('stays undecided mid-pair in sudden death', () => {
    const s = seriesStatus(series('ggg..g', 'ggg..'))
    expect(s.suddenDeath).toBe(true)
    expect(s.decided).toBe(false)
    expect(s.playerKicks).toBe(6)
    expect(s.botKicks).toBe(5)
  })

  it('decides a completed sudden-death pair', () => {
    const s = seriesStatus(series('ggg..g', 'ggg...'))
    expect(s.decided).toBe(true)
    expect(s.winner).toBe('player')
  })

  it('keeps going when a sudden-death pair is level', () => {
    const s = seriesStatus(series('ggg..g', 'ggg..g'))
    expect(s.decided).toBe(false)
    expect(s.suddenDeath).toBe(true)
  })

  it('never reports a winner without deciding', () => {
    for (let n = 0; n <= 5; n++) {
      const s = seriesStatus(series('g'.repeat(n), '.'.repeat(n)))
      expect(s.decided).toBe(s.winner !== null)
    }
  })
})

describe('ledgerFor', () => {
  it('always shows the five regulation slots', () => {
    expect(ledgerFor([], 'player', null)).toHaveLength(REGULATION_KICKS)
  })

  it('fills scored and missed kicks, then pads with pending', () => {
    const kicks = series('gg', '.')
    expect(ledgerFor(kicks, 'player', null)).toEqual([
      'scored',
      'scored',
      'pending',
      'pending',
      'pending',
    ])
    expect(ledgerFor(kicks, 'bot', null)).toEqual([
      'missed',
      'pending',
      'pending',
      'pending',
      'pending',
    ])
  })

  it('marks the kick in progress on the side taking it', () => {
    const afterOnePair = series('g', '.')
    expect(ledgerFor(afterOnePair, 'player', 2)[1]).toBe('current')
    expect(ledgerFor(afterOnePair, 'bot', 2)).not.toContain('current')

    const midPair = series('gg', '.')
    expect(ledgerFor(midPair, 'bot', 3)[1]).toBe('current')
  })

  it('grows past five in sudden death', () => {
    expect(ledgerFor(series('ggg..g', 'ggg..'), 'player', null)).toHaveLength(6)
  })
})
