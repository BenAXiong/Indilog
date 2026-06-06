---
status: superseded
superseded-by: DEC-SRS06
---

# `metadata jsonb` on `ind_flashcards` for extensible Card Templates

**Date:** 2026-05-30 · Superseded 2026-06-02 by DEC-SRS06

`metadata jsonb` was added to `ind_flashcards` so Card Templates that need fields beyond `front`/`back` could store them without schema migrations.

**Implemented metadata shapes (historical):**
- `default`: no metadata
- `sts`: `{ target_word: string; layout: 'word' | 'sentence' }`

**Superseded by DEC-SRS06:** both `card_type` and `metadata` columns were dropped from `ind_flashcards`. STS is now driven entirely by `ind_items.target_word` and the session mode system.
