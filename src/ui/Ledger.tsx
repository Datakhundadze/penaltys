import type { LedgerCell } from '../game/series'

/**
 * §8 — ხელმოწერა: ledger.
 * შევსებული და ცარიელი წრეების რიგი, ●●○●◐. ეს არის ერთადერთი
 * პროგრესის ენა მთელ პროდუქტში, ამიტომ ის ცალკე კომპონენტია.
 */
export function Ledger({
  cells,
  tone,
  align = 'left',
}: {
  cells: readonly LedgerCell[]
  /** ვის რიგია — §8-ის ორი ტემპერატურა */
  tone: 'sodium' | 'floodlight'
  align?: 'left' | 'right'
}) {
  const color = tone === 'sodium' ? 'var(--color-sodium)' : 'var(--color-floodlight)'

  return (
    <div
      className={`flex items-center gap-1.5 ${align === 'right' ? 'justify-end' : ''}`}
      aria-hidden
    >
      {cells.map((cell, i) => (
        <span
          key={i}
          className="block h-2.5 w-2.5 rounded-full"
          style={cellStyle(cell, color)}
        />
      ))}
    </div>
  )
}

function cellStyle(cell: LedgerCell, color: string): React.CSSProperties {
  switch (cell) {
    case 'scored':
      return { background: color, boxShadow: `0 0 10px ${color}66` }
    case 'missed':
      return { border: `1.5px solid ${color}`, opacity: 0.5 }
    case 'current':
      return {
        background: `linear-gradient(90deg, ${color} 50%, transparent 50%)`,
        border: `1.5px solid ${color}`,
      }
    case 'pending':
      return { border: `1.5px solid var(--color-chalk)`, opacity: 0.22 }
  }
}
