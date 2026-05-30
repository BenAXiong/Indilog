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

## Current state (as of 2026-05-30)

All Tiers 1–3 shipped on `redesign/srs-overhaul`. Not yet merged to main.

- [x] FormoSRS-1 scheduling (SM-2 + fuzz + ease recovery) — T1-A
- [x] Study tab: Decks / Browser / Stats subtabs, deck list (Curriculum/Collections/Captures) — T1-B
- [x] Dashboard: real streak, ring, heatmap, quick stats, goal widget — T1-C
- [x] Review session: full-screen, 4-dir gestures, rating buttons, options sheet — T1-D/E
- [x] Goal feature: GoalSheet, GoalWidget, 5-color flags, deck coverage — T2-A
- [x] Stats subtab: overview 2×2, per-deck coverage bars, 14-day pace chart — T2-B
- [x] Card browser: search, filters (All/Due/New/Flagged/Suspended), sort, inline edit — T2-C
- [x] Suspension (`suspended_at`), 5-color flags (`flag_color`), reverse cards (`card_type`) — T3-B/C/D
- [x] Learn phase + relearn burst: queue-based session, Repeat/Easy/Got it! buttons, pass dots — T3-A

---

## Navigation (settled 2026-05-29)

Tab order: **Dashboard · Study · Capture · Translate · Dict**

The current Learn and Review tabs merge into a single **Study** tab. Study is
the single entry point for all flashcard activity. The existing Learn content
(Lessons / Patterns / Essays / Dialogs) surfaces in Study as Curriculum decks.

---

## Schema additions needed

All applied via `npx supabase db query --linked`. See `supabase/migrations/`.

```sql
-- 20260529020000 · T1-A FormoSRS-1 state
ease_factor real NOT NULL DEFAULT 2.5, interval_days int NOT NULL DEFAULT 0, repetitions int NOT NULL DEFAULT 0

-- 20260529030000 · T2-A Goal
goal_collection_id text, goal_due_date date  (on ind_profiles)

-- 20260530010000 · T3-B/C/D
suspended_at timestamptz, flag_color text, card_type text NOT NULL DEFAULT 'forward'

-- 20260530020000 · T3-C flag redesign
DROP flagged boolean → ADD flag_color text
```

---

## Tier 1 — Core loop

*Goal: a session you'd actually sit down and do every day.*

### T1-A — FormoSRS-1 algorithm (`lib/db/srs/schedule.ts`)

FormoSRS-1 = SM-2 base + Anki Hard behavior (no reset on Hard) + fuzz + ease
recovery on Good.

- [x] Define `SMState { ease_factor, interval_days, repetitions }` type
- [x] `nextFormoSRS1(state, rating)` → `{ due_at, new_state }` — pure function, no DB
- [x] Update `rateCard()` to call `nextFormoSRS1`, write SM-2 columns
- [x] Column defaults handle existing cards (ease 2.5, interval 0, reps 0)

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

- [x] New route `/study` with subtab bar: Decks | Browser | Stats
- [x] Deck list with 3 sections: Curriculum / My Collections / Captures
- [x] "Review all — N due" primary CTA at top of Decks view
- [x] Per-deck "..." menu: rename · delete · export · share (DeckActionSheet — toggle in Review all deferred, needs schema)
- [x] Import button in page header (single, no ghost row)
- [x] Browser and Stats subtabs: built in T2
- [x] Redirect `/learn` → `/study` (server-side redirect; `/review` left as-is — still active session route)
- [x] Update BottomNav: Dashboard · Study · Capture · Translate · Dict

### T1-C — Dashboard overhaul

Dashboard is the primary motivational hub and the main review entry point.

- [x] Streak hero: chain visual + day count
- [x] Learning goal widget: GoalWidget (T2-A)
- [x] Today's ring: circular progress reviewed/goal + "N due today"
- [x] Primary CTA: "Review N due → (~N min)" — goes directly into session
- [x] Real heatmap: `ind_daily_stats` data, intensity = reviewed_count (~16 weeks)
- [x] Quick stats 2×2: Mastered · Active · This week · Due tomorrow
- [x] Remove seed-based heatmap and fake streak

### T1-D — Review session overhaul

Full-screen session, BottomNav hidden during review.

- [x] Session header: back button · deck name · "X / N" counter
- [x] Single thin progress bar (spans full queue including requeued cards)
- [x] Card contained on cream background (rounded, shadow, not edge-to-edge)
- [x] Tap card = reveal (no animation — answer appears)
- [x] Swipe ← Again · → Good · ↑ Easy · ↓ Suspend
- [x] Subtle swipe edge indicators on card (visible before reveal)
- [x] Rating row: Again · Hard · Good · Easy with interval label (mono)
- [x] Hard + Easy togglable off in options
- [x] Full immersion mode: hide button row entirely, gestures only
- [x] Options sheet via gear icon in session header

### T1-E — Session end screen

- [x] Hero: "N cards reviewed" (large serif)
- [x] "N due tomorrow"
- [x] Confetti: triggers when daily goal met
- [x] Share: native share API ("Reviewed N cards · 🔥 X-day streak")
- [x] CTAs: "Review more" (if cards due) · "Capture more" (nudge if tomorrow low) · "Done"

### T1-F — Content sources wired

- [x] From `ind_items` (captures, dict/learn saves) — existing
- [x] From `ind_learn_collections` (Amis1k) — done
- [ ] From curriculum (Lessons/Patterns/Essays/Dialogs) — Curriculum deck rows in Study
  tab link to content pages; flashcard generation from curriculum not yet wired
- [ ] `ensureFlashcards()` called on Study landing, dedup safe

---

## Tier 2 — Progress layer

*Goal: feel the progress, stay motivated.*

### T2-A — Learning goal feature

- [x] Goal-setting UI: GoalSheet bottom drawer — pick deck, daily goal, optional target date with live pace hint
- [x] Stores in `ind_profiles`: `goal_collection_id`, `goal_due_date`, `daily_goal`
- [x] Dashboard widget: GoalWidget — active shows deck name, days left, known-% bar; inactive shows "Set a goal →"

### T2-B — Stats subtab

- [x] Cards total / due today / known (ease ≥ 2.5 + interval ≥ 21d) / mastered (≥ 60d)
- [x] Per-deck coverage bars (colour-coded sage/amber/crimson by %)
- [x] 14-day pace bar chart with avg/day
- [x] Populates the Stats subtab in Study

### T2-C — Card browser (Browser subtab)

- [x] List all `ind_flashcards` (search bar, client-side filter on front+back)
- [x] Show: front, back, source, status badge, ease factor, flag dot, REV badge
- [x] Edit front/back inline (tap to expand, Save/Cancel)
- [x] Filter: All / Due / New / Flagged (+ color sub-filter) / Suspended
- [x] Sort: by due date, by ease, by added
- [x] Ease reset, Suspend/Unsuspend, Flag color picker — all in expanded row

---

## Tier 3 — Power features

*Only after Tier 1 and 2 are solid and you've been studying for a few weeks.*

### T3-A — Learn phase + Relearn burst

Session queue model: `QueueEntry[]` replaces `cards + idx`. Cards append
on requeue; `qIdx` advances linearly. DB writes only on graduation.

**Learning** (new cards: `repetitions === 0 && interval_days === 0`):
- `learningSteps` passes (default 3, configurable 1–5 in OptionsSheet)
- 2 buttons: **Repeat** (requeue / reset-to-0 on final) · **Easy** (non-final, first attempt, Easy interval) / **Got it!** (final pass or after first restart, Good interval)
- Cap: 3 full restarts max → 4th final-pass Repeat forces Good graduation
- Hard treated as Repeat (not shown as button)

**Relearn burst** (mature lapse: `interval_days ≥ 7` + Again):
- Same `learningSteps` depth; no DB write at lapse moment
- 2 buttons: **Repeat** (requeue / reset-to-0 on final, same 3-restart cap) · **Got it!** (50% recovery interval + ease −0.2 via `rateCardRelearn`)
- Exhausted + cap: `rateCard('again')` full reset
- `nextRelearn()` in schedule.ts; `rateCardRelearn()` in flashcards.ts

**UI**:
- Pass dots (●●○) below card — sage for learning, amber for relearn; reset on restart
- Card border tint: sage learning / amber relearn / lineSoft review
- Phase label: New (first pass, no restarts) · Learning (sage) · Relearning (amber)
- `↩ N returning` micro-label below progress bar
- OptionsSheet: Learning passes stepper (1–5), `srs_learning_steps`

### T3-B — Card suspension

- [x] Suspend during review (archive icon → skips card, no rating)
- [x] Excluded from `listDueFlashcards`, due counts, stats
- [x] Browser: Suspended filter, SUSP badge, Unsuspend in expanded row

### T3-C — Flags

Five color flags (red · orange · yellow · green · blue) act as free-form
tags. No semantics imposed — the user decides what each color means.

- [x] `flag_color text` column (null = no flag; values: red/orange/yellow/green/blue)
- [x] Review session: bookmark icon opens inline 5-color picker; optimistic update
- [x] Browser: Flagged filter + color sub-filter row; colored dot badge on rows; flag picker in expanded row
- [x] "Review flagged" CTA → `/review?filter=flagged` or `/review?flag=X`
- [x] `setFlagColor(id, color | null)` in flashcards.ts; `flags.ts` with FLAG_COLORS + flagColorHex

### T3-D — Card types

- [x] Reverse cards (zh → ab): `card_type` column; `generateReverseCardsForCollection()`; "Generate reverse cards" button on collection page; REV badge in Browser
- [ ] Card type selector per collection on import (deferred — design pending)

#### Audio Cards — implementation plan (2026-05-30)

Audio terminology: Note (source fact) · Card (review question) · Note Type (field schema) · Card Template (front/back mapping). See DEC-NOTE01.

**Architecture decision:** Audio is a session mode (on-the-fly), NOT a stored `card_type`. Same Card shown differently depending on session mode. One SRS schedule per Card. See DEC-NOTE02, DEC-NOTE03.

**Step 1 — Wire audio playback on existing Cards** _(no migration)_
- `listDueFlashcards`: extend select `ind_items(type, language, dialect, audio_url)`
- `FlashcardWithItem`: add `audio_url: string | null` to `ind_items` join shape
- Add `cardAudio(card): string | null` helper — priority: `ind_items?.audio_url` (Steps 2–3 extend this)
- `review/page.tsx`: add `audioRef`, play handler, unhide + wire button when `cardAudio(card)` is non-null

**Step 2 — `audio_url` on `ind_learn_cards`** _(schema migration)_
- Migration: `ALTER TABLE ind_learn_cards ADD COLUMN audio_url text`
- Update select: `ind_learn_cards(audio_url, ind_learn_collections(name, language))`
- `cardAudio()` updated: `ind_items?.audio_url ?? ind_learn_cards?.audio_url`

**Step 3 — `audio_url` + `metadata` on `ind_flashcards`** _(schema migration)_
- `audio_url text` — snapshot for curriculum Cards (populated at generation time, NULL for all existing rows)
- `metadata jsonb` — extensible Card Template fields; STS will use `{ target_word, hint_sentence }`
- `cardAudio()` final: `card.audio_url ?? ind_items?.audio_url ?? ind_learn_cards?.audio_url`

**Step 4 — Note type architecture** _(DEC entries, no code)_
- Log DEC-NOTE01/02/03 in `decisions.md` ✓ (done 2026-05-30)

**Step 5 — Audio session mode** _(review UX)_
- `audioMode: boolean` session param (OptionsSheet toggle or `?mode=audio` URL param)
- When `audioMode && cardAudio(card)`: front = play button + lang pill, no text; autoplay on card load
- Fallback: cards without audio shown as text (silent, no session interruption)
- Rating updates same Card's SRS state — one schedule regardless of mode

**Step 6 — Curriculum audio** _(after T1-F)_
- Curriculum flashcard generator (T1-F) copies `CurriculumRow.audio_url` into `ind_flashcards.audio_url`
- No SQLite join at review time — `cardAudio()` priority-1 picks it up

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

## Sequence (as of 2026-05-30 — all shipped on redesign/srs-overhaul)

```
✓ T1-A  FormoSRS-1 algorithm + schema
✓ T1-B  Study tab (Decks/Browser/Stats)
✓ T1-C  Dashboard overhaul
✓ T1-D/E Review session + end screen
✓ T2-A  Goal feature (GoalWidget + GoalSheet)
✓ T2-B  Stats subtab (coverage bars, pace chart)
✓ T2-C  Card browser (search, filters, inline edit)
✓ T3-A  Learn phase + relearn burst
✓ T3-B  Suspension
✓ T3-C  5-color flags
✓ T3-D  Reverse cards (partial — audio + import selector deferred)
  T3-E  FSRS — not in v1

Remaining open items:
  T1-B   Kebab toggle "in Review all" (needs schema — include_in_review boolean on ind_learn_collections)
  [x] T1-F   ensureFlashcards() on Study landing — done; called in Study page main useEffect
  T1-F   Curriculum flashcard generation (Learn content → flashcards; needs design)
  T2-D   Language workflow rethink — may split decks by language; wire showAllLangs toggle once direction settled
  T2-E   Favourites system — star/pin a deck to top of My collections
  [x] T2-F   Reset SRS data — resetCollectionSRS/resetCapturesSRS; DeckActionSheet reset view; Captures kebab
  [x] T3-D   Audio step 1 — wire playback on captured-item cards
  [x] T3-D   Audio step 2 — audio_url on ind_learn_cards (migration)
  [x] T3-D   Audio step 3 — audio_url + metadata on ind_flashcards (migration)
  [x] T3-D   Audio step 5 — audio session mode (OptionsSheet toggle)
  T3-D   Audio step 6 — curriculum audio (after T1-F)
  T3-D   STS Card Template (needs metadata jsonb from step 3, deferred)
  T3-D   Card type selector on import (deferred)
```

---

## Tier 2 additions

### T2-D — Review language selector

Override the global language setting for a review session. Lets users study a
specific language or dialect subset without changing app-wide settings.

- [ ] Language/dialect picker in OptionsSheet (or session start screen)
- [ ] Session-scoped filter: `listDueFlashcards` respects selected lang/dialect
- [ ] Cards outside the selection are excluded from due counts and not served
- [ ] Global lang setting unchanged — this is session-only

**Open design questions:**
- Where to expose the picker: OptionsSheet gear icon (quick), or a pre-session
  screen before cards load (clearer)?
- Scope of filter: by `ind_items.language` for captures, by
  `ind_learn_collections.language` for collections — needs both paths covered.
- SRS implication: excluding a language long-term will let those cards accrue
  overdue debt silently. May need a warning or a "pause deck" affordance instead
  of just hiding cards. Details TBD.

---

## Open design questions

1. **Curriculum deck generation:** The 4 Learn sources (Lessons/Patterns/Essays/
   Dialogs) need a flashcard generation path. Currently their rows link to the
   content pages; no flashcard generation from curriculum is implemented.

2. **T2-D Review language selector:** See T2-D above. Key open question is
   whether session-scoped filtering is the right model, or whether per-deck
   "pause" is safer for SRS health.

3. **T3-E FSRS:** Revisit after 4+ weeks of real review data on the production branch.
