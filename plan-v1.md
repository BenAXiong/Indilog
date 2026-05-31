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

### M1-D — Progress View & Stats

- [x] Streak heatmap — `ind_daily_stats` real data (~16 weeks), intensity = reviewed count
- [x] Per-language stats — Stats subtab: total/due/known/mastered cards + per-deck coverage bars + 14-day pace chart
- [x] Daily goal progress ring — Dashboard ring (reviewed/goal) + GoalWidget
- [x] Review session summary screen — ReviewEnd with count, streak, confetti on goal met, share

### M1-E — Review Page Overhaul

- [x] Full-screen session with session header, progress bar, card area
- [x] Tap to reveal (no flip animation — design change); 4-dir swipe gestures
- [x] Rating buttons: Again/Hard/Good/Easy with interval estimates; Hard/Easy toggleable; full immersion mode
- [x] Keyboard shortcuts: Space/Enter reveal, 1–4 ratings, arrow keys, ↓ suspend
- [x] Session end screen — ReviewEnd
- [x] Learn phase + relearn burst — queue-based, Repeat/Easy/Got it!, pass dots, 3-restart cap
- [x] Card type rendering — default, STS (word/sentence layouts), audio session mode
- [x] Undo last rating — single-level, DB-write only (not requeues); reverts ind_flashcards + deletes ind_reviews row + decrements daily stat; includes graduation
- [x] Defer card — skip-fwd button top-right of header; sets due_at=tomorrow, no rating written; clears undo state

### M1-F — SRS polishing

- [x] Goal deck cards sorted first — post-sort in reload() using goal_collection_id from profile; always on when goal deck is set
- [x] Estimate daily review load in GoalSheet — linear simulator (now / peak / long-term rows)
- [x] Card strength metric — model B: score = R × S_norm; R = exp(-t/interval_days), S_norm = min(interval/21,1); shown in browser expanded card panel (score % + R% · Sd); computeStrength() in schedule.ts
- [x] Custom review sessions — filter icon next to Review all; CustomSessionSheet (lang, dialect, source, due-only toggle); bypasses global exclusions
- [x] Daily reset time — getStudyDate() reads srs_reset_hour from localStorage (default 4am); stepper in review OptionsSheet (12am–6am)

---

## Milestone 2 — Library / Browser

**Goal:** Browsable, filterable view of everything the user has saved — captured items, dict saves, learn saves — with item detail, edit, and delete.

> The Browser subtab (Study → Browser) covers most of M2. No separate `/library` route needed — Browser IS the library. Now note-centric: queries `ind_items` with left-joined flashcard state; notes without cards appear in All view.


- [x] Note-centric list of all saved items — `ind_items` base query, left join to `ind_flashcards`
- [x] SRS-state filters — All / Due / New / Flagged / Suspended (post-filtered client-side)
- [x] Sort — by due date, ease, added
- [x] Full note detail — expanded row shows all fields: ab, zh, notes, audio, dialect, place, language, type, source, tags, target_word
- [x] Edit — ab, zh, notes, place_heard, target_word inline in expanded row
- [x] STS layout toggle per card — word / sentence
- [x] Field filters — language, type, source/deck, tags (collapsible row, derived from loaded cards, active-count badge)
- [x] Delete note from browser — hard delete cascades ind_flashcards → ind_reviews; inline confirm warns about heatmap/stats impact; suggests Suspend as alternative
- [x] Dict lookup button in expanded card — Lookup button on empty zh; auto-fills first result; chips for alternatives; "No results" on miss
- [x] Date range filter — from/to date inputs below filter row, filter on created_at, ✕ clear button
- [x] Batch select + delete / suspend / flag — Select button in header; tap rows to highlight; bottom action bar with All/None, Delete (confirm), Suspend, Flag (color picker)

---

## Milestone 3 — Corpus rescrape

Essays and dialogues need to be rescraped. This is content/corpus work but impacts curriculum usage too strongly to defer — stale or broken curriculum content undermines the core study loop.

- [ ] Identify what needs rescaping (essays, dialogues — scope TBD)
- [ ] Rescrape and re-import into corpus
- [ ] Verify curriculum routes return correct data
- [ ] Smoke-test Learn tab (essays + dialogues sections)

---

## Milestone 4 — Sources db

Design a method to keep track of item sources and associate data to them (eg. dictionaires or speakers, with their dialect, location, ect)

- [ ] tbd

---

## Milestone 5 — Architecture & UI Polish

### M5-A — Architecture polish

- [x] Rethink note vs card type architecture — decision recorded in DEC-SRS05; migration deferred; no new card_type values until then
- [ ] Remove transitional review landing when entering from Dashboard — navigate directly into session
- [ ] Fix: ind_reviews / increment_reviewed_today fires spuriously on page navigation — inflates heatmap + daily counter; audit review page useEffect/mount lifecycle
- [ ] Corpus: switch `/api/learn/curriculum` to accept `index` instead of `title_zh`

### M5-B — UI polish

- [x] Remove transitional review landing when entering from Dashboard — /review?start=1 auto-starts session
- [x] Fix: ind_reviews / increment_reviewed_today fires spuriously — onExit ref + sessionEndFiredRef one-shot guard
- [ ] Convert /settings page to a bottom sheet on the Dashboard (dashboard is currently a server component — needs client conversion or hybrid)
- [ ] Revamp dashboard — streak card, goal card with background chart overlay, central card, heatmap, overview section; remove recent captures
- [ ] Revamp GoalSheet UI
- [ ] Curriculum layout options — compact / standard / flashcard view; toggled per-section or globally

- [ ] Browser zh lookup: enable multi word


---

## Milestone 6 — ?


- [ ] Desktop usability pass
- [ ] Error states (API failures, auth errors)
- [ ] Basic accessibility pass (focus order, ARIA labels)
- [ ] README setup flow (clone → env → supabase → run)
- [ ] Smoke test all 11 flows
- [ ] Local cache for fast startup (profile + lang on first render, no flash)
- [ ] Capture-page Translate action


---

## Deferred — needs design before placing

- **Set per-deck card types** — STS auto-generation requires a `target_word` per note which can't be automated without AI; realistically means "mark deck as STS, set targets manually in browser." Under-designed for v1.
- **Dummy user profile for testing (stats)** — dev tooling, not user-facing; separate dev track.
- consider tab split for curriculum & collections (captures + custom)


---

## Longterm

- Video capture — v2 new feature
- Vocabulary + frequency analysis: Klokah vs ILRDF 1k
- Amis1k: add simple example sentences
- Icons: align with CD design handoff
- 階層×10 system (tadpole - crab - mangcel - fafoy - bear - kawas?)
- User contributions — send to pending DB
- OCR capture
- AI-formatted json from other formats (txt, csv, pdf) for teachers
- How to tutorial

---

## Versioning

- **v0** — all phases 0–10 shipped, architecture baseline, Phase 9 mostly done.
- **v1** — M1 complete. M2–M5 pending. Target: `v1.0.0` when M1 + M2 ship; M3–M5 extend to `v1.x`.

Semver tags when publishing: `v0.9.0` now → `v1.0.0` when M1 + M2 ship.
