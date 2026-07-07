---
status: accepted
---

# Review modes — 4-mode system; drop card_type + metadata

`card_type` and `metadata` dropped from `ind_flashcards`; review presentation is fully determined by session mode + `ind_items.target_word`.

**Date:** 2026-06-02

**Context:** DEC-SRS05 noted `card_type='sts'` should "long-term move to ind_items as a note property." `ind_items.target_word` already exists and is the authoritative source. `ind_flashcards.card_type` and `metadata.target_word` are derived duplicates with no independent value.

**Decision 1 — Drop `card_type` and `metadata` from `ind_flashcards`:**
- `card_type ('default'|'sts')` = just `target_word IS NOT NULL` — no independent meaning
- `metadata ({ target_word, layout })` = duplicates `ind_items.target_word`; `layout` superseded by mode system
- Both columns dropped from schema; code reads `ind_items.target_word` directly (already in the join)

**Decision 2 — 4 session modes** stored in localStorage as `srs_review_mode`:

> **Amended by DEC-SRS13 (2026-07-08):** every mode now surfaces audio when present (forward/reverse on the reveal, sts on the prompt, all autoplay) and fallbacks chain through the zh check. The table below is the original decision.

| Mode | Front | Back | Fallback |
|------|-------|------|----------|
| `forward` | `ab` | `zh` | — (always works) |
| `reverse` | `zh` | `ab` | → `forward` (no zh) |
| `audio` | audio player | `ab` + `zh` | → `reverse` (no audio) |
| `sts` | `ab` with `target_word` highlighted | `zh` | → `reverse` (no target_word) |

**Decision 3 — STS rendering:** always sentence layout — full `ab` with `target_word` highlighted. Word-only layout dropped. Works for both single-word notes and sentence notes.

**Decision 4 — Extensibility:** new variants are new string values + render cases. No schema changes needed — all data lives in `ind_items`.

**Decision 5 — UI surface:** mode selector in dashboard review options (persistent preference) + OptionsSheet (per-session override, does not overwrite preference).

**Decision 6 — `ind_reviews.mode`:** records the *resolved* mode after fallback, not the raw preference.

**Decision 7 — Dict saves:** saving a word from dict search auto-sets `target_word = word_ab`.
