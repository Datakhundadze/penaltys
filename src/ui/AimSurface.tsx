import { useCallback, useRef, useState } from 'react'
import { mapSwipe, type Swipe } from '../lib/controls'
import { PALETTE } from '../lib/palette'

export interface AimSurfaceProps {
  onPreview: (swipe: Swipe | null) => void
  onCommit: (swipe: Swipe) => void
  /** §8 — ამბერი ურტყამს, ცივი ლურჯი იცავს */
  tone: 'sodium' | 'floodlight'
  hint: string
}

interface DragState {
  pointerId: number
  originX: number
  originY: number
  x: number
  y: number
}

/**
 * მოსმის ზედაპირი — მთელი ეკრანი. თაგვიც და შეხებაც ერთი და იმავე
 * Pointer Events-ით მუშაობს, ბრაუზერის ჟესტები გამორთულია.
 */
export function AimSurface({ onPreview, onCommit, tone, hint }: AimSurfaceProps) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const color = tone === 'sodium' ? PALETTE.sodium : PALETTE.floodlight

  const swipeFor = useCallback((d: DragState): Swipe => {
    return mapSwipe(d.x - d.originX, d.y - d.originY, {
      width: window.innerWidth,
      height: window.innerHeight,
    })
  }, [])

  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag) return
    ref.current?.setPointerCapture(e.pointerId)
    setDrag({ pointerId: e.pointerId, originX: e.clientX, originY: e.clientY, x: e.clientX, y: e.clientY })
  }

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return
    const next = { ...drag, x: e.clientX, y: e.clientY }
    setDrag(next)
    const swipe = swipeFor(next)
    onPreview(swipe.valid ? swipe : null)
  }

  const onUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag || e.pointerId !== drag.pointerId) return
    const swipe = swipeFor({ ...drag, x: e.clientX, y: e.clientY })
    setDrag(null)
    onPreview(null)
    if (swipe.valid) onCommit(swipe)
  }

  const onCancel = () => {
    setDrag(null)
    onPreview(null)
  }

  const power = drag ? swipeFor(drag).power : 0

  return (
    <div
      ref={ref}
      className="no-touch-gestures absolute inset-0 z-10 cursor-crosshair"
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
