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

- [ ] Amis1k word list as a static importable dataset (`packages/amis1k/`)
- [ ] Bulk-import Amis1k into a user's `ind_learn_collections` on first use
- [ ] Track which Amis1k words have been seen / learned / mastered
- [ ] Compare Amis1k against user's existing captured items (avoid duplicates)

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
- [ ] Corpus: switch `/api/learn/curriculum` to accept `index` instead of `title_zh` (DEC-corpus issue 1 mitigation — Indivore-side fix, can do anytime)

---

## Versioning

- **v0** — all phases 0–10 shipped, architecture baseline, Phase 9 mostly done. Current state.
- **v1** — Milestone 1 (SRS) + Milestone 2 (Library) complete.

Semver tags when publishing: `v0.9.0` now → `v1.0.0` when M1 + M2 ship.
