---
status: accepted
---

# Kilang AB-direction fuzzy matching — tiered contains/similar/alt-spelling

Dict tab v2 Phase 2 (`plan-dict-v2.md`): fixes `fetchMoeWords` hardcoding
`exact=false` regardless of the local `fuzzy` toggle — Kilang's `exact=false`
also matches gloss/definition text, not just the headword (`keyword=make`
returned 207 rows, only 114 with "make" actually in `word_ab`).

**Date:** 2026-07-11

## Decisions

1. **Scope: Kilang/Amis only.** ePark's identical root-contamination problem
   (Phase 3, `sicepo'ay` for query `icep`) is not addressed here — left open,
   to be decided separately (possibly the cheaper ilike-filter, not this
   mechanism). No generic fallback was built for the other 15 languages.

2. **Single fetch, tiered local classification** — not two-mode
   exact-then-refetch like Grimoire. One `exact=false` call per AB-direction
   search; results are locally tagged and filtered:
   - `exact`: `word_ab` literally equals the query (unchanged from before).
   - `contains`: `word_ab` contains the query as a substring. Drops the
     gloss-only false positives — this is the fuzzy-OFF behavior.
   - `similar` (fuzzy ON only): `word_ab` within Levenshtein distance ≤1
     (queries ≤5 chars) or ≤2 (longer) of the query, even without substring
     overlap. Scored against the *same already-fetched pool* — zero
     additional upstream requests.
   - `altSpelling` (fuzzy ON only, and only when the above tiers return
     nothing at all): curated candidate generation ported from Grimoire
     (`族語魔書/Ext_族語魔書_PopupDict/background.js`) — alt-spelling swaps,
     glottal-stop repairs, prefix/suffix stripping — each retried against
     Kilang's `exact=true`, capped at 30 candidates. Fallback-triggers-on-
     empty (not "always run") keeps upstream request volume bounded against
     an undocumented external API (see `docs/kilang-moe-api.md`).

3. **Swap groups**: `u/o` and `l/r` stay 2-way pairs; `b/f/v` is a 3-way
   interchangeable group (Grimoire only had `f/v`) — `makeMoeAltSpellings`
   was generalized from a binary per-position toggle to a per-position
   choice set to support the 3-way group.

4. **Schwa/e-insertion** (`demak` vs `dmak`) is not handled by any tier —
   left as a known open gap, per the plan's own framing. No heuristic
   attempted.

5. **ZH/EN direction unchanged** — Kilang's broad match against Chinese/
   English glosses is the intended behavior there (matches Grimoire's
   `fetchMoeZhInsights` split); no filtering or tagging applied.

6. **Tagging**: each Kilang `WordRow` carries `moeMatch?: 'contains' |
   'similar' | 'altSpelling'`, surfaced as a small badge in the dict UI
   (`similar`/`altSpelling` only — `contains` needs no badge, it's the
   expected default). Purpose: let us see which mechanism is actually
   pulling weight in practice, not a permanent user-facing design element.

**Verified** via direct API calls against the live Kilang endpoint and in the
running dict tab: `keyword=make` fuzzy-off now returns 77 real `word_ab`
matches (zero gloss-only noise); a fabricated typo (`makebo'`, a b→f swap of
the real word `makefo'`) returns nothing fuzzy-off and correctly recovers
`makefo'`/`kefo'` tagged `altSpelling` fuzzy-on.
