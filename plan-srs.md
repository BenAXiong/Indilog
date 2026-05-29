# Indivore — SRS Feature Plan

> Companion to `plan-v1.md`. This file scopes the full spaced-repetition system
> from algorithm to UI, sequenced by what actually unblocks studying vs. what's
> polish and power-user tooling.

> Status key: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked

---

## Principles

**Don't build Anki. Build what you need to study Amis.**

The Anki trap: spend months on the tool, never use it. Every feature below should
pass the test "would I stop studying without this?" Tier 1 items do. Tier 3 items
don't — they improve an already-working loop.

**Fixed intervals → SM-2 → FSRS is the upgrade path.**
Fixed intervals are already live. SM-2 is the right first algorithm upgrade — it's
simple, proven, and personalizes per card. FSRS is better but complex; only worth
it once there's enough review history to benefit from it.

---

## Current state (as of 2026-05-29)

- [x] `ind_flashcards` table with `front`, `back`, `due_at`
- [x] Fixed-interval scheduling (Again: 10m / Hard: 1d / Good: 3d / Easy: 7d)
- [x] `ensureFlashcards()` — generates cards from `ind_items`
- [x] `generateFlashcardsFromCollection()` — generates cards from `ind_learn_cards`
- [x] Basic review session: reveal → rate → next card
- [x] `item_id` nullable + `collection_card_id` on `ind_flashcards`
- [x] Amis1k collection importable, 1063 cards

---

## Schema additions needed

Apply each in the Supabase SQL editor as the feature requiring it is built.

```sql
-- SM-2 state per card (Tier 1)
ALTER TABLE ind_flashcards
  ADD COLUMN IF NOT EXISTS ease_factor   real    NOT NULL DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS interval_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repetitions   integer NOT NULL DEFAULT 0;

-- Suspension (Tier 3)
ALTER TABLE ind_flashcards
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

-- Flags (Tier 3)
ALTER TABLE ind_flashcards
  ADD COLUMN IF NOT EXISTS flagged boolean NOT NULL DEFAULT false;
```

---

## Tier 1 — Core loop

*Goal: a session you'd actually sit down and do every day.*

### T1-A — SM-2 algorithm (`lib/db/srs/schedule.ts`)

- [ ] Define `SMState { ease_factor, interval_days, repetitions }` type
- [ ] `nextSM2(state, rating)` → `{ due_at, new_state }` — pure function, no DB
- [ ] Update `rateCard()` to call `nextSM2` and write `ease_factor`, `interval_days`, `repetitions`
- [ ] Migrate existing cards: set default SM-2 state (ease 2.5, interval 0, reps 0) — already handled by column defaults

Rating → SM-2 mapping:
| Rating | Effect |
|---|---|
| Again | interval = 1 day · ease -= 0.2 · reps = 0 |
| Hard  | interval = max(1, interval × 1.2) · ease -= 0.15 |
| Good  | interval = interval × ease (min 1 day on first rep) |
| Easy  | interval = interval × ease × 1.3 · ease += 0.15 |
| Min ease factor: 1.3 | |

### T1-B — Daily goal session

- [ ] Settings: daily goal slider in General tab (already in `ind_profiles.daily_goal` schema)
- [ ] Session counter: track cards reviewed today, stop offering new cards once goal reached
- [ ] Session start screen: show due count, goal remaining, "Begin" button
- [ ] Session end screen: cards reviewed, accuracy %, streak update
- [ ] Keyboard shortcuts: 1/2/3/4 = Again/Hard/Good/Easy, Space = reveal

### T1-C — Review page overhaul

- [ ] Landing: "You have N cards due" + daily goal ring + Begin button
- [ ] Replace current flat reveal/rate with: front → tap/Space to reveal → rate buttons
- [ ] Progress bar at top (not dots — too many for 1063 cards)
- [ ] Undo last rating (within session, single level)
- [ ] Skip card (send to end of session queue)
- [ ] Card source label: "Amis1k", "Capture", "Dict save" (from `ind_learn_cards` or `ind_items`)

### T1-D — Content sources wired

- [x] From `ind_items` (captures, dict/learn saves) — existing
- [x] From `ind_learn_collections` (Amis1k) — done
- [ ] Source filter on review landing: All / Captures / Collections (per collection)
- [ ] `ensureFlashcards()` called on Review landing, not just on mount — dedup safe

---

## Tier 2 — Progress layer

*Goal: feel the progress, stay motivated.*

### T2-A — Dashboard heatmap (real data)

- [ ] Replace seed-based heatmap with real `ind_daily_stats` data
- [ ] Color intensity = reviewed_count, not captured_count
- [ ] Show streak count accurately (currently computed from captured_count)

### T2-B — Daily goal ring

- [ ] Dashboard: ring showing today's reviewed / goal
- [ ] Review landing: same ring
- [ ] Green when goal met, amber when close, red when 0

### T2-C — Per-language stats

- [ ] Cards total / due today / mastered (ease_factor ≥ 2.5 and interval_days ≥ 21)
- [ ] Show on Review landing or a dedicated Stats page
- [ ] Amis1k coverage: X of 1063 cards mastered

### T2-D — Session summary screen

- [ ] After rating last card: show cards reviewed, accuracy %, time spent
- [ ] If daily goal met: celebration state
- [ ] "Review more" (if cards remain) vs "Come back tomorrow"

---

## Tier 3 — Power features

*Only after Tier 1 and 2 are solid and you've been studying for a few weeks.*

### T3-A — Card browser

- [ ] List all `ind_flashcards` for current language
- [ ] Show: front, back, source, due date, ease factor, interval
- [ ] Edit front/back inline
- [ ] Filter: all / due / new / suspended / flagged
- [ ] Sort: by due date, by ease, by creation date

### T3-B — Card suspension

- [ ] Suspend button on card during review (skips until manually unsuspended)
- [ ] Unsuspend in card browser
- [ ] Suspended cards excluded from `listDueFlashcards`

### T3-C — Flags

- [ ] Flag button during review (mark for later attention)
- [ ] Flagged filter in card browser
- [ ] Review flagged cards as a separate session

### T3-D — Card types

- [ ] Reverse cards (zh → ab)
- [ ] Audio-only cards (play audio, produce ab text) — requires audio data
- [ ] Card type selector per collection on import

### T3-E — FSRS upgrade

- [ ] Replace SM-2 with FSRS-4.5 if scheduling quality feels wrong after 4+ weeks of data
- [ ] FSRS requires retrievability estimation — more complex but better for long intervals
- [ ] Keep SM-2 as fallback

---

## Design notes

The review session is the most important screen in the app — it needs to feel
satisfying, not clinical. Key design decisions to make before building T1-C:

- **Card size**: full-screen card or contained card on cream background?
- **Reveal animation**: flip (current `animate-iv-flip`) or slide up?
- **Rating buttons**: horizontal row (current) or arc/radial layout?
- **Streak/goal feedback**: subtle (number) or expressive (animation on goal met)?
- **Font**: Newsreader for the indigenous text? Needs to be large and clear.

Consider a design checkpoint (sketch/mockup) before building T1-C overhaul.

---

## Sequence

```
Now:       T1-A (SM-2)         ← algorithm, pure function, no UI
           T1-B partial        ← goal session counter, session end screen
           T1-D source filter  ← source labels on cards

Week 1:    T1-C review overhaul ← after design decision
           T1-B complete        ← start screen, keyboard shortcuts

Week 2:    T2-A heatmap         ← quick win, real data
           T2-B goal ring
           T2-D session summary

Later:     T2-C stats
           T3-A card browser    ← when you actually want to edit cards
           T3-B suspension      ← when you have cards you want to skip
           T3-C flags
           T3-D card types
           T3-E FSRS            ← after 4+ weeks of data
```

---

## Open design questions

1. **Algorithm first or session UX first?** SM-2 is a code change only; session UX
   requires design. Recommend: ship SM-2 silently first (users won't notice), then
   redesign the session UX with the better algorithm already under the hood.

2. **Where do stats live?** Dedicated `/stats` route, or embedded in Dashboard and
   Review landing? Leaning toward: Dashboard gets the ring + streak, Review landing
   gets the per-language breakdown, no separate route needed for Tier 2.

3. **Card browser route?** `/review/cards` or `/library` (which also shows captures)?
   If Library (M2) shows all `ind_items` and the card browser shows `ind_flashcards`,
   they're different enough to warrant separate routes.

4. **Amis1k mastery definition?** ease_factor ≥ 2.5 AND interval_days ≥ 21 is a
   reasonable "known" threshold. "Mastered" could be ≥ 60 days. Define before
   building T2-C so the metric is consistent.
