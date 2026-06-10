# Learn / Review session separation and priority-list goal model

Two separate SRS entry points replace the single "Review" CTA. Architectural decisions from the M5-B grilling session (2026-06-06).

## Session boundary

**`repetitions === 0` is the Learn/Review boundary.** A card is a Learn card until it graduates; after graduation it is a Review card exclusively. The boundary is strict — Review sessions never load `repetitions === 0` cards, Learn sessions never load `repetitions > 0` cards. The existing learn phase inside the Review session is removed.

## Learn session mechanics

Each card progresses through three stages:

1. **Exposure pass** — card shown fully revealed; user taps OK (→) or swipes right to confirm; swipe up / ArrowUp → **Easy** (direct graduation at 4d, bypasses test entirely); swipe down / ArrowDown → Suspend; no other rating recorded.
2. **Test passes** — card shown front-only; rated Again / Good / Easy.
   - Two consecutive Good responses → **graduate at 12h** (`repetitions = 1, interval_days = 0.5`)
   - Easy → **graduate at 4d** (`repetitions = 1, interval_days = 4`); skips the two-pass requirement
   - Again → resets the consecutive-Good counter; card re-queues for Test passes (not re-exposed)

### Open question: Easy in test pass

Easy is currently available in both the exposure pass and the test pass. The exposure-pass Easy is clearly justified (you recognised it immediately — no test needed). The **test-pass Easy is less clear**: if the card is in the test pass, the user already confirmed they didn't instantly recognise it (they didn't use exposure-Easy), so a 4d interval may be overconfident. Consider removing Easy from the test pass and routing "easy" responses to the 2× Good graduation path instead (keeping only Again / Good). Deferred — needs more real-world session data before deciding.

Learn session cap defaults to 10, maximum 20 (configurable in GoalSheet). Default of 10 keeps the Exposure → Test gap short enough that per-card inline exposure remains effective.

### Persistence model

**Graduation is the only DB write point in a Learn session.** Nothing is written until a card graduates. Specifically:

- Exposure pass OK → no write (session state only)
- Test pass — Again / Good below threshold → no write (session state only)
- Test pass — 2× consecutive Good or Easy → `graduateLearnCard()` writes `ind_flashcards` + calls `increment_learned_today` RPC

Consequence: **in-flight progress is lost on exit.** A card that received 1× Good but not yet 2× Good returns to `seed` state at the next session start. This is intentional — the two-pass threshold is the minimum evidence of retention; a partial pass carries no scheduling value.

By contrast, **Review sessions write immediately** on every rating — `rateCard()` updates `ind_flashcards` and appends to `ind_reviews` as soon as the user taps a rating button. Undo (`undoRating`) is available for one step.

### Suspend replacement (overflow buffer)

Both Learn and Review sessions maintain an **overflow buffer**: all available cards beyond the initial session cap, loaded in full at session start and held in memory.

When a card is suspended mid-session, the next overflow card is appended to the queue as a replacement, keeping the session count stable. If the overflow is exhausted, the session shrinks by one (no cards left to draw from). Custom Review sessions (flag, language, or source filter) load all matched cards with no cap, so their overflow is always empty.

## Daily targets and the priority-list goal model

Daily targets (Learn cards/day, Review cards/day) are **never stored** — they are computed fresh on each dashboard/session load from the active Simulation. Two modes:

- **Calculated**: Simulation runs against current SRS state of selected priority decks + user-set deadline → outputs today's Learn target and Review target. Both rings on the dashboard display simulation output.
- **Manual**: User sets Learn and Review daily goals directly in GoalSheet. No simulation needed.

"Cap" is not a user-facing concept. In manual mode, the daily goal IS the effective limit. In calculated mode, the simulation output IS the target. UI max constraints (Learn ≤ 20, Review ≤ 300) are slider ceilings, not surfaced as a separate "cap" concept.

## Priority list

An ordered list of decks (`ind_priority_decks` table, `position` column). Cards from priority decks are sorted first in both Learn and Review sessions, in deck order, then by `level → lesson → position` within each deck. Non-priority cards fill remaining session slots silently. A toast fires once when priority cards are exhausted mid-session.

Priority sorting is always-on when the list is non-empty — no toggle. Shuffle behaviour (in-deck, inter-deck, or other variants) is deferred — options not yet evaluated. Default v1 sort: strict deck order by `position`, within each deck by `level → lesson → position`.

## Streak

- **Simulation active**: streak fires if both `learnedToday >= learnTarget` AND `reviewedToday >= reviewTarget` (both ring targets met). The streak is a goal-realism feedback signal — repeated breaks mean the deadline or scope is too aggressive.
- **No simulation**: streak fires if `learnedToday >= learnDailyGoal` OR `reviewedToday >= reviewDailyGoal` (either daily goal hit).

## Schema changes

- `ind_priority_decks` (new table): `user_id, collection_id, position, in_simulation, simulation_deadline`
- `ind_daily_stats.learned_count` (new column): tracks new cards graduated per day separately from `reviewed_count`
- `ind_profiles.preferences`: `learn_cap` added; `daily_cap` renamed `review_cap`; `goal_collection_id` and `goal_due_date` columns deprecated (data migrated to `ind_priority_decks`)

## Dashboard CTAs

**Learn CTA (3 states):**
- `newAvailable > 0` and `learnedToday < learnTarget` → "Learn N new" (N = min(newAvailable, learnTarget − learnedToday))
- `learnedToday >= learnTarget` and `newAvailable > 0` → "Learn more?"
- `newAvailable === 0` → "No new cards left~"

**Review CTA (3 states):**
- `dueCount > 0` and `reviewedToday < reviewTarget` → "Review N due"
- `reviewedToday >= reviewTarget` and `totalDue > 0` → "Review N more" [✏] where N = `Math.max(10, Math.round(reviewTarget / 50) * 5)`; edit icon persists custom value to `preferences.review_more_size`
- `totalDue === 0` → "All caught up!"

**Open question:** Should Easy be removed from test-pass ratings? See [design-questions.md](../../design-questions.md).
