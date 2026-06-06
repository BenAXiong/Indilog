---
status: accepted
---

# Reset SRS scope — what "reset a deck" erases

**Date:** 2026-05-31 · Implemented: `wipeReviewsAndReset()` in `flashcards.ts`, called from `resetCollectionSRS()` and `resetCapturesSRS()`

A deck reset erases SRS scheduling state + `ind_reviews` rows for those cards. `ind_daily_stats` is left alone.

| Layer | Table | Effect if wiped |
|---|---|---|
| SRS scheduling state | `ind_flashcards` cols (`ease_factor`, `interval_days`, `repetitions`, `due_at`) | Cards go back to "New" — re-study from scratch |
| Review history | `ind_reviews` rows (one per rating event) | Raw rating log gone; heatmap unchanged (reads `ind_daily_stats`) |
| Daily stats | `ind_daily_stats` rows (daily aggregate counts) | Heatmap goes blank, streak affected |

**Why:** The user's intent is "pretend I've never reviewed these cards." That means cards re-enter as New and the per-card rating log is gone. But `ind_daily_stats` tracks "did I show up and study today" — a motivational/habit record. That effort happened; resetting a deck shouldn't wipe the streak or heatmap. Subtracting exact per-deck counts from `ind_daily_stats` retroactively would also require non-trivial work for limited gain.

**Alternatives considered:**
- SRS state only: cards go back to New but history remains. Rejected: user wants a clean slate.
- Full wipe (SRS + reviews + daily stats): Rejected: destroys streak/heatmap which are motivational, and `ind_daily_stats` is shared across all decks so subtracting one deck's contribution is fragile.
- Confirmation tiers (soft reset vs. hard reset): over-engineered for the current use case.
