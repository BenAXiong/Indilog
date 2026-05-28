# Indivore — v0 Build Plan

> **v1 active work lives in `plan-v1.md`** — SRS milestone, Library, v1 polish.

> Status key: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked

---

## Phase 0 — Project Bootstrap ✅

**Goal:** Create the repo and prepare for fast iteration.

- [x] Initialize Next.js with TypeScript (`apps/web/`)
- [x] Add Tailwind CSS (with full design token palette + animations)
- [x] Add PWA metadata and manifest setup
- [x] Add `.env.example` with all required vars documented
- [x] Add Supabase client helper (browser)
- [x] Add Supabase server helper (SSR / server components)
- [x] Add placeholder routes for all five tabs + dashboard
- [x] Add base app layout (shell, nav slot)
- [x] Add i18n helper and English message dictionary
- [x] Add language metadata for all 16 Formosan languages
- [x] Add supported translation-pair metadata (constant)
- [x] **Design Checkpoint 0** — design handoff bundle read; `docs/design-system.md` and `docs/ui-screens.md` created
- [x] Monorepo structure: pnpm workspaces, packages/ stubs, supabase/ dir
- [x] Build passes clean (`next build`, 11 routes, 0 errors)
- [x] Deploy to Vercel — env vars resolved (DEC-R05b), output directory fix applied

**[PHASE COMPLETE 2026-05-25]** — app builds, all routes exist, Vercel deployed.

---

## Phase 1 — Static UI Shell (Mock Data) ✅

**Goal:** Build the full visible structure before backend wiring.

- [x] Dashboard home route with mock stats
- [x] Five-tab bottom navigation:
  - [x] Learn tab
  - [x] Review tab
  - [x] Capture tab (central, visually emphasized / primary)
  - [x] Dictionary tab
  - [x] Translate tab
- [x] Active language chip in header/nav
- [x] Settings / profile entry point
- [x] Usable desktop fallback layout
- [x] Empty states for all tabs
- [x] Mock saved items list (Recent Captures section on Dashboard)
- [x] Static screens:
  - [x] Dashboard
  - [x] Learn placeholder
  - [x] Review (static)
  - [x] Capture (static form)
  - [x] Dictionary (static results)
  - [x] Translate (static panels)
  - [x] Settings / language selector
  - [x] Library / saved-material view (merged into Dashboard recent captures — see DEC-P1-01)
- [x] **Design Checkpoint 1** — reconcile against design: nav shape, dashboard hierarchy, Capture prominence, card spacing, typography, color tokens, mobile touch targets, desktop layout

**Exit criteria:** App feels navigable with mock data. Mobile is primary. Desktop usable. No backend half-wired.

**[PHASE COMPLETE 2026-05-26]** — All 7 screens built with mock data. Shared UI component library (Icon, Chip, Card, Button, SectionHead, LangAvatar, Stat, Toast, Wordmark). Desktop sidebar layout. Build clean (11 routes, 0 type errors).

---

## Phase 2 — Supabase Auth and Profile Settings ✅

**Goal:** Real login and persisted app-level settings.

- [x] Google OAuth through existing Supabase project
- [x] Auth callback route (`/auth/callback`)
- [x] Sign in UI (`/login`)
- [x] Sign out action
- [x] `ind_profiles` migration
  - Fields: `id`, `user_id`, `active_study_language`, `default_dialect`, `ui_locale` (default `en`), `daily_goal`, `created_at`, `updated_at`
- [x] RLS policies for `ind_profiles` (user owns their row)
- [x] Profile creation on first login (upsert)
- [x] Active study language selector in Settings
- [x] Default dialect selector in Settings — bottom-sheet picker with dialect step for multi-dialect languages (done in Phase 10 / Settings overhaul)
- [ ] Local cache for fast startup → plan-v1.md M3
- [ ] **Design Checkpoint 2** — skipped; built iteratively from handoff, not needed

**Exit criteria:** User can sign in. Profile row created. Active language and dialect persist. UI works after refresh.

**[PHASE COMPLETE 2026-05-26 11:15]** — Auth flow live. ind_profiles migration ready to apply. Settings reads/writes real data. Sign-out working.

---

## Phase 3 — Private Data Schema and CRUD ✅

**Goal:** Personal notebook data layer.

### Migrations and RLS

- [x] `ind_sources` — name, url, notes, language, user_id
- [x] `ind_speakers` — name, notes, user_id
- [x] `ind_items` — text, type (word/sentence/note), language, dialect, place_heard, notes, source_id, speaker_id, user_id
- [x] `ind_item_tokens` — item_id, token_text, definition_id (nullable), position
- [x] `ind_flashcards` — item_id, front, back, user_id
- [x] `ind_reviews` — flashcard_id, rating, reviewed_at, due_at, user_id
- [x] `ind_daily_stats` — user_id, date, captured_count, reviewed_count, streak_day
- [x] RLS on all tables (user owns their rows)

### Data helpers

- [x] `createItem` / `updateItem` / `deleteItem`
- [x] `listItems` (with pagination)
- [x] `createSource` / `listSources`
- [x] `createSpeaker` / `listSpeakers`
- [x] `getDashboardStats`

### UX surfaces

- [ ] Saved material list (Library) → plan-v1.md M2
- [ ] Item detail drawer or page → plan-v1.md M2
- [x] Basic source selector (InlineSelector in Capture)
- [x] Basic speaker selector (InlineSelector in Capture)

**Exit criteria:** User can save/view material. Data persists. RLS protects rows. Dashboard reads real counts.

**[PHASE COMPLETE 2026-05-26 11:36]** — All tables migrated, data helpers built, Capture saves real items, Dashboard reads real stats.

---

## Phase 4 — Capture / SeMi v0 ✅

**Goal:** Capture as the core app workflow.

- [x] Large capture text input
- [x] Save type selector (word / sentence / note)
- [x] Active language display + override
- [x] Optional dialect field
- [x] Source selector + quick source creation inline
- [x] Speaker selector + quick speaker creation inline
- [x] Optional place-heard/seen field (separate from dialect)
- [x] Notes field
- [x] Save button with confirmation feedback
- [x] Edit-after-save behavior
- [x] Recent captures list below form
- [x] "Set this language as app default" action
- [ ] **Design Checkpoint 3** — skipped; built iteratively from handoff

**Exit criteria:** User can capture quickly. Form does not feel like a long form. Saved items appear in Library/Review.

**[PHASE COMPLETE 2026-05-26 11:45]** — Full capture workflow live. Dialect, source, speaker, place, notes. Recent captures with tap-to-edit. Edit mode with Update/Cancel. Set-default language action. tsc clean.

---

## Phase 5 — Dictionary Integration ✅

**Goal:** Wire the YCM SQLite corpus (local file, not remote API).

- [x] Dictionary DB client (`lib/dict/client.ts` — better-sqlite3, path fallback)
- [x] `/api/dict/search` Route Handler (FTS words + sentences, glid filter)
- [x] `/api/dict/dialects` Route Handler
- [x] Dictionary search page (debounced, dialect filter, exact match card, sentence examples)
- [x] Save word action from result → `createItem`
- [x] "Open in Capture" action from result → `/capture?text=&notes=`
- [x] Loading state, empty state, DB error banner
- [ ] Capture token lookup → plan-v1.md (DEC-L08; FTS infrastructure ready)
- [ ] **Design Checkpoint 4** — skipped; built iteratively from handoff

**Exit criteria:** User can search dictionary. User can save words and navigate to Capture from results.

**[PHASE COMPLETE 2026-05-26 12:11]** — Awaiting `ycm_master.db` drop at `packages/dictionary/`. All code wired; DB error banner shown until file is present. tsc clean.

### Phase 5+ — Dictionary Enhancements

Post-completion improvements built during and after Phase 10:

- [x] Language filter defaults to active study language on first load
- [x] Audio plays inline (direct `Audio()` playback, not a link to external page)
- [x] Sentence dedup in route — one row per sentence id; prefer entries with `audio_url`
- [x] Words / Merged / Sentences tabs (swipeable l/r); all three loaded together
- [x] Merged tab: group by normalised `word_ab` (apostrophe-variant unification + space-stripping), per-dialect sections, deduplicated and parsed definitions
- [x] Tooltips on all result card buttons; Save + Add-context on sentence cards
- [x] Filter bottom sheet: lang/dialect picker behind header funnel button; closes on dialect select or outside tap; button turns crimson when filter is active
- [x] Fuzzy (≈) / prefix toggle in header
- [x] 3-character minimum search (trimmed; guard in both page and route)
- [x] Word dedup in route by space-stripped normalisation key — removes corpus spacing inconsistencies (→ DEC-D01)
- [x] `LIMIT` removed from word and sentence queries — 3-char minimum keeps worst-case result count manageable (~2K rows)
- [x] Settings: `dict` tab — interface language toggle + dictionary source toggles (Klokah on; 族語言線上辭典 / MoE Dict disabled stubs)
- [ ] Capture token lookup → plan-v1.md (DEC-L08)

---

## Phase 6 — Translation Integration ✅

**Goal:** FormoBank Modal inference for Traditional Chinese ↔ 6 Formosan languages.

- [x] `/api/translate` route — Modal inference proxy, Zod validation, mock fallback
- [x] Supported-pair validation on the server (12 pairs: zho_Hant ↔ ami/tay/bnn/pyu/pwn/dru)
- [x] Translate page — source/target selectors, input with char counter, output panel
- [x] Unsupported targets clearly disabled in selector
- [x] Copy output action
- [x] Save output as captured item
- [x] Loading shimmer and error states
- [x] Translation direction independent of active study language
- [ ] Capture-page Translate action → plan-v1.md M3
- [ ] **Design Checkpoint 5** — skipped; built iteratively from handoff

**Exit criteria:** Supported pairs translate. Unsupported pairs disabled. Output saveable.

**[PHASE COMPLETE 2026-05-26 12:53]** — Mock works out of the box. Set INFERENCE_API_URL + INFERENCE_API_KEY in .env.local for live model. tsc clean.

---

## Phase 7 — Review and Flashcards v0 ✅

**Goal:** Saved material → reviewable cards.

- [x] Generate flashcards from saved words and sentences
- [x] Review queue (due cards, ordered by due date)
- [x] Flashcard screen with reveal action
- [x] Rating buttons: Again / Hard / Good / Easy
- [x] Simple scheduling algorithm (fixed intervals: 10m / 1d / 3d / 7d)
- [x] Write review history row after each rating
- [x] Update `ind_daily_stats` reviewed count
- [x] Dashboard review stats (due count, reviewed today)
- [x] Basic streak logic — computed from `ind_daily_stats.captured_count`; heatmap wiring → plan-v1.md M1-D
- [x] Saved-material browsing inside Review tab
- [ ] **Design Checkpoint 6** — skipped; built iteratively from handoff

**Exit criteria:** User can review due cards. Ratings update due dates. Dashboard reflects reviewed counts.

**[PHASE COMPLETE 2026-05-26 11:52]** — Flashcards auto-generated from items. Live review session with reveal/rate. Completion banner. Dashboard dueCount fixed. tsc clean.

---

## Phase 8 — Dashboard Completion

**Goal:** Dashboard reflects real user activity.

- [x] Captured content count card
- [x] Reviewed flashcards count card
- [x] Current streak card
- [x] Due review count card
- [x] Learned lessons placeholder (static "—", dimmed)
- [x] Recent captures list
- [x] Quick resume action (contextual: "Start Review" if dueCount > 0, else "Capture")
- [ ] **Design Checkpoint 7** — skipped; built iteratively from handoff

**Exit criteria:** Dashboard opens cleanly. User understands what to do next. Main stats are real.

**[PHASE COMPLETE 2026-05-26 13:15]** — All stats real. QuickAction CTA wired. Lessons placeholder present. tsc clean.

---

## Phase 9 — Polish, Testing, and Deployment

**Goal:** Coherent prototype ready to demo.

- [x] Mobile spacing pass (all five tabs)
- [x] Vercel deployment check (env vars set, build passes)
- [x] Supabase redirect URL check (OAuth callback registered)
- [~] Loading states — Dict/Learn covered; Capture/Review/Dashboard need a pass to verify all async paths
- [~] Empty states — Dict covered; other tabs need audit for consistent no-data messages
- [ ] Document all env vars in `.env.example` and `README` ← **do now**
- [ ] README setup flow (clone → env → supabase → run) — deferred to v1
- [ ] Desktop usability pass — deferred to v1
- [ ] Error states (API failures, auth errors) — deferred to v1
- [ ] Basic accessibility pass — deferred to v1
- [ ] Smoke test all 11 flows — deferred to v1

**Exit criteria:** App deployable. Main v0 loop works. README explains setup. Known gaps listed.

---

## Architecture Baseline ✅

Cross-cutting infrastructure work done 2026-05-29. No feature changes — all tsc clean.

- [x] `lib/lang/` — static YCM metadata extracted from `lib/learn/` (dialects.ts, lang-bridge.ts)
- [x] `lib/corpus/` — all SQLite reads in one place: `db.ts` (singleton), `dict.ts` (word/sentence search), `curriculum.ts` (lesson queries)
- [x] `lib/db/` split into domain subfolders: `notebook/` (items/sources/speakers), `srs/` (flashcards), `progress/` (completions/collections/stats), `profile/` (client/server)
- [x] `LangDialectProvider` — single Supabase profile fetch at layout level; exposes `setLang`/`setDialect`; Settings writes through context for instant cross-app sync; replaces `useActiveLang` (7 independent fetches → 1)
- [x] `components/lookup/` — cross-app lookup home; `LookupInline` moved from `components/learn/`
- [x] `app/api/learn/` — curriculum, geometry, lookup routes grouped under learn namespace
- [x] `temp_learn/`, `temp_scrape/` added to `.gitignore`; stale commits cleaned up

**Future additions slot directly into:**
- `lib/db/srs/` — SRS charts, review history, scheduling improvements
- `lib/db/progress/` — Amis1k tracking, vocab progress
- `lib/db/notebook/` — token definitions, batch import
- `components/lookup/` — cross-app WordLookup panel (DEC-L08)
- `lib/corpus/dict.ts` — collocation search

---

## Deferred to v1

See `plan-v1.md` for the full breakdown. Items from v0 phases that didn't ship:

| Item | plan-v1.md section |
|---|---|
| Library / saved material list | M2 |
| Item detail drawer / page | M2 |
| Capture token lookup (cross-app WordLookup) | M1 / DEC-L08 |
| Capture-page Translate action | M3 |
| Dashboard heatmap wired to real data | M1-D |
| Streak polish | M1-D |
| Multiple flashcard card types | M1-E |
| Advanced SRS algorithm (SM-2 / FSRS) | M1-A |
| Amis1k collection | M1-C |
| Token definition persistence | M1-B |
| Local cache for fast startup | M3 |
| Accessibility pass | M3 |
| Desktop usability pass | M3 |
| Smoke tests | M3 |
| Advanced source/speaker fields | future |
| Public sharing, social, admin, classroom, offline sync | future |


---

## Phase 10 — Learn Feature v1

**Goal:** Full structured study experience backed by `ycm_master.db`. Four content sources: 12-level curriculum, grammar patterns, essays, dialogues. Sentences saveable into `ind_items` → feeds flashcard queue.

> Full spec: `docs/learn-feature.md`

### Phase L0 — Assets & Data Bridge ✅
- [x] Copy `corpus_geometry.json` → `apps/web/lib/learn/`
- [x] Copy `grmpts_type_labels.json` → `apps/web/lib/learn/`
- [x] Create `lib/lang/dialects.ts` (GLID maps) — moved from `lib/learn/` 2026-05-29
- [x] Create `lib/lang/lang-bridge.ts` (Indivore code → GLID) — moved from `lib/learn/` 2026-05-29
- [x] Wire `ind_profiles.default_dialect` for Learn dialect persistence

### Phase L1 — API Routes ✅
- [x] `lib/corpus/curriculum.ts` — SQLite curriculum query functions (moved from `lib/learn/db.ts` 2026-05-29)
- [x] `/api/learn/curriculum` — four source variants + audio URL repair (moved from `/api/curriculum` 2026-05-29)
- [x] `/api/learn/lookup` — exact-match ILRDF word lookup (moved from `/api/lookup` 2026-05-29)
- [x] `ind_completions` migration (cross-device lesson completion)

### Phase L2 — Learn Page UI ✅
- [x] Source tab bar (mobile bottom strip / desktop horizontal)
- [x] Content selector per source (lesson grid, pattern list, essay/dialogue groups)
- [x] Data fetch loop (source + selection + dialect → results)
- [x] Prev / Next navigation
- [x] Study card component: ab text, zh reveal/hide, audio, copy, save, mark-complete
- [x] Settings panel (zh visibility, layout, lookup toggle)
- [x] Saved view (filters `ind_items` by language + sentence type)

### Phase L3 — Lookup + Polish ✅
- [x] Inline word lookup on study card tokens → `/api/lookup`
- [x] Completion counts → Dashboard Lessons stat (real data replaces "—")
- [x] Mobile spacing pass
- [ ] Accessibility pass → plan-v1.md M3

**[PHASE COMPLETE 2026-05-26 14:00]** — Full study view for all 4 sources, collection creation, hub with progress, inline word lookup. Merged feat/learn → main.

**Deferred from Phase 10:** grammar comparison mode, language dashboard, full cross-app WordLookup component, accessibility pass.

### Word Lookup — Spelling Suggestions (v1 addition)
When a token has no exact dictionary match, surface near-matches ranked by edit distance with common phonological variants:
- l ↔ r (common across Formosan languages)
- o ↔ u vowel alternation
- Glottal stop / apostrophe variation
- Single edit distance (insertion, deletion, substitution)
Display as a "Did you mean?" row beneath the "not found" card in the Capture lookup section and in the Learn StudyCard inline lookup.

**Exit criteria:** User can navigate all four sources for their active language, study cards render with audio and zh toggle, saving a sentence creates an item in the notebook and a reviewable flashcard, completed lessons persist cross-device.

---

## Corpus Data Issues (Blocked — Needs Citadel)

> Discovered 2026-05-27. These are NOT Indivore code bugs. They are upstream data pipeline problems in YCM/Citadel that produce `corpus_geometry.json` and `ycm_master.db`. Indivore cannot fix these without either: (a) changes to the Citadel crystallizer, or (b) a clean re-scrape.

---

### Issue 1 — Essay and Dialogue Topics: Wrong Count and Polluted Titles

**Symptom:** `corpus_geometry.json` has 73 essay topics and 61 dialogue topics instead of 60 each.

**Root cause (confirmed by reading `geometry_crystallizer.py`):**

1. **`max_len` alignment bloat.** The crystallizer computes `max_len = max(categories per dialect)`. If any one dialect has more categories than others, all slots are created up to that dialect's count. Sparse slots (indices 71–72 for essays, index 60 for dialogues) end up with only 1–2 dialects in their `alignment` map — they are essentially unpublished or test content from one dialect that leaked into the shared geometry.

2. **Vocabulary words scraped as topics.** Some TIDs contain a single vocabulary word as their first sentence (e.g. `七點`, `走路`, `排隊`). The crystallizer title heuristic picks `data[0]["ch"]` if `len < 20`, so these become topic titles instead of proper sentence fragments. The real cause is that the essay scraper grabbed vocabulary-entry TIDs alongside sentence TIDs — likely from the `S2` section of the master `ES*.json` files, which may index vocabulary rather than full-sentence content.

3. **Duplicate inferred titles.** 11 essay titles and 3 dialogue titles appear more than once (e.g. `我的名字是Ljumeg。` 3×, `這辣椒很辣…` 3×). This is a consequence of the same Chinese sentence appearing in multiple TIDs.

**What to ask/check in Citadel:**

- [ ] In `essay_scraper.py`: does it scrape TIDs from both `S1` and `S2` lesson blocks of the ES master JSON? If so, does `S2` contain vocabulary TIDs rather than sentence TIDs? If yes, filter to `S1` only (or whichever section contains full sentences).
- [ ] What is the expected topic count per dialect for essays and dialogues? Run the validation query from `REPORT.md` against `ycm_master.db` to see per-dialect category counts and confirm which dialects inflate `max_len`.
- [ ] Fix the crystallizer to use a minimum-coverage threshold: only include a topic slot if `len(alignment) >= N` (suggest N = 10 or half of all dialects). This will drop the orphan slots at 71–72 and 60.
- [ ] Consider deduplication by aboriginal text hash before assigning ordinal slots, to prevent the same content appearing twice.

**Impact on Indivore:** Hub shows wrong totals (73/61 instead of 60/60). ContentSheet groups (`初級`/`中級`/`高級`) break at the boundary. The `essayDiff` helper assumes 60 items. Duplicate `title_zh` causes `.find()` to silently resolve to the wrong topic.

**Indivore-side mitigation (can apply now, partial):**
- Use `index` as the stable selector (already recommended in `REPORT.md`) — switch `/api/curriculum` to accept `index` instead of `title_zh` to avoid duplicate-title collisions.
- Cap displayed total at `Math.min(total, 60)` as a stopgap until crystallizer is fixed.

---

### Issue 2 — Twelve (Lessons): Aboriginal Titles Missing

**Symptom:** Lesson cards in ContentSheet show the zh title only; the ab title row is blank.

**What exists:** `corpus_geometry.json → twelve.titles[level][class]` has all 120 zh titles (scraped from `data/raw/twelve/{l}_{c}.json` → `data["titleCh"]`). No ab titles are present anywhere.

**Why:** The crystallizer only reads `titleCh` from the twelve raw JSON. It does not read a `titleAb` / `titleLang` field. It is unknown whether the raw twelve JSON files even contain such a field.

**What to ask/check in Citadel:**

- [ ] Open any raw twelve JSON file (e.g. `data/raw/twelve/twelve_l1_c1.json`). Does it have a field like `titleAb`, `titleLang`, `titleIndigenous`, or a dialect-specific key alongside `titleCh`? If yes, add it to the crystallizer output as `titles_ab[level][class]` (language-agnostic, one representative dialect) or `titles_ab[dialect][level][class]` (per-dialect map).
- [ ] If the raw JSON does NOT have an ab title: check whether the klokah.tw twelve lesson HTML page has the lesson title in the indigenous language anywhere (e.g. a page heading). If yes, a simple fetch-and-parse of `https://web.klokah.tw/twelve/...` could extract it.
- [ ] Clarify: should ab lesson titles be dialect-specific? The zh titles are dialect-neutral (共通 titles). If the indigenous title is the same across dialects for each lesson, one array suffices. If not, a per-dialect map is needed.

**Impact on Indivore:** ContentSheet lesson cards show empty ab title row with `minHeight: '1.2em'` placeholder. Low priority cosmetically, but adds context and is the right label for learners.

---

### Tracking

| Issue | Owner | Blocked on | Priority |
|-------|-------|-----------|----------|
| Essay/dialogue topic count (73/61 → 60/60) | Citadel | crystallizer fix + optional re-scrape | High — affects hub counts, group splits, completion % |
| Duplicate title_zh → use index as selector | Indivore | can do now | Medium — prevents silent wrong-topic loads |
| Twelve ab titles | Citadel | raw file inspection first | Low — cosmetic in ContentSheet |
