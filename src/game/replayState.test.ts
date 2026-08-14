import { describe, expect, it } from 'vitest'
import { frameKind } from './replayState'
import type { Phase } from './store'

describe('frameKind — ინვარიანტი: რაუნდი იდლით იწყება', () => {
  it('holds the result pose only on the result screen', () => {
    expect(frameKind('animating', true)).toBe('live')
    expect(frameKind('between-rounds', true)).toBe('hold')
  })

  it('returns to idle when the next round starts aiming, after any result', () => {
    // ზუსტად ის თანმიმდევრობა, რომელშიც მეკარე მიწაზე რჩებოდა:
    // animating → between-rounds (დივის პოზა) → aiming (ახალი რაუნდი)
    const sequence: [Phase, boolean][] = [
      ['aiming', false],
      ['timing', false],
      ['resolving', false],
      ['animating', true],
      ['between-rounds', true],
      ['aiming', false], // ← მეორე რაუნდის დასაწყისი
    ]
    const kinds = sequence.map(([p, hasPlan]) => frameKind(p, hasPlan))
    expect(kinds.at(-1)).toBe('idle')
    // ჰოლდი მხოლოდ ერთ ადგილას ჩნდება
    expect(kinds.filter((k) => k === 'hold')).toHaveLength(1)
  })

  it('is idle in every non-animating phase without a plan', () => {
    for (const phase of ['aiming', 'timing', 'resolving', 'between-rounds', 'finished'] as const) {
      expect(frameKind(phase, false)).toBe('idle')
    }
  })

  it('is idle on the finished screen even though a plan exists', () => {
    expect(frameKind('finished', true)).toBe('idle')
  })

  it('never reports live without a plan to replay', () => {
    expect(frameKind('animating', false)).toBe('idle')
  })
})
