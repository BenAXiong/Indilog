# Browser tab — v2 work plan (temp doc, revise freely)

**Milestone:** M5-C — Feature refinement (`plan-v1.md`, section starting
line 207). The four open `Browser:` bullets this doc is scoped to
(`plan-v1.md:254-257`, verbatim for reference — not edited here):

```
- [ ] Browser: add all context fields, editable
- [ ] Browser: enable swipe left/right for extanded options
- [ ] Browser: edit of any field esp audio
- [ ] Browser: batch edit of any field esp dia & source
```

## Context

Session on 2026-07-17 scanned `apps/web/components/study/BrowserView.tsx`,
`BrowserButton.tsx`, and `apps/web/lib/db/srs/browser.ts` in response to the
M5-C Browser backlog above plus new asks from this session:

- add all context fields, editable (some collapsed) — including audio
- enable swipe left/right for extended/convenient options
- batch edit of fields
- UI reordering by most-used elements
- filter reordering/styling
- a smarter layout: intuitive deck selection, filter pills, etc.

This doc is input for a `/grill-with-docs` session to firm up the layout
direction before any of the above gets built. It does not decide anything —
Part 4 in particular is brainstorm fodder, not a recommendation.

`plan-v1.md` is not edited by this doc or by Claude — the four backlog
bullets there (lines 254-257) map onto the phases below and can be
checked off / rewritten by the user once this plan is agreed.

---

## Part 1 — Straightforward fixes (do first, no design decisions needed)

These don't depend on any layout choice made in Part 4 — safe to land before
or in parallel with the grill-with-docs session.

### 1a. Preview sheet identity bug

**File:** `BrowserView.tsx:512` (`previewIndex` state), `:535-551` (load effect)

`previewIndex` is a raw index into the derived `filtered` array. Two failure
modes:
- Editing search/filters while the preview sheet is open reshuffles
  `filtered`, but the audio-load effect only depends on `[previewIndex]` —
  the visible front text updates (read live in render) but the loaded audio
  and `previewRevealed` state don't, so the sheet can show one card's text
  while playing another card's audio.
- Deleting/suspending a card via a `CardRow`'s edit panel while a *later*
  card's preview is open doesn't touch `previewIndex` — every later index
  shifts down one, so the sheet can point at the wrong card entirely.

**Direction:** track the previewed card by `id`, derive its current index
into `filtered` at render time, and close (or re-clamp) the sheet if the id
drops out of `filtered`.

### 1b. Sort triggers an unnecessary re-fetch

**File:** `BrowserView.tsx:522-527`

`sort` is in the fetch effect's dependency array, but `'due'`/`'ease'` sort
is already done client-side after fetch (`:145-154`); only `'added'` relies
on DB order. Switching Sort currently re-runs both paginated queries against
`ind_items` from scratch.

**Direction:** only re-fetch when `filter`/`flagColorFilter`/`videoOnly`
change; re-sort the already-loaded `cards` in memory when `sort` changes.

### 1c. Missing `videoOnly` dependency

**File:** `BrowserView.tsx:522-527`

Used inside the fetch effect, not listed in the dependency array, no
`eslint-disable` comment (unlike the two other effects in this file that do
document their intentional omissions). Harmless today because both call
sites (`VideoPage.tsx:950`, `BrowserButton.tsx:63`) pass it as a static prop
— but it'll silently misbehave if that ever changes.

**Direction:** add it to the array (one-line fix), or a comment if there's a
reason not to that isn't obvious from the code.

### 1d. Audio not cleaned up on unmount

**Files:** `BrowserView.tsx:126-136` (`CardRow.handleAudio`), `:535-551`
(preview audio effect)

Neither the per-row audio nor the preview audio has a cleanup return on
unmount — only handled on explicit toggle-off or `previewIndex` change.
Closing the whole Browser sheet or navigating away mid-playback leaves audio
running in the background.

**Direction:** add unmount cleanup (pause + null the ref) in both places, or
factor into one shared audio hook (see Part 2).

---

## Part 2 — Refactor candidates (not urgent — candidates for `docs/refactor.md`)

**Independent of the layout decision — safe to do without waiting on
grill-with-docs:**

- **`CardRow` does too much** — edit form + audio player + lookup + strength/
  grade display + suspend/delete/flag in ~400 lines. Splitting out the edit
  panel is pure code organization, not a layout call — doesn't need to wait.
- **Three near-identical inline audio players** (`CardRow`'s own, preview's,
  video-clip sync). Worth one shared hook regardless of which direction (A-D)
  wins — ties into fix 1d above.

**Tied to whichever layout direction is picked in Part 4 — leave in grill scope:**

- **8 independent `useState` filters** (`fType`, `fSource`, `fLanguage`,
  `fDialect`, `fromDate`, `toDate`, `filter`, `sort`) — consolidating into a
  reducer only makes sense once it's known which dimensions become
  always-visible pills vs. tucked into a sheet (Part 4 direction C) vs.
  replaced by deck drill-down (direction B).

---

## Part 3 — Perf

- **No virtualization on the card list** (`BrowserView.tsx:828`, plain
  `overflowY: auto`). Fine at today's vault sizes, but "add all context
  fields" makes rows heavier, and this is the exact screen power users dump
  thousands of cards into. Retrofitting virtualization onto already-bloated
  rows is more painful than adding it before the fields expansion —
  sequence this ahead of Part 4's fields work if virtualization is adopted.
- Two full paginated queries fire on every `filter`/`flagColorFilter` change
  even though most narrowing (type/source/language/dialect/date/search)
  happens client-side after. Correct per DEC-SRS04, just note it if large
  accounts show lag switching SRS-state filters.

---

## Part 4 — Layout brainstorm: from first principles

### The primitives at play

Any "browser" screen is really six independent decisions:

1. **Identity** — what's a row: a note, a card, or (as here) effectively 1:1?
2. **Selection** — how you enter/exit multi-select for batch ops.
3. **Filtering** — which dimensions exist (SRS state, deck/source, language,
   dialect, note type, date, free text) and how they're exposed.
4. **Sorting** — order criteria.
5. **Preview vs. edit** — quick look vs. full field edit; today these are
   two separate surfaces (row-expand vs. bottom-sheet preview).
6. **Density / disclosure** — how much shows collapsed vs. expanded, and
   what "extended options" (swipe) reveals that the default row doesn't.
7. **Navigation** — how you move between the filtered set and between
   individual cards.

The current implementation: flat scrolling list, dropdown filters (2 rows +
date range), tap-row-to-expand-inline-edit, separate tap-icon-for-preview-
sheet, explicit "Select" mode toggle for batch ops. All filter dimensions are
presented as equals in a horizontal row of `<select>`s — no hierarchy.

### Candidate directions (not mutually compatible — pick one to interview)

**A. Anki-desktop split view** — persistent filter sidebar (decks/tags/state
as a tree) + dense sortable table, click a row to edit in a side/bottom pane.
Pros: scales to large vaults, familiar to Anki users. Cons: this app is
mobile-first (full-screen `100dvh` bottom sheet, everything else in the app
is touch/swipe-driven) — a sidebar+table doesn't fit the existing shell
without a parallel desktop-only layout, which is a bigger commitment than
the other options.

**B. Deck-first drill-down** — home view of the Browser is tappable deck/
source tiles or pills with counts (no flat card list yet); tapping one
enters a list already scoped to that deck, with SRS-state/type as a
secondary (smaller) pill row inside. Directly answers "intuitive deck
selection" by making deck choice a navigation step instead of one dropdown
among six. Trade-off: cross-deck search/filter (e.g. "all flagged cards
regardless of source") needs an explicit escape hatch back to a flat view,
or it becomes harder than it is today.

**C. Flat list, pills replace dropdowns** — keep today's single-list
architecture, but promote SRS-state (`All/Due/New/Flagged/Suspended`) to an
always-visible horizontally-scrollable pill row (highest usage → highest
salience, answering "UI reordering by most-used"), demote
language/dialect/date-range into a "More filters" sheet, show active
filters as removable chips above the list. Lowest-risk option — it's a
styling/reorganization pass on the existing data flow, no navigation model
change. Weakest on "smart... deck selection" specifically, since source/deck
stays inside the filter sheet rather than becoming primary.

**D. Segmented state tabs + swipeable card stack** — SRS state becomes a
segmented control (like iOS Mail), and the main content area becomes a
swipeable single-card stack (Tinder/Anki-mobile-review-style) rather than a
scrolling list, with edit-in-place on the current card. This reframes "swipe
left/right for extended options" from a bonus gesture bolted onto a list
into the primary navigation model. Biggest philosophical shift of the four —
worth interviewing on purpose (is the Browser meant to stay a *search/manage*
tool, or become a *skim/triage* tool closer to Review?) before committing.

### Design tensions worth raising in the interview

- **Row density vs. field count**: "add all context fields" pushes toward
  more per-row info; the user's own note already assumes progressive
  disclosure ("some will be collapsed") — the real open question is *which*
  fields get promoted to always-visible in whichever direction (A-D) is
  chosen, not whether disclosure happens at all.
- **Batch-editable vs. single-edit-only fields**: batch edit only makes
  sense for fields where one value can apply to many notes at once
  (dialect, source, tags, place_heard, flag) vs. fields that are inherently
  per-note (`ab`/`zh` text, `target_word`). Worth deciding this split
  explicitly before building a generic "batch edit any field" form.
- **Selection mode vs. long-press**: today's explicit "Select" button toggle
  could become a long-press-to-select gesture (Photos/Gmail-style) instead,
  freeing a header slot and fitting better with a swipe-forward direction
  (D) — but it's a bigger interaction change and worth a deliberate call,
  not a silent swap.
- **Preview sheet vs. inline expand — one surface or two?** Today a card can
  be opened two different ways (tap row → inline edit; tap preview icon →
  bottom-sheet study-style preview) with different content. Worth asking
  whether that's intentional (they serve different jobs: quick recall-check
  vs. edit) or accidental duplication to consolidate.

---

## Mapping back to existing asks — what actually needs grilling

Re-examined after the four straightforward fixes (2026-07-17): most of the
M5-C backlog genuinely hinges on which Part 4 direction wins, but two items
don't touch overall navigation/layout at all and can be built independently
without waiting for that decision.

| Ask | Blocked by layout decision? | Landed in |
|---|---|---|
| `plan-v1.md`: add all context fields, editable | **Yes** — row density/disclosure is exactly what Part 4 direction (A-D) constrains | Part 4 (density/disclosure question) + implementation phase after layout is picked |
| `plan-v1.md`: swipe left/right for extended options | **Yes** — direction D makes swipe primary navigation, A/B/C make it a bonus layer | Part 4 direction D, or as a layer on top of A/B/C's row |
| `plan-v1.md`: edit of any field, esp. audio | Partially — the audio-hook consolidation (Part 2) is independent; adding more fields to the edit panel is safest done after row density is settled, to avoid retrofitting | Part 2 (independent piece) + Part 4 (fields piece) |
| `plan-v1.md`: **batch edit of any field, esp. dia & source** | **No** — batch edit operates within the existing selection-mode action bar regardless of which direction the surrounding list takes; dia/source are exactly the "one value applies to many notes" case flagged below | **Pull out of grill scope — build independently**, after the four fixes |
| New: UI reordering by most-used elements | **Yes** — this *is* Part 4 direction C | Part 4 direction C (or as a principle applied within B/D) |
| New: filter reordering/styling | **Yes** — same as above | Part 4 direction C |
| New: smart layout — deck selection, filter pills | **Yes** — the core question | Part 4 directions B and C are the two live candidates |

**Net: after the four fixes, only "batch edit for dia & source" is ready to
build without grilling.** Everything else either directly constitutes the
Part 4 decision or is cheaper to build once that decision is made.
