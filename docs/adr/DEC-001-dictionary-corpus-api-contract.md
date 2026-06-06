---
status: accepted
---

# Dictionary and corpus API contract

**Date:** 2026-05-26 · Updated paths 2026-05-29 · Updated (SQLite removed) by DEC-M3-03

All corpus queries go through `lib/corpus/` — `dict.ts` (word/sentence search), `curriculum.ts` (lesson queries), `db.ts` (singleton). Route handlers: `/api/dict/search`, `/api/dict/dialects`, `/api/learn/curriculum`, `/api/learn/lookup`, `/api/learn/geometry`. Capture inline lookup uses `/api/learn/lookup`.

Originally used local SQLite file (`ycm_master.db`, `packages/dictionary/`) via `better-sqlite3`. As of DEC-M3-03 (June 2026), corpus is migrated to Supabase — `lib/corpus/` now uses async Supabase queries; `better-sqlite3` and `ycm_master.db` removed.
