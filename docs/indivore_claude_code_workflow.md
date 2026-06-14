# Indivore — Claude Code Build Workflow

## Purpose

This document is the implementation workflow for building **Indivore** in the new repo:

```text
indivore
```

Indivore is a fast personal PWA for Formosan-language study and capture. It should feel like a lightweight language notebook: open quickly, capture quickly, look up or translate when needed, save personal material, and review it later.

Claude Code can fetch the current Claude Design output through the design API. Use that design as the visual source of truth whenever a design checkpoint is mentioned below.

The goal is not to build every possible future feature. The goal is to build a credible v0 with clean architecture, stable navigation, user-owned Supabase data, dictionary lookup, translation for supported pairs, and simple review.

---

## Product scope for v0

### Core app surfaces

The app has a dashboard home and five main tabs:

```text
Learn | Review | Capture | Dictionary | Translate
```

Capture is the central primary tab and should be visually emphasized.

### Main v0 features

Build:

- Next.js PWA shell.
- Mobile-first layout with usable desktop fallback.
- Google OAuth through Supabase.
- App-level active study language setting.
- Optional default dialect setting.
- English UI for v0, but i18n-ready for later Traditional Chinese.
- Dashboard with basic stats.
- Capture / SeMi flow for words, sentences, and notes.
- Source, speaker, and place-heard/seen metadata.
- Dictionary lookup through the existing Vercel SQLite API.
- Token chips and definition popups in Capture.
- Translate page and Capture translation action for supported pairs only.
- Disabled UI state for unsupported translation pairs.
- Saved material library.
- Simple flashcards and daily review.
- Streak and daily stats if time allows.

### Explicitly out of scope for v0

Do not implement:

- Public sharing of user-added content.
- Social/community features.
- Admin console.
- Classroom or teacher mode.
- Full lesson system.
- Offline-first sync conflict resolution.
- Batch import from video/audio.
- Public corpus editing.
- Reviewer dashboard.
- Advanced spaced repetition.
- Full desktop polish.

---

## Key product concepts

### 1. UI locale

The app interface language.

- v0 default: `en`
- future: `zh-Hant`

All visible UI strings should go through an i18n helper from the beginning. v0 does not need full Chinese copy, but the code should not make later localization painful.

### 2. Active study language

The user’s app-wide Formosan language focus.

Examples:

```text
Amis, Atayal, Paiwan, Bunun, Puyuma, Rukai, etc.
```

This should be persisted in Supabase and cached locally for fast startup.

### 3. Default dialect

An optional dialect preference within the active study language.

### 4. Translation direction

The source/target pair used inside Translate and Capture translation actions.

Important: translation direction is not the same as active study language. Changing the Translate source/target pair should not silently change the app-wide active study language.

### 5. Place heard/seen

A captured item or source may have a place where it was heard or seen.

Keep this separate from dialect. Location may later help with heuristics, but it is observational metadata, not automatically a dialect label.

---

## Technical foundation

### Recommended stack

Use:

- Next.js App Router.
- TypeScript.
- Tailwind CSS.
- Supabase Auth and Postgres.
- Vercel deployment.
- Existing Vercel SQLite dictionary API.
- Existing translation API pattern for supported pairs.

### Repo shape

Suggested structure:

```text
indivore
├── apps/
│   └── web/
├── packages/
│   ├── shared/
│   ├── dictionary-client/
│   ├── translator/
│   └── scheduler/
├── supabase/
│   ├── migrations/
│   └── seed.sql
└── docs/
    ├── architecture.md
    ├── feature-spec.md
    ├── design-system.md
    ├── ui-screens.md
    └── implementation-log.md
```

This structure can be simplified if needed, but keep shared constants and validation out of random page components.

### Supabase table prefix

All Indivore tables should use the prefix:

```text
ind_
```

This avoids collisions with other apps using the same Supabase project.

---

## Sequential build plan

## Phase 0 — project bootstrap

### Goal

Create the `indivore` repo and prepare the app for fast iteration.

### Build

- Initialize Next.js with TypeScript.
- Add Tailwind.
- Add basic PWA metadata and manifest setup.
- Add environment variable examples.
- Add Supabase client/server helpers.
- Add placeholder routes.
- Add base app layout.
- Add i18n helper and English message dictionary.
- Add language metadata for the 16 Formosan languages.
- Add supported translation-pair metadata.

### Design checkpoint 0

Before styling the app shell, fetch the current Claude Design output.

Use it to create or update:

```text
docs/design-system.md
docs/ui-screens.md
```

Do not improvise the visual direction if the design output contains specific decisions for colors, spacing, typography, cards, chips, or navigation.

### Exit criteria

- App runs locally.
- Empty routes exist.
- i18n helper is in place.
- Language metadata is in place.
- Project can deploy to Vercel.

---

## Phase 1 — static UI shell with mock data

### Goal

Build the visible app structure before backend wiring.

### Build

- Dashboard home route.
- Five-tab navigation:
  - Learn
  - Review
  - Capture
  - Dictionary
  - Translate
- Central round/primary Capture tab.
- Usable desktop fallback.
- Settings or profile entry point.
- Active language chip.
- Empty states.
- Mock stats.
- Mock saved items.

### Screens

Build static versions of:

- Dashboard.
- Learn placeholder.
- Review.
- Capture.
- Dictionary.
- Translate.
- Settings/language selector.
- Library or saved-material view if needed for Review.

### Design checkpoint 1

After the first static UI shell works, fetch the latest Claude Design output again.

Compare the implementation against the design and fix:

- navigation shape;
- dashboard hierarchy;
- Capture prominence;
- card spacing;
- typography;
- color tokens;
- mobile touch targets;
- desktop fallback layout.

### Exit criteria

- The app feels navigable with mock data.
- Mobile layout is the primary experience.
- Desktop is usable and not broken.
- No backend feature is half-wired yet.

---

## Phase 2 — Supabase auth and profile settings

### Goal

Add real user login and app-level persisted settings.

### Build

- Google OAuth through the existing Supabase project.
- Auth callback route.
- Sign in / sign out UI.
- `ind_profiles` table migration.
- Row Level Security for profile data.
- Profile creation after first login.
- Active study language persistence.
- Default dialect persistence.
- UI locale field, defaulting to English.
- Daily goal field.
- Local cache for fast startup.

### Design checkpoint 2

Use Claude Design only if the sign-in, onboarding, or settings flow feels visually unclear.

Review:

- first-run onboarding;
- active language selector;
- default dialect selector;
- settings layout;
- signed-out state.

### Exit criteria

- User can sign in.
- User gets an Indivore profile row.
- Active study language persists.
- Default dialect persists.
- UI still works after refresh.

---

## Phase 3 — private data schema and CRUD

### Goal

Create the private notebook data layer.

### Build

Create migrations and RLS for:

- `ind_sources`
- `ind_speakers`
- `ind_items`
- `ind_item_tokens`
- `ind_flashcards`
- `ind_reviews`
- `ind_daily_stats`

Build data helpers for:

- creating items;
- updating items;
- deleting items;
- listing saved material;
- creating sources;
- creating speakers;
- reading dashboard stats.

### UX surfaces

- Saved material list.
- Item detail drawer or page.
- Basic source selector.
- Basic speaker selector.

### Exit criteria

- User can save a word, sentence, or note.
- User can see saved material after refresh.
- User-owned rows are protected by RLS.
- Dashboard can read real saved counts.

---

## Phase 4 — Capture / SeMi v0

### Goal

Make Capture useful as the core app workflow.

### Build

- Large capture input.
- Save type selector:
  - word;
  - sentence;
  - note.
- Active language and dialect controls.
- Source selector and quick source creation.
- Speaker selector and quick speaker creation.
- Optional place-heard/seen field.
- Notes field.
- Save button.
- Edit-after-save behavior.
- Recent captures.

### Important behavior

- Do not force every metadata field before saving.
- Keep dialect and place separate.
- Default to the app-wide active study language.
- Allow tool-level language override.
- Give the user a way to set the current tool language as the app-wide default.

### Design checkpoint 3

Fetch latest Claude Design before finalizing Capture.

Capture is the most important screen. Check:

- input prominence;
- action button placement;
- metadata drawer/bottom sheet;
- source/speaker fields;
- optional place field;
- save confirmation;
- recent capture display.

### Exit criteria

- User can capture real material quickly.
- Capture screen does not feel like a long form.
- Saved items are visible in Review/Library.

---

## Phase 5 — Dictionary integration

### Goal

Wire the existing Vercel SQLite dictionary API into Indivore.

### Build

- Dictionary API client.
- Dictionary search page.
- Active language/dialect filter.
- Result cards.
- Exact matches first.
- Examples when available.
- Save word action.
- Open result in Capture action.
- Loading and empty states.
- Error state for API failure.

### Capture token lookup

Add:

- conservative tokenization;
- token chips under captured text;
- tap/click definition popup;
- save token as word;
- optional selected-definition persistence.

### Design checkpoint 4

Fetch latest Claude Design if dictionary cards or token popups feel unclear.

Review:

- result card density;
- definition popup layout;
- token chip style;
- save-word interaction;
- empty/error states.

### Exit criteria

- User can search dictionary entries.
- User can tap words in Capture and see possible definitions.
- User can save dictionary results or tokens as personal items.

---

## Phase 6 — Translation integration

### Goal

Add AI translation where supported without making it the whole app.

### Build

- Translation API route or proxy using the existing contract.
- Supported-pair validation.
- Standalone Translate page.
- Capture-page Translate action.
- Disabled state for unsupported pairs.
- Copy output action.
- Save output into a captured item.
- Loading and error states.

### Important behavior

- Show all 16 languages as app study languages.
- Only enable translation pairs that are actually supported.
- Do not silently change the app-wide active study language when the user changes translation direction.

### Design checkpoint 5

Fetch latest Claude Design before finalizing Translate.

Check:

- disabled unsupported-pair state;
- source/target selectors;
- input/output panels;
- save-to-Capture action;
- mobile ergonomics.

### Exit criteria

- Supported pairs translate successfully.
- Unsupported pairs are disabled clearly.
- Translation output can be saved into personal material.

---

## Phase 7 — Review and flashcards v0

### Goal

Turn saved material into reviewable cards.

### Build

- Generate flashcards from saved words/sentences.
- Review queue for due cards.
- Review screen with reveal action.
- Rating buttons:
  - Again
  - Hard
  - Good
  - Easy
- Simple scheduling algorithm.
- Review history rows.
- Daily reviewed count.
- Dashboard review stats.
- Basic streak logic if time allows.

### Keep simple

Do not overbuild spaced repetition. A simple predictable algorithm is enough for v0.

### Design checkpoint 6

Fetch latest Claude Design if the review session feels awkward.

Review:

- flashcard layout;
- reveal interaction;
- rating button placement;
- daily progress display;
- saved-material browsing inside Review.

### Exit criteria

- User can review due cards.
- Review actions update due dates.
- Dashboard reflects reviewed counts.

---

## Phase 8 — Dashboard completion

### Goal

Make the dashboard reflect real user activity.

### Build

Dashboard cards for:

- captured content;
- reviewed flashcards;
- current streak;
- due review count;
- learned lessons placeholder or simple count;
- recent captures;
- quick resume action.

### Keep lessons light

The Learn tab and learned-lessons stat can remain minimal in v0. Do not build a full lesson system unless everything else is already stable.

### Design checkpoint 7

Fetch latest Claude Design before final dashboard polish.

Check:

- hierarchy;
- stats readability;
- recent capture cards;
- quick action placement;
- desktop layout.

### Exit criteria

- Dashboard opens cleanly.
- User can understand what to do next.
- Main stats are real, except any intentionally placeholder lesson stat.

---

## Phase 9 — polish, testing, and deployment

### Goal

Make the prototype coherent enough to demo and continue iterating.

### Build

- Mobile spacing pass.
- Desktop usability pass.
- Loading states.
- Empty states.
- Error states.
- Basic accessibility pass.
- Environment variable documentation.
- README setup flow.
- Vercel deployment check.
- Supabase redirect URL check.
- Smoke test main flows.

### Smoke-test flows

Test:

1. Sign in.
2. Set active study language.
3. Capture a sentence.
4. Add source/speaker/place.
5. Look up a token.
6. Save a word.
7. Translate supported pair.
8. Save translation into an item.
9. Generate/review a flashcard.
10. Confirm dashboard stats update.

### Exit criteria

- App is deployable.
- Main v0 loop works.
- README explains setup.
- Known missing pieces are listed clearly.

---

## Design break rules

Use a design break whenever one of these is true:

- A new major screen is about to be implemented.
- The current implementation feels visually wrong.
- The user reports that something feels too dense, too corporate, too childish, or too hard to use.
- The layout has important mobile ergonomics questions.
- The app needs a new component pattern, such as a metadata drawer, language selector, token popup, or disabled translation-pair selector.

Do not use a design break for:

- Supabase schema decisions.
- RLS policies.
- API wiring.
- Type errors.
- Build errors.
- Refactors that do not change visible behavior.

---

## Implementation priorities

If time is limited, protect these first:

1. App shell and navigation.
2. Auth and active study language.
3. Capture and save flow.
4. Dictionary lookup.
5. Translation for supported pairs.
6. Basic review.
7. Dashboard stats.

Cut or defer:

1. Learned-lessons implementation.
2. Streak polish.
3. Advanced source/speaker fields.
4. Token definition persistence.
5. Multiple flashcard card types.
6. Full desktop polish.

---

## Final instruction to Claude Code

Build in layers. Do not half-wire everything at once.

The best sequence is:

```text
Design source of truth
→ static UI shell
→ auth/settings
→ private data CRUD
→ Capture
→ Dictionary
→ Translate
→ Review
→ dashboard stats
→ polish/deploy
```

At each design checkpoint, fetch the latest Claude Design output and update the local design docs before coding further.

