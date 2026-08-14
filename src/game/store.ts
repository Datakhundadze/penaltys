/**
 * თამაშის მდგომარეობა (zustand).
 *
 * აქ ინახება ის, რაც UI-ს სჭირდება. სცენა ამ მდგომარეობას მხოლოდ კითხულობს —
 * three.js-ის ობიექტებში თამაშის ლოგიკისთვის საჭირო არაფერი წევს.
 * შედეგი ყოველთვის `resolveShot`-ით გამოითვლება ანიმაციამდე (§4).
 */

import { create } from 'zustand'
import { keeperCommitFromPower, type AnalyzedSwipe } from '../lib/controls'
import {
  KEEPER_PRESETS,
  ballFlightTime,
  botKeeperInput,
  botShooterInput,
  makeStats,
  resolveShot,
  roundSeed,
  type Difficulty,
  type KeeperInput,
  type ShooterInput,
  type ShotResolution,
  type Stats,
} from '../lib/physics'
import { REGULATION_KICKS, seriesStatus, shooterFor, type Kick, type Side } from './series'

export type Phase = 'aiming' | 'resolving' | 'animating' | 'between-rounds' | 'finished'

export type Screen = 'menu' | 'match'

/**
 * მოთამაშის სტატები ფაზა 0-ში ფიქსირებულია და ბოტის სამ დონეს შუაშია.
 * ფაზა 4-ში ეს პროფილიდან წამოვა.
 */
export const PLAYER_STATS: Stats = makeStats({
  power: 40,
  accuracy: 40,
  curve: 30,
  nerve: 40,
  reflex: 40,
  reach: 40,
  hands: 40,
  reading: 40,
})

export interface RoundRecord {
  readonly index: number
  readonly shooterSide: Side
  readonly shooter: ShooterInput
  readonly keeper: KeeperInput
  readonly resolution: ShotResolution
}

interface GameState {
  screen: Screen
  phase: Phase
  difficulty: Difficulty
  /** სერიის ფესვი — ყველა რაუნდის seed აქედან იშლება */
  rootSeed: number
  roundIndex: number
  kicks: Kick[]
  /** ბოლო მოსმის ხარისხი — უკუკავშირისთვის („სუფთა დარტყმა!") */
  lastQuality: number | null
  /** სესიაში ნასროლი პირველი დარტყმები — სასწავლო ბადე 3-ის შემდეგ ქრება */
  tutorialShots: number
  /** ბოლო გათამაშებული რაუნდი; ანიმაცია მხოლოდ ამას იმეორებს */
  round: RoundRecord | null

  startMatch: (difficulty: Difficulty) => void
  /** ერთი მოსმა ატარებს ყველაფერს: aim + power + quality → შედეგი მაშინვე */
  commitSwipe: (swipe: AnalyzedSwipe) => void
  finishAnimation: () => void
  nextRound: () => void
  backToMenu: () => void
}

const TUTORIAL_KEY = 'spot-tutorial-shots'
export const TUTORIAL_SHOTS = 3

function loadTutorialShots(): number {
  try {
    return Math.max(0, Number(globalThis.localStorage?.getItem(TUTORIAL_KEY)) || 0)
  } catch {
    return 0
  }
}

function saveTutorialShots(n: number): void {
  try {
    globalThis.localStorage?.setItem(TUTORIAL_KEY, String(n))
  } catch {
    /* private mode და მსგავსები — ბადე უბრალოდ ისევ გამოჩნდება */
  }
}

/** მოთამაშე ურტყამს ლუწ დარტყმებზე */
export function playerRole(roundIndex: number): 'shooter' | 'keeper' {
  return shooterFor(roundIndex) === 'player' ? 'shooter' : 'keeper'
}

function freshSeed(): number {
  // ერთადერთი ადგილი, სადაც შემთხვევითობა შემოდის — სერიის ფესვი.
  // ფაზა 2-ში ამას სერვერი გამოგზავნის (§4).
  return (Math.floor(Math.random() * 0xffffffff) >>> 0) || 1
}

export const useGame = create<GameState>((set, get) => ({
  screen: 'menu',
  phase: 'aiming',
  difficulty: 'normal',
  rootSeed: 1,
  roundIndex: 0,
  kicks: [],
  lastQuality: null,
  tutorialShots: loadTutorialShots(),
  round: null,

  startMatch: (difficulty) =>
    set({
      screen: 'match',
      phase: 'aiming',
      difficulty,
      rootSeed: freshSeed(),
      roundIndex: 0,
      kicks: [],
      lastQuality: null,
      round: null,
    }),

  commitSwipe: (swipe) => {
    const state = get()
    if (state.phase !== 'aiming' || !swipe.valid) return
    set({ phase: 'resolving', lastQuality: swipe.quality })

    const quality = swipe.quality
    const index = state.roundIndex
    const seed = roundSeed(state.rootSeed, index)
    const shooterSide = shooterFor(index)
    const botStats = KEEPER_PRESETS[state.difficulty]

    let shooter: ShooterInput
    let keeper: KeeperInput
    let shooterStats: Stats
    let keeperStats: Stats

    if (shooterSide === 'player') {
      shooterStats = PLAYER_STATS
      keeperStats = botStats
      shooter = { aim: swipe.aim, power: swipe.power, timing: quality }
      keeper = botKeeperInput(seed, state.difficulty, ballFlightTime(shooterStats.power))
    } else {
      shooterStats = botStats
      keeperStats = PLAYER_STATS
      shooter = botShooterInput(seed)
      const tBall = ballFlightTime(shooterStats.power)
      // მოთამაშის დივი: მიმართულება flick-იდან, სისწრაფე — რამდენად ადრე ეშვება
      keeper = { dive: swipe.aim, commitAt: keeperCommitFromPower(swipe.power, tBall) }
    }

    const resolution = resolveShot({ shooter, keeper }, shooterStats, keeperStats, seed)

    // სასწავლო ბადე მხოლოდ მოთამაშის პირველ დარტყმებს ითვლის
    let tutorialShots = state.tutorialShots
    if (shooterSide === 'player' && tutorialShots < TUTORIAL_SHOTS) {
      tutorialShots++
      saveTutorialShots(tutorialShots)
    }

    set({
      phase: 'animating',
      tutorialShots,
      round: { index, shooterSide, shooter, keeper, resolution },
    })
  },

  finishAnimation: () => {
    const state = get()
    if (state.phase !== 'animating' || !state.round) return

    const kicks: Kick[] = [
      ...state.kicks,
      {
        index: state.round.index,
        side: state.round.shooterSide,
        result: state.round.resolution.result,
        scored: state.round.resolution.scored,
      },
    ]

    set({ kicks, phase: seriesStatus(kicks).decided ? 'finished' : 'between-rounds' })
  },

  nextRound: () => {
    const state = get()
    if (state.phase !== 'between-rounds') return
    set({ phase: 'aiming', roundIndex: state.roundIndex + 1, round: null })
  },

  backToMenu: () => set({ screen: 'menu', phase: 'aiming', round: null, lastQuality: null }),
}))

/** მიმდინარე დარტყმის ნომერი ჩვენებისთვის (1-იდან) */
export function kickNumber(roundIndex: number): number {
  return Math.floor(roundIndex / 2) + 1
}

export { REGULATION_KICKS }
