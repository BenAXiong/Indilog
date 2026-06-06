---
status: accepted
superseded-by: DEC-SRS06 (card_type/metadata/layout decisions replaced)
---

# Note-centric SRS architecture — intervals on notes, modes as session settings

**Date:** 2026-05-31 · Updated 2026-06-01 (mode logging) · Updated 2026-06-02 (card_type/metadata superseded by DEC-SRS06)

**Vision:** SRS metrics belong on `ind_items` (the note), not on a pre-made card. Review "cards" are generated on the fly per session — the note is the unit of knowledge, the session mode is just the presentation lens. This means:
- One note → one schedule (shared interval across all modes)
- Session picks the review mode at runtime (audio, forward, reverse, STS)
- No pre-made `ind_flashcards` rows needed for scheduling

**Why note-centric avoids the duplicates problem:** A card-centric multi-mode model (one `ind_flashcards` row per note per mode) would surface duplicate rows for the same word in the browser and complicate note-level editing — the user has one mental model of a word, not one per review mode. Note-centric keeps the browser genuinely one-row-per-note while mode is invisible infrastructure.

**On the unified-interval tradeoff:** A single interval can't distinguish "this word is easy in audio but hard in forward mode." This is accepted — for vocabulary acquisition, word knowledge is the goal, not mode-specific mastery. However, we want to *observe* whether mode-specific difficulty is real before making a scheduling commitment.

**Hybrid approach (implemented 2026-06-01):** Instrument now, decide later.
- `ind_reviews.mode` (text, nullable) logs the session mode on every review event: `'forward'` | `'audio'` | `'sts'` (future: `'reverse'`, `'production'`).
- Legacy rows have `mode = null`.
- Scheduling remains single-interval per note — unchanged.
- Once enough production data exists, `ind_reviews` can answer: "after N days of forward reviews, does switching to audio cause retention to drop?" If yes, per-mode intervals become justified.

**On card/session mode taxonomy (superseded by DEC-SRS06):**
- Audio, forward, reverse are session modes — no per-note storage, set at session level.
- `card_type` and `metadata` dropped from `ind_flashcards` — see DEC-SRS06.

**Current state:** `ind_flashcards` exists and works. Migration to note-centric SRS (moving scheduling columns to `ind_items`, repurposing `ind_flashcards`) requires a dedicated milestone. Deferred — instrument `ind_reviews.mode` now, revisit per-mode scheduling once retention-transfer data exists.
