---
status: accepted
---

# Capture without a dict entry — scope, item type, language passthrough

Dict tab v2 Phase 1 (`plan-dict-v2.md`): let users capture the searched text
directly when the Words tab has no matches, instead of forcing a trip to
Capture with the word retyped.

**Date:** 2026-07-11

## Decisions

1. **Scope:** the "Capture this word" affordance appears only in the true
   no-results state (`words.length === 0`), not always-available alongside
   real results. Simplest version first; revisit if "none of these are good
   enough" turns out to be a common case worth its own affordance.

2. **Item type:** items created via this flow are saved as `type: 'word'`.
   This is a deliberate departure from the existing "Add context" flow
   (dict word cards → Capture), which has always hardcoded new items to
   `type: 'sentence'` regardless of source — that existing quirk is left
   alone. The word/sentence type distinction on `ind_items` is expected to
   be erased in a future schema pass, so this isn't being over-engineered
   with a type picker or similar.

3. **Language/dialect passthrough:** the capture form is prefilled from the
   dict tab's active search filter (`glid` → indivore language code,
   `dialectFilter` → dialect name) via URL params, rather than falling back
   to the user's profile language/dialect like the existing "Add context"
   links do. Avoids a mismatch when the user is dict-searching in a
   language that differs from their profile default.

**Trade-off:** the existing "Add context" buttons (word/sentence results)
still don't pass language/dialect and still hardcode `type: 'sentence'` —
inconsistent with this new flow, but out of scope for Phase 1; not being
retrofitted here.
