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

**Fixed intervals → FormoSRS-1 → FSRS is the upgrade path.**
Fixed intervals are already live. FormoSRS-1 (SM-2 with targeted fixes, see T1-A)
is the right first upgrade. FSRS is better but is out of scope for v1 — revisit
after serious production review data.

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

## Navigation (settled 2026-05-29)

Tab order: **Dashboard · Study · Capture · Translate · Dict**

The current Learn and Review tabs merge into a single **Study** tab. Study is
the single entry point for all flashcard activity. The existing Learn content
(Lessons / Patterns / Essays / Dialogs) surfaces in Study as Curriculum decks.

---

## Schema additions needed

Apply each in the Supabase SQL editor as the feature requiring it is built.

```sql
-- FormoSRS-1 state per card (T1-A)
ALTER TABLE ind_flashcards
  ADD COLUMN IF NOT EXISTS ease_factor   real    NOT NULL DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS interval_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repetitions   integer NOT NULL DEFAULT 0;

-- Suspension (T3-B)
ALTER TABLE ind_flashcards
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

-- Flags (T3-C)
ALTER TABLE ind_flashcards
  ADD COLUMN IF NOT EXISTS flag_color text;  -- null | 'red' | 'orange' | 'yellow' | 'green' | 'blue'
```

---

## Tier 1 — Core loop

*Goal: a session you'd actually sit down and do every day.*

### T1-A — FormoSRS-1 algorithm (`lib/db/srs/schedule.ts`)

FormoSRS-1 = SM-2 base + Anki Hard behavior (no reset on Hard) + fuzz + ease
recovery on Good.

- [ ] Define `SMState { ease_factor, interval_days, repetitions }` type
- [ ] `nextFormoSRS1(state, rating)` → `{ due_at, new_state }` — pure function, no DB
- [ ] Update `rateCard()` to call `nextFormoSRS1`, write SM-2 columns
- [ ] Column defaults handle existing cards (ease 2.5, interval 0, reps 0)

Rating → algorithm mapping:

| Rating | Interval | Ease delta | Reps |
|---|---|---|---|
| Again | 1 day | −0.20 | reset to 0 |
| Hard  | max(1, prev × 1.2) | −0.15 | unchanged |
| Good  | prev × ease (min 1 day on rep 0) | **+0.02** | +1 |
| Easy  | prev × ease × 1.3 | +0.15 | +1 |

Min ease factor: 1.3

**Good +0.02 (ease hell fix):** Anki's pure-zero Good means ease only moves down
(Hard/Again) or up (Easy), so after ~6 total Again ratings a card hits the 1.3
floor permanently. +0.02 on Good means consistent correct answers slowly recover
ease: 10 consecutive Goods = +0.2 ease recovery. Avoids mean-reversion complexity.

**Fuzz ±5%:** random variation applied to all intervals ≥ 2 days prevents cards
clustering on the same day. `interval = Math.round(interval * (0.95 + Math.random() * 0.1))`

**Learn phase (pending design discussion):** Anki-style fixed steps (e.g. 1m → 10m
→ graduate) before a card enters FormoSRS-1. Crucial for new-card acquisition.
Deferred to T3-A — needs its own design pass as it changes session UX.

### T1-B — Study tab (navigation overhaul)

Replaces both the Learn and Review tabs.

- [ ] New route `/study` with subtab bar: Decks | Browser | Stats
- [ ] Deck list with 3 sections: Curriculum / My Collections / Captures
- [ ] "Review all — N due" primary CTA at top of Decks view
- [ ] Per-deck "..." menu: rename · delete · export · share · toggle in Review all
- [ ] Import button in page header (single, no ghost row)
- [ ] Browser and Stats subtabs: placeholder empty states (built in T2)
- [ ] Redirect `/learn` → `/study`, `/review` → `/study`
- [ ] Update BottomNav: Dashboard · Study · Capture · Translate · Dict

### T1-C — Dashboard overhaul

Dashboard is the primary motivational hub and the main review entry point.

- [ ] Streak hero: chain visual + day count
- [ ] Learning goal widget: placeholder ("Set a goal →") until T2-A ships
- [ ] Today's ring: circular progress reviewed/goal + "N due today"
- [ ] Primary CTA: "Review N due → (~N min)" — goes directly into session
- [ ] Real heatmap: `ind_daily_stats` data, intensity = reviewed_count (~16 weeks)
- [ ] Quick stats 2×2: Mastered · Active · This week · Due tomorrow
- [ ] Remove seed-based heatmap and fake streak

### T1-D — Review session overhaul

Full-screen session, BottomNav hidden during review.

- [ ] Session header: back button · deck name · "X / N" counter
- [ ] Single thin progress bar (not per-card dots)
- [ ] Card contained on cream background (rounded, shadow, not edge-to-edge)
- [ ] Tap card = reveal (no animation — answer appears)
- [ ] Swipe left = Again, swipe right = Good
- [ ] Subtle swipe edge indicators on card (visible before reveal)
- [ ] Rating row: Again · Hard · Good · Easy with interval label (mono)
- [ ] Hard + Easy togglable off in options
- [ ] Full immersion mode: hide button row entirely, gestures only
- [ ] Options sheet via gear icon in session header

### T1-E — Session end screen

- [ ] Hero: "N cards reviewed" (large serif)
- [ ] "N due tomorrow"
- [ ] Confetti: triggers when daily goal met
- [ ] Share: native share API ("Reviewed N cards · 🔥 X-day streak")
- [ ] CTAs: "Review more" (if cards due) · "Capture more" (nudge if tomorrow low) · "Done"

### T1-F — Content sources wired

- [x] From `ind_items` (captures, dict/learn saves) — existing
- [x] From `ind_learn_collections` (Amis1k) — done
- [ ] From curriculum (Lessons/Patterns/Essays/Dialogs) — filtered `ind_items` by
  source; appear as Curriculum deck rows in Study tab
- [ ] `ensureFlashcards()` called on Study landing, dedup safe

---

## Tier 2 — Progress layer

*Goal: feel the progress, stay motivated.*

### T2-A — Learning goal feature

- [ ] Goal-setting UI: sheet/overlay — select target deck, set daily cards or target
  date (bidirectional: lock one, the other calculates)
- [ ] Stores in `ind_profiles`: target deck, daily goal cards, goal due date
- [ ] Dashboard widget when active: "[Deck] · N days left · X% mastered" + progress bar

### T2-B — Stats subtab

- [ ] Cards total / due today / mastered (ease ≥ 2.5 and interval ≥ 21d = "known",
  ≥ 60d = "mastered")
- [ ] Amis1k coverage: X of 1063 mastered
- [ ] Weekly pace chart
- [ ] Populates the Stats subtab in Study

### T2-C — Card browser (Browser subtab)

- [ ] List all `ind_flashcards` for current language
- [ ] Show: front, back, source, due date, ease factor, interval
- [ ] Edit front/back inline
- [ ] Filter: all / due / new / suspended / flagged
- [ ] Sort: by due date, by ease, by creation date
- [ ] Ease reset action (safety valve for ease-hell edge cases)

---

## Tier 3 — Power features

*Only after Tier 1 and 2 are solid and you've been studying for a few weeks.*

### T3-A — Learn phase + Relearn burst

Session queue model: `QueueEntry[]` replaces `cards + idx`. Cards append
on requeue; `qIdx` advances linearly. DB writes only on graduation.

**Learning** (new cards: `repetitions === 0 && interval_days === 0`):
- `learningSteps` requeue passes (default 3, configurable 1–5 in OptionsSheet)
- Again / Hard / Good → requeue until final pass, then graduate with that rating
- Easy at any pass → graduate immediately; Hard treated as Again
- Rating buttons: Again · Good · Easy (Hard hidden); labels: retry / more / done

**Relearn burst** (mature lapse: `interval_days ≥ 7` + Again):
- Same `learningSteps` depth; no DB write at the moment of lapse
- Good / Easy → `rateCardRelearn`: 50% recovery interval + ease −0.2
- Again exhausted → `rateCard('again')`: full reset (1d, ease −0.2, reps = 0)
- `nextRelearn()` in schedule.ts; `rateCardRelearn()` in flashcards.ts

**UI changes**:
- Card phase label (top-right): New · Learning (sage) · Relearning (amber)
- Progress bar: `qIdx / queue.length` (shrinks on requeue — communicates extra work)
- `↩ N returning` micro-label below progress bar when pending requeue > 0
- OptionsSheet: Learning passes stepper (1–5), localStorage `srs_learning_steps`

### T3-B — Card suspension

- [ ] Suspend during review (skips until manually unsuspended in Browser)
- [ ] Excluded from `listDueFlashcards`

### T3-C — Flags

Five color flags (red · orange · yellow · green · blue) act as free-form
tags. No semantics imposed — the user decides what each color means.

- [ ] `flag_color text` column (null = no flag; values: red/orange/yellow/green/blue)
- [ ] Review session: bookmark icon opens inline color picker (5 dots + clear ×);
  active flag shown by filled bookmark in that color; optimistic update
- [ ] Browser: Flagged filter shows all flagged cards; color sub-filter row (5 dots)
  narrows to specific color; colored dot badge on card rows
- [ ] "Review flagged" amber CTA in Browser links to `/review?filter=flagged` (any
  color) or `/review?flag=red` etc. for a specific color
- [ ] `setFlagColor(id, color | null)` in flashcards.ts

### T3-D — Card types

- [ ] Reverse cards (zh → ab)
- [ ] Audio cards — requires audio data
- [ ] Card type selector per collection on import

### T3-E — FSRS

**Not in v1.** FormoSRS-1 with the +0.02 Good ease recovery adequately addresses
ease hell for the v1 timeframe. FSRS solves it structurally via mean reversion
of difficulty — revisit after 4+ weeks of real review data when scheduling quality
can actually be measured.

---

## Design decisions (settled 2026-05-29)

### Navigation

Tab order: **Dashboard · Study · Capture · Translate · Dict**

### Study tab — deck architecture

Three sections under the Decks subtab:

**Curriculum** (app-provided, corpus-backed — the 4 existing Learn tab sources)
- Lessons / Patterns / Essays / Dialogs — one row each, due badge

**My Collections** (user-imported)
- Each collection: name + card count + due badge + "..." menu
- Import button in page header (single)

**Captures** (virtual deck from `ind_items`)
- Single row: "Captures & lookups" + due badge + "..." menu

Per-deck "..." menu: rename · delete · export · share · toggle in Review all
(checkbox — checked = included in "Review all" CTA, default on).

Subtab bar present from day 1: Decks (active) · Browser (placeholder) · Stats
(placeholder). Fourth section "Pre-made packs" added when curriculum packs ship.

### Dashboard widget order

1. ScreenHeader (existing component)
2. Streak hero + goal widget (same row or stacked — leave to CD)
3. Today's ring (reviewed / daily goal) + "N due today"
4. Primary CTA: "Review N due → (~N min)"
5. Heatmap (~16 weeks, intensity = reviewed count)
6. Quick stats 2×2: Mastered · Active · This week · Due tomorrow

Goal widget: active → "[Deck] · N days left" + thin progress bar.
Inactive → "Set a goal →" tertiary prompt. Goal-setting UI is T2-A.

### Review session

- Full screen, BottomNav hidden
- Card contained on cream bg (rounded, shadow — not edge-to-edge)
- Tap card = reveal (no animation, answer appears)
- Swipe ← = Again · Swipe → = Good · Swipe ↑ = Easy · Swipe ↓ = Suspend
- Subtle edge indicators on card face (← again / → good, before reveal)
- Rating row: Again · Hard · Good · Easy + interval estimate (mono)
- Hard + Easy togglable; full immersion = hide entire row
- Options via gear icon in session header (shows all 4 gestures)
- Flag icon (bookmark) opens 5-color picker; suspend icon skips card

### Session end screen

- Hero: "N cards reviewed" (large serif) — no accuracy %
- "N due tomorrow"
- Confetti on goal met
- Share (native API)
- CTAs: "Review more" · "Capture more" nudge · "Done"

---

## Sequence

```
Now:       T1-A FormoSRS-1        ← algorithm + schema migration, no UI
           CD wireframes          ← Dashboard / Study tab / Review / End screen

Week 1:    T1-B Study tab         ← nav overhaul, deck list, subtab bar
           T1-C Dashboard         ← real data widgets, CTA
           T1-D/E Review session  ← full-screen, gestures, options, end screen

Week 2:    T2-A goal feature      ← goal-setting UI, dashboard widget live
           T2-B stats subtab      ← mastery metrics, pace chart

Later:     T2-C card browser
           T3-A learn phase       ← after dedicated design discussion
           T3-B/C suspension, flags
           T3-D card types
           T3-E FSRS              ← not in v1
```

---

## Open design questions

1. **Learn phase design:** How do learning steps feel in the session? Rating buttons
   change meaning in learning vs review phase. Needs a dedicated design pass
   before T3-A implementation.

2. **Mastery definition:** ease_factor ≥ 2.5 AND interval_days ≥ 21 = "known".
   interval_days ≥ 60 = "mastered". Confirm before building T2-B stats so the
   metric is consistent across the app.

3. **Curriculum deck generation:** The 4 Learn sources (Lessons/Patterns/Essays/
   Dialogs) each need a flashcard generation path. Currently only `ind_items`
   filtered by source — verify this is the right model before T1-F.
