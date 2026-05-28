# Indivore — v1 Plan

> v0 plan (all phases 0–10 + Architecture Baseline) lives in `plan.md`.
> This document tracks v1 milestones.

> Status key: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked

---

## Milestone 1 — SRS + Review Overhaul

**Goal:** A smooth, motivating spaced-repetition loop that draws from all content sources — captured items, dict/learn saves, and a custom Amis1k vocabulary collection — with daily goals, progress views, stats, and streaks.

### M1-A — SRS Engine (`lib/db/srs/`)

- [ ] Replace fixed-interval scheduling with SM-2 (or FSRS) algorithm — `lib/db/srs/schedule.ts`
- [ ] `ind_reviews` query helpers — fetch review history per card, compute ease factor
- [ ] Card types: `word` (ab → zh), `sentence` (ab → zh), `reverse` (zh → ab)
- [ ] Store `card_type` on `ind_flashcards`
- [ ] Daily goal: configurable in Settings, stored in `ind_profiles.daily_goal` (already in schema)
- [ ] Daily session counter — stop presenting new cards once goal is reached

### M1-B — Content Sources

- [ ] Cards generated from `ind_items` (captures, dict saves, learn saves) — already partially done
- [ ] Cards generated from custom Amis1k collection (`ind_learn_collections`) — new source
- [ ] Source filter in Review tab (All / Captures / Amis1k / etc.)
- [ ] `ind_vocab_progress` table (or tag on `ind_flashcards`) to track Amis1k coverage

### M1-C — Amis1k Collection

- [x] Amis1k word list as importable JSON (`packages/amis1k/amis1k.json`) — 1063 cards, 4 difficulty lessons (初級/中級/中高級/高級), drag-drop into `/learn/new`
- [x] Collections saved to `ind_learn_collections` + `ind_learn_cards` via chunked insert (200/batch)
- [x] `lesson_title` column on `ind_learn_cards` — titles shown in browse page
- [x] Learn hub shows saved collections (amber card, card count, links to browse page)
- [x] `/learn/collection/[id]` browse page — collapsible lessons, rename inline, delete with confirm
- [ ] Generate flashcards from collection cards → SRS queue (M1-B dependency)
- [ ] Track which Amis1k words have been seen / learned / mastered
- [ ] Compare Amis1k against existing captured items (avoid duplicates)

### M1-D — Progress View & Stats

- [ ] Streak calendar — heatmap of daily review activity (replace current seed-based mock)
- [ ] Per-language stats: total cards, cards due, mastered (ease factor above threshold)
- [ ] Daily goal progress ring or bar on Dashboard and Review landing
- [ ] Review session summary screen (cards reviewed, accuracy %, time)
- [ ] Retention curve / forgetting curve visualization (later — deferred if complex)

### M1-E — Review Page Overhaul

- [ ] Replace current simple reveal/rate loop with full session UX:
  - Session start: show today's due count + daily goal progress
  - Card flip animation (already exists — `animate-iv-flip`)
  - Again/Hard/Good/Easy with keyboard shortcuts (1/2/3/4)
  - Session end: summary screen
- [ ] Undo last rating (within session)
- [ ] Skip card (defer to end of session)
- [ ] Card type rendering: word card vs sentence card vs reverse

---

## Milestone 2 — Library

**Goal:** Browsable, filterable view of everything the user has saved — captured items, dict saves, learn saves — with item detail, edit, and delete.

- [ ] `/library` route with `ind_items` list
- [ ] Filter by language, type (word/sentence/note), source, date range
- [ ] Item detail drawer/page (text, notes, meaning, dialect, source, speaker, audio)
- [ ] Edit and delete from Library
- [ ] Link from Library item → Review (show flashcard status)
- [ ] Link from Library item → Dictionary (look up the word)
- [ ] Batch select + delete

---

## Milestone 3 — Phase 9 deferred polish (v1 cleanup)

Items explicitly deferred from v0 Phase 9:

- [ ] Desktop usability pass
- [ ] Error states (API failures, auth errors)
- [ ] Basic accessibility pass (focus order, ARIA labels)
- [ ] README setup flow (clone → env → supabase → run)
- [ ] Smoke test all 11 flows
- [ ] Local cache for fast startup (profile + lang on first render, no flash)
- [ ] Capture-page Translate action (shortcut from Capture to Translate with pre-filled text)
- [ ] Corpus: switch `/api/learn/curriculum` to accept `index` instead of `title_zh` (Indivore-side fix for duplicate-title silent failures — can do anytime)

---

## Versioning

- **v0** — all phases 0–10 shipped, architecture baseline, Phase 9 mostly done. Current state.
- **v1** — Milestone 1 (SRS) + Milestone 2 (Library) complete.

Semver tags when publishing: `v0.9.0` now → `v1.0.0` when M1 + M2 ship.
