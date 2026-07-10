# FSRS Migration Notes

> See also: `DEC-SRS03-formosrs1-algorithm.md` — the current FormoSRS-1 spec and the original "why not FSRS" rationale.

## Where FSRS fits in the SRS stack

FSRS replaces only the **core interval calculation** — the formula that maps a rating to a next interval. It does not touch:

- The Learn/Review/Relearning state machine
- Learning and relearning steps
- Lapse counter and leech detection
- Burying and suspension
- Graduation logic

All of those live around the algorithm, not inside it. A migration to FSRS is a vertical swap at one layer; the surrounding system is unchanged.

## What FSRS tracks (vs FormoSRS-1)

| | FormoSRS-1 | FSRS |
|---|---|---|
| Per-card state | `ease_factor`, `interval_days`, `repetitions` | `stability` (S), `difficulty` (D), `retrievability` (R, computed) |
| Scheduling target | Fixed multiplier (ease × interval) | Retention rate (default 90%) — interval set where R drops to target |
| Ease hell risk | Mitigated by Good +0.02 recovery | Eliminated by design — no ease factor |
| Late review handling | Ignores delay | Recalculates R from actual elapsed time — late review gets smaller stability boost |
| Personalization | Static formula | Parameters can be optimized on user's own review history after ~1000 reviews |

## The young-card interval concern

FSRS schedules based on estimated stability. For a card it rates as "easy" after one or two reviews, it may push the next interval significantly further out than FormoSRS-1 would. Users expect to see young cards frequently; FSRS optimizes for efficiency, not frequency.

**Is it a real problem for Indivore?**

Likely yes, more than for general SRS use. Formosan languages have minimal natural exposure outside the app — there are no incidental encounters in the wild to fill the gaps. The default FSRS parameters are population-average; our users' forgetting curves for these languages are probably steeper, meaning the defaults will overshoot.

## Mitigations (if/when we migrate)

**Lower the target retention rate.** The main lever. Dropping from 90% → 85% shortens all intervals across the board. 95% tightens them considerably. Start here.

**Extend learning steps before graduation.** Learning steps are independent of FSRS — they run before the algorithm takes over. Longer steps (e.g. `1m 10m 1d 4d`) mean FSRS inherits a card with more early reps already baked in, and its initial stability estimate starts from a stronger baseline.

**Optimize parameters on real review history.** After ~1000 reviews the FSRS parameters can be fit to actual per-user forgetting curves. For a language with low natural exposure, optimized params will typically produce shorter intervals than the defaults because the fitted forgetting curve is steeper. This is the cleanest long-term fix.

**Per-deck retention targets.** Vocabulary decks → higher retention target (shorter intervals). Mature content → default. Needs tool-level support.

## What migration would require in the codebase

- Add `stability` and `difficulty` columns to `ind_flashcards`
- Rewrite `rateCard` / `rateCardRelearn` in `lib/db/srs/schedule.ts`
- Redefine Rooted mastery grade: currently `ease_factor >= 2.5` is one gate — needs a stability-based equivalent (e.g. `stability >= 21`)
- Preserve `repetitions` and `lapses` — these still drive state machine transitions (Learn/Review boundary, leech detection), independent of the scheduling math

## Timing

Per DEC-SRS03: revisit after 4+ weeks of production data. FSRS optimization needs a meaningful review history to fit parameters; migrating before that means running on population-average defaults with no calibration.
