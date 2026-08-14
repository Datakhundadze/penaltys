import { useEffect, useRef, useState } from 'react'
import {
  analyzeSwipe,
  mapSwipe,
  releaseSpeed,
  speedToPower,
  type AnalyzedSwipe,
  type SwipePoint,
} from '../lib/controls'
import { PALETTE } from '../lib/palette'
import { aimPreview } from './aimPreview'

export interface AimSurfaceProps {
  onCommit: (swipe: AnalyzedSwipe) => void
  /** §8 — ამბერი ურტყამს, ცივი ლურჯი იცავს */
  tone: 'sodium' | 'floodlight'
  hint: string
}

interface DragState {
  pointerId: number
  points: SwipePoint[]
}

/**
 * მოსმის ზედაპირი — ერთი უწყვეტი ჟესტი ატარებს ყველაფერს:
 * მიმართულება → aim, სიჩქარე აშვებისას → power, გზის სისუფთავე → quality.
 *
 * - მხოლოდ Pointer Events + setPointerCapture; თაგვი და შეხება ერთი გზაა
 * - touch-action: none + preventDefault — ბრაუზერი ჟესტს ვერ წაიღებს
 * - კოორდინატები ელემენტის getBoundingClientRect-იდან
 * - ცოცხალი მდგომარეობა aimPreview-შია, React შუაში არ დგას
 */
export function AimSurface({ onCommit, tone, hint }: AimSurfaceProps) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const color = tone === 'sodium' ? PALETTE.sodium : PALETTE.floodlight

  // მონტაჟისას ძველი (წინა რაუნდის) პრევიუ იშლება
  useEffect(() => {
    aimPreview.swipe = null
  }, [])

  const local = (el: HTMLElement, e: React.PointerEvent): SwipePoint => {
    const rect = el.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, t: performance.now() }
  }

  const viewportOf = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect()
    return { width: Math.max(1, rect.width), height: Math.max(1, rect.height) }
  }

  const preview = (el: HTMLElement, points: SwipePoint[]) => {
    const a = points[0]
    const b = points[points.length - 1]
    if (!a || !b) return
    const vp = viewportOf(el)
    const base = mapSwipe(b.x - a.x, b.y - a.y, vp)
    // პრევიუს ძალა — მიმდინარე სიჩქარიდან, რომ რგოლი ცოცხლად სუნთქავდეს
    const power = speedToPower(releaseSpeed(points) / Math.min(vp.width, vp.height))
    aimPreview.swipe = { ...base, power }
  }

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag) return
    e.preventDefault()
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const p = local(el, e)
    setDrag({ pointerId: e.pointerId, points: [p] })
    preview(el, [p])
  }

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return
    e.preventDefault()
    const el = e.currentTarget
    // coalesced events — მაღალსიხშირიან ეკრანებზე გზა სრულად ჩაიწერება
    const native = e.nativeEvent
    const coalesced =
      typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : []
    const rect = el.getBoundingClientRect()
    const fresh: SwipePoint[] =
      coalesced.length > 0
        ? coalesced.map((ev) => ({
            x: ev.clientX - rect.left,
            y: ev.clientY - rect.top,
            t: performance.now(),
          }))
        : [local(el, e)]
    const points = [...drag.points, ...fresh]
    setDrag({ ...drag, points })
    preview(el, points)
  }

  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return
    e.preventDefault()
    const el = e.currentTarget
    const points = [...drag.points, local(el, e)]
    setDrag(null)
    const swipe = analyzeSwipe(points, viewportOf(el))
    if (swipe.valid) {
      // დარტყმა მაშინვე მიდის — შუალედური ნაბიჯი აღარ არსებობს
      aimPreview.swipe = swipe
      onCommit(swipe)
    } else {
      aimPreview.swipe = null
    }
  }

  const onCancel = () => {
    setDrag(null)
    aimPreview.swipe = null
  }

  const first = drag?.points[0]
  const last = drag ? drag.points[drag.points.length - 1] : undefined
  const power = aimPreview.swipe?.power ?? 0

  return (
    <div
      ref={ref}
      className="no-touch-gestures absolute inset-0 z-10 cursor-crosshair"
      style={{ touchAction: 'none' }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onCancel}
    >
      {drag && first && last && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {/* გავლილი გზა — მოთამაშე ხედავს საკუთარი მოსმის სისუფთავეს */}
          <polyline
            points={drag.points.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.5}
          />
          <circle cx={first.x} cy={first.y} r={9} fill="none" stroke={color} strokeWidth={1.5} opacity={0.4} />
          {/* ძალის რკალი წარმოშობის წერტილზე — სიჩქარეს მიჰყვება */}
          <circle
            cx={first.x}
            cy={first.y}
            r={9}
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeDasharray={`${power * 2 * Math.PI * 9} ${2 * Math.PI * 9}`}
            transform={`rotate(-90 ${first.x} ${first.y})`}
          />
          <circle cx={last.x} cy={last.y} r={5} fill={color} opacity={0.85} />
        </svg>
      )}

      {!drag && (
        <p className="pointer-events-none absolute inset-x-0 bottom-24 text-center text-2xs opacity-55 sm:text-xs">
          {hint}
        </p>
      )}
    </div>
  )
}
