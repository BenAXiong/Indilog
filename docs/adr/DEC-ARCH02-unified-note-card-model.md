---
status: accepted
---

# Unified Note/Card model — final decisions

Canonical reference: `architecture.md`.

**Date:** 2026-05-30

1. **`ind_items` is the universal Note table.** `ind_learn_cards` is deprecated and merged into `ind_items` (T-UNIFY migration complete). All notes — captured, collection, dict, curriculum — live in `ind_items` distinguished by `note_source`.

2. **`front`/`back` are banned from the data model.** They are view-layer concepts computed at render time from `note.ab` + `note.zh` + session mode. Never re-add them to `ind_items` or `ind_flashcards`.

3. **Note fields:** `ab` (target-language text), `zh` (translation/definition), `notes` (personal annotation), `audio` (null | URL | storage path). Renamed from legacy `text`, `meaning`, `audio_url`.

4. **One Card per Note.** `forward`/`reverse`/`audio` are session modes (localStorage), not stored card rows. `generateReverseCardsForCollection()` is deleted.

5. **`card_type` and `metadata` dropped** per DEC-SRS06 (2026-06-02). STS is now a session mode driven by `ind_items.target_word`.

6. **`audio` field:** Accepts null, full URL, or Supabase Storage path. Resolved at render via `cardAudio()` which checks `card.audio` → `note.audio` in priority order.

7. **`note_source` values:** `captured | collection | dict | curriculum | import | text | video | podcast`. Future values (`text`, `video`, `podcast`) reserved. `import` added DEC-M7-01.

8. **`ensureFlashcards()`** is the single Card generation function. No separate `generateFlashcardsFromCollection()`. Called on Study mount and immediately after collection import.
