export type SMState = {
  ease_factor: number
  interval_days: number
  repetitions: number
}

export type Rating = 'again' | 'hard' | 'good' | 'easy'

export const MIN_EASE = 1.3
const MAX_EASE = 4

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
// Deterministic interval estimate (no fuzz) — for display only, not for scheduling
export function estimateInterval(state: SMState, rating: Rating): number {
  const { ease_factor, interval_days, repetitions } = state
  switch (rating) {
    case 'again': return 1
    case 'hard':  return Math.max(1, Math.round(interval_days * 1.2))
    case 'good':  return repetitions === 0 ? 1 : Math.max(1, Math.round(interval_days * ease_factor))
    case 'easy': {
      if (repetitions === 0) return 4
      const good = Math.max(1, Math.round(interval_days * ease_factor))
      return Math.max(good + 1, Math.round(interval_days * ease_factor * 1.3))
    }
  }
}

export function formatDays(days: number): string {
  if (days <= 1) return `${days}d`
  if (days < 14)  return `${days}d`
  if (days < 60)  return `${Math.round(days / 7)}w`
  if (days < 548) return `${Math.round(days / 30)}mo`
  return `${Math.round(days / 365)}y`
}

export function nextFormoSRS1(
  state: SMState,
  rating: Rating,
): { due_at: string; new_state: SMState } {
  let { ease_factor, interval_days, repetitions } = state
  let nextInterval: number

  switch (rating) {
    case 'again':
      nextInterval = 1
      ease_factor = Math.max(MIN_EASE, ease_factor - 0.2)
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

/**
 * Relearn scheduling: applied when a mature card (interval ≥ 7d) completes its
 * relearn burst. Good/Easy recover at 50% of the lapsed interval; Again full-resets.
 * Ease is always penalised — the card did lapse regardless of relearn outcome.
 */
export function nextRelearn(
  state: SMState,
  rating: 'good' | 'easy' | 'again',
  lapsedInterval: number,
): { due_at: string; new_state: SMState } {
  let { ease_factor, repetitions } = state
  let nextInterval: number

  if (rating === 'again') {
    nextInterval = 1
    ease_factor  = Math.max(MIN_EASE, ease_factor - 0.2)
    repetitions  = 0
  } else {
    nextInterval = Math.max(1, Math.floor(lapsedInterval * 0.5))
    ease_factor  = Math.max(MIN_EASE, ease_factor - 0.2)
    repetitions  = repetitions + 1
  }

  nextInterval = fuzz(nextInterval)
  const due_at = new Date(Date.now() + nextInterval * 86400000).toISOString()
  return { due_at, new_state: { ease_factor, interval_days: nextInterval, repetitions } }
}

// ─── Card strength (B model) ──────────────────────────────────────────────────
// strength = R × S_norm
// R (retrievability) = exp(-t / interval)  — probability of recall right now
// S_norm = min(interval / 21, 1)           — stability normalised to 21d mature threshold
// t = days since last review, derived from due_at - interval_days

export type StrengthResult = { score: number; R: number; S: number }

export function computeStrength(card: {
  card_id: string | null
  repetitions: number
  interval_days: number
  due_at: string | null
}): StrengthResult | null {
  if (!card.card_id || !card.due_at || card.repetitions === 0 || card.interval_days <= 0) return null
  const dueMs       = new Date(card.due_at).getTime()
  const lastReviewMs = dueMs - card.interval_days * 86_400_000
  const t           = (Date.now() - lastReviewMs) / 86_400_000   // days since last review
  const R           = Math.exp(-t / card.interval_days)           // retrievability 0–1
  const S_norm      = Math.min(card.interval_days / 21, 1)        // stability 0–1 (21d = mature)
  return { score: R * S_norm, R, S: card.interval_days }
}
