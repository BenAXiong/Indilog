---
id: DEC-SRS14
title: Unsave from bookmark surfaces — delete if unreviewed, suspend if reviewed
status: accepted
date: 2026-07-08
---

## Context

Bookmark icons (curriculum study cards in `EparkSentence`, dict page sentence results) originally toggled: a second tap called `deleteItem`/`deleteNote`, removing the `ind_items` row. Because `ind_flashcards.note_id` and `ind_reviews.flashcard_id` are both `ON DELETE CASCADE`, that silently erased review history for any card the user had already studied — a fast re-tap in a scrolling reading view is an easy accidental hit, with no confirmation.

The fix applied 2026-06-04/05 (`919961a`, `45d8ef2`) replaced the toggle with a warning toast pointing at Study → Browser, where deletion requires an explicit "Permanently delete this note?" confirmation. This made unsave safe but removed the one-tap affordance entirely — re-discovered as "unsave is currently impossible" on 2026-07-07/08. The dict page's warning copy (`handleSaveSentence`, `dict/page.tsx:460`) already anticipated the fix: *"to delete or suspend it, find it in Study → Browser."*

`ind_items` ↔ `ind_flashcards` is strictly 1:1 (DB-enforced unique constraint, see DEC-SRS05), so there is exactly one `repetitions` value and one `suspended_at` value per saved sentence — no per-row ambiguity.

## Decision

Re-tapping a filled bookmark performs a real unsave again, branching on review state:

- **`repetitions === 0` (or no `ind_flashcards` row exists yet — `ensureFlashcards()` is lazy, not synchronous with save)**: hard delete the `ind_items` row. No review history exists, so cascading delete is safe.
- **`repetitions > 0`**: do not delete. Set `suspended_at = now()` on the flashcard instead (reusing the existing, already-reversible suspend mechanism used by Study → Browser's manual Suspend/Unsuspend toggle — not the in-session swipe-suspend gesture from DEC-SRS11, which is a different, session-scoped action). The item stays in the notebook and its history stays intact; it's just excluded from due/learn queues via the existing `suspended_at IS NULL` filters.
- If already suspended, re-tapping is a no-op state-wise — show the same "kept, won't appear in reviews" toast rather than erroring.

Toast copy: two variants replace the single "already saved, go to Browser" message —
- Deleted: "Removed from notebook."
- Suspended: "Kept — your review history is safe, but it won't appear in future sessions. Unsuspend it from Notebook if you change your mind."

### Scope

Applies to curriculum (`EparkSentence`/`EparkView`, all four sources) and dict page sentence bookmarks. Capture and translate do not get this treatment — they save directly rather than toggling a bookmark against pre-existing content rows ("premade sheets"), so there's no re-tap-to-unsave affordance to fix there.

### One canonical implementation

Logic lives in a single helper (SRS layer, alongside `deleteNote`/`suspendCard` in `lib/db/srs/`), not duplicated per page. The dead `deleteItem()` in `lib/db/notebook/items.ts` is retired in favor of this helper.

### Performance

- The batched "is this already saved" pre-check that both surfaces already run on load (curriculum's `savedItemMap`, dict's `savedAbSet` query at `dict/page.tsx:352`) must carry `repetitions`/`suspended_at` in the *same* query (join or second column set), not become N+1 per-card lookups. This is the only hot-path-adjacent piece; do not skip.
- The unsave action itself (branch + delete-or-suspend) runs only on explicit user tap — a rare, user-initiated action, not a page-load path. A plain RLS-scoped client call (read `repetitions`, then delete or update) is fine; no RPC needed, consistent with how `deleteNote`/`suspendCard` already work as plain client calls today.

## Rationale

- Reuses existing, tested machinery (`suspended_at`, the Browser's suspend/unsuspend toggle, the due-query exclusion) instead of inventing new state.
- The 1:1 note↔flashcard model (DEC-SRS05) makes the reps check unambiguous — no multi-row edge cases.
- Matches the warning copy already shipped on the dict page, which had already signposted this exact resolution.
- Keeps the accidental-data-loss protection that motivated the original warn-only fix, while restoring the one-tap affordance the warn-only fix took away.

## Code locations

- `apps/web/components/epark/EparkSentence.tsx` — `handleSave` re-tap branch (currently calls `onSaveWarning()` only)
- `apps/web/components/epark/EparkView.tsx` — `savedItemMap` batched pre-check, `handleSaveWarning`
- `apps/web/app/(main)/dict/page.tsx` — `savedAbSet` pre-check (`:352`), `handleSaveSentence` (`:457-461`)
- `apps/web/lib/db/srs/flashcards.ts` — `suspendCard`/`unsuspendCard` (`:554-562`), `repetitions`/`suspended_at` columns
- `apps/web/lib/db/srs/browser.ts` — `deleteNote`/`batchSuspendCards` (existing precedent to reuse, not duplicate)
- `apps/web/lib/db/notebook/items.ts` — `deleteItem` (dead code, to be removed once the new helper lands)
