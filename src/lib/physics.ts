/**
 * SPOT — თამაშის ფიზიკა (SPEC.md §5)
 *
 * ეს ფაილი განზრახ სუფთაა: მხოლოდ input → output.
 * არანაირი იმპორტი React-იდან, three.js-იდან ან ბრაუზერის API-დან,
 * არანაირი Math.random(), არანაირი გვერდითი ეფექტი.
 * ფაზა 2-ში ის უცვლელად გადადის Supabase Edge Function-ში (Deno).
 *
 * კარი ნორმალიზებულ კოორდინატებში:
 *   x ∈ [-1, 1]  ბოძიდან ბოძამდე
 *   y ∈ [0, 1]   მიწიდან ჰორიზონტალამდე
 */

// ─────────────────────────────────────────────────────────────
// ტიპები
// ─────────────────────────────────────────────────────────────

export interface Vec2 {
  readonly x: number
  readonly y: number
}

/** §3 player_stats — 0..100 */
export interface Stats {
  readonly power: number
  readonly accuracy: number
  readonly curve: number
  readonly nerve: number
  readonly reflex: number
  readonly reach: number
  readonly hands: number
  readonly reading: number
}

/** §4 — დამრტყმელის ფარული არჩევანი */
export interface ShooterInput {
  /** დამიზნება ნორმალიზებულ კარის კოორდინატებში */
  readonly aim: Vec2
  /** swipe-ის სიგრძე, 0..1 */
  readonly power: number
  /** timing ზოლის ხარისხი, 0..1 */
  readonly timing: number
}

/** §4 — მეკარის ფარული არჩევანი */
export interface KeeperInput {
  /** დივის წერტილი ნორმალიზებულ კარის კოორდინატებში */
  readonly dive: Vec2
  /** წამები დარტყმიდან, როცა მეკარემ დივი დაიწყო */
  readonly commitAt: number
}

export interface RoundInput {
  readonly shooter: ShooterInput
  readonly keeper: KeeperInput
}

export type ShotResult = 'goal' | 'save' | 'post' | 'out' | 'rebound'

export interface ShotResolution {
  /** ბურთის დაშვების წერტილი კარის სიბრტყეზე */
  readonly landing: Vec2
  readonly result: ShotResult
  /** ბურთის ფრენის დრო წამებში — ანიმაციის ხანგრძლივობა */
  readonly tBall: number
  /** ქულა ითვლება? (rebound სერიაში გოლი არ არის) */
  readonly scored: boolean
  /** დიაგნოსტიკა და replay — ანიმაციას ეს არაფერს აწყვეტინებს */
  readonly detail: {
    readonly sigma: number
    /** მანძილი დივსა და დაშვების წერტილს შორის, curve-ის ჩათვლით */
    readonly distance: number
    /** მეკარის წვდომის რადიუსი */
    readonly reach: number
    /** გადარჩენის ალბათობა მოგორების შემდეგ */
    readonly pSave: number
    /** მეკარემ ადრე დაიწყო? */
    readonly earlyCommit: boolean
    /** ბოძის მხარე: -1 მარცხენა, 1 მარჯვენა, 0 — ბოძი არ არის */
    readonly postSide: -1 | 0 | 1
  }
}

// ─────────────────────────────────────────────────────────────
// მუდმივები — SPEC.md §5
// ─────────────────────────────────────────────────────────────

/** გაფანტვის საბაზისო კოეფიციენტი */
export const SIGMA_BASE = 0.22
/** დარტყმიდან კარამდე ტრაექტორიის სიგრძე (მ) */
export const BALL_PATH_LENGTH = 12.2
/** ბოძის ზოლი: 0.95 < |x| ≤ 1.0 */
export const POST_BAND = 0.95
/** ადრე დაწოლის ზღვარი: commit_at < t_ball − 0.25 */
export const EARLY_COMMIT_MARGIN = 0.25
/** ადრე დაწოლის ჯარიმა p_save-ზე */
export const EARLY_COMMIT_PENALTY = 0.15

/**
 * §5: „CURVE ამრუდებს ტრაექტორიას — მეკარის დივი წერტილთან უფრო შორს
 * აღმოჩნდება, თუ მან ადრე დაიწყო." ეფექტი აღწერილია, ფორმულა — არა.
 * ვნერგავთ მინიმალურ, ერთ ადგილას გატანილ წევრს: ადრე დაწოლისას
 * ეფექტური მანძილი იზრდება CURVE-ის პროპორციულად.
 * 0-ზე დაყენება ეფექტს სრულად თიშავს.
 */
export const CURVE_DRIFT_MAX = 0.12

// ─────────────────────────────────────────────────────────────
// PRNG — ყველა შემთხვევითობა აქედან მოდის
// ─────────────────────────────────────────────────────────────

/**
 * mulberry32 — 32-ბიტიანი seed → [0, 1) გენერატორი.
 * ერთი seed → ერთი და იგივე მიმდევრობა კლიენტზეც და სერვერზეც.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Box–Muller — ორი დამოუკიდებელი N(0,1) ერთ გამოძახებაზე */
export function gaussPair(rng: () => number): readonly [number, number] {
  const u1 = Math.max(rng(), Number.EPSILON)
  const u2 = rng()
  const r = Math.sqrt(-2 * Math.log(u1))
  const theta = 2 * Math.PI * u2
  return [r * Math.cos(theta), r * Math.sin(theta)]
}

// ─────────────────────────────────────────────────────────────
// დამხმარეები
// ─────────────────────────────────────────────────────────────

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

export function distance(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

// ─────────────────────────────────────────────────────────────
// დარტყმა — SPEC.md §5
// ─────────────────────────────────────────────────────────────

/**
 * σ = 0.22 × (1 − ACC/150) × (1 + 0.5×(power − 0.5)) × (1.4 − 0.4×timing)
 *
 * სიზუსტე მოქმედებს გაფანტვის რადიუსზე, არა შედეგზე პირდაპირ (§5, §11).
 */
export function dispersion(power: number, timing: number, accuracy: number): number {
  const p = clamp(power, 0, 1)
  const t = clamp(timing, 0, 1)
  const sigma = SIGMA_BASE * (1 - accuracy / 150) * (1 + 0.5 * (p - 0.5)) * (1.4 - 0.4 * t)
  return Math.max(0, sigma)
}

/**
 * landing = aim + gauss(0, σ)
 * gauss-ის ორივე კომპონენტი ერთი და იმავე seed-იდან მოდის.
 */
export function landingPoint(aim: Vec2, sigma: number, g: readonly [number, number]): Vec2 {
  return { x: aim.x + g[0] * sigma, y: aim.y + g[1] * sigma }
}

export type LandingClass = 'in' | 'post' | 'out'

/**
 * |landing.x| > 1.0 ან landing.y > 1.0  → აუტი
 * 0.95 < |landing.x| ≤ 1.0             → ბოძი
 * სხვა შემთხვევაში                      → კარში
 */
export function classifyLanding(landing: Vec2): LandingClass {
  const ax = Math.abs(landing.x)
  if (ax > 1 || landing.y > 1) return 'out'
  if (ax > POST_BAND) return 'post'
  return 'in'
}

/**
 * v = 18 + 0.12 × POWER  (მ/წმ),  t_ball = 12.2 / v
 *
 * POWER აქ არის *სტატი* 0..100 — §5-ში ყველა დიდი ასოებით დაწერილი
 * სახელი სტატია (ACC, REACH, REFLEX, HANDS). ეს იძლევა სპეციფიკაციაში
 * მითითებულ დიაპაზონს: ≈0.68წმ სუსტი → ≈0.40წმ მაქსიმალური.
 * swipe-ის power ∈ [0,1] გაფანტვაზე მოქმედებს, არა ფრენის დროზე.
 */
export function ballFlightTime(powerStat: number): number {
  return BALL_PATH_LENGTH / (18 + 0.12 * powerStat)
}

// ─────────────────────────────────────────────────────────────
// გადარჩენა — SPEC.md §5
// ─────────────────────────────────────────────────────────────

/** R = 0.28 + REACH/400 */
export function saveRadius(reachStat: number): number {
  return 0.28 + reachStat / 400
}

/**
 * p_save = 0.90 − 0.60×(d/R) − 0.20×(POWER/100) + REFLEX/500
 * clamp [0.05, 0.95]; შემდეგ ადრე დაწოლის ჯარიმა −0.15.
 *
 * §5-ში clamp ჯარიმაზე ადრეა ჩამოთვლილი, ამიტომ იმავე რიგით ვაკეთებთ;
 * ჯარიმის შემდეგ მხოლოდ [0,1]-ში ვამაგრებთ, რომ ალბათობა უარყოფითი
 * არ გამოვიდეს.
 */
export function saveProbability(
  d: number,
  r: number,
  powerStat: number,
  reflexStat: number,
  earlyCommit: boolean,
): number {
  const raw = 0.9 - 0.6 * (d / r) - 0.2 * (powerStat / 100) + reflexStat / 500
  const clamped = clamp(raw, 0.05, 0.95)
  return clamp(earlyCommit ? clamped - EARLY_COMMIT_PENALTY : clamped, 0, 1)
}

/** მეკარემ დივი ბურთის ჩამოსვლამდე 0.25წმ-ზე ადრე დაიწყო? */
export function isEarlyCommit(commitAt: number, tBall: number): boolean {
  return commitAt < tBall - EARLY_COMMIT_MARGIN
}

/**
 * CURVE-ის დრიფტი — იხ. CURVE_DRIFT_MAX.
 * მხოლოდ მაშინ მოქმედებს, როცა მეკარემ ადრე დაიწყო.
 */
export function curveDrift(curveStat: number, earlyCommit: boolean): number {
  if (!earlyCommit) return 0
  return CURVE_DRIFT_MAX * clamp(curveStat / 100, 0, 1)
}

// ─────────────────────────────────────────────────────────────
// სრული გადაწყვეტა
// ─────────────────────────────────────────────────────────────

/**
 * ერთი რაუნდის სრული შედეგი.
 *
 * დეტერმინისტულია: ერთი და იგივე (input, stats, seed) → ერთი და იგივე
 * ShotResolution. ანიმაცია ამის შემდეგ მხოლოდ ათამაშებს უკვე
 * გადაწყვეტილ შედეგს (§4).
 *
 * შემთხვევითი რიცხვების რიგი ფიქსირებულია:
 *   1–2. gauss ორეული (გაფანტვა)
 *   3.   გადარჩენის მოგორება
 *   4.   rebound-ის მოგორება
 */
export function resolveShot(
  input: RoundInput,
  statsShooter: Stats,
  statsKeeper: Stats,
  seed: number,
): ShotResolution {
  const rng = mulberry32(seed)

  const sigma = dispersion(input.shooter.power, input.shooter.timing, statsShooter.accuracy)
  const raw = landingPoint(input.shooter.aim, sigma, gaussPair(rng))
  const tBall = ballFlightTime(statsShooter.power)
  const kind = classifyLanding(raw)

  // მიწის ქვემოთ დაშვება = გორვით შესვლა კარის ხაზზე
  const landing: Vec2 = { x: raw.x, y: Math.max(0, raw.y) }

  if (kind === 'out') {
    return {
      landing: raw,
      result: 'out',
      tBall,
      scored: false,
      detail: { sigma, distance: 0, reach: 0, pSave: 0, earlyCommit: false, postSide: 0 },
    }
  }

  if (kind === 'post') {
    return {
      landing,
      result: 'post',
      tBall,
      scored: false,
      detail: {
        sigma,
        distance: 0,
        reach: 0,
        pSave: 0,
        earlyCommit: false,
        postSide: landing.x < 0 ? -1 : 1,
      },
    }
  }

  const earlyCommit = isEarlyCommit(input.keeper.commitAt, tBall)
  const r = saveRadius(statsKeeper.reach)
  const d = distance(input.keeper.dive, landing) + curveDrift(statsShooter.curve, earlyCommit)

  if (d > r) {
    return {
      landing,
      result: 'goal',
      tBall,
      scored: true,
      detail: { sigma, distance: d, reach: r, pSave: 0, earlyCommit, postSide: 0 },
    }
  }

  const pSave = saveProbability(d, r, statsShooter.power, statsKeeper.reflex, earlyCommit)
  const saved = rng() < pSave

  if (!saved) {
    return {
      landing,
      result: 'goal',
      tBall,
      scored: true,
      detail: { sigma, distance: d, reach: r, pSave, earlyCommit, postSide: 0 },
    }
  }

  // rebound: თუ გადაარჩინა და random > HANDS/100 → ბურთი ბრუნდება თამაშში.
  // სერიაში rebound გოლი არ არის — ბურთი უბრალოდ ცოცხალი რჩება.
  const rebound = rng() > statsKeeper.hands / 100

  return {
    landing,
    result: rebound ? 'rebound' : 'save',
    tBall,
    scored: false,
    detail: { sigma, distance: d, reach: r, pSave, earlyCommit, postSide: 0 },
  }
}

// ─────────────────────────────────────────────────────────────
// ბოტი მეკარე — ფაზა 0-ისთვის, ისიც სუფთა და seed-ზე
// ─────────────────────────────────────────────────────────────

export type Difficulty = 'easy' | 'normal' | 'hard'

/**
 * სირთულე მხოლოდ REFLEX/REACH-ზე მოქმედებს — არაფერზე სხვაზე.
 * დანარჩენი სტატები სამივე დონეზე ერთნაირია.
 */
export const KEEPER_PRESETS: Readonly<Record<Difficulty, Stats>> = {
  easy: makeStats({ reflex: 10, reach: 10 }),
  normal: makeStats({ reflex: 40, reach: 40 }),
  hard: makeStats({ reflex: 75, reach: 75 }),
}

export const DEFAULT_SHOOTER: Stats = makeStats()

/** §3-ის ნაგულისხმევი სტატები, სურვილისამებრ გადაფარვით */
export function makeStats(over: Partial<Stats> = {}): Stats {
  return {
    power: 20,
    accuracy: 20,
    curve: 20,
    nerve: 20,
    reflex: 20,
    reach: 20,
    hands: 20,
    reading: 20,
    ...over,
  }
}

/**
 * ბოტი ირჩევს დივის წერტილს შემთხვევით, კუთხეებისკენ მსუბუქი მიდრეკილებით.
 * სუფთა და seed-ზე დამოკიდებული — ორივე მხარეს ერთი და იგივე გამოდის.
 *
 * მიდრეკილება: |x| ნაწილდება sqrt-ით (კიდეები ოდნავ უფრო სავარაუდო),
 * y — ქვედა ნახევრისკენ, რადგან რეალურად მეკარეები დაბლა ეშვებიან.
 */
export function pickKeeperDive(seed: number, cornerBias = 0.65): Vec2 {
  const rng = mulberry32(seed ^ 0x9e3779b9)
  const side = rng() < 0.5 ? -1 : 1
  const magnitude = Math.pow(rng(), 1 - clamp(cornerBias, 0, 0.9))
  const y = Math.pow(rng(), 1.7)
  return { x: side * magnitude, y }
}

/**
 * როდის იწყებს ბოტი დივს. მარტივი მეკარე ხშირად წინასწარ ეშვება
 * (და −0.15 ჯარიმას იღებს), რთული უფრო მოთმინებიანია.
 */
export function pickKeeperCommit(seed: number, difficulty: Difficulty, tBall: number): number {
  const rng = mulberry32(seed ^ 0x85ebca6b)
  const earliness: Record<Difficulty, number> = { easy: 0.55, normal: 0.3, hard: 0.12 }
  const chance = earliness[difficulty]
  if (rng() < chance) {
    // ადრეული დაწოლა: ბურთის ჩამოსვლამდე 0.25წმ-ზე მეტით ადრე
    return Math.max(0, tBall - EARLY_COMMIT_MARGIN - 0.05 - rng() * 0.15)
  }
  return tBall - EARLY_COMMIT_MARGIN + rng() * EARLY_COMMIT_MARGIN
}

/** ბოტის სრული არჩევანი ერთი რაუნდისთვის */
export function botKeeperInput(seed: number, difficulty: Difficulty, tBall: number): KeeperInput {
  return {
    dive: pickKeeperDive(seed),
    commitAt: pickKeeperCommit(seed, difficulty, tBall),
  }
}

/**
 * ბოტი დამრტყმელი — მაშინ, როცა როლები იცვლება და მოთამაშე იცავს კარს.
 * ისიც სუფთა და seed-ზეა.
 */
export function botShooterInput(seed: number): ShooterInput {
  const rng = mulberry32(seed ^ 0xc2b2ae35)
  const side = rng() < 0.5 ? -1 : 1
  const x = side * Math.pow(rng(), 0.55) * 0.92
  const y = Math.pow(rng(), 1.5) * 0.85
  const power = 0.45 + rng() * 0.5
  const timing = 0.35 + rng() * 0.6
  return { aim: { x, y }, power, timing }
}

/** seed-ების დეტერმინისტული წარმოება ერთი სერიის ფესვიდან */
export function roundSeed(rootSeed: number, roundIndex: number): number {
  return (Math.imul(rootSeed ^ (roundIndex + 1), 0x27d4eb2d) >>> 0) || 1
}
