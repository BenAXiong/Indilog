export type SMState = {
  ease_factor: number
  interval_days: number
  repetitions: number
}

export type Rating = 'again' | 'hard' | 'good' | 'easy'

const MIN_EASE = 1.3
const MAX_EASE = 4.0

function fuzz(interval: number): number {
  if (interval < 2) return interval
  const delta = Math.max(1, Math.round(interval * 0.05))
  return Math.max(1, interval + Math.floor(Math.random() * (delta * 2 + 1)) - delta)
}

/**
 * FormoSRS-1: SM-2 base + Anki Hard behavior + ±5% fuzz + ease recovery on Good.
 * Pure function — no side effects, no DB access.
 *
 * Again: interval=1d, ease-=0.20, reps=0
 * Hard:  interval=max(1, prev×1.2), ease-=0.15, reps unchanged
 * Good:  interval=1d (rep0) | prev×ease, ease+=0.02, reps+1
 * Easy:  interval=4d (rep0) | max(good+1, prev×ease×1.3), ease+=0.15, reps+1
 * Min ease: 1.3 · Max ease: 4.0 · Fuzz: ±5% on intervals ≥ 2d
 */
export function nextFormoSRS1(
  state: SMState,
  rating: Rating,
): { due_at: string; new_state: SMState } {
  let { ease_factor, interval_days, repetitions } = state
  let nextInterval: number

  switch (rating) {
    case 'again':
      nextInterval = 1
      ease_factor = Math.max(MIN_EASE, ease_factor - 0.20)
      repetitions = 0
      break

    case 'hard':
      nextInterval = Math.max(1, Math.round(interval_days * 1.2))
      ease_factor = Math.max(MIN_EASE, ease_factor - 0.15)
      break

    case 'good':
      nextInterval = repetitions === 0
        ? 1
        : Math.max(1, Math.round(interval_days * ease_factor))
      ease_factor = Math.min(MAX_EASE, ease_factor + 0.02)
      repetitions += 1
      break

    case 'easy': {
      if (repetitions === 0) {
        nextInterval = 4
      } else {
        const goodInterval = Math.max(1, Math.round(interval_days * ease_factor))
        nextInterval = Math.max(goodInterval + 1, Math.round(interval_days * ease_factor * 1.3))
      }
      ease_factor = Math.min(MAX_EASE, ease_factor + 0.15)
      repetitions += 1
      break
    }
  }

  nextInterval = fuzz(nextInterval)

  const due_at = new Date(Date.now() + nextInterval * 24 * 60 * 60 * 1000).toISOString()

  return {
    due_at,
    new_state: { ease_factor, interval_days: nextInterval, repetitions },
  }
}
