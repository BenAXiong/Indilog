---
id: DEC-SRS16
title: Priority-deck visibility — curriculum sub-source, session header fallback, due breakdown tab
status: implemented — pending manual verification
date: 2026-07-08
---

## Context

Follow-up to the investigation in the DEC-SRS15 conversation: a review session's due count was
dominated (250 of 293 cards) by a collection ("EPark_Amis - 詞匯 初~高級") absent from the user's
priority-deck list, and the session header showed no label at all for those cards — `deckName`
returned `null` whenever a card didn't match any configured priority deck, which is exactly the
"non-priority" case, not an edge case. Separately, `ind_items` never recorded which curriculum
sub-source (`con_practice`/`dialogue`/`essay`/`grmpts`) a saved sentence came from — only `'twelve'`
is distinguishable, via the `level` column being set — so `matchesPriorityDeck`'s four non-`twelve`
curriculum priority decks (Conversations/Dialogues/Essays/Patterns) were structurally
indistinguishable from one another and all resolved to the same pool.

## Decisions

**1. Curriculum sub-source recorded going forward, not backfilled.** `EparkView.tsx`'s `handleSave`
now passes `metadata: { curriculum_source: source }` on every `createItem()` call (previously only
`'twelve'` got any source-specific data, via `level`/`lesson`). `CreateItemInput` gained an optional
`metadata` field; `ind_items.metadata` already existed as an empty jsonb column. `matchesPriorityDeck`
checks `metadata.curriculum_source` first, falling back to the old level-based heuristic for cards
saved before this change (no backfill attempted — no reliable link from existing rows back to their
corpus source). The existing 283 pre-fix Conversations/Dialogues/Essays/Patterns cards remain in one
combined bucket permanently, unless naturally re-saved.

**2. Session header falls through to the card's real deck, not blank.** `deckName` (in both
`review/page.tsx` and `learn/page.tsx`) previously returned `null` when the current card didn't
match any priority deck. It now falls through to `ind_items.ind_learn_collections.name` or a
note-source label — the same information the Card Inspector already showed, just surfaced in the
header where it's actually visible during a session, instead of requiring a manual inspect.

**3. Session-size picker gets a "Decks" tab; no separate dashboard-ring tooltip.** Both the Learn
and Review pen-button "Session size" popups (`DualRingCard.tsx`) now have a `Size`/`Decks` tab
switcher. `Decks` shows due (or new, for Learn) cards grouped by priority deck — in configured
order — followed by non-priority collections/sources sorted by count descending. This subsumes what
a separate ring tooltip would have shown, so the tooltip wasn't built. Informational only: tapping a
row doesn't scope a session to that deck; starting a session still uses the existing numeric size
control regardless of which tab is active.

**Grouping is client-side, reusing `matchesPriorityDeck()` — not a SQL RPC.** A new
`getDeckBreakdown()` (`lib/db/srs/flashcards.ts`) fetches a slim projection of due/new cards
(collection/note_source/level/lesson/language/dialect/tags/metadata — no joined corpus content,
audio, or text) and groups them in JS with the exact function review/learn already use for sorting.
Considered a SQL port (mirroring `get_due_stats`), but `matchesPriorityDeck` needs an *ordered
first-match* against a variable, user-configured deck list (collection-id equality, or
note_source + curriculum/language/dialect/tag branching) — meaningfully more complex than
`get_due_stats`'s flat `GROUP BY`, and a second hand-maintained implementation of the matching logic
that can drift from the JS version (exactly the class of bug this whole thread started from: display
not matching real behavior). Rejected in favor of one source of truth.

**Future consideration — this doesn't scale past a single/small-user personal app.** The client-side
fetch-and-group approach transfers every due/new card's slim projection to the browser and groups in
JS. At this account's volume (~300 due cards) that's negligible and lazy (only fetched when the
picker's "Decks" tab is opened). If this app ever had many users with much larger per-user due/new
counts, or the client fetch itself became a bottleneck, revisit with a proper grouped RPC — at that
point the SQL-port cost analyzed above would need to be paid, and `matchesPriorityDeck`'s branching
logic would need a single canonical implementation (e.g. generated from one spec, or moved
server-side entirely) rather than living twice.

## Code locations

- `apps/web/components/epark/EparkView.tsx` — `handleSave` (`metadata: { curriculum_source: source }`)
- `apps/web/lib/db/notebook/items.ts` — `CreateItemInput.metadata`
- `apps/web/lib/db/srs/priority.ts` — `matchesPriorityDeck` (now takes a `PriorityMatchItem` object,
  was 8 positional params — hit the lint parameter-count ceiling once `metadata` was added),
  `matchesFilterConfig` (extracted), `PriorityMatchItem`
- `apps/web/lib/db/srs/flashcards.ts` — `getDeckBreakdown`, `DeckBreakdownRow`, `CARD_SEL`/
  `FlashcardWithItem` gained `metadata`; all `matchesPriorityDeck` call sites updated to the new
  object signature
- `apps/web/app/(main)/review/page.tsx`, `apps/web/app/(main)/learn/page.tsx` — `deckName` fallback,
  updated `matchesPriorityDeck` call sites
- `apps/web/app/(main)/DualRingCard.tsx` — `PickerTabs`, `DeckBreakdownList`, `openPickerTab`

## Verification status

**Implemented, not yet manually tested in a browser.** `npx tsc --noEmit -p apps/web` passes.
Pending checklist:

1. Save a new sentence from each curriculum source (Lessons/Conversations/Dialogues/Essays/Patterns)
   via the Epark view; confirm `ind_items.metadata->>'curriculum_source'` is set correctly per source.
2. Start a review/learn session that includes a card from a non-priority collection (e.g.
   EPark_Amis); confirm the session header shows that collection's real name instead of nothing.
3. Open the Learn and Review pen-button pickers, switch to the "Decks" tab, confirm: priority decks
   appear in configured order with correct counts, non-priority collections appear individually
   (not lumped into one bucket) sorted by count descending, and the numbers match a manual DB count.
4. Confirm switching tabs and closing/reopening a picker doesn't leave stale data from the other
   picker (Learn vs Review breakdown state shouldn't cross-contaminate).
5. Regression: existing pre-fix curriculum cards (no `metadata.curriculum_source`) still sort/match
   the same as before (level-based fallback intact).
