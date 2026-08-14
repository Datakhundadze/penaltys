import { useEffect, useState } from 'react'
import { QUALITY_CLEAN, QUALITY_SHAKY } from '../lib/controls'
import { PALETTE } from '../lib/palette'
import { T } from './strings'

export interface QualityFlashProps {
  /** ბოლო მოსმის ხარისხი; null — ჯერ არ ყოფილა */
  quality: number | null
  /** ჩნდება მხოლოდ გაშვების მომენტში */
  active: boolean
}

/**
 * მოსმის ხარისხის უკუკავშირი — მოთამაშემ უნდა ისწავლოს, როგორია
 * კარგი მოსმა ხელში. მხოლოდ უკიდურესობებზე ჩნდება: სუფთა flick ან
 * აშკარად მერყევი გზა. შუალედი დუმს — §8, არა ხმაური.
 */
export function QualityFlash({ quality, active }: QualityFlashProps) {
  const [shown, setShown] = useState<{ label: string; color: string } | null>(null)

  useEffect(() => {
    if (!active || quality === null) {
      setShown(null)
      return
    }
    if (quality >= QUALITY_CLEAN) {
      setShown({ label: T.cleanStrike, color: PALETTE.sodium })
    } else if (quality <= QUALITY_SHAKY) {
      setShown({ label: T.shakySwipe, color: PALETTE.card })
    } else {
      setShown(null)
      return
    }
    const timer = setTimeout(() => setShown(null), 1100)
    return () => clearTimeout(timer)
  }, [active, quality])

  if (!shown) return null

  return (
    <p
      className="pointer-events-none absolute inset-x-0 top-[38%] z-20 animate-[quality-fade_1.1s_ease-out_forwards] text-center text-sm font-semibold"
      style={{ color: shown.color, textShadow: `0 0 22px ${shown.color}66` }}
    >
      {shown.label}
    </p>
  )
}
