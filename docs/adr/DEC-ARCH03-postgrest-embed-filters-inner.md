---
status: accepted
---

# PostgREST embed filters require `!inner` — non-inner filters exclude nothing

Any Supabase query that filters on an embedded table's columns (`.filter('ind_items.x', …)`,
`.or(…, { foreignTable })`) MUST mark that embed `!inner`. Without it, PostgREST keeps every
parent row and merely nulls (to-one) or empties (to-many) the embed — the "filter" excludes
nothing.

**Date:** 2026-07-03

**Context:** Verified live against production data: `ind_flashcards?select=id,ind_items(…)&ind_items.note_source=eq.captured`
returned all 277 rows (embeds nulled) where the true match was 21. Consequences, all shipped and
unnoticed since the predicate-pushdown refactor (f42db26, 2026-06-14):

- Custom Review sessions (per-collection, captures-only, ePark "Saved", language/type filters)
  loaded the **entire** due pool — the Saved deck loaded 2,394 cards where 366 existed, the rest
  rendering as blank-faced cards. The perf harness's own telemetry had recorded the wrong count
  in every round.
- Language/collection exclusions in normal Review silently didn't exclude.
- Browser due/new/flagged/suspended tabs over-showed the whole vault with defaulted SRS values.

It went unnoticed because the default, filterless session — the common path — was unaffected.
Head-count queries were never affected (they already used `!inner`).

**Decision:**
- `CARD_SEL` uses `ind_items!inner(…)` unconditionally — every card has a note (`note_id` has no
  null rows; ensureFlashcards always sets it), so the join never drops legitimate rows.
- `listBrowserCards` uses `ind_flashcards!inner(…)` when a card-level filter is active.
- `getDueStats` avoids the problem entirely via the `get_due_stats` RPC (real SQL join).
- **Rule for all future queries:** if you filter on an embedded resource, mark it `!inner`, or
  push the logic into an RPC. When in doubt, verify with a live probe (`Prefer: count=exact` and
  compare counts with/without `!inner`) — the failure mode is silent.

Fixed 2026-07-03; verified post-deploy (Saved deck n=366 exactly). See `docs/perf-log.md`
§ Byproduct correctness fixes.
