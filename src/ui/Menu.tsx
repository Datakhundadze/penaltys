import { useState } from 'react'
import type { Difficulty } from '../lib/physics'
import { DIFFICULTY_LABEL, DIFFICULTY_NOTE, T } from './strings'

const LEVELS: Difficulty[] = ['easy', 'normal', 'hard']

/**
 * პატარა მენიუ — მხოლოდ სირთულე.
 * სირთულე მხოლოდ მეკარის REFLEX/REACH-ს ცვლის, სხვას არაფერს.
 */
export function Menu({ onStart }: { onStart: (difficulty: Difficulty) => void }) {
  const [picked, setPicked] = useState<Difficulty>('normal')

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-night/78 px-6 backdrop-blur-[2px]">
      <h1 className="display text-xl leading-none">{T.title}</h1>
      <p className="mt-3 text-2xs opacity-55 sm:text-xs">{T.subtitle}</p>

      <div className="mt-10 w-full max-w-xs">
        <p className="mb-3 text-2xs opacity-50">{T.difficulty}</p>
        <div className="flex flex-col gap-2">
          {LEVELS.map((level) => {
            const active = picked === level
            return (
              <button
                key={level}
                type="button"
                onClick={() => setPicked(level)}
                aria-pressed={active}
                className="flex items-baseline justify-between rounded-sm border px-4 py-3 text-left transition-colors"
                style={{
                  borderColor: active ? 'var(--color-sodium)' : 'rgba(232,237,230,0.16)',
                  background: active ? 'rgba(242,178,62,0.09)' : 'transparent',
                }}
              >
                <span className="text-sm">{DIFFICULTY_LABEL[level]}</span>
                <span className="text-2xs opacity-45">{DIFFICULTY_NOTE[level]}</span>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => onStart(picked)}
          className="mt-6 w-full rounded-sm bg-sodium px-4 py-3.5 text-sm font-semibold text-night"
        >
          {T.start}
        </button>
      </div>
    </div>
  )
}
