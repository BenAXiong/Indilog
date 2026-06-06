---
status: accepted
---

# Shared YCM utilities live in `lib/lang/`, not `lib/learn/`

Any file that 3+ non-Learn features import belongs in `lib/lang/` or another domain-neutral folder, not inside a feature folder.

**Date:** 2026-05-29

**Why:** `dialects.ts` and `lang-bridge.ts` lived under `lib/learn/` despite being consumed by 8 importers across 5 features. `lib/learn/db.ts` imported the SQLite singleton directly from `lib/dict/client.ts`, coupling two unrelated domains. `useActiveLang` caused 7 independent Supabase profile fetches — one per page mount.

**Pass 1 (intermediate):** `lib/lang/` + `lib/dict/sqlite.ts` extracted.
**Pass 2 (full):** Complete architecture restructure.

**Final directory contract:**
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
