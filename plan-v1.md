# Indivore — v1 Plan

> v0 plan (all phases 0–10 + Architecture Baseline) lives in `plan-v0.md`.
> This document tracks v1 milestones.

> See [design-questions.md](design-questions.md) for open cross-cutting design questions.
> See [plan-v+.md](plan-v+.md) for beyond-v1 ideas and deferred features.

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

### M1-G — SRS UX fixes

- [x] Learning logic: Easy-only before flip (button + swipe ↑); Again + Good (non-final) / Got it! (final pass or relearn) after reveal; ↑ gesture disabled after reveal in learning
- [x] Exit warning when learning cards in progress (shows count + steps, blocks exit)
- [x] Gesture hints: ↑ easy / ↓ suspend outside card (↑ hidden after reveal in learning); ← again / → good or got it! inside card (after flip only)
- [x] Deck ordering: collection cards sorted by level → lesson → position; shuffle-within-level toggle
- [x] Session end: expandable reviewed-items list + goal mastered/total + days to goal due date
- [x] Review mode DEC — forward/reverse/audio/sts; drop card_type+metadata; target_word as STS signal (→ DEC-SRS06)

### M1-H — Review mode implementation

- [x] Supabase: `DROP COLUMN card_type, DROP COLUMN metadata` from `ind_flashcards`
- [x] `ensureFlashcards()` + `setTargetWord()`: remove card_type/metadata writes
- [x] `browser.ts`: remove `setCardLayout()`; drop card_type/metadata from BrowserCard type + SEL
- [x] Review render: effectiveMode computed with fallback chain; isAudio/isReverse/isSts locals; reverse mode rendering added
- [x] Mode selector: OptionsSheet 4-button segmented control (forward/reverse/audio/sts), persists to srs_review_mode
- [x] Dict word save: auto-set `target_word = word_ab`

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
- [x] Dict sentence search — phrase input auto-switches to Sentences tab; CJK auto-fuzzy; min length 1 for CJK
- [x] Dict zh→ab search — CJK input routes to word_ch/zh columns with gin_trgm indexes
- [x] Fix dict search placeholder showing raw glid ("01") instead of language name ("Amis")
- [x] Post-add audio — quick programmatic match for Amis1k

---

## Milestone 3 — Corpus rescrape + DB homogenisation + Supabase migration

Essays and dialogues need to be rescraped. This is content/corpus work but impacts curriculum usage too strongly to defer — stale or broken curriculum content undermines the core study loop.

- [x] Identify scope: essays (24-slot geometry, S1/S2/原版 structure) + dialogues (30-slot, S1/S2/S3) + con_practice (30-slot, XML)
- [x] Essay geometry rebuilt — 24 slots, master JSON role detection (→ DEC-M3-01)
- [x] Dialogue geometry rebuilt — 30 slots, index JSON S1/S2/S3 structure
- [x] 生活會話篇 scraped + added — 30 slots × 42 dialects, official bilingual titles, sentence/word audio
- [x] DB updated — 202k occurrences (fresh June 2026 rescrape); copied to Indivore packages/dictionary
- [x] Rescrape essays + dialogues (June 2026); JSONL deduped + distiller rebuilt
- [x] Curriculum API: add con_practice to indexed sources; fix geometry API union type error
- [x] Verify curriculum API routes — all three sources return correct rows + audio URLs
- [x] Learn UI: Conversations tab (/learn/conversations) wired to StudyView; geometry + ContentSheet + curriculum-progress APIs extended
- [x] Smoke-test + fix: con_practice card turn order, ContentSheet height/tabs, stale localStorage auto-select, curriculum-progress API

- [x] DB homogenisation — `unit`, `lesson`, `role`, `position` columns added to corpus_occurrences; enriched by Supabase distiller from geometry JSON (→ DEC-M3-02)
- [x] Corpus migrated to Supabase — corpus_sentences (185k) + corpus_occurrences (201k) + corpus_vocabulary (293k); packages/dictionary/ycm_master.db removed from git; better-sqlite3 uninstalled (→ DEC-M3-03)
- [x] Curriculum + dict APIs updated — async Supabase queries; audio repair extended to grmpts; dialogs → dialogues normalized


---

## Milestone 4 — Sources db

Personal library of sources (people, media, references) linked to captured items, with dialect pre-fill on capture. Schema + decisions in DEC-M4-01.

### M4-A — Schema + CRUD

- [x] Supabase migration: `ind_sources` (id, user_id, name, type, dialect_name, language, location, url, notes, avatar_color)
- [x] `/sources` page — card grid, add/edit/delete; accessible via library icon button in Capture header
- [x] `lib/db/sources/` — CRUD helpers (createSource, listSources, updateSource, deleteSource)

### M4-B — Capture integration

- [x] Source selector in Capture form — searchable pill; on select: pre-fills dialect + language
- [x] Selected `source_id` saved on `ind_items` when item is created from capture
- [x] Browser expanded card: show source name as amber pill (BrowserCard + listBrowserCards query updated)

### M4-C — Capture field consolidation

- [x] Merge source + speaker fields — Speaker InlineSelector removed; source type=person covers speakers; speaker_id no longer written
- [x] Place field — replaced text input with InlineSelector; loads past places from ind_items on mount; create new inline
- [x] Multi-language capture — language selector in capture form (select, defaults to profile language)

---

## Milestone 5 — Architecture & UI Polish

### M5-A — Architecture polish

- [x] Rethink note vs card type architecture — decision recorded in DEC-SRS05; migration deferred; no new card_type values until then
- [x] Remove transitional review landing when entering from Dashboard — /review?start=1 auto-starts session
- [x] Fix: ind_reviews / increment_reviewed_today fires spuriously — onExit ref + sessionEndFiredRef one-shot guard
- [x] Corpus: switch `/api/learn/curriculum` to accept `index` instead of `title_zh` — essay/dialogue use index; twelve/grmpts use constructed keys (unchanged)

### M5-B — UI refinement

- [x] Convert /settings page to a bottom sheet on the Dashboard — SettingsSheet client island; all tabs (general/review/capture/translate/dict) wired everywhere
- [x] Deck sections collapsible
- [x] Swipe to switch tabs — edge swipe (±28px) navigates between tabs
- [x] Separate Learn from Reviews in Dashboard and Study — see DEC-M5-01; boundary = repetitions===0; strict separation; 2 CTAs, 2 rings
- [x] Learn session: Exposure pass → 2× consecutive Good = 12h graduation, Easy = 4d; Again resets counter; cap default 10 max 20
- [x] Priority list — ind_priority_decks table (position, in_simulation, simulation_deadline); replaces goal_collection_id; always-on sort; shuffle deferred (in-deck vs inter-deck options not yet evaluated)
- [x] Dynamic simulation — Simulate tab in GoalSheet; outputs learnTarget + reviewTarget daily (never stored); replaces static daily_goal
- [x] Mastery grades — Seed/Planted/Rooted/Blooming; see DEC-SRS09; rename "mastered" stat to "Rooted"
- [x] ind_daily_stats: add learned_count column; add increment_learned_today RPC
- [x] Revamp GoalSheet UI — 3 tabs: Goals (manual/calculated toggle), Priority (ordered deck list), Simulate (deadline + deck selection + curve)
- [~] Fix: SRS workflow bugs - Learn
- [~] Fix: SRS workflow bugs - Review (again not requeed, bottom bar jiggle, see ss)
- [x] Refine Cards UI - Learn (rewind, skip, gestures, scores buttons, etc)
- [~] Refine Cards UI - Review (rewind, skip, gestures, scores buttons, etc)
- [ ] Refine Cards UX (visual grading feedback)
- [ ] Add motivation stats/progression to Learn session end
- [~] Fix: dailies recalc after session on same day
- [ ] Revamp Dashboard — streak card, goal card with background chart overlay, central card, heatmap, overview section; remove recent captures
- [ ] Curriculum content layout options — compact / standard / flashcard view; toggled per-section or globally
- [ ] Study tab decks: on click, add in sheet review now, open in browser, etc

### M5-C — Feature refinement

- [x] Instore max reviews/learn per day — daily cap stepper (10–300) in OptionsSheet; srs_daily_cap localStorage
- [x] Browser zh lookup: enable multi word — lookup also searches sentences, includes sentence zh
- [x] 2-step review entry — resolved by Learn/Review split + priority list (DEC-M5-01)
- [x] Refine simulation of dailies from custom goals



---

## Milestone 6 — Translate (ILRDF AI)

Switch translate tab from FormosanBank/Modal.run to ILRDF AI Labs (https://ai-labs.ilrdf.org.tw/). Add TTS. Enable save-to-items from translate output.

**Current state:** ILRDF MT + TTS both live via ai-labs.ilrdf.org.tw Gradio 5 endpoints. Modal.run remains as MT fallback for non-Amis languages.

- [x] DEC-M6-01 — ILRDF MT at ai-labs.ilrdf.org.tw/kari-seejiq-tnpusu-ai-hmjil; TTS at ai-labs.ilrdf.org.tw/hnang-kari-ai-asi-sluhay; both Gradio 5 SSE
- [x] MT working — ILRDF primary (Amis), Modal.run fallback (all others); translate tab + capture sparkle
- [x] Swap `/api/translate` to ILRDF — live; dialect selector in translate UI; Amis dialect→ILRDF code mapping
- [x] TTS live — /api/tts calls ILRDF /default_speaker_tts; dialect→speaker mapping; Listen in translate, wave in capture
- [x] Save translation output — translate Save button saves ab+zh correctly (Formosan/Chinese per direction)

---

## Milestone 7 — Chrome Extension Import + AI (族語魔書 ↔ IndiHunt) — COMPLETE

> Design contract: DEC-M7-01

- [x] DEC-M7-01 recorded; architecture.md updated (`note_source = 'import'`)
- [x] `/import` page — hash decode, dedup, selectable preview, confirm (indilog.vercel.app/import)
- [x] Browser: all note_source values visible (neq collection query); source labels (Imported / Dict / Curriculum)
- [x] Extension: Export to IndiHunt — saved.js, saved.html, manifest v1.5.3
- [x] Extension: AI MT & TTS tab — ILRDF Gradio 5 direct calls (translate + listen; Amis only)
- [ ] Browser: `note_source = 'import'` distinct badge colour (low-priority)

---

## Milestone 8 — Tests and fixes

- [x] FIX: grmpts audio still not playing — pre-existing, investigate correct URL pattern
- [x] FIX: sentences cannot be unbookmarked — investigate handleSave / saved state reset
- [x] FIX: review pull-to-refresh on down-swipe — `touchAction: none` on card div
- [x] FIX: dict sentence bookmark toast invisible when scrolled — moved to `position: fixed` at bottom
- [x] FIX: dict sentence saved state not pre-loaded across sessions — `savedAbSet` pre-check from `ind_items` on sentences state change
- [x] FIX: dict sentence could be re-saved indefinitely — block duplicates, show amber warning toast

- [ ] Desktop usability pass
- [ ] Error states (API failures, auth errors)
- [ ] Basic accessibility pass (focus order, ARIA labels)
- [ ] README setup flow (clone → env → supabase → run)
- [ ] Smoke test all 11 flows
- [x] Local cache for fast startup — LangDialectProvider reads profile_lang_code + profile_dialect from localStorage synchronously
- [x] Capture-page Translate action — sparkle button calls /api/translate (ab→zh); fills meaning field


---

## Dict Source Expansion — MoE Dictionary

> Branch: `feat/moe-dict` (active testing, not yet merged)

### V1 — Definitions + source toggle

- [x] MoE source toggle in SettingsSheet — defaults to MoE-only for testing; `klokahEnabled` gates ePark
- [x] `GET /api/dict/search` — parallel fetch: ePark words+sentences (klokah gate) + MoE words (moe gate)
- [x] MoE proxy: Indivore API → Citadel `/api/moe_shadow`; merge rows by normalised `word_ab`; concat defs with ` · `
- [x] 5px steel-blue dot marker on MoE results (discreet; for testing only)
- [x] MoE results sorted with ePark words (exact-first, then by length)
- [x] Merge `feat/moe-dict` → main after test coverage confirmed

### V2 — Deferred

- [ ] Root/affix chips from MoE data
- [ ] MoE example sentences in Sentences tab
- [ ] Lineage/morphology rendering
- [ ] Remove dot marker once sources are unified (no source badges in final UI)

---

## Deferred — needs design before placing

- **Set per-deck card types** — STS auto-generation requires a `target_word` per note which can't be automated without AI; realistically means "mark deck as STS, set targets manually in browser." Under-designed for v1.
- **Dummy user profile for testing (stats)** — dev tooling, not user-facing; separate dev track.
- consider tab split for curriculum & collections (captures + custom)


---

## Versioning

- **v0** — all phases 0–10 shipped, architecture baseline, Phase 9 mostly done.
- **v1** — M1–M4, M6, M7 complete. M5 (UI polish, pending dashboard/goals/cards revamp), M8 (tests), MoE dict expansion in progress. Target: `v1.0.0` when M1–M8 all complete.

Semver tags when publishing: `v0.9.0` now → `v1.0.0` when M1–M8 complete.
