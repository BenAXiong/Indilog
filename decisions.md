# Indivore — Decisions

Tracks open questions and resolved architectural/product decisions.

---

## Open

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

## Resolved

### DEC-001 · Dictionary API contract
**Decision:** Dictionary is a local SQLite file (`ycm_master.db`) accessed via `better-sqlite3`. No remote Vercel API. Route handlers: `/api/dict/search` (FTS words + sentences, glid filter) and `/api/dict/dialects`. Capture lookup uses `/api/lookup` (exact-match ILRDF word lookup).
**Date:** 2026-05-26

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
