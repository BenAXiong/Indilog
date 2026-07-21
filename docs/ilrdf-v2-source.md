# ILRDF v2 (new-amis.moedict.tw) dictionary reference

Not yet wired into the app — this documents a harvested, staged data source found and pulled 2026-07-19/20, ahead of building the `ilrdf_entries` table / `apps/web/lib/corpus/ilrdf.ts` / flipping the `ytd` toggle in `SettingsSheet.tsx`'s dict-source picker. See `plan-ilrdf-harvest.md` (repo root, temp doc) for live task status.

- **Canonical home: YCM_Citadel.** Harvester ported to `core/ilrdf_v2_harvester.py`, findings folded into `brain/AMIS_MOE_DICT_SCOUT.md` + `brain/ILRDF_V2_HARVEST_LOG.md`, data in `export/ycm_master.db`'s `ilrdf_v2_words`/`ilrdf_v2_dict_entries`/`ilrdf_v2_descriptions`/`ilrdf_v2_examples` tables — matching the Kilang precedent below. See `plan-ilrdf-harvest.md` for live status. Indivore's own copy (`scrap/analysis/ilrdf_v2_harvest/`, gitignored) is the original investigation working-notes — superseded by Citadel's copy, not deleted, kept as-is for the session history.
- **Will be consumed in Indivore at:** `apps/web/lib/corpus/ilrdf.ts` (not yet built) via a new `ilrdf_entries` Supabase table (not yet created), gated behind the `ytd` dict-source toggle in `SettingsSheet.tsx` (currently `disabled: true`).
- **Amis-only** — confirmed empirically, not assumed. Tested against a live Atayal batch: 1.3% hit rate, and even those hits were coincidental string collisions with Amis-specific dictionaries (蔡中涵/博利亞潘世光/吳明義), not real Atayal coverage. Zero ILRDF-tagged hits for non-Amis. The domain name (`new-amis.moedict.tw`) is honest about this in hindsight — it's an Amis aggregator, not a general 16-language one, despite an unconfirmed "Version 2 API" README claim that misled the initial scope decision.
- **API shape:** `GET new-amis.moedict.tw/api/v2/terms/{word}` → array of per-dictionary entries (`蔡中涵大辭典`, `方敏英字典`, `學習詞表－{dialect}` ×5 Amis dialects, `吳明義阿美族語辭典`, `博利亞潘世光阿漢/阿法字典`, `原住民族語言線上辭典`), each with `descriptions[]` → `examples[]` (`content_amis`/`content_zh`) and an `audio` URL. No bulk/index endpoint exists (`/api/v2/{dictionaries,languages,words,index}` all 404) — per-word lookup only, unauthenticated, no CAPTCHA encountered.
- **Licensing: unresolved, deferred.** See `plan-v+.md`'s pre-publicize blocker entry. Harvested for personal testing only.

## Why this exists alongside Kilang and the ILRDF word list in `corpus_vocabulary`

There are now three distinct ILRDF-adjacent things in play, easy to conflate:

1. **`kilang_entries`** — zero ILRDF content. 100% from the open-source `g0v/amis-moedict` repo (蔡中涵/博利亞潘世光/Manoel Fey — see `docs/kilang-moe-api.md`). Unrelated pipeline.
2. **`corpus_vocabulary` (`source='族語線上辭典'`)** — a real ILRDF scrape, but word+gloss only, via `YCM_Citadel/core/ilrdf_harvester.py` hitting `glossary-api.ilrdf.org.tw` (a lean, breadth-first, all-16-language glossary endpoint — different host, different API, different owning tool than #3). **Correction (2026-07-20)**: initially misdiagnosed as a stale/partial export (7,930 Amis rows, Siuguluan-only, looked like a broken sync). Verified directly against Citadel's own `ilrdf_vocabulary` SQLite table — it *also* only has 族語線上辭典-tagged rows for one dialect per language (142,167 total, matching Supabase exactly, dialect-by-dialect). Re-ran the full upsert with a proper unique constraint to be sure; zero rows changed. **This isn't a pipeline bug — it's how ILRDF's own 族語線上辭典 glossary is scoped**: one standard/reference dialect per language (Amis→Siuguluan, Atayal→Squliq, etc.), with other dialects' vocabulary covered by 學習詞表 (a different source tag) instead. Confirmed directly against the *official* site too — `e-dictionary.ilrdf.org.tw`'s own `filter-tribe-dialect` API (the endpoint that populates its dictionary's dialect selector) lists exactly one dialect per multi-dialect language across the board, not just Amis. And 學習詞表 itself isn't a substitute depth-wise: ~1,090 words per Amis dialect (vs. 7,930 for the real dictionary), zero sentences, known dirty-entry issues (see `scrap/analysis/dirty_entries_report.md`) — it's a small fixed pedagogical vocabulary list, not a dictionary. **There is no ILRDF-published word+sentence depth for any Amis dialect other than Siuguluan, anywhere** — official site or otherwise. Full writeup in `plan-ilrdf-harvest.md`.
3. **This doc's source** — a *different* ILRDF surface (re-served through `new-amis.moedict.tw`'s aggregator, not `glossary-api.ilrdf.org.tw` directly), with actual example sentences and multi-dictionary depth, but real coverage for Amis only.

## Breadth vs. depth — the numbers, scoped correctly

The natural instinct is to compare "292,983 (Citadel's glossary) vs. 34,345 (this harvest's sentences)" as if they're the same kind of count. They're not — different schemas, different scope, mostly non-overlapping content types. The only fair comparison is Amis-scoped:

| | Count | What it is |
|---|---|---|
| Citadel `ilrdf_vocabulary`, all 16 languages | 292,983 | `(word, gloss, dialect, source)` rows — a glossary. Zero sentences anywhere in this schema, for any language. |
| — of which, Amis rows | 24,745 | word×dialect×source rows |
| — of which, unique Amis word strings | 15,879 | dedup of the above |
| This harvest: Amis words successfully enriched | 12,127 | **77.9%** of Amis's unique words now have real dictionary content |
| — dict_entries (word × matched dictionary) | 35,941 | avg ~3 dictionaries per resolved word |
| — descriptions (definition senses) | 47,946 | |
| — **example sentences** | 34,345 | did not exist in Citadel's 292,983-row set, for any of the 16 languages |

So: Citadel's set is wide (all 16 languages) but has no depth (no sentences, ever). This harvest takes the Amis slice of that same word universe and gets ~78% of it to full-dictionary-with-sentences depth. The other 15 languages have no depth-enrichment path via this method — confirmed near-zero coverage — and would need a different source (the official `e-dictionary.ilrdf.org.tw`, Turnstile-gated, copyright-noticed — see `plan-v+.md`) to get equivalent treatment.
