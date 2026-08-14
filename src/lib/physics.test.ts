import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SHOOTER,
  KEEPER_PRESETS,
  ballFlightTime,
  botKeeperInput,
  classifyLanding,
  curveDrift,
  dispersion,
  gaussPair,
  isEarlyCommit,
  landingPoint,
  mulberry32,
  pickKeeperDive,
  resolveShot,
  roundSeed,
  saveProbability,
  saveRadius,
  type RoundInput,
  type Stats,
} from './physics'

const stats = (over: Partial<Stats> = {}): Stats => ({ ...DEFAULT_SHOOTER, ...over })

const round = (over: Partial<RoundInput> = {}): RoundInput => ({
  shooter: { aim: { x: 0.5, y: 0.4 }, power: 0.7, timing: 0.8 },
  keeper: { dive: { x: -0.5, y: 0.3 }, commitAt: 0.5 },
  ...over,
})

describe('mulberry32', () => {
  it('stays inside [0, 1)', () => {
    const rng = mulberry32(12345)
    for (let i = 0; i < 5000; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('is reproducible for the same seed and diverges for different seeds', () => {
    const a = mulberry32(7)
    const b = mulberry32(7)
    const c = mulberry32(8)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
    expect(mulberry32(7)()).not.toEqual(c())
  })
})

describe('gaussPair', () => {
  it('has roughly zero mean and unit variance', () => {
    const rng = mulberry32(99)
    const samples: number[] = []
    for (let i = 0; i < 20000; i++) {
      const [g1, g2] = gaussPair(rng)
      samples.push(g1, g2)
    }
    const mean = samples.reduce((s, v) => s + v, 0) / samples.length
    const variance = samples.reduce((s, v) => s + (v - mean) ** 2, 0) / samples.length
    expect(Math.abs(mean)).toBeLessThan(0.03)
    expect(variance).toBeGreaterThan(0.95)
    expect(variance).toBeLessThan(1.05)
  })
})

describe('dispersion — σ (SPEC §5)', () => {
  it('matches the formula exactly', () => {
    // σ = 0.22 × (1 − ACC/150) × (1 + 0.5×(power − 0.5)) × (1.4 − 0.4×timing)
    const expected = 0.22 * (1 - 60 / 150) * (1 + 0.5 * (0.8 - 0.5)) * (1.4 - 0.4 * 0.25)
    expect(dispersion(0.8, 0.25, 60)).toBeCloseTo(expected, 12)
  })

  it('higher ACC gives lower σ', () => {
    const low = dispersion(0.6, 0.5, 20)
    const mid = dispersion(0.6, 0.5, 60)
    const high = dispersion(0.6, 0.5, 100)
    expect(mid).toBeLessThan(low)
    expect(high).toBeLessThan(mid)
  })

  it('higher power raises σ and better timing lowers it', () => {
    expect(dispersion(1, 0.5, 50)).toBeGreaterThan(dispersion(0, 0.5, 50))
    expect(dispersion(0.5, 1, 50)).toBeLessThan(dispersion(0.5, 0, 50))
  })

  it('never goes negative', () => {
    expect(dispersion(1, 0, 200)).toBe(0)
  })
})

describe('classifyLanding — bounds (SPEC §5)', () => {
  it('calls anything past the posts or the bar out', () => {
    expect(classifyLanding({ x: 1.01, y: 0.5 })).toBe('out')
    expect(classifyLanding({ x: -1.4, y: 0.5 })).toBe('out')
    expect(classifyLanding({ x: 0, y: 1.001 })).toBe('out')
  })

  it('calls 0.95 < |x| <= 1.0 a post', () => {
    expect(classifyLanding({ x: 0.96, y: 0.5 })).toBe('post')
    expect(classifyLanding({ x: -1.0, y: 0.2 })).toBe('post')
    expect(classifyLanding({ x: 0.95, y: 0.5 })).toBe('in')
  })

  it('calls the rest in', () => {
    expect(classifyLanding({ x: 0, y: 0 })).toBe('in')
    expect(classifyLanding({ x: -0.5, y: 1.0 })).toBe('in')
  })
})

describe('landingPoint', () => {
  it('is aim plus gaussian noise scaled by σ', () => {
    const p = landingPoint({ x: 0.2, y: 0.4 }, 0.1, [1, -2])
    expect(p.x).toBeCloseTo(0.3, 12)
    expect(p.y).toBeCloseTo(0.2, 12)
  })

  it('collapses onto aim when σ is zero', () => {
    expect(landingPoint({ x: 0.2, y: 0.4 }, 0, [3, -3])).toEqual({ x: 0.2, y: 0.4 })
  })
})

describe('ballFlightTime — SPEC §5 range', () => {
  it('spans ≈0.68s (weakest) to ≈0.40s (max POWER)', () => {
    expect(ballFlightTime(0)).toBeCloseTo(0.678, 3)
    expect(ballFlightTime(100)).toBeCloseTo(0.407, 3)
  })

  it('is monotonically faster with more POWER', () => {
    expect(ballFlightTime(80)).toBeLessThan(ballFlightTime(30))
  })
})

describe('saveRadius / saveProbability — SPEC §5', () => {
  it('R = 0.28 + REACH/400', () => {
    expect(saveRadius(0)).toBeCloseTo(0.28, 12)
    expect(saveRadius(100)).toBeCloseTo(0.53, 12)
  })

  it('matches the p_save formula before clamping', () => {
    const d = 0.2
    const r = saveRadius(40)
    const expected = 0.9 - 0.6 * (d / r) - 0.2 * (30 / 100) + 50 / 500
    expect(saveProbability(d, r, 30, 50, false)).toBeCloseTo(expected, 12)
  })

  it('clamps into [0.05, 0.95]', () => {
    expect(saveProbability(0, 0.5, 0, 100, false)).toBe(0.95)
    // d > R is a goal before this is ever called, so the floor only shows up
    // if the formula is fed out-of-range values.
    expect(saveProbability(2, 1, 100, 0, false)).toBe(0.05)
  })

  it('bottoms out at 0.10 for the worst legal shot the keeper can reach', () => {
    expect(saveProbability(0.53, 0.53, 100, 0, false)).toBeCloseTo(0.1, 12)
  })

  it('subtracts the early-commit penalty and never goes negative', () => {
    const r = saveRadius(40)
    const late = saveProbability(0.1, r, 40, 40, false)
    const early = saveProbability(0.1, r, 40, 40, true)
    expect(late - early).toBeCloseTo(0.15, 12)
    expect(saveProbability(0.38, 0.38, 100, 0, true)).toBe(0)
  })

  it('falls as the dive lands further from the ball', () => {
    const r = saveRadius(40)
    expect(saveProbability(0.3, r, 40, 40, false)).toBeLessThan(
      saveProbability(0.05, r, 40, 40, false),
    )
  })
})

describe('isEarlyCommit / curveDrift', () => {
  it('flags a dive started more than 0.25s before arrival', () => {
    expect(isEarlyCommit(0.2, 0.6)).toBe(true)
    expect(isEarlyCommit(0.35, 0.6)).toBe(false)
    expect(isEarlyCommit(0.6, 0.6)).toBe(false)
  })

  it('only drifts the ball away from an early dive', () => {
    expect(curveDrift(100, false)).toBe(0)
    expect(curveDrift(0, true)).toBe(0)
    expect(curveDrift(100, true)).toBeGreaterThan(curveDrift(30, true))
  })
})

describe('resolveShot — determinism', () => {
  it('same seed and same inputs give the identical result', () => {
    const input = round()
    for (const seed of [1, 42, 999, 123456]) {
      const a = resolveShot(input, DEFAULT_SHOOTER, KEEPER_PRESETS.normal, seed)
      const b = resolveShot(input, DEFAULT_SHOOTER, KEEPER_PRESETS.normal, seed)
      expect(a).toEqual(b)
    }
  })

  it('different seeds move the landing point', () => {
    const input = round()
    const a = resolveShot(input, DEFAULT_SHOOTER, KEEPER_PRESETS.normal, 1)
    const b = resolveShot(input, DEFAULT_SHOOTER, KEEPER_PRESETS.normal, 2)
    expect(a.landing).not.toEqual(b.landing)
  })

  it('mutates nothing it is given', () => {
    const input = round()
    const snapshot = JSON.parse(JSON.stringify(input))
    resolveShot(input, DEFAULT_SHOOTER, KEEPER_PRESETS.hard, 77)
    expect(input).toEqual(snapshot)
  })
})

describe('resolveShot — outcomes', () => {
  it('landing outside the frame is out, whatever the keeper does', () => {
    const input = round({
      shooter: { aim: { x: 2.5, y: 0.5 }, power: 0.5, timing: 1 },
      keeper: { dive: { x: 1, y: 0.5 }, commitAt: 0.6 },
    })
    for (let seed = 1; seed <= 200; seed++) {
      const r = resolveShot(input, DEFAULT_SHOOTER, KEEPER_PRESETS.hard, seed)
      expect(r.result).toBe('out')
      expect(r.scored).toBe(false)
    }
  })

  it('a high aim over the bar is out', () => {
    const input = round({
      shooter: { aim: { x: 0, y: 3 }, power: 0.5, timing: 1 },
      keeper: { dive: { x: 0, y: 0.5 }, commitAt: 0.6 },
    })
    expect(resolveShot(input, DEFAULT_SHOOTER, KEEPER_PRESETS.hard, 5).result).toBe('out')
  })

  it('d > R is always a goal — the keeper never gets a roll', () => {
    // σ = 0 (ACC 150) so the ball lands exactly on the aim point.
    const perfect = { ...DEFAULT_SHOOTER, accuracy: 150 }
    const input = round({
      shooter: { aim: { x: 0.9, y: 0.9 }, power: 0.9, timing: 1 },
      keeper: { dive: { x: -0.9, y: 0 }, commitAt: 0.6 },
    })
    for (let seed = 1; seed <= 200; seed++) {
      const r = resolveShot(input, perfect, KEEPER_PRESETS.hard, seed)
      expect(r.result).toBe('goal')
      expect(r.scored).toBe(true)
      expect(r.detail.distance).toBeGreaterThan(r.detail.reach)
    }
  })

  it('the post band resolves to post, not save', () => {
    const perfect = { ...DEFAULT_SHOOTER, accuracy: 150 }
    const input = round({
      shooter: { aim: { x: -0.98, y: 0.4 }, power: 0.9, timing: 1 },
      keeper: { dive: { x: -0.98, y: 0.4 }, commitAt: 0.6 },
    })
    const r = resolveShot(input, perfect, KEEPER_PRESETS.hard, 3)
    expect(r.result).toBe('post')
    expect(r.scored).toBe(false)
    expect(r.detail.postSide).toBe(-1)
  })

  it('a dive right on the ball saves it far more often than not', () => {
    const perfect = { ...DEFAULT_SHOOTER, accuracy: 150, power: 20 }
    const input = round({
      shooter: { aim: { x: 0.3, y: 0.3 }, power: 0.5, timing: 1 },
      keeper: { dive: { x: 0.3, y: 0.3 }, commitAt: 10 },
    })
    let stopped = 0
    for (let seed = 1; seed <= 400; seed++) {
      const r = resolveShot(input, perfect, KEEPER_PRESETS.hard, seed)
      if (r.result === 'save' || r.result === 'rebound') stopped++
    }
    expect(stopped / 400).toBeGreaterThan(0.8)
  })

  it('never scores a save, a rebound, a post or an out', () => {
    for (let seed = 1; seed <= 500; seed++) {
      const r = resolveShot(round(), DEFAULT_SHOOTER, KEEPER_PRESETS.normal, seed)
      expect(r.scored).toBe(r.result === 'goal')
    }
  })

  it('rebounds happen when HANDS are low and stop when HANDS are perfect', () => {
    const perfect = { ...DEFAULT_SHOOTER, accuracy: 150, power: 0 }
    const input = round({
      shooter: { aim: { x: 0.2, y: 0.2 }, power: 0.5, timing: 1 },
      keeper: { dive: { x: 0.2, y: 0.2 }, commitAt: 10 },
    })
    const count = (hands: number) => {
      let n = 0
      for (let seed = 1; seed <= 300; seed++) {
        const keeper = { ...KEEPER_PRESETS.hard, hands }
        if (resolveShot(input, perfect, keeper, seed).result === 'rebound') n++
      }
      return n
    }
    expect(count(0)).toBeGreaterThan(count(50))
    expect(count(100)).toBe(0)
  })

  it('an early-committing keeper concedes more than a patient one', () => {
    const shooter = { ...DEFAULT_SHOOTER, power: 50 }
    const tBall = ballFlightTime(shooter.power)
    const goals = (commitAt: number) => {
      let n = 0
      for (let seed = 1; seed <= 800; seed++) {
        const input = round({
          shooter: { aim: { x: 0.35, y: 0.35 }, power: 0.5, timing: 0.8 },
          keeper: { dive: { x: 0.35, y: 0.35 }, commitAt },
        })
        if (resolveShot(input, shooter, KEEPER_PRESETS.normal, seed).scored) n++
      }
      return n
    }
    expect(goals(0)).toBeGreaterThan(goals(tBall))
  })

  it('a better keeper concedes fewer goals than a weaker one', () => {
    const shooter = { ...DEFAULT_SHOOTER, accuracy: 45, power: 45 }
    const goals = (difficulty: 'easy' | 'hard') => {
      let n = 0
      for (let seed = 1; seed <= 1000; seed++) {
        const tBall = ballFlightTime(shooter.power)
        const input: RoundInput = {
          shooter: { aim: { x: 0.45, y: 0.35 }, power: 0.6, timing: 0.7 },
          keeper: botKeeperInput(seed, difficulty, tBall),
        }
        if (resolveShot(input, shooter, KEEPER_PRESETS[difficulty], seed).scored) n++
      }
      return n
    }
    expect(goals('hard')).toBeLessThan(goals('easy'))
  })

  it('higher ACC lands the ball closer to the aim point on average', () => {
    const aim = { x: 0.6, y: 0.5 }
    const meanError = (accuracy: number) => {
      let total = 0
      for (let seed = 1; seed <= 600; seed++) {
        const r = resolveShot(
          round({
            shooter: { aim, power: 0.7, timing: 0.5 },
            keeper: { dive: { x: -1, y: 0 }, commitAt: 1 },
          }),
          { ...DEFAULT_SHOOTER, accuracy },
          KEEPER_PRESETS.normal,
          seed,
        )
        total += Math.hypot(r.landing.x - aim.x, r.landing.y - aim.y)
      }
      return total / 600
    }
    expect(meanError(95)).toBeLessThan(meanError(10))
  })
})

describe('bot keeper', () => {
  it('always dives inside the frame', () => {
    for (let seed = 1; seed <= 2000; seed++) {
      const dive = pickKeeperDive(seed)
      expect(Math.abs(dive.x)).toBeLessThanOrEqual(1)
      expect(dive.y).toBeGreaterThanOrEqual(0)
      expect(dive.y).toBeLessThanOrEqual(1)
    }
  })

  it('leans towards the corners rather than the middle', () => {
    let wide = 0
    for (let seed = 1; seed <= 3000; seed++) {
      if (Math.abs(pickKeeperDive(seed).x) > 0.5) wide++
    }
    expect(wide / 3000).toBeGreaterThan(0.5)
  })

  it('is fully determined by its seed', () => {
    expect(botKeeperInput(31, 'normal', 0.6)).toEqual(botKeeperInput(31, 'normal', 0.6))
  })

  it('commits earlier on easy than on hard', () => {
    const early = (difficulty: 'easy' | 'hard') => {
      let n = 0
      for (let seed = 1; seed <= 1000; seed++) {
        if (isEarlyCommit(botKeeperInput(seed, difficulty, 0.6).commitAt, 0.6)) n++
      }
      return n
    }
    expect(early('easy')).toBeGreaterThan(early('hard'))
  })
})

describe('roundSeed', () => {
  it('gives a distinct non-zero seed per round', () => {
    const seeds = new Set<number>()
    for (let i = 0; i < 40; i++) {
      const s = roundSeed(20260814, i)
      expect(s).not.toBe(0)
      seeds.add(s)
    }
    expect(seeds.size).toBe(40)
  })

  it('is stable for the same root and index', () => {
    expect(roundSeed(5, 3)).toBe(roundSeed(5, 3))
    expect(roundSeed(5, 3)).not.toBe(roundSeed(5, 4))
  })
})

describe('stats plumbing', () => {
  it('difficulty only moves REFLEX and REACH', () => {
    const { easy, normal, hard } = KEEPER_PRESETS
    expect(easy.reflex).toBeLessThan(normal.reflex)
    expect(normal.reflex).toBeLessThan(hard.reflex)
    expect(easy.reach).toBeLessThan(hard.reach)
    for (const key of ['power', 'accuracy', 'curve', 'nerve', 'hands', 'reading'] as const) {
      expect(easy[key]).toBe(hard[key])
      expect(normal[key]).toBe(hard[key])
    }
  })

  it('exposes stats the shooter helper can override', () => {
    expect(stats({ accuracy: 80 }).accuracy).toBe(80)
    expect(stats().accuracy).toBe(DEFAULT_SHOOTER.accuracy)
  })
})
