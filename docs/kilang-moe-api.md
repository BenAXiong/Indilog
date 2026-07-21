# Kilang / MoE dictionary reference

Amis word data, ported (2026-07-16) from YCM_Citadel's `amis_moe_test.db`
SQLite export into Indivore's own Supabase — `kilang_entries` (flat word
list, from `moe_entries`) and `kilang_hierarchy` (derivation tree, from
`moe_hierarchy_moe`; `moe_hierarchy_plus`/`moe_hierarchy_star` are unused
duplicates of the same word_ab/parent_word/ultimate_root/depth columns and
were not ported). Indivore no longer calls the external
`ycm-citadel.vercel.app/api/moe_shadow` proxy at request time — the notes
below (response shape, `word_ab` markup quirks) describe the source data and
are still accurate for the ported copy; the "query parameters" section
describes the now-retired live endpoint, kept for historical/re-import
reference.

- **Ported into:** `kilang_entries` / `kilang_hierarchy` tables, migration `supabase/migrations/20260716010000_kilang_tables.sql`
- **Consumed in Indivore at:** `apps/web/lib/corpus/kilang.ts` (`kilangFetch`, `parseMoeExamples`) via `apps/web/app/api/dict/search/route.ts` (`fetchMoeWords`)
- **Amis-only** — Indivore only calls it when `glid === '01'`.
- **Original owning app:** YCM_Citadel (`portal/app/api/moe_shadow/route.ts`, `portal/components/views/kilang/`, DB at `portal/amis_moe_test.db`) — that's the source of truth for the underlying data and where a refreshed export would come from.

## Re-import path (refreshing the data)

1. Get a current `amis_moe_test.db` from YCM_Citadel (`portal/amis_moe_test.db`, or wherever it's fetched from — see that repo's build script / `portal/lib/db.ts`'s `getMoeDb`).
2. Confirm the schema hasn't changed: `moe_entries` (`id, dict_code, word_ab, definition, examples_json, dialect_name, glid, stem`) and `moe_hierarchy_moe` (`word_ab, parent_word, ultimate_root, depth, sort_path, sources`) — if columns were added/renamed, update `scripts/import-kilang.mjs` and the migration to match.
3. Install `better-sqlite3` **transiently** (it is deliberately not a persisted dependency — DEC-M3-03): `pnpm add -w -D better-sqlite3`.
4. Run `node scripts/import-kilang.mjs [path/to/amis_moe_test.db]` — needs `scripts/perf/.api-keys.json` (see `scripts/perf/mint-session.mjs`'s header for how to fetch it). Upserts by `source_id` (entries) / `word_ab` (hierarchy), so re-running is idempotent and safe for a refresh — it will not create duplicates, but also won't remove rows deleted upstream.
5. Remove the transient dependency: `pnpm remove -w better-sqlite3`. Confirm `git status` shows `package.json`/`pnpm-lock.yaml` unchanged.

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

## Query parameters (observed) — the retired live endpoint

Grimoire still calls the live `ycm-citadel.vercel.app/api/moe_shadow`
endpoint directly, so this section remains accurate for that consumer.
Indivore itself no longer sends these params anywhere — `kilangFetch` in
`apps/web/lib/corpus/kilang.ts` queries `kilang_entries` in Supabase instead,
replicating the same `exact=true`/`exact=false` semantics locally.

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
  dict_code: string       // s: 蔡中涵大辭典 (Safolu, 57,627 entries) · p: 博利亞潘世光阿漢/阿法字典 (Poinsot, 6,085)
                          // · m: Manoel Fey (French, 101) — NOT Wu Ming-yi, an earlier YCM_Citadel session
                          // misidentified this; corrected in brain/AMIS_MOE_DICT_INFILTRATION_LOG.md 2026-05.
                          // · old-s: 3, older Safolu snapshot · separately: 吳明義阿美族語辭典 (8 rows, added
                          // manually, not part of the s/p/m/old-s bulk import) — confirmed via exact row-count
                          // match against Citadel's brain/AMIS_MOE_DICT_INFILTRATION_LOG.md, 2026-07-20.
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
