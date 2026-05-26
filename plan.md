# Indivore — Build Plan

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
- [ ] Deploy to Vercel (pending Supabase env vars — DEC-005)

**[PHASE COMPLETE 2026-05-25]** — app builds and all routes exist. Vercel deploy pending env vars.

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
- [ ] Default dialect selector in Settings (deferred — dialect data not yet in LANGUAGES constant)
- [ ] Local cache for fast startup (deferred to Phase 9 polish)
- [ ] **Design Checkpoint 2** (if flow feels unclear) — first-run onboarding, language selector, settings layout, signed-out state

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

- [ ] Saved material list (Library) — deferred to Phase 8 dashboard completion
- [ ] Item detail drawer or page — deferred to Phase 8
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
- [ ] **Design Checkpoint 3** — deferred (core flow works; polish in Phase 9)

**Exit criteria:** User can capture quickly. Form does not feel like a long form. Saved items appear in Library/Review.

**[PHASE COMPLETE 2026-05-26 11:45]** — Full capture workflow live. Dialect, source, speaker, place, notes. Recent captures with tap-to-edit. Edit mode with Update/Cancel. Set-default language action. tsc clean.

---

## Phase 5 — Dictionary Integration

**Goal:** Wire the existing Vercel SQLite dictionary API.

> **BLOCKED:** Dictionary API URL and response schema not yet provided. See `decisions.md`.

- [ ] Dictionary API client (`packages/dictionary-client/`)
- [ ] Dictionary search page
- [ ] Active language / dialect filter
- [ ] Result cards (exact matches first, examples when available)
- [ ] Save word action from result
- [ ] "Open in Capture" action from result
- [ ] Loading state, empty state, error state

### Capture token lookup

- [ ] Conservative tokenization of captured text
- [ ] Token chips displayed under captured text
- [ ] Tap/click definition popup
- [ ] Save token as word action
- [ ] Optional: persist selected definition to `ind_item_tokens`
- [ ] **Design Checkpoint 4** (if needed) — result card density, definition popup layout, token chip style, save-word interaction

**Exit criteria:** User can search dictionary. Token chips work in Capture. User can save from both surfaces.

---

## Phase 6 — Translation Integration

**Goal:** AI translation for supported pairs.

> **BLOCKED:** Supported translation pairs not enumerated. See `decisions.md`.

- [ ] Translation API route / proxy (`apps/web/app/api/translate/`)
- [ ] Supported-pair validation on the server
- [ ] Standalone Translate page
  - [ ] Source language selector
  - [ ] Target language selector
  - [ ] Input panel
  - [ ] Output panel
  - [ ] Disabled state for unsupported pairs (clear UI, not hidden)
  - [ ] Copy output action
  - [ ] Save output as captured item
  - [ ] Loading and error states
- [ ] Capture-page Translate action
- [ ] Translation direction does NOT change app-wide active study language
- [ ] **Design Checkpoint 5** — disabled state, selectors, panels, save action, mobile ergonomics

**Exit criteria:** Supported pairs translate. Unsupported pairs clearly disabled. Output saveable.

---

## Phase 7 — Review and Flashcards v0

**Goal:** Saved material → reviewable cards.

- [ ] Generate flashcards from saved words and sentences
- [ ] Review queue (due cards, ordered by due date)
- [ ] Flashcard screen with reveal action
- [ ] Rating buttons: Again / Hard / Good / Easy
- [ ] Simple scheduling algorithm (not full SRS — interval multipliers are enough)
- [ ] Write review history row after each rating
- [ ] Update `ind_daily_stats` reviewed count
- [ ] Dashboard review stats (due count, reviewed today)
- [ ] Basic streak logic (if time allows)
- [ ] Saved-material browsing inside Review tab
- [ ] **Design Checkpoint 6** (if session feels awkward) — card layout, reveal interaction, rating placement, daily progress

**Exit criteria:** User can review due cards. Ratings update due dates. Dashboard reflects reviewed counts.

---

## Phase 8 — Dashboard Completion

**Goal:** Dashboard reflects real user activity.

- [ ] Captured content count card
- [ ] Reviewed flashcards count card
- [ ] Current streak card
- [ ] Due review count card
- [ ] Learned lessons placeholder (static count or "coming soon")
- [ ] Recent captures list
- [ ] Quick resume action (e.g., "Start Review" if cards are due)
- [ ] **Design Checkpoint 7** — hierarchy, stats readability, recent capture cards, quick action placement, desktop layout

**Exit criteria:** Dashboard opens cleanly. User understands what to do next. Main stats are real.

---

## Phase 9 — Polish, Testing, and Deployment

**Goal:** Coherent prototype ready to demo.

- [ ] Mobile spacing pass (all five tabs)
- [ ] Desktop usability pass
- [ ] Loading states everywhere async data is fetched
- [ ] Empty states everywhere (consistent copy)
- [ ] Error states (API failures, auth errors)
- [ ] Basic accessibility pass (focus order, ARIA labels on icon buttons)
- [ ] Document all env vars in `.env.example` and `README`
- [ ] README setup flow (clone → env → supabase → run)
- [ ] Vercel deployment check (env vars set, build passes)
- [ ] Supabase redirect URL check (OAuth callback registered)
- [ ] Smoke test all 10 flows from the workflow doc

### Smoke-test flows

- [ ] 1. Sign in
- [ ] 2. Set active study language
- [ ] 3. Capture a sentence
- [ ] 4. Add source / speaker / place
- [ ] 5. Look up a token
- [ ] 6. Save a word
- [ ] 7. Translate a supported pair
- [ ] 8. Save translation into an item
- [ ] 9. Generate and review a flashcard
- [ ] 10. Confirm dashboard stats update

**Exit criteria:** App deployable. Main v0 loop works. README explains setup. Known gaps listed.

---

## Deferred (explicit)

These are intentionally not in v0:

- Learned-lessons full implementation
- Streak polish
- Advanced source/speaker fields
- Token definition persistence
- Multiple flashcard card types
- Full desktop polish
- Public sharing, social, admin, classroom, lesson system, offline sync, batch import
