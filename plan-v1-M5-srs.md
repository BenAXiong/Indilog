# Indivore v1 — M5-B SRS Overhaul Implementation Plan

> Decisions from grill session 2026-06-06. See **DEC-M5-01** (Learn/Review separation + priority list) and **DEC-SRS09** (mastery grades) for full decision rationale.
> See **CONTEXT.md** for canonical terminology (Learn session, Review session, Exposure pass, Priority list, Simulation, Mastery grade, Streak, etc.)

---

## What this plan covers

- Learn / Review session separation (strict, `repetitions === 0` boundary)
- New Learn session UI (Exposure + Test passes, graduation logic)
- Priority list replacing single `goal_collection_id`
- Dynamic Simulation replacing static `daily_goal`
- GoalSheet 3-tab revamp (Goals / Priority / Simulate)
- Dashboard 2-ring + 2-CTA redesign
- Mastery grades (Seed / Planted / Rooted / Blooming)
- `ind_daily_stats.learned_count` tracking + streak update

---

## Architectural constraints (from `agents.md` + `architecture.md`)

- **Build in strict phase order.** Do not start Phase N+1 until Phase N is complete and verified.
- **Phase-start gate.** Before writing any code for a phase, summarise scope and get user go-ahead.
- **Settings sync rule.** Every new setting must write to both `localStorage` AND `ind_profiles.preferences` via `patchPreferences()`. No localStorage-only writes.
- **Pagination.** Any query that may return >1000 rows must use the `.range()` pagination pattern from `architecture.md`.
- **`architecture.md` first.** Read it before touching `ind_items`, `ind_flashcards`, or anything in `lib/db/srs/`.
- **Commit cadence.** One commit per screen, component, or schema change — not one commit per phase.

---

## Phase 1 — Schema

*Everything downstream blocks on this. No UI work until migrations are applied and verified.*

### 1A — New table: `ind_priority_decks`
```sql
CREATE TABLE ind_priority_decks (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collection_id       uuid NOT NULL REFERENCES ind_learn_collections(id) ON DELETE CASCADE,
  position            int  NOT NULL,
  in_simulation       boolean NOT NULL DEFAULT false,
  simulation_deadline date,
  UNIQUE (user_id, collection_id),
  UNIQUE (user_id, position)
);
```

### 1B — Extend `ind_daily_stats`
```sql
ALTER TABLE ind_daily_stats ADD COLUMN learned_count int NOT NULL DEFAULT 0;
```

### 1C — `ind_profiles.preferences` keys
- Rename `daily_cap` → `review_cap` in all read/write paths (no DB migration needed — JSONB key rename at application layer; old key falls back to default)
- Add `learn_cap` (default 10)
- Add `review_more_size` (nullable — null means use formula)
- Data migration: copy existing `goal_collection_id` + `goal_due_date` from `ind_profiles` to a new row in `ind_priority_decks` (position=1, in_simulation=true if due date set) per user. **Do not drop `goal_collection_id` / `goal_due_date` yet** — expand/contract pattern: mark deprecated, read from new table, drop in a cleanup migration after the feature ships and is verified in production.

### 1D — New Supabase RPC: `increment_learned_today`
Parallel to existing `increment_reviewed_today`. Increments `ind_daily_stats.learned_count` for the current study date.

---

## Phase 2 — Query layer

*No UI changes. Update and add DB helper functions only.*

### 2A — Update `listDueFlashcards` (Review filter)
Add `repetitions > 0` filter. Review sessions must never see new cards.

```
WHERE (due_at <= now() OR due_at IS NULL)  -- old
WHERE due_at <= now() AND repetitions > 0  -- new
```

Note: after graduation, all Review cards have `due_at` set. `due_at IS NULL` is now exclusively a Learn-card signal and must not appear in Review queries.

### 2B — New `listLearnFlashcards`
New function in `lib/db/srs/flashcards.ts`. Loads `repetitions === 0, suspended_at IS NULL` cards. Priority-sorted post-fetch:
1. Cards from `ind_priority_decks` in ascending `position` order, within each deck sorted by `level → lesson → position`
2. Non-priority cards after

### 2C — New `lib/db/srs/priority.ts`
CRUD helpers:
- `listPriorityDecks(userId)` — ordered by `position`
- `addPriorityDeck(userId, collectionId)` — appends at end
- `removePriorityDeck(userId, collectionId)` — removes and re-sequences positions
- `reorderPriorityDecks(userId, orderedIds)` — bulk reposition
- `setPriorityDeckSimulation(userId, collectionId, inSimulation, deadline?)` — toggle simulation membership

### 2D — Simulation computation function
New function in `lib/db/srs/simulation.ts`. Called on dashboard load when any priority decks have `in_simulation = true`.

Input: priority decks marked `in_simulation`, their `simulation_deadline`, current SRS state of their cards.

Output: `{ learnTarget: number, reviewTarget: number }` for today.

Logic: for each in-simulation deck, compute cards remaining to reach Rooted (`interval_days >= 21 AND repetitions >= 5 AND ease_factor >= 2.5`) by the deadline. Distribute required new cards/day (Learn target) and projected review load (Review target) across remaining days.

**v+ note:** Option A (`interval_days >= 21` only, no repetitions/ease gate) should be exposed as an experimental flag to test whether the stricter Rooted threshold creates over-reliance on SRS drilling vs. natural retention.

### 2E — Update `getDashboardStats`
Add to return shape:
- `newCount` — `repetitions === 0 AND suspended_at IS NULL` (total new cards available)
- `learnedToday` — from `ind_daily_stats.learned_count`
- `learnTarget` — from simulation output or `preferences.learn_cap` (manual mode)
- `reviewTarget` — from simulation output or `preferences.review_cap` (manual mode)

### 2F — Update `getDueStats` / dashboard count
Apply `repetitions > 0` filter to `dueRes` in `getDashboardStats`. The existing DEC-DASH-01 open issue (language/collection exclusions diverging between dashboard and session) should be addressed here now that the Learn/Review decision is resolved.

---

## Phase 3 — Review session update

*Depends on Phase 2. Update existing `/review` page.*

- [x] Remove learn phase (`learningQueue`, pass dots, `rateCardRelearn` calls in session) — Review is `repetitions > 0` exclusively
- [x] Update session load to use updated `listDueFlashcards` (now filters `repetitions > 0`)
- [x] Rename `daily_cap` reads → `review_cap` (preferences + localStorage key)
- [x] "Review N more" CTA: compute N = `Math.max(10, Math.round(reviewTarget / 50) * 5)`; add edit icon → inline stepper (step=5, min=10); persist to `preferences.review_more_size` + localStorage (settings sync rule)
- [x] Priority sort: replace `goal_collection_id` post-sort with `ind_priority_decks` ordered sort

---

## Phase 4 — Learn session (new page)

*Depends on Phase 2. New route — confirm path before creating.*

### Session mechanics
Each card cycles through:
1. **Exposure pass** — card shown fully revealed (front + back visible); "OK" button or swipe right; no DB write, no rating
2. **Test pass(es)** — card shown front-only; user reveals; rates:
   - **Again** — resets consecutive-Good counter to 0; card re-queues for Test (not re-exposed)
   - **Good** — increments counter; if counter reaches 2 → graduation at 12h
   - **Easy** — immediate graduation at 4d; bypasses two-pass requirement

### Graduation
Calls `rateCard` with a synthetic first-graduation rating that sets `repetitions = 1` and `interval_days = 0.5` (12h Good) or `interval_days = 4` (Easy). Then calls `increment_learned_today`.

### Queue management
- Session loads `min(newAvailable, learnCap - learnedToday)` cards
- Default cap: 10. Maximum: 20. Label levels displayed in GoalSheet (chill=3, regular=5, serious=10, hardcore=20) with projected review load after 1w, 2w, 3mo.
- Consecutive-Good counter tracked in session state (not DB). Rendered as two dots in session UI.

### Toast
When priority deck cards are exhausted and non-priority cards begin: toast "Priority decks done · showing other new cards" (fires once per session).

---

## Phase 5 — Dashboard

*Depends on Phases 1–4.*

- [x] Two rings: Learn ring (`learnedToday / learnTarget`) + Review ring (`reviewedToday / reviewTarget`). Exact layout (side-by-side / stacked / split arcs) deferred to design pass — implement simplest version first.
- [x] Learn CTA (3 states):
  - `newAvailable > 0` and `learnedToday < learnTarget` → "Learn N new" (crimson/green TBD)
  - `learnedToday >= learnTarget` and `newAvailable > 0` → "Learn more?"
  - `newAvailable === 0` → "No new cards left~"
- [x] Review CTA (updated 3 states):
  - `dueCount > 0` and `reviewedToday < reviewTarget` → "Review N due" (crimson)
  - `reviewedToday >= reviewTarget` and `totalDue > 0` → "Review N more [✏]" (amber)
  - `totalDue === 0` → "All caught up!" (sage)
- [x] Streak logic update: simulation active → both targets met; no simulation → either cap hit

---

## Phase 6 — GoalSheet revamp

*Depends on Phases 1–5. Biggest UI change.*

3-tab sheet replacing the current GoalSheet:

### Tab 1 — Goals
- Mode toggle: Manual / Calculated
- **Manual**: Learn daily goal stepper (1–20, step 1) + Review daily goal stepper. Level labels: chill=3, regular=5, serious=10, hardcore=20. Forecast: projected review load at 1w / 2w / 3mo.
- **Calculated**: Shows today's simulation output (Learn N/day, Review N/day). "Recalculate" trigger. Read-only — numbers come from the Simulation tab setup.
- Settings sync: `learn_cap`, `review_cap` → localStorage + `patchPreferences()`

### Tab 2 — Priority
- Ordered list of priority decks. Drag-to-reorder (or up/down arrows for v1). Add deck (picker from `ind_learn_collections`). Remove deck. Per-deck: name, mastery progress bar (% Rooted), `in_simulation` toggle.
- Shuffle within priority decks: **deferred** (in-deck vs inter-deck options not yet evaluated).

### Tab 3 — Simulate
- Deck selection: checkboxes from priority list (1 to all). Deadline date picker. "Run simulation" CTA.
- Output: curve table (today / 2w / 3mo rows showing Learn/day + Review/day). "Apply as my daily targets?" → switches to Calculated mode and saves deadline + selection to `ind_priority_decks`.

---

## Phase 7 — Mastery grades

*Depends on Phase 2 (query layer). Relatively independent — can be done after Phase 2.*

- [x] `computeMasteryGrade(card)` utility function:
  ```ts
  // Returns 'seed' | 'planted' | 'rooted' | 'blooming'
  if (card.repetitions === 0) return 'seed'
  if (card.interval_days >= 60) return 'blooming'
  if (card.interval_days >= 21 && card.repetitions >= 5 && card.ease_factor >= 2.5) return 'rooted'
  return 'planted'
  ```
- [x] Display grade badge in Browser expanded card view
- [x] Update Stats subtab: replace "Mastered" count with Rooted count; add Blooming count
- [x] Dashboard "Overview" Stat widget: rename "Mastered" → "Rooted"
- [x] v+ note in code: add `// v+: test interval-only (A) threshold — less SRS-reliant, may work at 85%` comment alongside Rooted condition

---

## Deferred

- Shuffle options for priority list (in-deck vs inter-deck — options not yet evaluated)
- 3rd ring for Captures
- Configurable streak per goal type (any/all/combination of caps)
- Option A simulation target (`interval_days >= 21` only) as experimental flag
