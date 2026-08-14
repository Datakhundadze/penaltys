import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { BALL_START, type Vec3 } from '../lib/geometry'
import { flightDuration, planFlight, sampleFlight } from '../lib/flight'
import type { Vec2 } from '../lib/physics'
import type { Phase, RoundRecord } from '../game/store'
import { frameKind, type FrameKind } from '../game/replayState'
import { Ball } from './Ball'
import { Goal, type NetImpact, type PostFlash } from './Goal'
import { Keeper } from './Keeper'
import { Shooter } from './Shooter'

export interface ReplayProps {
  phase: Phase
  round: RoundRecord | null
  reducedMotion: boolean
  onFinish: () => void
  /** გოლის მომენტი — სტადიონი პროჟექტორის პულსით პასუხობს */
  onGoalImpact?: (at: number) => void
}

interface Frame {
  ball: Vec3
  spin: number
  keeperProgress: number
  keeperAnticipation: number
  shooterSwing: number
  netImpact: NetImpact | null
  postFlash: PostFlash | null
}

const IDLE: Frame = {
  ball: BALL_START,
  spin: 0,
  keeperProgress: 0,
  keeperAnticipation: 0,
  shooterSwing: 0,
  netImpact: null,
  postFlash: null,
}

/** შერბენის ხანგრძლივობა დარტყმამდე — ბურთი ამ დროს ადგილზეა */
const KICK_AT = 0.62
/** დივის გაშლის ხანგრძლივობა */
const DIVE_TIME = 0.3
/** ჩაჯდომის გაღრმავება დივის წინ */
const ANTICIPATION = 0.22
/** შეხების შემდეგ რამდენ ხანს ვაჩერებთ კადრს */
const HOLD = 0.35
/** reduced-motion: შედეგი მაშინვე ჩანს */
const REDUCED_HOLD = 0.3

/**
 * გათამაშება — უკვე გამოთვლილი შედეგის დეტერმინისტული ანიმაცია.
 *
 * დროის ხაზი: [0, KICK_AT) შერბენა → KICK_AT დარტყმა → ბურთის ფრენა →
 * შეხება → დაშოშმინება. აქ არაფერი წყდება: `round.resolution` მზად არის,
 * ეს კომპონენტი მხოლოდ კითხულობს (§4).
 */
export function Replay({ phase, round, reducedMotion, onFinish, onGoalImpact }: ReplayProps) {
  const [frame, setFrame] = useState<Frame>(IDLE)
  const startedAt = useRef<number | null>(null)
  const netDone = useRef(false)
  const ended = useRef(false)
  const shown = useRef<FrameKind>('idle')

  const plan = useMemo(() => (round ? planFlight(round.resolution) : null), [round])

  useEffect(() => {
    startedAt.current = null
    netDone.current = false
    ended.current = false
  }, [round, phase])

  useFrame(({ clock }) => {
    const kind = frameKind(phase, plan !== null)

    if (kind !== 'live') {
      // კადრი ყოველ ფაზურ გადასვლაზე თავიდან დგება — 'hold' მხოლოდ
      // შედეგის ეკრანზეა, ყველა სხვა ფაზა იდლი პოზას აბრუნებს.
      // (აქ იყო შეცდომა: ერთჯერადი დროშა 'hold'-ზე ჩერდებოდა და მეორე
      // რაუნდში მეკარე მიწაზე რჩებოდა.)
      if (shown.current !== kind) {
        shown.current = kind
        setFrame(
          kind === 'hold' && plan
            ? {
                ball: plan.rest,
                spin: 0,
                keeperProgress: 2,
                keeperAnticipation: 0,
                shooterSwing: 1.6,
                netImpact: null,
                postFlash: frame.postFlash,
              }
            : IDLE,
        )
      }
      return
    }
    shown.current = 'live'
    if (!plan) return

    if (startedAt.current === null) startedAt.current = clock.elapsedTime
    const t = clock.elapsedTime - startedAt.current

    if (reducedMotion) {
      // მოძრაობა გამორთულია: ბურთი მაშინვე საბოლოო წერტილშია
      setFrame({
        ball: plan.rest,
        spin: 0,
        keeperProgress: 2,
        keeperAnticipation: 0,
        shooterSwing: 1.6,
        netImpact: null,
        postFlash:
          plan.result === 'post' && round
            ? { side: round.resolution.detail.postSide === -1 ? -1 : 1, at: clock.elapsedTime }
            : null,
      })
      if (t >= REDUCED_HOLD && !ended.current) {
        ended.current = true
        onFinish()
      }
      return
    }

    // ბურთის დრო დარტყმიდან ითვლება
    const ballT = t - KICK_AT
    const flying = ballT >= 0 && ballT < plan.tBall
    const commitAt = round?.keeper.commitAt ?? plan.tBall

    let netImpact = frame.netImpact
    if (!netDone.current && plan.result === 'goal' && ballT >= plan.tBall && round) {
      netImpact = {
        x: round.resolution.landing.x,
        y: round.resolution.landing.y,
        at: clock.elapsedTime,
        strength: 0.34,
      }
      netDone.current = true
      onGoalImpact?.(clock.elapsedTime)
    }

    const hitPost = plan.result === 'post' && ballT >= plan.tBall && round
    const postFlash: PostFlash | null =
      frame.postFlash ??
      (hitPost
        ? { side: round.resolution.detail.postSide === -1 ? -1 : 1, at: clock.elapsedTime }
        : null)

    setFrame({
      ball: ballT <= 0 ? BALL_START : sampleFlight(plan, ballT),
      spin: flying ? 26 : 7,
      // >1 დაშვების ფაზაა — Keeper თვითონ კეტავს
      keeperProgress: Math.max(0, (ballT - commitAt) / DIVE_TIME),
      keeperAnticipation: Math.max(
        0,
        Math.min(1, (ballT - (commitAt - ANTICIPATION)) / ANTICIPATION),
      ),
      shooterSwing: t / KICK_AT,
      netImpact,
      postFlash,
    })

    if (ballT >= flightDuration(plan) + HOLD && !ended.current) {
      ended.current = true
      onFinish()
    }
  })

  const dive: Vec2 = round?.keeper.dive ?? { x: 0, y: 0 }
  const lean = round?.shooter.aim.x ?? 0

  return (
    <>
      <Goal impact={frame.netImpact} postFlash={frame.postFlash} reducedMotion={reducedMotion} />
      <Keeper
        dive={dive}
        progress={frame.keeperProgress}
        idle={phase !== 'animating'}
        anticipation={frame.keeperAnticipation}
        outcome={round?.resolution.result ?? null}
      />
      <Ball position={frame.ball} spin={frame.spin} />
      <Shooter swing={frame.shooterSwing} lean={lean} />
    </>
  )
}
