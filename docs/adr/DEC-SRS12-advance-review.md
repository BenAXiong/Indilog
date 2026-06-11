---
id: DEC-SRS12
title: Advance review — session mode for cards returning before next reset
status: accepted
date: 2026-06-11
---

## Context

After a review session, some reviewed cards will be scheduled to return before the next daily reset (e.g. cards reviewed just after reset that are due again that afternoon). The review end screen shows this count. We want to give the user a way to do those reviews proactively, without waiting.

## Decision

A new `advance=1` URL param activates **advance review mode** on `/review`.

### Card selection

`listDueFlashcards` gains an `advanceUntil?: string` option (ISO timestamp). When set:

- **due_at window**: `now < due_at <= advanceUntil` — cards not yet due but due before the next reset boundary
- **Repetitions floor**: `repetitions >= 2` instead of the normal `>= 1`

New/`repetitions === 1` cards are excluded because they just graduated from the learn session at a 12-hour interval. They haven't had a second review yet and reviewing them before their scheduled time provides minimal reinforcement value compared to Planted-or-above cards, which have an established interval.

The `advanceUntil` ceiling uses the same next-reset computation as the rest of the app: advance to the next occurrence of `resetHour:00` in local time (default 4am, user-editable in `ind_profiles.preferences.reset_hour`, mirrored in `localStorage.srs_reset_hour`).

### Session cap

Advance mode uses `c.length` as the session cap (same as custom sessions) — the user opted in to review all z cards, so no daily-cap truncation applies.

### Entry point

The review end screen shows a CTA "Review z in advance?" (amber styling) when `sessionReturning.plantedOrAbove > 0`. It links to `/review?start=1&advance=1`.

## Rationale

- Keeping it as a URL-param mode means no new routes, no schema changes, and full reuse of the existing review session and scheduling logic.
- Scoping to Planted-or-above avoids undermining the learn→planted ramp-up for newly graduated cards.
- Tying the ceiling to `nextReset` (not rolling 24h) is consistent with `dueTomorrow` and `countSessionReturning` elsewhere in the app.

## Code locations

- `apps/web/lib/db/srs/flashcards.ts` — `ListDueOpts.advanceUntil`, `buildQ` branching
- `apps/web/app/(main)/review/page.tsx` — `isAdvance` param, `advanceUntil` wiring in `reload()`, CTA in `ReviewEnd`
