import { useEffect, useState } from 'react'
import type { Quality } from '../scene/textures'

const QUERY = '(max-width: 640px)'

/**
 * ხარისხის ავტომატური გადამრთველი: ვიწრო (მობილურ) ეკრანზე
 * პოსტპროცესინგი ითიშება და ტექსტურები ნახევრდება, რომ კადრები
 * არ დავარდეს. დესკტოპზე სრული ხარისხია.
 */
export function useQuality(): Quality {
  const [small, setSmall] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(QUERY).matches,
  )

  useEffect(() => {
    const mq = window.matchMedia(QUERY)
    const onChange = (e: MediaQueryListEvent) => setSmall(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return small ? 'low' : 'high'
}
