---
status: accepted
---

# Browser tab redesign — layout direction and surface model

**Context:** the M5-C backlog asked for all-context-fields-editable, swipe
left/right, and a smarter deck-selection/filter layout
(`plan-v1-M5-C-browser.md`). Four candidate directions were drafted: A (Anki
desktop split view), B (deck-first drill-down), C (flat list with promoted
pills), D (segmented state tabs + swipeable card stack).

**Decision:** the Browser stays a search/manage tool, not a skim/triage
tool — Review already owns the go-through-cards-in-sequence job, so a second
surface for the same job would be redundant. This rules out D as the primary
navigation model. Direction A (persistent sidebar + table) doesn't fit the
app's mobile-first bottom-sheet shell without a parallel desktop-only layout,
ruling it out too. **Direction C** (flat scrolling list, filter dimensions
promoted/demoted by actual usage rather than presented as equals) is
adopted.

The existing two-surface split — tap row → inline expand-in-place edit; tap
preview icon → separate bottom-sheet recall-check preview — is collapsed
into **one overlay**, covering most (not all) of the viewport, leaving a gap
below to tap-outside-to-close (with a confirm prompt only when the form is
dirty). Which entry point is tapped sets the overlay's starting mode: row
tap → edit fields; preview icon → recall-check. A toggle inside the overlay
switches between the two either way. `CardRow`'s inline expand-in-row state
is retired in favor of this overlay.

Swipe left/right is layered onto list rows independently of the overlay:
swipe left reveals delete/suspend, swipe right reveals the flag-color
picker. Multi-select entry moves from the explicit header "Select" button to
long-press-to-select, freeing the header slot and avoiding a swipe vs.
select-button gesture collision. Inside the open overlay, swipe left/right
instead navigates to the previous/next card in the filtered set.

**Resolved filter-bar architecture** (dimension ranking is the user's stated
usage, not the doc's original "SRS-state is highest usage" assumption, which
turned out to be wrong):

1. Search — always visible.
2. Source/deck — always visible dropdown, promoted above the fold (not
   inside the filter panel). Companion sort-mode pill row: Alpha (default) /
   Count / Recent.
3. Collapsible "Filters" panel (collapsed by default), most- to
   least-used inside: language pills (multi-select, scrollable, `All`/`None`
   reset — `All` means no constraint, not 16 individual selections) →
   dialect pills (shown only when exactly one language is selected) → list
   sort (Due/Ease/Added, 3-pill segmented row) → SRS-state (All/Due/New/
   Flagged/Suspended) → date range → note type (lowest priority — the
   `type` word/sentence/note distinction is already slated for removal per
   DEC-D02, not worth surfacing further).
4. Active-filter chips, removable, shown above the list whenever the panel
   is collapsed but a filter inside it is active.

**Full spec:** see `plan-v1-M5-C-browser.md` Part 5.
