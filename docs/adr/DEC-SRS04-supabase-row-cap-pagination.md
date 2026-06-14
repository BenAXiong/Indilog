---
status: accepted
---

# Supabase PostgREST row cap — use `.range()` pagination

Any query that may return >1000 rows uses `.range(from, from + PAGE - 1)` in a loop (PAGE = 1000). Never use `.limit()` for large fetches.

**Date:** 2026-05-31

**Context:** Supabase's PostgREST server enforces a hard max-rows limit (default 1000). `.limit(N)` in the JS client is silently capped server-side regardless of N. Discovered when the Amis1k import (1063 cards, all due simultaneously) caused `getDueStats` to show 1000 due, `listDueFlashcards` to return 1000 cards, and `listBrowserCards` to omit captured items entirely.

**Note:** `listBrowserCards` uses two parallel `paginate<T>` calls (one per `note_source` value) instead of one, to keep collection items from crowding out captured notes within the same page window.

**Affected functions (as of 2026-06-14):** `listDueFlashcards`, `getDueStats`, `listLearnFlashcards`, `listUserLanguages`, `resetCollectionSRS`, `resetCapturesSRS`, `listBrowserCards`, `ensureFlashcards` (both inner queries).

The raw loop is now centralized in the `paginate<T>` helper in `lib/db/srs/flashcards.ts` — do not copy-paste the loop. See `architecture.md` § *Supabase row cap* for usage.
