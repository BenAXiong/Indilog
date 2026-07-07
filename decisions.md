# Indivore — Decisions Index

All decisions live as individual ADR files in [`docs/adr/`](docs/adr/). This file is the index.

New ADRs: pick a prefix matching the feature area (e.g. `DEC-SRS`, `DEC-M5`, `DEC-ARCH`), scan existing files for the highest `NN` within that prefix, increment.

---

## Active ADRs

| ID | Title | Status |
|----|-------|--------|
| [DEC-ARCH01](docs/adr/DEC-ARCH01-lib-directory-contract.md) | Shared YCM utilities — `lib/` directory contract | accepted |
| [DEC-ARCH02](docs/adr/DEC-ARCH02-unified-note-card-model.md) | Unified Note/Card model | accepted |
| [DEC-ARCH03](docs/adr/DEC-ARCH03-postgrest-embed-filters-inner.md) | PostgREST embed filters require `!inner` | accepted |
| [DEC-ARCH04](docs/adr/DEC-ARCH04-performance-architecture.md) | Performance architecture — 2026-07 campaign decisions | accepted |
| [DEC-DASH-01](docs/adr/DEC-DASH-01-duecount-divergence.md) | Dashboard dueCount vs session count divergence | resolved in Phase 2F of plan-v1-M5-srs.md |
| [DEC-D01](docs/adr/DEC-D01-dict-word-dedup-normalisation.md) | Dictionary word dedup: space-stripping normalisation | accepted |
| [DEC-L01](docs/adr/DEC-L01-learn-all-16-languages.md) | Learn available for all 16 languages | accepted |
| [DEC-L02](docs/adr/DEC-L02-saved-view-all-sentences.md) | Saved view shows all captured sentences for the language | accepted |
| [DEC-L03](docs/adr/DEC-L03-grammar-comparison-deferred.md) | Grammar comparison mode deferred | deferred |
| [DEC-L04](docs/adr/DEC-L04-corpus-geometry-static-file.md) | `corpus_geometry.json` is a static repo file | accepted |
| [DEC-L05](docs/adr/DEC-L05-lesson-completion-in-supabase.md) | Lesson completion stored in `ind_completions` | accepted |
| [DEC-L06](docs/adr/DEC-L06-single-learn-route.md) | Single `/learn` route, no per-language URL segments | accepted |
| [DEC-L07](docs/adr/DEC-L07-dialect-persistence-ind-profiles.md) | Dialect persistence: `ind_profiles.default_dialect` | accepted |
| [DEC-L08](docs/adr/DEC-L08-word-lookup-cross-app.md) | Word lookup is a separate cross-app feature | accepted |
| [DEC-M3-01](docs/adr/DEC-M3-01-essay-corpus-geometry.md) | Essay corpus geometry — 24-slot structure | accepted |
| [DEC-M3-02](docs/adr/DEC-M3-02-db-homogenisation-occurrences.md) | DB homogenisation — structural metadata on occurrences | accepted |
| [DEC-M3-03](docs/adr/DEC-M3-03-corpus-sqlite-to-supabase.md) | Corpus DB migration: SQLite LFS → Supabase | accepted |
| [DEC-M4-01](docs/adr/DEC-M4-01-sources-schema-type-taxonomy.md) | Sources db — schema, type taxonomy, FK consolidation | accepted |
| [DEC-M6-01](docs/adr/DEC-M6-01-ilrdf-mt-tts-endpoints.md) | ILRDF AI Labs MT + TTS endpoints | accepted |
| [DEC-M7-01](docs/adr/DEC-M7-01-extension-import-format.md) | Chrome Extension Import — format, mechanism, dedup | accepted |
| [DEC-M8-01](docs/adr/DEC-M8-01-video-cards-pipeline.md) | Video cards — pipeline, storage schema, player, planned extensions | accepted |
| [DEC-NOTE01](docs/adr/DEC-NOTE01-canonical-srs-terminology.md) | Canonical SRS terminology | accepted |
| [DEC-NOTE02](docs/adr/DEC-NOTE02-note-unification-deferred.md) | Note unification — T-UNIFY | resolved |
| [DEC-NOTE03](docs/adr/DEC-NOTE03-metadata-jsonb-card-templates.md) | `metadata jsonb` on `ind_flashcards` | superseded by DEC-SRS06 |
| [DEC-P1-01](docs/adr/DEC-P1-01-no-library-route-phase1.md) | No separate Library route in Phase 1 | accepted |
| [DEC-P1-02](docs/adr/DEC-P1-02-no-i18n-phase1.md) | i18n strings not threaded through `t()` in Phase 1 | accepted |
| [DEC-P2-01](docs/adr/DEC-P2-01-login-dedicated-page.md) | `/login` is a dedicated page | accepted |
| [DEC-R01](docs/adr/DEC-R01-tech-stack.md) | Tech stack | accepted |
| [DEC-R02](docs/adr/DEC-R02-ind-table-prefix.md) | All tables use `ind_` prefix | accepted |
| [DEC-R03](docs/adr/DEC-R03-translation-direction-not-study-lang.md) | Translation direction ≠ active study language | accepted |
| [DEC-R03b](docs/adr/DEC-R03b-design-access-method.md) | Design access method | resolved |
| [DEC-R04](docs/adr/DEC-R04-place-heard-not-dialect.md) | Place heard/seen is observational metadata, not dialect | accepted |
| [DEC-R05](docs/adr/DEC-R05-learn-placeholder-v0.md) | Learn tab is placeholder in v0 | superseded by DEC-L01 |
| [DEC-R05b](docs/adr/DEC-R05b-supabase-env-vars.md) | Supabase env vars | resolved |
| [DEC-R08](docs/adr/DEC-R08-dialogue-drill-v0-scope.md) | Dialogue drill is v0 scope | accepted |
| [DEC-R09](docs/adr/DEC-R09-both-review-modes-v0-scope.md) | Both review modes are v0 scope | accepted |
| [DEC-R10](docs/adr/DEC-R10-16-formosan-languages.md) | 16 Formosan languages confirmed | accepted |
| [DEC-R11](docs/adr/DEC-R11-supabase-project.md) | Supabase project | accepted |
| [DEC-SRS01](docs/adr/DEC-SRS01-five-color-flags.md) | Five-color flag system | accepted |
| [DEC-SRS02](docs/adr/DEC-SRS02-deck-reset-scope.md) | Deck reset scope | accepted |
| [DEC-SRS03](docs/adr/DEC-SRS03-formosrs1-algorithm.md) | FormoSRS-1 algorithm | accepted |
| [DEC-SRS04](docs/adr/DEC-SRS04-supabase-row-cap-pagination.md) | Supabase row cap — `.range()` pagination | accepted |
| [DEC-SRS05](docs/adr/DEC-SRS05-note-centric-srs-architecture.md) | Note-centric SRS architecture | accepted (partially superseded by DEC-SRS06) |
| [DEC-SRS06](docs/adr/DEC-SRS06-review-modes-drop-card-type.md) | Review modes — 4-mode system; drop card_type | accepted (Decision 2 amended by DEC-SRS13) |
| [DEC-SRS07](docs/adr/DEC-SRS07-learning-phase-gesture-labels.md) | Learning phase gesture + label design | accepted |
| [DEC-SRS08](docs/adr/DEC-SRS08-session-cap-source-of-truth.md) | Session cap source of truth + "Review more" UX | superseded by DEC-M5-01 |
| [DEC-SRS09](docs/adr/DEC-SRS09-mastery-grades.md) | Mastery grades — Seed / Planted / Rooted / Blooming | accepted |
| [DEC-SRS10](docs/adr/DEC-SRS10-simulation-forward-projection.md) | Simulation — FormoSRS-1 day-by-day forward projection | accepted |
| [DEC-SRS11](docs/adr/DEC-SRS11-review-session-counter.md) | Review session — in-session counter and progress bar semantics | accepted |
| [DEC-SRS12](docs/adr/DEC-SRS12-advance-review.md) | Advance review — session mode for cards returning before next reset | accepted |
| [DEC-SRS13](docs/adr/DEC-SRS13-audio-surfacing-session-modes.md) | Audio surfacing — every session mode plays audio when present | accepted |
| [DEC-M5-01](docs/adr/DEC-M5-01-learn-review-separation.md) | Learn / Review session separation + priority-list goal model | accepted |
| [DEC-001](docs/adr/DEC-001-dictionary-corpus-api-contract.md) | Dictionary and corpus API contract | accepted |
| [DEC-002](docs/adr/DEC-002-supported-translation-pairs.md) | Supported translation pairs (v0) | superseded by DEC-M6-01 |
| [DEC-R06](docs/adr/DEC-R06-spaced-repetition-simple.md) | Spaced repetition stays simple (v0) | superseded by DEC-SRS03 |

---

## Pre-ADR decisions (no body, v0 era)

These were referenced in early log entries but never formalized. All resolved.

| ID | Notes |
|----|-------|
| DEC-003 | Design checkpoint — resolved |
| DEC-004 | Language count confirmation — resolved by DEC-R10 |
| DEC-005 | Vercel env vars — resolved by DEC-R05b |
| DEC-006 | v0 scope question — resolved |
| DEC-007 | v0 scope question — resolved |
