---
id: DEC-SRS11
title: Review session — in-session counter and progress bar semantics
status: accepted
date: 2026-06-10
---

## Context

The review session shows a counter (`X / Y`) and a progress bar at the top of every card. The denominator Y must stay stable during a session so the user gets a consistent sense of how far they have left to go. The numerator X must reflect only meaningful progress — not queue mechanics.

Several actions affect the queue in ways that are NOT equivalent to progress:

- **Again**: re-inserts the card ~10 positions ahead. The card is not done; it will come back.
- **Suspend**: removes the card from the session. If overflow cards are loaded (up to `review_cap` hard cap), the next overflow card replaces it — net-zero for the session size.
- **Defer (Skip to tomorrow)**: removes the card from the session. No overflow replacement.

The initial `qIdx + 1 / queue.length` formula broke both invariants:
- denominator grew every time Again re-inserted a card
- numerator incremented on every queue advance, including retries and removals

## Decision

Two independent states track the counter:

```ts
const [handledCount, setHandledCount] = useState(0)          // numerator
const [totalCards,   setTotalCards]   = useState(cards.length) // denominator
```

### Numerator — `handledCount`

Increments only on a **final grade**: Good, Hard, or Easy (whether from a fresh card or a requeued lapsed card). Decrements on Undo (which reverses the most recent grade).

**Does NOT increment on:**
- Again — card is requeued and will return
- Defer — card is removed but not graded
- Suspend — card is removed but not graded

### Denominator — `totalCards`

Starts at `cards.length` (the initial session load). Decrements by 1 when a card **exits the session permanently without a replacement**:

- Defer → `setTotalCards(n => n - 1)`
- Suspend **without overflow** → `setTotalCards(n => n - 1)` (inside the `setOverflow` updater when `!prev.length`)

**Does NOT change on:**
- Again — card remains in the session (requeued)
- Suspend **with overflow** — one card exits, one overflow card enters; the slot is filled

### Full action table

| Action | `handledCount` | `totalCards` |
|---|---|---|
| Good / Hard / Easy | +1 | unchanged |
| Again | unchanged | unchanged |
| Defer | unchanged | −1 |
| Suspend, no overflow available | unchanged | −1 |
| Suspend, overflow available | unchanged | unchanged |
| Undo (reverses Good/Hard/Easy only) | −1 | unchanged |

### Implementation notes

**Suspend-no-overflow phantom:** If suspend-without-replacement incremented `handledCount` instead of decrementing `totalCards`, the counter would show `N/cards.length` (e.g. 15/15) when only `N-1` cards were graded — the suspended card becomes a phantom in the numerator. The correct fix is to shrink the denominator, not increment the numerator.

**Suspend-with-overflow does not count:** The overflow card that replaces a suspended card will eventually be graded (or deferred/suspended in turn). That future action is what counts, not the suspension event itself. Counting the suspension here would double-count a slot.

**Defer does not count:** Defer is a removal action ("skip to tomorrow"), not a grading. The card is gone from the session and should not appear as progress.

**Undo scope:** Undo only reverses Good/Hard/Easy grades (the `lastRatedRef` path). It cannot undo Defer or Suspend. Therefore `handledCount` can only be decremented via Undo, and `totalCards` is never restored — there is no undo for removals.

**Session-end effect:** The session ends when `qIdx >= queue.length`. At that moment the counter naturally reads `handledCount / totalCards`. If some cards were deferred/suspended without replacement, `totalCards < cards.length` and `handledCount == totalCards` (all remaining active cards were graded). If all cards were graded directly, both equal `cards.length`.

### Code locations

- `ReviewSession` component: `apps/web/app/(main)/review/page.tsx`
- `handledCount` and `totalCards` declared alongside `queue` and `qIdx` state
- Progress bar: `width: handledCount / Math.max(totalCards, 1) * 100 + '%'`
- Counter: `{handledCount} / {totalCards}`
