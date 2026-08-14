import { useEffect, useRef, useState } from 'react'
import { TIMING_PERFECT_BAND, markerPosition } from '../lib/controls'
import { PALETTE } from '../lib/palette'
import { T } from './strings'

export interface TimingBarProps {
  onStop: (marker: number) => void
  tone: 'sodium' | 'floodlight'
  hint: string
}

/**
 * timing ზოლი — მარკერი ირხევა, დაჭერა აჩერებს.
 * ცენტრთან სიახლოვე = timing ∈ [0,1] (§5).
 * მოძრაობა თამაშის ნაწილია, ამიტომ reduced-motion-ზეც რჩება.
 */
export function TimingBar({ onStop, tone, hint }: TimingBarProps) {
  const [marker, setMarker] = useState(0)
  const start = useRef(0)
  const stopped = useRef(false)
  const color = tone === 'sodium' ? PALETTE.sodium : PALETTE.floodlight

  useEffect(() => {
    let raf = 0
    start.current = performance.now()
    const tick = (now: number) => {
      if (stopped.current) return
      setMarker(markerPosition((now - start.current) / 1000))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const stop = () => {
    if (stopped.current) return
    stopped.current = true
    onStop(markerPosition((performance.now() - start.current) / 1000))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        stop()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="no-touch-gestures absolute inset-0 z-10 flex flex-col justify-end pb-[max(4.5rem,env(safe-area-inset-bottom))]"
      onPointerDown={(e) => {
        e.preventDefault()
        stop()
      }}
      role="button"
      tabIndex={0}
      aria-label={T.tapToStop}
    >
      <div className="mx-auto w-[min(26rem,82vw)] px-1">
        <p className="mb-3 text-center text-2xs opacity-70 sm:text-xs">{hint}</p>

        <div className="relative h-3.5 w-full rounded-full bg-turf/90 ring-1 ring-chalk/15">
          {/* სრულყოფილი ზონა */}
          <div
            className="absolute inset-y-0 rounded-full"
            style={{
              left: `${(0.5 - TIMING_PERFECT_BAND) * 100}%`,
              width: `${TIMING_PERFECT_BAND * 200}%`,
              background: `${color}33`,
              boxShadow: `inset 0 0 0 1.5px ${color}`,
            }}
          />
          {/* მარკერი */}
          <div
            className="absolute top-1/2 h-6 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ left: `${marker * 100}%`, background: color, boxShadow: `0 0 12px ${color}` }}
          />
        </div>

      </div>
    </div>
  )
}
