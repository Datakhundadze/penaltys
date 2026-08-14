import { useEffect, useRef, useState } from 'react'
import { FLICK_TIMEOUT_MS, analyzeSwipe, type AnalyzedSwipe, type SwipePoint } from '../lib/controls'
import { PALETTE } from '../lib/palette'

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
 * დროის შტამპები ივენთებიდან მოდის, არა დამუშავების მომენტიდან —
 * დატვირთულ მთავარ ნაკადზე (სუსტი ტელეფონი) ივენთები გვიან მუშავდება
 * და performance.now() ჟესტის რეალურ ტემპს ამახინჯებს.
 */

/**
 * Flick-ის ზედაპირი — ჟესტი თვითონ არის დარტყმა.
 *
 * თითქვეშ არაფერი ჩანს გზის ხაზის გარდა: არც რეტიკული, არც სამიზნე
 * რგოლი. მოთამაშე გრძნობით უმიზნებს და შედეგებით სწავლობს. დარტყმა
 * აშვებისთანავე ისვრება; ~700მწმ-ზე გრძელი დაჭერა უქმდება — რგოლის
 * „ტარება" ვერ დაბრუნდება.
 *
 * - Pointer Events + setPointerCapture; თაგვი და შეხება ერთი გზაა
 * - touch-action: none + preventDefault
 * - კოორდინატები ელემენტის getBoundingClientRect-იდან
 */
export function AimSurface({ onCommit, tone, hint }: AimSurfaceProps) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const color = tone === 'sodium' ? PALETTE.sodium : PALETTE.floodlight

  const clearTimer = () => {
    if (timeout.current !== null) {
      clearTimeout(timeout.current)
      timeout.current = null
    }
  }

  const cancel = () => {
    clearTimer()
    dragRef.current = null
    setDrag(null)
  }

  /** ვიზუალური გაქრობა დაჭერისას — ჟესტის ბედს კი აშვებაზე ივენთების
   * დროშტამპები წყვეტს, რომ დაგვიანებულმა დამუშავებამ დარტყმა არ შეჭამოს */
  const hidePath = () => {
    clearTimer()
    setDrag(null)
  }

  useEffect(() => clearTimer, [])

  const local = (el: HTMLElement, e: React.PointerEvent): SwipePoint => {
    const rect = el.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, t: e.nativeEvent.timeStamp }
  }

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) return
    e.preventDefault()
    const el = e.currentTarget
    try {
      el.setPointerCapture(e.pointerId)
    } catch {
      /* სინთეზური ან მკვდარი pointerId — ჟესტი მაინც მუშაობს */
    }
    const next = { pointerId: e.pointerId, points: [local(el, e)] }
    dragRef.current = next
    setDrag(next)
    // ბალისტიკური ფანჯარა: ვინც ატარებს და არ უშვებს, გზა თვალწინ უქრება
    clearTimer()
    timeout.current = setTimeout(hidePath, FLICK_TIMEOUT_MS)
  }

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const current = dragRef.current
    if (!current || e.pointerId !== current.pointerId) return
    e.preventDefault()
    const el = e.currentTarget
    const native = e.nativeEvent
    const coalesced =
      typeof native.getCoalescedEvents === 'function' ? native.getCoalescedEvents() : []
    const rect = el.getBoundingClientRect()
    const fresh: SwipePoint[] =
      coalesced.length > 0
        ? coalesced.map((ev) => ({
            x: ev.clientX - rect.left,
            y: ev.clientY - rect.top,
            t: ev.timeStamp,
          }))
        : [local(el, e)]
    const next = { ...current, points: [...current.points, ...fresh] }
    dragRef.current = next
    // ვიზუალი მხოლოდ მანამ, სანამ გზა ჯერ არ „გამქრალა"
    if (timeout.current !== null) setDrag(next)
  }

  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const current = dragRef.current
    if (!current || e.pointerId !== current.pointerId) return
    e.preventDefault()
    const el = e.currentTarget
    const points = [...current.points, local(el, e)]
    cancel()
    // ბალისტიკურობის წესი ივენთების დროზეა: >700მწმ ჭერა = გაუქმება
    const first = points[0]
    const last = points[points.length - 1]
    if (!first || !last || last.t - first.t > FLICK_TIMEOUT_MS) return
    const rect = el.getBoundingClientRect()
    const swipe = analyzeSwipe(points, {
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height),
    })
    // დარტყმა მაშინვე — აშვება თვითონ არის სროლა
    if (swipe.valid) onCommit(swipe)
  }

  return (
    <div
      className="no-touch-gestures absolute inset-0 z-10 cursor-crosshair"
      style={{ touchAction: 'none' }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={cancel}
    >
      {/* თითქვეშ მხოლოდ გავლილი გზა ჩანს — მოთამაშე საკუთარ ჟესტს ხედავს */}
      {drag && drag.points.length > 1 && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          <polyline
            points={drag.points.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.55}
          />
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
