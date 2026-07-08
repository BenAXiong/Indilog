---
id: DEC-SRS15
title: Review/learn language exclusion filters must read from ind_profiles, not localStorage
status: implemented — pending manual verification
date: 2026-07-08
---

## Context

`show_all_langs`/`excluded_langs` are persistent preferences (`ind_profiles.preferences`, synced via
`patchPreferences()` per DEC-SRS08 Decision 4). Despite that, the query-building code on `/review`,
`/learn`, and `/study` read these two fields straight from `localStorage` (`srs_show_all_langs`,
`srs_excluded_langs`) instead of the DB — a leftover from before the cloud-sync rule was adopted.

Each page's context loader (`loadSessionContext`, `loadLearnContext`, `/study`'s mount effect)
already fetched `ind_profiles.preferences` for other fields (`review_target`, `learn_target`) and
discarded the lang-exclusion fields sitting in the same row. Worse, in `review/page.tsx`,
`getExcludeLangs()` read `localStorage` *synchronously*, before any `await`, inside the same
`Promise.all` that was concurrently fetching the fresh DB value — so even on a page that does fetch
current prefs, the query itself never saw them.

Net effect: a device/tab that hasn't opened `SettingsSheet` this session (the only place that
rehydrates `localStorage` from the DB) builds review/learn/due-count queries from stale or default
`localStorage`, silently ignoring a language exclusion set on another device or in a previous
session. Found while auditing why a review session's pending count didn't match expectations
(investigation started from a user question about filtered due-counts, 2026-07-08).

## Decision

`ind_profiles.preferences` is authoritative for `show_all_langs`/`excluded_langs` at query-build
time, everywhere. `localStorage` remains a cache for synchronous UI reads (toggle initial paint)
but is never trusted for the query itself.

- `fetchReviewPrefsSnapshot(userId)` (new, `lib/db/profile/preferences.ts`) is the single read of
  `ind_profiles` (`preferences` + `include_in_review`), merged with `DEFAULT_PREFERENCES`. Writes
  `srs_show_all_langs`/`srs_excluded_langs` to `localStorage` as a side effect so other components'
  synchronous reads see the fresh value on next read.
- `getExcludeFromReview()` (`lib/db/srs/flashcards.ts`) now returns `{ collections, captures,
  showAllLangs, excludedLangs, prefs }` — sourced from one shared fetch (`ind_learn_collections` +
  `fetchReviewPrefsSnapshot`, in parallel) instead of two separate `ind_profiles` reads.
- `review/page.tsx`'s `reload()` fetches `getExcludeFromReview()` **once** and shares the same
  promise with `loadSessionContext()` — one `ind_profiles` round trip per landing instead of up to
  three (previously: `loadSessionContext`'s own preferences read, `getExcludeFromReview`'s own
  `include_in_review` read, and the discarded lang fields never even used for the query).
  `loadSessionContext` also now reads `review_target`/`review_more_size` off this same snapshot
  instead of a redundant dedicated query.
- `ReviewSession`/`LearnSession` initialize their options-sheet `showAllLangs`/`excludedLangs`
  state from the already-fetched `ctx` prop, not a second `localStorage` read on mount.
- `getExcludeLangs()` (review page) is deleted; `handleReviewMore` and `/study`'s
  `refreshDue`/`handleIncludeToggled` now source from the fetched result or from React state that
  the mount effect keeps in sync, not `localStorage`.

Custom review sessions (`?custom=1`) are unaffected — they bypass exclusion filters entirely via
their own `includeLangs`/`includeCollectionId` params, as before.

## Rationale

- Matches DEC-SRS08 Decision 1/4: the DB is the source of truth, `localStorage` is sync cache only.
- The dedup is a byproduct, not the goal, but is a straightforward win: fewer redundant
  `ind_profiles` round trips on the perf-sensitive review-landing path (DEC-ARCH04). No sequential
  serialization was introduced — the shared fetch still runs in parallel with the other landing
  queries in each page's `Promise.all`.

## Code locations

- `apps/web/lib/db/profile/preferences.ts` — `fetchReviewPrefsSnapshot`, `ReviewPrefsSnapshot`
- `apps/web/lib/db/srs/flashcards.ts` — `getExcludeFromReview`, `ReviewExclusions`
- `apps/web/app/(main)/review/page.tsx` — `loadSessionContext`, `reload()`, `handleReviewMore`,
  `ReviewSession` local state init
- `apps/web/app/(main)/learn/page.tsx` — `loadLearnContext`, `reload()`, `LearnSession` local state
  init
- `apps/web/app/(main)/study/page.tsx` — mount effect, `refreshDue`, `handleIncludeToggled`

## Verification status

**Implemented, not yet manually tested in a browser.** `npx tsc --noEmit -p apps/web` passes; there
is no automated test suite in this project (`package.json` has no test runner), so correctness here
depends on manual verification. Pending checklist, to run before this is considered done:

1. Set a language exclusion via Settings, then clear `localStorage` (`srs_show_all_langs`,
   `srs_excluded_langs`) to simulate a fresh device/tab. Confirm `/review`, `/learn`, and `/study`
   all still respect the exclusion on first load (this is the actual bug — the case that used to
   silently fail).
2. With the same cleared-localStorage state, open each session's options sheet and confirm the
   language-filter toggle reflects the DB state, not a reset-to-default display.
3. DevTools Network tab: confirm `ind_profiles` is queried once per page landing, not two or three
   times.
4. Regression: toggling a language exclusion mid-session (same-tab, normal flow) still reloads the
   queue correctly.
5. Regression: custom sessions and "Review more" still work with an exclusion active.
6. Turn "Show all languages" back on and confirm the no-exclusion default case is unaffected.

If any of these fail, this ADR's status should move to a revert or a follow-up fix, not silently
diverge from what's described above.
