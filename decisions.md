# Indivore — Decisions

Tracks open questions and resolved architectural/product decisions.

---

## Open

### DEC-SRS05 · Note-centric SRS architecture — intervals on notes, modes as session settings

**Context:** Current schema stores SRS metrics (`ease_factor`, `interval_days`, `repetitions`, `due_at`) on `ind_flashcards` (one card pre-created per note). `ind_flashcards.card_type` stores `'default'` or `'sts'` as a permanent property.

**Vision:** SRS metrics belong on `ind_items` (the note), not on a pre-made card. Review "cards" are generated on the fly per session — the note is the unit of knowledge, the session mode is just the presentation lens. This means:
- One note → one schedule (shared interval across all modes)
- Session picks the review mode at runtime (audio, forward, reverse, STS)
- No pre-made `ind_flashcards` rows needed for scheduling

**Why note-centric avoids the duplicates problem:** A card-centric multi-mode model (one `ind_flashcards` row per note per mode) would surface duplicate rows for the same word in the browser and complicate note-level editing — the user has one mental model of a word, not one per review mode. Note-centric keeps the browser genuinely one-row-per-note while mode is invisible infrastructure.

**On the unified-interval tradeoff:** A single interval can't distinguish "this word is easy in audio but hard in forward mode." This is accepted — for vocabulary acquisition, word knowledge is the goal, not mode-specific mastery. However, we want to *observe* whether mode-specific difficulty is real before making a scheduling commitment.

**Hybrid approach (implemented 2026-06-01):** Instrument now, decide later.
- `ind_reviews.mode` (text, nullable) logs the session mode on every review event: `'forward'` | `'audio'` | `'sts'` (future: `'reverse'`, `'production'`).
- Legacy rows have `mode = null`.
- Scheduling remains single-interval per note — unchanged.
- Once enough production data exists, `ind_reviews` can answer: "after N days of forward reviews, does switching to audio cause retention to drop?" If yes, per-mode intervals become justified.

**On card/session mode taxonomy:**
- `card_type: 'sts'` is genuinely structural (requires `target_word`, different layout). Long-term: move to `ind_items` as a note property.
- Audio, forward, reverse are **session modes** — no per-note storage, set at session level.
- `card_type` is not surfaced in UI — users see review modes, not card types.
- `target_word` is available to all modes (not STS-exclusive), enabling future audio + STS combinations.

**Current state:** `ind_flashcards` exists and works. Migration to note-centric SRS (moving scheduling columns to `ind_items`, repurposing `ind_flashcards`) requires a dedicated milestone.

**Decision:** Defer migration. Instrument `ind_reviews.mode` now. Do not add new `card_type` values to `ind_flashcards` in the meantime. Revisit per-mode scheduling once retention-transfer data exists.

**Date:** 2026-05-31 · Updated 2026-06-01 (mode logging implemented)

---

### DEC-SRS02 · Reset SRS scope — what "reset a deck" erases (2026-05-31) — IMPLEMENTED

**Context:** A deck reset can target three distinct layers:

| Layer | Table | Effect if wiped |
|---|---|---|
| SRS scheduling state | `ind_flashcards` cols (`ease_factor`, `interval_days`, `repetitions`, `due_at`) | Cards go back to "New" — re-study from scratch |
| Review history | `ind_reviews` rows (one per rating event) | Raw rating log gone; heatmap unchanged (reads `ind_daily_stats`) |
| Daily stats | `ind_daily_stats` rows (daily aggregate counts) | Heatmap goes blank, streak affected |

**Decision:** Reset = SRS scheduling state + `ind_reviews` for those cards. Leave `ind_daily_stats` alone.

**Why:** The user's intent is "pretend I've never reviewed these cards." That means cards re-enter as New and the per-card rating log is gone. But `ind_daily_stats` tracks "did I show up and study today" — a motivational/habit record. That effort happened; resetting a deck shouldn't wipe the streak or heatmap. Subtracting exact per-deck counts from `ind_daily_stats` retroactively would also require non-trivial work for limited gain.

**Alternatives considered:**
- SRS state only: cards go back to New but history remains — useful if you want to "re-study" but keep the habit log and also keep per-card history for analysis. Rejected: user wants a clean slate.
- Full wipe (SRS + reviews + daily stats): complete as-if-never-used. Rejected: destroys streak/heatmap which are motivational, and `ind_daily_stats` is shared across all decks so subtracting one deck's contribution is fragile.
- Confirmation tiers (soft reset vs. hard reset in a two-step dialog): over-engineered for the current use case. Can revisit if users want SRS-only reset as a separate option.

**Date:** 2026-05-31 · Implemented: `wipeReviewsAndReset()` in `flashcards.ts`, called from `resetCollectionSRS()` and `resetCapturesSRS()`

---

### DEC-SRS04 · Supabase PostgREST row cap — use `.range()` pagination

**Context:** Supabase's PostgREST server enforces a hard max-rows limit (default 1000). `.limit(N)` in the JS client is silently capped server-side regardless of N. Discovered when the Amis1k import (1063 cards, all due simultaneously) caused `getDueStats` to show 1000 due, `listDueFlashcards` to return 1000 cards, and `listBrowserCards` to omit captured items entirely.

**Decision:** Any query that may return >1000 rows uses `.range(from, from + PAGE - 1)` in a loop (PAGE = 1000). Never use `.limit()` for large fetches. See `architecture.md` § *Supabase row cap* for the standard pattern.

**Exception:** `listBrowserCards` instead splits into two parallel queries (one per `note_source` value) — semantically cleaner since the two data types are always fetched separately anyway.

**Affected functions (as of 2026-05-31):** `listDueFlashcards`, `getDueStats`, `listUserLanguages`, `resetCollectionSRS`, `resetCapturesSRS`, `listBrowserCards`.

**Date:** 2026-05-31

---

### DEC-ARCH02 · Unified Note/Card model — final decisions (2026-05-30)

**Canonical reference:** `architecture.md`

Key decisions settled:

1. **`ind_items` is the universal Note table.** `ind_learn_cards` is deprecated and will be merged into `ind_items` (T-UNIFY migration). After migration, all notes — captured, collection, dict, curriculum — live in `ind_items` distinguished by `note_source`.

2. **`front`/`back` are banned from the data model.** They are view-layer concepts computed at render time from `note.ab` + `note.zh` + session mode. Never re-add them to `ind_items` or `ind_flashcards`.

3. **Note fields:** `ab` (target-language text), `zh` (translation/definition), `notes` (personal annotation), `audio` (null | URL | storage path). Renamed from legacy `text`, `meaning`, `audio_url`.

4. **One Card per Note.** `forward`/`reverse`/`audio` are session modes (localStorage), not stored card rows. `generateReverseCardsForCollection()` is deleted. Existing `card_type='reverse'` rows removed in T-UNIFY.

5. **`card_type` values:** `default | sts` only. `sts` is the only template that requires stored metadata.

6. **`audio` field:** Accepts null, full URL, or Supabase Storage path. Resolved at render via `cardAudio()` which checks `card.audio` → `note.audio` in priority order.

7. **`note_source` values:** `captured | collection | dict | curriculum | text | video | podcast`. Future values (`text`, `video`, `podcast`) reserved for upcoming content sources.

8. **`ensureFlashcards()`** is the single Card generation function. No separate `generateFlashcardsFromCollection()`. Called on Study mount and immediately after collection import.

**Date:** 2026-05-30

---

### DEC-M3-01 · Essay corpus geometry — 24-slot structure from master JSON role detection

**Context:** The klokah.tw essay module has 12 thematic units across 3 levels (初級/中級/中高級). Each unit has content in two "sets": S1 (original) and S2 (later expansion). S2 covers exactly 6 units (L1,L2,L5,L6,L9,L10), uniform across all 42 dialects.

**Decision:** `corpus_geometry.json` essay section contains **24 slots** (6×3 + 6×1):
- S2 units → 3 texts: `學習一` (S2 current), `學習二` (S2 second text), `原版` (S1 original)
- S1-only units → 1 text: `學習一` (S1 original)

**TID role detection** (in `geometry_crystallizer.py`):
- `學習一` = TID appearing exactly **×1** in master JSON raw lesson list (solo TID)
- `學習二` = TID appearing **>1×** AND first item has >4 chars (sentence-level, not vocabulary)
- `詞彙` and `練習` TIDs are excluded from geometry (exercise content, not reading texts)

**Why not positional ordering?** The DB orders TIDs numerically, which maps loosely to lesson position but breaks for S2 units where S1 and S2 TID ranges are interleaved. Master JSON raw lists are authoritative.

**Non-essay content (詞彙, 練習, 互動 sections):** Excluded from geometry but still in `ycm_master.db`. Full slot mapping preserved in Citadel `brain/content_intel/` for future use.

**Date:** 2026-06-01 | **Source:** `Citadel/core/geometry_crystallizer.py`, branch `fix/essay-dialogue-geometry`

---

### DEC-M3-02 · DB homogenisation — add structural metadata to occurrences

**Context:** `twelve`/`nine_year`/`grmpts` store structural metadata in `occurrences.level` + `occurrences.category` and can be navigated by direct DB query. Essays, dialogues, and con_practice carry no structural metadata — navigation relies on `corpus_geometry.json` as an external routing file rebuilt from master JSONs. This is heterogeneous.

**Decision:** Add `unit` (int), `lesson` (text), `role` (text) columns to `occurrences`. Populate during scraping — the scraper already reads master JSONs and can tag each JSONL record before it reaches the distiller. Distiller passes fields through unchanged. Role-detection logic currently in the crystallizer moves into each scraper.

| Column | Essay | Dialogue | Con-practice | Twelve/Grmpts |
|--------|-------|----------|--------------|---------------|
| `unit` | 0–11 (unit index) | 0–11 | 0–29 (lesson index) | grade level |
| `lesson` | L1–L12 | L1–L12 | L1–L30 | lesson number |
| `role` | 學習一/學習二/原版/詞彙/練習 | 對話一/二/三 | dialogue/word | null |

After migration, `corpus_geometry.json` is reduced to a lightweight nav index (titles, ordering) rather than a routing table — or removed entirely for sources that have structural columns.

**Risks:** dialogue role is currently derived from S1/S2/S3 set, which maps cleanly; con_practice is already clean (L1–L30 + dialogue/word role); essay role-detection logic is proven in crystallizer and can be ported directly. Main risk is re-distillation effort (~200k rows).

**Sequence:** do after rescrape is stable; combine with Supabase migration (DEC-M3-03) so the schema lands once in Postgres rather than being migrated twice.

**Date:** 2026-06-01

---

### DEC-M3-03 · Corpus DB migration — SQLite LFS → Supabase

**Context:** `ycm_master.db` is a 215MB SQLite file git-tracked via LFS and bundled with every Vercel deployment. The file is read-only at runtime. Every corpus update requires: distill → copy → git commit → push → Vercel redeploys. Indivore already has a Supabase project for app data.

**Decision:** After DB homogenisation (DEC-M3-02), migrate `sentences` + `occurrences` (and optionally `ilrdf_vocabulary`) to the existing Supabase project.

**Why this works:**
- ~380k rows (sentences + occurrences) ≈ 100–150MB in Postgres — fits Supabase free tier (500MB) alongside app data
- Corpus queries are small (10–30 rows per request), so PostgREST 1000-row cap is not an issue
- Content updates become: distill → upsert — no git commit, no redeploy
- Eliminates the SQLite-in-serverless architectural awkwardness
- Curriculum API swaps `better-sqlite3` queries for `supabase.from()` calls — isolated change

**Migration path:** Re-run distiller targeting Supabase (write a Supabase distiller variant) with the enriched schema from DEC-M3-02. Update curriculum API. Drop `packages/dictionary/ycm_master.db` from git. Done in one step alongside homogenisation.

**Defer until:** DEC-M3-02 is ready; check Supabase project storage headroom before migrating ILRDF (293k rows, potentially large).

**Date:** 2026-06-01

---

### DEC-NOTE01 · Note / Card / Note Type / Card Template — canonical terminology
**Decision:** Adopt standard SRS terminology throughout all docs and code going forward.

| Term | Meaning | Current Indivore equivalent |
|---|---|---|
| **Note** | The underlying knowledge unit — a word, sentence, or fact | `ind_items` row, `ind_learn_cards` row, corpus item |
| **Card** | One review question derived from a Note; has its own SRS schedule | `ind_flashcards` row |
| **Note Type** | Schema defining a Note's fields (e.g., text+meaning+audio) | implicit — not yet modeled |
| **Card Template** | How a Note's fields map to a Card's front/back/prompt | `card_type` column on `ind_flashcards` |

Current Card Templates: `default` (text → meaning; was `forward`, renamed in T-UNIFY), `sts` (Single Target Sentence — target word + sentence, two layouts; implemented 2026-05-31).
`audio` is a session mode (on-the-fly, not a stored card_type). `reverse` removed in T-UNIFY (was a card row, now session mode).

**Date:** 2026-05-30

---

### DEC-NOTE02 · Note unification deferred — trigger condition defined
**Decision:** `ind_items` and `ind_learn_cards` remain separate tables for now. Merging them into a unified `ind_notes` table is deferred.

**Why not now:** `ind_items` has 10+ dependent files (capture UI, notebook, `lib/db/notebook/`, all flashcard joins). Migrating everything before knowing the final schema risks a second migration. Audio cards work fine via join without unification.

**Trigger condition:** Implement STS Card Template. STS needs `target_word` on a Note and makes the field-mismatch between `ind_items` and `ind_learn_cards` genuinely blocking. At that point the schema requirements are concrete and the migration has clear payoff.

**Status:** T-UNIFY completed 2026-05-30 (M1–M4). STS card template implemented 2026-05-31. This decision is now resolved — moving to Resolved section for history.

**Date:** 2026-05-30

---

### DEC-M4-01 · Sources db — schema, type taxonomy, FK consolidation

**Context:** Users capture vocabulary from various sources (people, media, references). `ind_items` already has `source_id` and `speaker_id` columns but no backing table. The goal is to let users maintain a personal source library and pre-fill capture fields from it.

**Decision — Schema:**
```sql
CREATE TABLE ind_sources (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('person', 'media', 'reference')),
  dialect_name TEXT,           -- primary dialect (pre-fills capture)
  language     TEXT,           -- language code (pre-fills capture)
  location     TEXT,           -- for persons: hometown / region
  url          TEXT,           -- for media/reference: link
  notes        TEXT,
  avatar_color TEXT,           -- UI: deterministic color for the card avatar
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

**Decision — Type taxonomy:**
| Type | Covers | Pre-fills |
|------|--------|-----------|
| `person` | speakers, teachers, elders, friends | dialect + language |
| `media` | movies, TV shows, music, podcasts, story books, YouTube | dialect + language |
| `reference` | dictionaries, textbooks, grammar books, websites | dialect + language |

The distinctions are cosmetic (icon) — all three share the same core fields and capture workflow.

**Decision — FK consolidation:**
- `ind_items.source_id` is the single FK to `ind_sources.id`
- `ind_items.speaker_id` is deprecated — ignored in all new code; will not be migrated or removed (low-risk orphan column)
- No shared sources between users in v1 — each user maintains their own library

**Sequence:** M4-A (schema + CRUD) → M4-B (capture integration + browser display)

**Date:** 2026-06-02

---

### DEC-NOTE03 · `metadata jsonb` on `ind_flashcards` for extensible Card Templates
**Decision:** Add `metadata jsonb` column to `ind_flashcards`. Card Templates that need fields beyond `front`/`back` store them here. The review session reads `card.card_type` + `card.metadata` together.

**Why jsonb, not typed columns:** New templates don't require schema migrations — only a new `card_type` value and a metadata shape definition.

**Implemented metadata shapes:**
- `default` (was `forward`): no metadata
- `audio` (session mode, not stored card_type): no metadata
- `sts`: `{ target_word: string; layout: 'word' | 'sentence' }` — sentence comes from `ind_items.ab`, not duplicated in metadata

**Date:** 2026-05-30

---

### DEC-L01 · Learn available for all 16 languages
**Decision:** Learn is enabled for all 16 officially recognized Formosan languages, not only the 6 FormoBank translation-supported ones. The `ycm_master.db` corpus covers all 16 via GLID families.
**Date:** 2026-05-26

---

### DEC-L02 · Saved view in Learn shows all captured sentences for the language
**Decision:** The "Saved" source tab in Learn shows all `ind_items` of type `sentence` for the active study language — not only sentences captured from within Learn. This gives full context (items captured via Capture, saved from Dictionary, saved from Learn all appear together).
**Date:** 2026-05-26

---

### DEC-L03 · Grammar comparison mode deferred
**Decision:** The grmpts side-by-side pattern comparison feature (desktop-only, multi-column) is deferred beyond Phase 10. Complex state management, desktop-only use case.
**Date:** 2026-05-26

---

### DEC-L04 · corpus_geometry.json is a static repo file
**Decision:** `corpus_geometry.json` is checked into the repo at `apps/web/lib/learn/corpus_geometry.json`. It represents stable curriculum structure (lesson counts, alignment keys) that changes only when the YCM corpus is updated. No live API fetch.
**Date:** 2026-05-26

---

### DEC-L05 · Lesson completion stored in ind_completions (Supabase)
**Decision:** Lesson/pattern/essay/dialogue completion state is stored server-side in a new `ind_completions` table, not in localStorage. Reasons: cross-device sync, queryable for Dashboard stats, enables future streaks and milestones. YCM used localStorage — Indivore has Supabase so use it.
**Date:** 2026-05-26
**Schema:** `(user_id, language, source, item_key, completed_at)` with a UNIQUE constraint on `(user_id, language, source, item_key)`.

---

### DEC-L06 · Learn routing: single /learn route, no per-language URL segments
**Decision:** Learn lives at `/learn` and always operates on `ind_profiles.active_study_language`. No `/:language/learn` routing. YCM uses per-language URLs because it's a multi-language portal; Indivore is a single-active-language notebook. Cursor state (selected lesson, pattern, etc.) is persisted in localStorage keyed by GLID, so switching languages in Settings resumes where the user left off per language.
**Date:** 2026-05-26

---

### DEC-L07 · Dialect persistence: ind_profiles.default_dialect
**Decision:** The dialect selected in Learn is persisted in `ind_profiles.default_dialect` (already in schema, was deferred in Phase 2). The stored value is the Chinese dialect name matching `occurrences.dialect_name` directly (e.g. `"南勢阿美語"`). This field is wired up as part of the Learn feature (Phase L0).
**Date:** 2026-05-26

---

### DEC-L08 · Word lookup is a separate cross-app feature
**Decision:** Full word lookup (tap token → definition panel, hover tooltip on desktop, sticky panel on mobile) is designed as a standalone `WordLookup` component usable across Learn, Capture, and Dictionary. It will be built after Learn v1 ships. Learn v1 may use a simplified placeholder (tap → opens Dictionary tab).
**Date:** 2026-05-26

---

### DEC-P1-01 · No separate Library route in Phase 1
**Decision:** The design handoff showed "saved items" content but no explicit Library tab in the BottomNav. Recent captured material is surfaced in the Dashboard "Recent Captures" section. No `/library` route created in Phase 1; if a dedicated Library screen is needed it can be added in Phase 3 alongside real saved-material CRUD.
**Date:** 2026-05-26

---

### DEC-P1-02 · i18n strings not threaded through t() in Phase 1
**Decision:** All Phase 1 pages use inline English strings directly rather than routing through the `t()` i18n helper. The full English key catalog (`lib/i18n/en.ts`) contains all keys, so threading is a mechanical Phase 9 task. Doing it in Phase 1 would add noise with zero user-visible benefit since the only supported locale is English.
**Date:** 2026-05-26

---

### DEC-P2-01 · /login is a dedicated page
**Decision:** Sign-in UI lives at `/login` — a dedicated full-page route, not a modal. Unauthenticated users are redirected there by middleware. No design handoff exists for this screen; keep it minimal and on-brand (cream background, Wordmark, Google OAuth button).
**Date:** 2026-05-26

---


### DEC-R08 · Dialogue drill is v0 scope
**Decision:** Dialogue drill IS v0 (confirmed by user 2026-05-25). Build as designed — two sample dialogues in Review landing, with session view. Content can be static for v0.
**Date:** 2026-05-25

---

### DEC-R10 · 16 Formosan languages confirmed
**Decision:** Use the 16 official CIP languages: Amis, Atayal, Paiwan, Bunun, Puyuma, Rukai, Tsou, Saisiyat, Tao, Thao, Kavalan, Truku, Sakizaya, Sediq, Kanakanavu, Saaroa. Confirmed by user 2026-05-25.
**Date:** 2026-05-25

---

### DEC-R11 · Supabase project
**Decision:** Existing Supabase project. Local instance running at `localhost:3004` for dev. Production URL set in Vercel env vars. Confirmed 2026-05-25.
**Date:** 2026-05-25

---

### DEC-R05b · Supabase env vars (DEC-005 resolved)
**Decision:** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in `.env.local` and in Vercel. Auth is unblocked. Resolved 2026-05-26.
**Date:** 2026-05-26

---

### DEC-R09 · Both review modes are v0 scope
**Decision:** Both Comprehension ("see meaning → produce sentence") and Expression ("hear sentence → recall sentence") modes are v0 (confirmed by user 2026-05-25). Both use Again/Hard/Good/Easy ratings but present the card differently.
**Date:** 2026-05-25

---

### DEC-ARCH01 · Shared YCM utilities live in `lib/lang/`, not `lib/learn/`
**Decision:** Shared YCM utilities and the SQLite layer are extracted into domain-neutral folders. The full architecture was completed in two passes (2026-05-29).
**Date:** 2026-05-29

**Why:** `dialects.ts` and `lang-bridge.ts` lived under `lib/learn/` despite being consumed by 8 importers across 5 features. `lib/learn/db.ts` imported the SQLite singleton directly from `lib/dict/client.ts`, coupling two unrelated domains. `useActiveLang` caused 7 independent Supabase profile fetches — one per page mount.

**Pass 1 (intermediate):** `lib/lang/` + `lib/dict/sqlite.ts` extracted.
**Pass 2 (full):** Complete architecture restructure — see directory contract in DEC-ARCH01 body below.

**Rule going forward:** Any file that 3+ non-Learn features import belongs in `lib/lang/` or another domain-neutral folder, not inside a feature folder.

**Final directory contract (2026-05-29):**
- `lib/lang/` — static YCM metadata, no I/O
- `lib/corpus/` — all SQLite reads (`db.ts` singleton, `dict.ts` word search, `curriculum.ts` lesson queries)
- `lib/db/notebook/` — captured items, sources, speakers
- `lib/db/srs/` — flashcards and scheduling
- `lib/db/progress/` — completions, collections, stats
- `lib/db/profile/` — user profile read/write
- `lib/context/LangDialectProvider` — single profile fetch, exposes `{lang, dialect, dialectLabel, setLang, setDialect}`; Settings writes through context for instant cross-app sync
- `components/lookup/` — cross-app word lookup components
- `app/api/learn/` — curriculum, geometry, lookup routes
- `app/api/dict/` — dictionary search and dialects routes

---

### DEC-D01 · Dictionary word dedup: space-stripping normalisation
**Decision:** When returning word results from `/api/dict/search`, deduplicate entries that differ only by internal whitespace. Two rows are considered duplicates when their `(dialect_name, normWordKey(word_ab))` matches, where `normWordKey` = lowercase → NFC → unify apostrophe variants (U+0027/U+2019/U+02BC/U+A78C → `'`) → strip all whitespace. Among duplicates keep the entry with the longest original `word_ab` — the spaced form is always longer and is the correct romanisation.
**Date:** 2026-05-28

**Root cause:** The ILRDF corpus contains both `mafana'to` and `mafana' to` as separate rows with the same dialect and overlapping definitions. The unspaced form is a data entry error — in Amis romanisation, `'` represents a glottal stop and the morpheme boundary requires a space before the following syllable. This pattern likely recurs elsewhere in the 293K-row vocabulary table.

**Why full space-strip, not just apostrophe-adjacent spaces:**
Stripping only spaces immediately adjacent to apostrophes (`replace(/' /g, "'")`) would fix the known case but miss equivalent errors involving other characters. Stripping all whitespace from the comparison key is simpler, catches all spacing variants at once, and carries negligible false-positive risk: two legitimate words that differ *only* by internal spacing (and agree on all other characters including apostrophes) would need to be in the same dialect — no such pair is known or expected in this corpus.

**Applied in two places:**
1. `apps/web/app/api/dict/search/route.ts` — dedup pass after `searchWords`, before sending response. Affects the Words tab and the raw data the Merged tab is built from.
2. `apps/web/app/(main)/dict/page.tsx` `normKey()` — same space-stripping added as a safety net for the Merged tab grouping, so residual duplicates (e.g. from different GLIDs that escaped route dedup) still collapse into one card.

**Trade-off acknowledged:** If a future corpus update introduces two genuinely distinct words that are identical after this normalisation, they would be silently merged. The mitigation is that `normWordKey` is only used for dedup/grouping — the display always shows the preserved (spaced, correct) form.

---

### DEC-SRS03 · FormoSRS-1 algorithm — exact spec and rationale

**Decision:** Use FormoSRS-1 (SM-2 base + Anki Hard behavior + fuzz + ease recovery on Good) rather than vanilla SM-2 or FSRS. Implemented in `lib/db/srs/schedule.ts`.

**Date:** 2026-05-30

**Rating → algorithm mapping:**

| Rating | Interval | Ease delta | Reps |
|---|---|---|---|
| Again | 1 day | −0.20 | reset to 0 |
| Hard  | max(1, prev × 1.2) | −0.15 | unchanged |
| Good  | prev × ease (min 1 day on rep 0) | **+0.02** | +1 |
| Easy  | prev × ease × 1.3 | +0.15 | +1 |

Min ease factor: 1.3. Initial ease: 2.5.

**Good +0.02 (ease hell fix):** Vanilla SM-2 has zero ease delta on Good, so ease only moves down (Again/Hard) or up (Easy). After ~6 total Again ratings a card hits the 1.3 floor and stays there permanently even if the user answers correctly every time after. +0.02 on Good means 10 consecutive Goods = +0.2 ease recovery. This avoids ease hell without the complexity of FSRS mean-reversion.

**Fuzz ±5%:** `interval = Math.round(interval * (0.95 + Math.random() * 0.1))` applied to all intervals ≥ 2 days. Prevents cards reviewed on the same day from clustering into the same future review date.

**Anki Hard behavior:** Hard uses `prev × 1.2` rather than Anki's full SM-2 Hard (which resets interval). Keeps progress while penalizing ease. Hard is not shown by default (toggle in OptionsSheet) because it confuses new users.

**Relearn burst (mature lapse):** Cards with `interval_days ≥ 7` that get Again enter a relearn burst (same learning-steps depth). "Got it!" = 50% interval recovery via `nextRelearn()` + `rateCardRelearn()`. Cap: 3 full restarts, then forced `rateCard('again')` full reset.

**Why not FSRS:** Better scheduling quality via Bayesian optimization of forgetting curve. Deferred because it requires meaningful production data (weeks of real reviews) to tune parameters. Revisit after 4+ weeks on prod.

---

### DEC-SRS01 · Five-color flag system (not boolean)

**Decision:** Flashcard flags are stored as `flag_color text` (null = no flag; values: `red`, `orange`, `yellow`, `green`, `blue`) rather than a `flagged boolean`. No meaning is assigned to specific colors by the app — the user decides. Five colors cover all practical tagging needs without imposing structure.

**Date:** 2026-05-30

**Why:** A single boolean flag has one dimension of meaning. A 5-color system acts as a lightweight tag set: e.g. red = "confused", green = "interesting", blue = "needs audio". The app should not assign semantics — that's the user's call. Five is the Anki convention and a reasonable upper bound before it becomes unwieldy.

**How it surfaces:** Review session bookmark icon opens an inline color picker (5 dots + clear). Browser Flagged filter adds a color sub-filter row. `/review?filter=flagged` or `/review?flag=red` targets sessions by flag. `setFlagColor(id, color | null)` is the single write path.

---

## Resolved

### DEC-001 · Dictionary and corpus API contract
**Decision:** YCM corpus is a local SQLite file (`ycm_master.db`, `packages/dictionary/`) accessed via `better-sqlite3`. No remote API. All corpus queries go through `lib/corpus/` — `dict.ts` (word/sentence search), `curriculum.ts` (lesson queries), `db.ts` (singleton). Route handlers: `/api/dict/search`, `/api/dict/dialects`, `/api/learn/curriculum`, `/api/learn/lookup`, `/api/learn/geometry`. Capture inline lookup uses `/api/learn/lookup`.
**Date:** 2026-05-26 · updated paths 2026-05-29

---

### DEC-002 · Supported translation pairs
**Decision:** 12 pairs supported via FormoBank Modal inference — `zho_Hant ↔ ami/tay/bnn/pyu/pwn/dru_Latn`. Defined in `lib/learn/translation-pairs.ts`. Unsupported targets are disabled in the Translate page UI.
**Date:** 2026-05-26

---

### DEC-R03b · Design access method
**Decision:** Claude Design handoff is provided as a downloaded zip bundle (`Indivore-design_handoff_v2.zip`) dropped in the repo root, extracted to `design-handoff/`. Read design files directly from disk — no API call needed.
**Source:** User provided the zip; bundle extracted to `design-handoff/indivore/project/`.
**Date:** 2026-05-25

---

### DEC-R01 · Tech stack
**Decision:** Next.js App Router, TypeScript, Tailwind CSS, Supabase Auth + Postgres, Vercel.
**Source:** Workflow doc — "Recommended stack" section.
**Date:** 2026-05-25

---

### DEC-R02 · Table prefix
**Decision:** All Indivore Supabase tables use the `ind_` prefix.
**Source:** Workflow doc — "Supabase table prefix" section.
**Date:** 2026-05-25

---

### DEC-R03 · Translation direction ≠ active study language
**Decision:** Changing the Translate source/target pair must NOT silently update the app-wide active study language. These are separate settings.
**Source:** Workflow doc — "Key product concepts" section.
**Date:** 2026-05-25

---

### DEC-R04 · Place heard/seen is observational metadata, not dialect
**Decision:** Place and dialect are separate fields. Place is not used to auto-infer dialect.
**Source:** Workflow doc — "Key product concepts" section.
**Date:** 2026-05-25

---

### DEC-R05 · Learn tab is a placeholder in v0
**Decision:** The Learn tab needs only a minimal placeholder. Full lesson system is explicitly out of scope.
**Source:** Workflow doc — Phase 8, "Keep lessons light."
**Date:** 2026-05-25

---

### DEC-R06 · Spaced repetition stays simple
**Decision:** v0 flashcard scheduling uses a simple interval multiplier algorithm. No full SRS (SM-2, FSRS, etc.).
**Source:** Workflow doc — Phase 7, "Keep simple."
**Date:** 2026-05-25
