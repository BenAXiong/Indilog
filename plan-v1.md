# Indivore — v1 Plan

> v0 plan (all phases 0–10 + Architecture Baseline) lives in `plan.md`.
> This document tracks v1 milestones.

> Status key: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked

---

## Milestone 1 — SRS + Review Overhaul — COMPLETE (2026-05-31)

**Goal:** A smooth, motivating spaced-repetition loop that draws from all content sources — captured items, dict/learn saves, and a custom Amis1k vocabulary collection — with daily goals, progress views, stats, and streaks.

> Full spec and decisions archived in `archive/plan-srs.md`. Algorithm spec in `decisions.md` DEC-SRS03.

### M1-A — SRS Engine

- [x] FormoSRS-1 scheduling (SM-2 + ease recovery + fuzz) — `lib/db/srs/schedule.ts`; see DEC-SRS03
- [x] `ind_reviews` table — one row per rating event; wiped on deck reset alongside scheduling state
- [x] `card_type` on `ind_flashcards`: `default` | `sts` (reverse removed — session mode; audio = session mode)
- [x] Daily goal — `ind_profiles.daily_goal`, GoalSheet, GoalWidget
- [x] Daily session counter — `ind_daily_stats` + `increment_reviewed_today` RPC

### M1-B — Content Sources

- [x] Cards from `ind_items` (captures, dict saves, learn saves) — `ensureFlashcards()` called on Study + Review mount
- [x] Cards from `ind_learn_collections` — `saveCollection()` calls `ensureFlashcards()`
- [x] Language filter — `excludeLangs` on `getDueStats`/`listDueFlashcards`; per-deck `include_in_review` toggle
- [x] Coverage tracking — via `ind_flashcards` stats (ease/interval thresholds); no separate `ind_vocab_progress` table needed

### M1-C — Amis1k Collection

- [x] Amis1k word list importable JSON — 1063 cards, 4 difficulty lessons
- [x] Collections saved to `ind_learn_collections` + `ind_items` (T-UNIFY migrated from `ind_learn_cards`)
- [x] `lesson_title` on items — shown in collection browse page
- [x] Learn hub shows saved collections; `/learn/collection/[id]` browse page
- [x] Flashcards generated from collection items via `ensureFlashcards()`
- [x] Coverage bars in Stats subtab — per-deck known/mastered percentage
- [ ] Compare Amis1k against existing captured items — dropped; low value, dedup at capture time is sufficient

### M1-D — Progress View & Stats

- [x] Streak heatmap — `ind_daily_stats` real data (~16 weeks), intensity = reviewed count
- [x] Per-language stats — Stats subtab: total/due/known/mastered cards + per-deck coverage bars + 14-day pace chart
- [x] Daily goal progress ring — Dashboard ring (reviewed/goal) + GoalWidget
- [x] Review session summary screen — ReviewEnd with count, streak, confetti on goal met, share
- [ ] Retention/forgetting curve — deferred; needs more real review data first

### M1-E — Review Page Overhaul

- [x] Full-screen session with session header, progress bar, card area
- [x] Tap to reveal (no flip animation — design change); 4-dir swipe gestures
- [x] Rating buttons: Again/Hard/Good/Easy with interval estimates; Hard/Easy toggleable; full immersion mode
- [x] Keyboard shortcuts: Space/Enter reveal, 1–4 ratings, arrow keys, ↓ suspend
- [x] Session end screen — ReviewEnd
- [x] Learn phase + relearn burst — queue-based, Repeat/Easy/Got it!, pass dots, 3-restart cap
- [x] Card type rendering — default, STS (word/sentence layouts), audio session mode
- [ ] Undo last rating — not implemented; not missed in practice
- [ ] Skip card (no rating) — not implemented; Again + requeue covers this need

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

- **v0** — all phases 0–10 shipped, architecture baseline, Phase 9 mostly done.
- **v1** — M1 (SRS) complete 2026-05-31. M2 (Library) + M3 (polish) pending.

Semver tags when publishing: `v0.9.0` now → `v1.0.0` when M1 + M2 ship.
