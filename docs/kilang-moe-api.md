# Kilang / MoE shadow API reference

External, undocumented-upstream API that Indivore's dict search proxies for
Amis word data. Notes below are empirical (verified via direct `curl` against
the live endpoint and by reading a sibling project's working implementation)
since there's no public API doc to link to.

- **Endpoint:** `https://ycm-citadel.vercel.app/api/moe_shadow`
- **Consumed in Indivore at:** `apps/web/app/api/dict/search/route.ts` (`fetchMoeWords`, `parseMoeExamples`)
- **Amis-only** — Indivore only calls it when `glid === '01'`.
- **Owning app:** YCM_Citadel (`portal/app/api/moe_shadow/route.ts`, `portal/components/views/kilang/`) — that's where the actual server-side query logic and DB assets live; treat this doc as a consumer-side reference, not the source of truth for their implementation.

## Reference implementation to consult before changing anything here

The Grimoire browser extension (`族語魔書/Ext_族語魔書_PopupDict/background.js`,
documented in its own `dev/FEATURES.md`) is another consumer of this same
API and has already worked through most of the quirks below in a shipped,
production extension (v1.6.4 as of 2026-07). Read `background.js`'s
`fetchMoeInsights`, `fetchMoeZhInsights`, `makeMoeFallbackCandidates`,
`makeMoeAltSpellings`, `makeMoeGlottalRepairs`, and `makeMoeStrippedStates`
before reinventing fuzzy/recovery logic against this API — see
`Indivore/plan-dict-v2.md` (if it still exists) for how that maps onto
Indivore's own dict-search plan.

## Query parameters (observed)

| Param | Values | Notes |
|---|---|---|
| `keyword` | any string | Searched term. |
| `mode` | `moe` | Only mode Indivore uses. |
| `exact` | `true` \| `false` | See below — **not** a simple strict/loose toggle. |
| `aggregate` | `true` | Used by Grimoire's `fetchMoeLineageRows` to pull all entries sharing a root; not currently used by Indivore. |

### `exact=false`

Broad match — **matches against more than just `word_ab`**. Verified:
`keyword=make&exact=false` → 207 rows, of which only 114 actually contain
"make" in `word_ab`; the other 93 matched only because their English gloss
text (embedded in the `definition` field) contains "make" (e.g. `'amitir`'s
definition says "...makes he[r]..."). Treat `exact=false` as searching the
full record (word + gloss + examples), not just the headword.

### `exact=true`

Strict literal headword match only. Verified: `keyword=make&exact=true` → 0
rows (no Amis word is literally "make"). This is *not* a stricter version of
the same search — it's a completely different, much narrower match. Do not
assume `exact=${!fuzzy}` is a safe way to wire a local fuzzy toggle to this
param; it isn't (see Grimoire's approach above, which never uses `exact=false`
for AB-direction lookups at all — it retries `exact=true` against a generated
candidate list instead).

## Response shape (per row)

```
{
  word_ab: string        // headword; may contain "^" (see below) or "`"/"~" markup (examples only)
  definition: string      // gloss; English + Chinese often concatenated, e.g.
                          // "￹￺wine * intoxicating drink￻酒，酒精製品飲料"
  dialect_name: string    // observed as always "阿美語 (MOE)" — no sub-dialect granularity, unlike ePark
  dict_code: string
  stem?: string           // immediate parent form, when word_ab is a derived form
  ultimate_root?: string  // root of the derivation chain; equals word_ab itself for root entries
  examples_json?: string  // JSON-encoded string (not a real array) — array of { ab, zh, en }
}
```

### `word_ab` markup quirks

- **`^` prefix/infix**: appears to mark something about the entry's role in
  MoE's own data model (root/stem boundary marking, given `stem`/
  `ultimate_root` exist as separate fields) — **not** a phonemic symbol.
  Confirmed it is *not* an alternate spelling of the apostrophe/glottal
  stop: some strings contain both a real apostrophe *and* a `^` doing
  different jobs, e.g. `"kaka^ no mako to fa'inayan"`.
- **`` ` `` and `~` in `examples_json[].ab`** (not in `word_ab` itself): stress
  or word-boundary markup specific to their examples data, not part of the
  orthography. Indivore strips these (`cleanMoeAb` in `route.ts`) before
  display — e.g. `` `Fadisoso'~ `a~ `^epah~. `` → `Fadisoso' a ^epah.`.
- **`dialect_name`**: every row observed carries the generic
  `"阿美語 (MOE)"` (Indivore strips the `" (MOE)"` suffix via `stripAuthor`).
  There is no per-sub-dialect breakdown in this source, unlike ePark's
  `corpus_vocabulary`/`corpus_occurrences` which has real dialect granularity.
- **`examples_json`**: a *string* containing JSON, not a JSON array directly
  — must be `JSON.parse`'d. Can be absent/empty.

## Open question (not resolved — see plan-dict-v2.md)

Grimoire's fuzzy/alt-spelling recovery (`MOE_ALT_SWAPS = { u:'o', o:'u', l:'r', r:'l', f:'v', v:'f' }`)
is hand-curated for Amis specifically (Kilang is Amis-only). Indivore's dict
covers 16 languages — whether to port a curated-per-language approach, use a
generic language-agnostic fuzzy mechanism instead, or some hybrid, is an open
architectural decision, not yet made.
