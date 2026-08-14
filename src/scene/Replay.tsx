import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { BALL_START, type Vec3 } from '../lib/geometry'
import { flightDuration, planFlight, sampleFlight } from '../lib/flight'
import type { Vec2 } from '../lib/physics'
import type { Phase } from '../game/store'
import type { RoundRecord } from '../game/store'
import { Ball } from './Ball'
import { Goal, type NetImpact } from './Goal'
import { Keeper } from './Keeper'
import { Shooter } from './Shooter'

export interface ReplayProps {
  phase: Phase
  round: RoundRecord | null
  reducedMotion: boolean
  onFinish: () => void
}

interface Frame {
  ball: Vec3
  spin: number
  keeperProgress: number
  shooterSwing: number
  netImpact: NetImpact | null
}

const IDLE: Frame = {
  ball: BALL_START,
  spin: 0,
  keeperProgress: 0,
  shooterSwing: 0,
  netImpact: null,
}

/** დივის გაშლის ხანგრძლივობა */
const DIVE_TIME = 0.3
/** შეხების შემდეგ რამდენ ხანს ვაჩერებთ კადრს */
const HOLD = 0.35
/** reduced-motion: შედეგი მაშინვე ჩანს */
const REDUCED_HOLD = 0.3

/**
 * გათამაშება — უკვე გამოთვლილი შედეგის დეტერმინისტული ანიმაცია.
 *
 * აქ არაფერი წყდება: `round.resolution` მზად არის, ეს კომპონენტი მხოლოდ
 * კითხულობს (§4). ანიმაციის დასრულებაზე ის მხოლოდ ატყობინებს store-ს.
 */
export function Replay({ phase, round, reducedMotion, onFinish }: ReplayProps) {
  const [frame, setFrame] = useState<Frame>(IDLE)
  const startedAt = useRef<number | null>(null)
  const netDone = useRef(false)
  const ended = useRef(false)
  const idle = useRef(true)

  const plan = useMemo(() => (round ? planFlight(round.resolution) : null), [round])

  useEffect(() => {
    startedAt.current = null
    netDone.current = false
    ended.current = false
  }, [round, phase])

  useFrame(({ clock }) => {
    if (phase !== 'animating' || !plan) {
      // შედეგის ჩვენებისას ბურთი იქ რჩება, სადაც გაჩერდა
      const hold = phase === 'between-rounds' && plan
      if (!idle.current) {
        idle.current = true
        setFrame(
          hold
            ? { ball: plan.rest, spin: 0, keeperProgress: 1, shooterSwing: 1, netImpact: null }
            : IDLE,
        )
      }
      return
    }
    idle.current = false

    if (startedAt.current === null) startedAt.current = clock.elapsedTime
    const t = clock.elapsedTime - startedAt.current

    if (reducedMotion) {
      // მოძრაობა გამორთულია: ბურთი მაშინვე საბოლოო წერტილშია
      setFrame({
        ball: plan.rest,
        spin: 0,
        keeperProgress: 1,
        shooterSwing: 1,
        netImpact: null,
      })
      if (t >= REDUCED_HOLD && !ended.current) {
        ended.current = true
        onFinish()
      }
      return
    }

    const flying = t < plan.tBall
    const commitAt = round?.keeper.commitAt ?? plan.tBall
    const netImpact =
      !netDone.current && plan.result === 'goal' && t >= plan.tBall && round
        ? {
            x: round.resolution.landing.x,
            y: round.resolution.landing.y,
            at: clock.elapsedTime,
            strength: 0.34,
          }
        : frame.netImpact
    if (netImpact && netImpact !== frame.netImpact) netDone.current = true

    setFrame({
      ball: sampleFlight(plan, t),
      spin: flying ? 26 : 7,
      keeperProgress: Math.min(1, Math.max(0, (t - commitAt) / DIVE_TIME)),
      shooterSwing: Math.min(1, t / 0.28),
      netImpact,
    })

    if (t >= flightDuration(plan) + HOLD && !ended.current) {
      ended.current = true
      onFinish()
    }
  })

  const dive: Vec2 = round?.keeper.dive ?? { x: 0, y: 0 }
  const lean = round?.shooter.aim.x ?? 0

  return (
    <>
      <Goal impact={frame.netImpact} reducedMotion={reducedMotion} />
      <Keeper dive={dive} progress={frame.keeperProgress} idle={phase !== 'animating'} />
      <Ball position={frame.ball} spin={frame.spin} />
      <Shooter swing={frame.shooterSwing} lean={lean} />
    </>
  )
}
