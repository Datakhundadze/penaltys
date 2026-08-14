import { useEffect, useRef, useState } from 'react'
import { mapSwipe, type Swipe } from '../lib/controls'
import { PALETTE } from '../lib/palette'
import { aimPreview } from './aimPreview'

export interface AimSurfaceProps {
  onCommit: (swipe: Swipe) => void
  /** §8 — ამბერი ურტყამს, ცივი ლურჯი იცავს */
  tone: 'sodium' | 'floodlight'
  hint: string
}

interface DragState {
  pointerId: number
  /** ელემენტის ლოკალურ კოორდინატებში */
  originX: number
  originY: number
  x: number
  y: number
}

/**
 * მოსმის ზედაპირი — მთელი ეკრანი.
 *
 * - მხოლოდ Pointer Events + setPointerCapture; თაგვი და შეხება ერთი გზაა
 * - touch-action: none (CSS კლასი + inline) და preventDefault, რომ
 *   ბრაუზერმა ჟესტი სქროლად/pull-to-refresh-ად არ წაიღოს
 * - კოორდინატები ელემენტის getBoundingClientRect-იდან — ბრაუზერის
 *   ზოლების გამოჩენა/გაქრობა window-ის ზომას ცვლის, ელემენტისას კი სწორად
 * - ცოცხალი მდგომარეობა aimPreview-შია; რენდერს მხოლოდ SVG სჭირდება
 */
export function AimSurface({ onCommit, tone, hint }: AimSurfaceProps) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const color = tone === 'sodium' ? PALETTE.sodium : PALETTE.floodlight

  // მონტაჟისას ძველი (წინა რაუნდის) პრევიუ იშლება
  useEffect(() => {
    aimPreview.swipe = null
  }, [])

  const swipeFor = (el: HTMLElement, d: DragState): Swipe => {
    const rect = el.getBoundingClientRect()
    return mapSwipe(d.x - d.originX, d.y - d.originY, {
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height),
    })
  }

  const local = (el: HTMLElement, e: React.PointerEvent) => {
    const rect = el.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag) return
    e.preventDefault()
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const p = local(el, e)
    const next = { pointerId: e.pointerId, originX: p.x, originY: p.y, x: p.x, y: p.y }
    setDrag(next)
    aimPreview.swipe = swipeFor(el, next)
  }

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return
    e.preventDefault()
    const el = e.currentTarget
    const p = local(el, e)
    const next = { ...drag, x: p.x, y: p.y }
    setDrag(next)
    // რეტიკული ამას პირდაპირ კითხულობს — React-ის ციკლს არ ელოდება
    aimPreview.swipe = swipeFor(el, next)
  }

  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return
    e.preventDefault()
    const el = e.currentTarget
    const p = local(el, e)
    const swipe = swipeFor(el, { ...drag, x: p.x, y: p.y })
    setDrag(null)
    if (swipe.valid) {
      // დადასტურებული მიზანი timing ფაზაშიც რჩება გამოსახული
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

  const power = drag && ref.current ? swipeFor(ref.current, drag).power : 0

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
      {drag && (
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          <line
            x1={drag.originX}
            y1={drag.originY}
            x2={drag.x}
            y2={drag.y}
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.55}
          />
          <circle cx={drag.originX} cy={drag.originY} r={9} fill="none" stroke={color} strokeWidth={1.5} opacity={0.4} />
          {/* ძალის რკალი წარმოშობის წერტილზე */}
          <circle
            cx={drag.originX}
            cy={drag.originY}
            r={9}
            fill="none"
            stroke={color}
            strokeWidth={3}
            strokeDasharray={`${power * 2 * Math.PI * 9} ${2 * Math.PI * 9}`}
            transform={`rotate(-90 ${drag.originX} ${drag.originY})`}
          />
          <circle cx={drag.x} cy={drag.y} r={5} fill={color} opacity={0.85} />
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
