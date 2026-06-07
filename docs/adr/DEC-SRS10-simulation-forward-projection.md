---
id: DEC-SRS10
title: Simulation — FormoSRS-1 day-by-day forward projection
status: accepted
date: 2026-06-07
---

## Context

The GoalSheet Simulate tab shows a projected review load curve (today / 2 weeks / at deadline) for a set of priority decks and a deadline. The original implementation (`runSimulation` + `buildCurve` in `simulation-client.ts`) used a one-shot formula:

```ts
reviewTarget = max(5, round((existingReviewDue + learnTarget × 2) / 5) × 5)
```

This inflated day-0 review counts by `learnTarget × 2` — implying that newly-graduated cards generate reviews immediately. A user with 0 existing graduated cards and a 15-card/day learn target was shown 60 reviews/day from day 1, which is incorrect: cards graduated today are not due for review until tomorrow at the earliest.

The server-side `computeSimulation` (used for the dashboard rings) had the same bug.

## Decision

Replace the formula with a proper day-by-day forward projection using FormoSRS-1 scheduling:

### `advanceGood(rep, interval, ease)`
Mirrors the `'good'` branch of `nextFormoSRS1` exactly, without fuzz (deterministic):
- `rep === 0`: next interval = 1d
- `rep > 0`: next interval = `max(1, round(interval × ease))`
- ease += 0.02 (capped at 4.0), rep += 1

### `reviewDaysFrom(firstDay, state, maxDay)`
Walks a card's full review schedule from `firstDay` forward, applying `advanceGood` at each step, collecting every review day up to `maxDay`.

### `projectSimulation` (main function)
For a set of collection IDs and a deadline:
1. **Already-graduated cards**: project each from its real `due_at` using `reviewDaysFrom`. These cards are never ignored — switching to a new simulation goal does not remove their review load from the projection.
2. **New cards (rep = 0)**: graduated at `learnTarget/day`. All cards graduating on the same day share an identical review schedule, so `reviewDaysFrom` is called once per graduation day and the count is multiplied — O(daysLeft) not O(totalNewCards).
3. Returns a `SimulationDay[]` array (one entry per day) with exact `learn` and `review` counts.

### Server-side fix
`reviewTarget` in `computeSimulation` (`simulation.ts`) changed to `max(reviewCap, existingReviewDue)` — only actually-due reviews count toward today's target; the `learnTarget × 2` multiplier is removed.

## Expected curve (15 new/day, 60-day deadline, 0 existing reviews)

| Day | Learn | Review | Source |
|-----|-------|--------|--------|
| 0 | 15 | 0 | No graduated cards |
| 1 | 15 | 15 | Day-0 cohort (interval 0.5d → ceil = 1) |
| 2 | 15 | 30 | Two cohorts |
| 5 | 15 | 45 | Three cohorts (+1, +2, +5 offsets align) |
| 13 | 15 | 60 | Four cohorts |
| 33+ | 0–15 | 75 | Five cohorts (peak) |

## Consequences

- Simulation output is accurate from day 0: no phantom reviews.
- Existing graduated cards from previous goals are included automatically (they are in the `graduated` filter of the same deck).
- Performance: O(daysLeft × reviewsPerCard) ≈ 60 × 5 = 300 iterations for a 60-day run, regardless of deck size.
- `buildCurveFromDays` extracts today / 2-week / at-deadline rows for the GoalSheet table.
- `TodayTarget` type added for the Goals tab's "Calculated" mode display (separate from `SimulationCurve` array type).
