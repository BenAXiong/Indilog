# ILRDF v2 harvest — temp plan doc

Temp doc, revise freely. Tracks the multi-session ILRDF/Kilang dictionary-source work started 2026-07-19. Origin: checking Amis minimal pairs → dirty-entry audit → discovered `new-amis.moedict.tw`'s open v2 API → harvested ILRDF sentence data for Amis.

## Status / recommended sequence

Revised 2026-07-20: the not-found backlog isn't one task — the bounded 514 affix-recoverable words are the same shape of work as the slash-split extension (cheap, closes a gap that would otherwise make the eventual report stale), while the open-ended 2,728 unexplained words are genuinely low-priority. Split accordingly. The overlap-analysis report moves to dead last since it should reflect final settled state, not a moving target.

0. **Slash-split extension** — DONE. 5,812 composite (slash/paren-joined) words attempted across all 16 languages, 0 errors. Amis-specific result: coverage of embedded parts went **82.8% → 98.9%** (511 → 610 of 617 parts now resolved; only 7 remain genuinely uncaptured). Output: `scrap/analysis/ilrdf_v2_harvest/v2_entries_extra_parts.jsonl`.

   **DB built**: `scrap/analysis/ilrdf_v2_harvest/ilrdf_v2.db` (SQLite, `load_to_sqlite.py`, rebuild-from-scratch each run — cheap to refresh). Normalized schema: `words` → `dict_entries` → `descriptions` → `examples`. Final load: **22,764 words, 35,941 dict entries, 47,946 descriptions, 34,345 examples**. Sanity-checked against the live API ("ising" round-trips exactly). This is the "yet another db" for the harvested data — deliberately not reconciled with Kilang/corpus_vocabulary/Citadel yet (explicit call: not worth the time to fully think through interference right now).

1. **Fix `corpus_vocabulary`'s missing unique constraint, then refresh the full 292,983-row all-16-language word list** — DONE, but the diagnosis behind it was WRONG. Correction (2026-07-20): added `UNIQUE (glid, dialect_name, word_ab, source, num)` (migration `20260720010000_corpus_vocabulary_unique_constraint.sql`, verified 0 duplicates on that key both in Citadel's source and the live table before applying), then re-ran the full 292,983-row upsert via `scrap/analysis/ilrdf_v2_harvest/refresh_corpus_vocabulary.py`. **Result: zero rows changed.** Checked Citadel's own `ilrdf_vocabulary` SQLite directly — it *also* only has `source='族語線上辭典'` rows for one dialect per language (142,167 total, matching Supabase exactly, dialect-by-dialect). There was never an export bug — `corpus_vocabulary` was already a byte-for-byte accurate mirror of Citadel's data. What looked like "missing dialects from a broken export" is actually how ILRDF's own 族語線上辭典 glossary is scoped: one standard/reference dialect per language (Amis→Siuguluan, Atayal→Squliq, etc.); other dialects' vocab comes from 學習詞表 instead, a different source tag entirely. **The original Amis-specific staleness concern that kicked off this whole thread is real but not fixable this way** — ILRDF's glossary genuinely doesn't have Nanshi/Coastal/Malan/Hengchun-tagged 族語線上辭典 entries to backfill. The unique constraint itself is still a good schema improvement (protects against future duplicate-insert bugs) and stays applied. `docs/ilrdf-v2-source.md` needs a correction pass to remove the now-wrong "stale/incomplete" framing.

2. **Citadel/Indivore reconciliation** — DONE (2026-07-20). Ported the v2 harvester to `YCM_Citadel/core/ilrdf_v2_harvester.py` (validated against 6 known test cases before trusting it — all matched); hit a real perf bug on first run (serial `requests.get()` with no connection reuse — ~228 words in 15min, projected 17+ hours), fixed with `requests.Session()` + `ThreadPoolExecutor(max_workers=8)` + batched commits, brought it down to ~7-8/s (~32min actual run). Word list pulled directly from Citadel's own `ilrdf_vocabulary` (no separate word-list step needed — Citadel already has it). Data lands in `ycm_master.db`'s new `ilrdf_v2_words`/`ilrdf_v2_dict_entries`/`ilrdf_v2_descriptions`/`ilrdf_v2_examples` tables.

   **Final numbers**: 15,879 Amis words, 12,168 resolved (76.6%), 35,776 dict_entries, **34,581 example sentences**, 7,912 ILRDF-tagged entries. Sanity-checked against the live API ("ising" round-trips exactly, matching the original Node harvest). Small variance from the original Node numbers (34,345 → 34,581 examples) is expected live-data drift between the two harvest runs, not a bug.

   **Known gap**: the slash-split extension pass (`harvest_v2_slash_extra.mjs`, which took Amis embedded-part coverage from 82.8%→98.9%) hasn't been ported to Python yet — only the main harvester has. Low priority; fold into step 4's affix-recovery work later rather than a separate pass.

   Also updated: `brain/AMIS_MOE_DICT_SCOUT.md` (Version 2 API section, confirmed findings) + new `brain/ILRDF_V2_HARVEST_LOG.md`; fixed a real gap in Indivore's `docs/kilang-moe-api.md` (`dict_code` mapping was never documented at all — I'd originally mischaracterized this as a "stale claim" without checking the actual file first; corrected both the doc gap and my own error in this plan doc); `docs/ilrdf-v2-source.md` updated to point at the new Citadel-canonical locations; Indivore's own `scrap/analysis/ilrdf_v2_harvest/` marked superseded (not deleted, kept as session history) via a new `SUPERSEDED.md` pointer file.

3. **Wire up Indivore consumption** — DONE (2026-07-20). New `ilrdf_entries` table (migration `20260720020000_ilrdf_entries.sql`, mirrors `kilang_entries`' shape — `source_id` = `ilrdf_v2_dict_entries.id` for idempotent re-import), populated via `scrap/analysis/ilrdf_v2_harvest/import_to_supabase.py` (35,776 rows, one per word×dictionary, descriptions joined, examples flattened to the same `{ab,zh}` JSON shape `kilang_entries.examples_json` uses). New `apps/web/lib/corpus/ilrdf.ts` mirrors `kilang.ts`'s interface exactly (`ilrdfFetch`/`parseIlrdfExamples`/`ilrdfRowHasExamples`/`fetchIlrdfWordExamples`). Wired into both `api/dict/search/route.ts` and `api/dict/word-sentences/route.ts` (new `ytd` query param, own merge function, own gating — not folded into Kilang's search path, per the architecture note originally here). `WordRow['source']` extended to `'epark'|'moe'|'ilrdf'` in both `dict.ts` and `dict/page.tsx`; added a purple indicator dot matching the existing MoE-dot convention. `ytd` toggle flipped from `disabled:true` to enabled in `SettingsSheet.tsx` (not added to the default-enabled sources array — opt-in). `ytdEnabled` threaded through `dict/page.tsx` mirroring `moeEnabled`/`klokahEnabled` at every call site (`useWordExamples`, `ExactWordCard`, `MergedEntryCard`, `runSearch`, the debounce effect + its deps array, both render call sites).

   **Tested live**, not just typechecked: minted an auth session (`scripts/perf/mint-session.mjs`), drove the actual running dev server (found on port 3001, not 3000 — that's a different project) via Playwright. Searched "ising" with `ytd` enabled: Words count 90, Sentences count 138, confirmed both known ILRDF example sentences render with the correct dialect tag ("阿美語 · ILRDF") and exact expected text. Re-ran with `ytd` disabled: Sentences dropped to 67, ILRDF tag and both sentences gone — confirms the toggle actually gates the content both ways, not just additive-only. `npx tsc --noEmit` clean throughout.

   **Deliberately not done**: the ~296-word gap-fill from the old `corpus_vocabulary` Siuguluan set that v2 didn't resolve (see step 1's finding — 96.3% already covered under any dictionary tag). Small, mostly multi-word phrases; noted as a future addition, not blocking.

4. **Affix-recovery extension** — DONE (2026-07-20). Combined into one script, `YCM_Citadel/core/ilrdf_v2_extra_recovery.py`: Phase A (offline, no API calls — the stems were already resolved, just needed local prefix/suffix stripping + a DB join, then duplicating the stem's dict_entries under the inflected word's own row) recovered **564 words** (a bit above the original 514 estimate — live-data drift between harvest runs, same pattern as before, not a bug). Phase B (live API) folded in the still-unported slash-split "try all parts" enhancement — 186 previously-unseen embedded parts, **179 newly resolved** (96.2% hit rate — much higher than the original all-16-language slash-extra pass, because this one is correctly scoped to Amis-only composite words from the start). New totals: 16,065 words, 12,911 resolved (80.4%, up from 76.6%), 38,266 dict_entries, **36,873 example sentences** (up from 34,581). Re-ran `import_to_supabase.py` — Supabase `ilrdf_entries` now at 38,266 rows, confirmed live.

5. **Cross-source overlap analysis + HTML report** — DONE (2026-07-21). Built directly (not handed off) at `scrap/analysis/ilrdf_v2_harvest/cross_source_report.html`, self-contained, no external deps. Data queried fresh from Supabase post-step-4 (not from the stale `v2_entries.jsonl`/handoff-brief numbers below). Used the dataviz skill: horizontal bar charts per source (Kilang/ePark/ILRDF v2, one identity hue each — blue/orange/violet from the validated default palette, re-validated for this 3-slot subset in both light/dark), 3-segment overlap bars (only-in-A / shared / only-in-B) for the pairwise comparisons, known-issues stat tiles + table. Rendered and visually checked in both color schemes via Playwright screenshots (no label collisions, correct label-suppression on segments too narrow to hold text).

   **Overlap findings**: Kilang 蔡中涵 (s) vs ILRDF v2 蔡中涵大辭典 — 94.4% of v2's words confirmed in Kilang (v2's word list is bounded by glossary-api's ~16k-word vocabulary, so it only ever samples a slice of Kilang's full 42k-word dictionary — not a disagreement, a coverage-scope difference). Kilang 博利亞潘世光 (p) vs v2's combined 博利亞潘世光 — 51.2% agreement, lower but still substantial. ePark 族語線上辭典 vs v2's 原住民族語言線上辭典 — 88.0%/95.3% mutual coverage, the strongest cross-check in the report (both are direct scrapes of the same official ILRDF dictionary via different APIs).

6. **Deep morphology backlog** (the open-ended ~2,728 unexplained not-found words) — BACK BURNER, no deadline pressure, may never get picked up. Chasing it means re-implementing `amis-fuzzy.ts`'s fuzzy/affix-recovery logic against the harvest; uncertain yield.

---

## Task 2: Citadel ↔ Indivore reconciliation (proposal)

**MAJOR FINDING (2026-07-20)**: Citadel's `export/ycm_master.db` → `ilrdf_vocabulary` table **already has the complete, current, all-42-dialect word list — 292,983 rows**, matching this session's fresh re-harvest almost exactly (e.g. 秀姑巒阿美語 = 11,597 in both). `core/ilrdf_harvester.py` was already run to completion at some point (file dated Jun 1) for ALL 16 languages, not just Amis. **This session's `harvest_wordlist_all.mjs` step was entirely redundant** — it independently re-derived data Citadel already had. Silver lining: it's a genuine independent cross-validation that Citadel's data is accurate.

The actual gap is narrower than first thought: it's specifically in the **Citadel → Indivore Supabase export**. `core/supabase_distiller.py` (lines 310-330) reads ALL of `ilrdf_vocabulary` with no dialect filter and upserts into `corpus_vocabulary` — so the export script itself isn't scoped to Siuguluan-only. Most likely explanation: the distiller was run once, early, before the harvester had gotten past Siuguluan, and never re-run since.

**Landmine found before recommending "just re-run it"**: `supa_post()`'s upsert uses `Prefer: resolution=merge-duplicates` with **no explicit `on_conflict` column**, and `corpus_vocabulary`'s schema (migration `20260601180000_corpus_tables.sql`) has no unique constraint beyond its own random `id UUID`. Re-running `distill()` as-is would **insert 292,983 fresh-UUID duplicate rows**, not refresh/replace the stale 7,930. Needs either (a) a unique constraint added (e.g. on `(glid, dialect_name, word_ab, source, num)`) before re-running with an explicit `on_conflict=`, or (b) a scoped delete-then-reinsert, before this is safe to run against production. **Not attempted — this touches live Supabase, flagging for your decision rather than doing it.**

This is a separate, faster win from the v2 sentence-enrichment work — worth doing on its own regardless of the Python-port timeline, since it fixes word+gloss coverage for all 16 languages immediately once the conflict-key issue is resolved.


**The problem**: this session's new harvester scripts + ~60MB of raw JSONL output live in Indivore's `scrap/analysis/ilrdf_v2_harvest/` — which is gitignored. If left as-is, none of it survives beyond this local checkout: not the scripts, not the discovered API shape, not the cleaning-rule fixes (404-vs-error misclassification, apostrophe normalization, digit/slash/colon fallback), not the "v2 is Amis-only" finding. Meanwhile YCM_Citadel already has an established, git-tracked home for this exact kind of work: `core/ilrdf_harvester.py` (the original glossary-api word-list harvester this session's `harvest_wordlist_all.mjs` supersedes), `core/analyze_moe_kilang*.py` and friends, and `brain/AMIS_MOE_DICT_SCOUT.md` / `AMIS_MOE_DICT_INFILTRATION_LOG.md` (which already has a stub for "Version 2 API: new-amis.moedict.tw" — written before this session confirmed what that actually is).

**Correction (2026-07-20)**: originally claimed here that `docs/kilang-moe-api.md` "still carries the stale Wu Ming-yi claim" as proof the two repos had drifted. Checked the actual file — it never made that claim at all; `dict_code` was just left undocumented/unmapped. Asserted something as verified fact without checking it first. Fixed properly: added the correct `dict_code` mapping to `docs/kilang-moe-api.md` (s/p/m/old-s + the separate manually-added 吳明義 rows), sourced from `brain/AMIS_MOE_DICT_INFILTRATION_LOG.md`'s already-correct Manoel Fey identification.

**Proposed split** (matches the pattern `docs/kilang-moe-api.md` already uses for Kilang itself — "Original owning app: YCM_Citadel... that's the source of truth"):

- **Citadel (canonical, git-tracked)**:
  - Port `harvest_wordlist_all.mjs` + `harvest_v2.mjs` (+ the slash-extra pass) into `core/` — either as-is (Node) or ported to Python to match the existing `ilrdf_harvester.py` sibling's style. **Open question for you**: keep Node or port to Python?
  - Update `brain/AMIS_MOE_DICT_SCOUT.md`'s "Version 2 API" stub with everything confirmed this session: the `/api/v2/terms/{word}` shape, the 5 aggregated dictionaries, the Amis-only finding (1.3% hit rate on Atayal, 0% ILRDF-tagged for non-Amis), the cleaning rules and their yields.
  - New `brain/ILRDF_V2_HARVEST_LOG.md` (mirrors `AMIS_MOE_DICT_INFILTRATION_LOG.md`'s style) chronicling this harvest: 15,879 Amis words, 76.1% resolved, 10,331 ILRDF sentences collected, methodology, bugs caught.
  - Move the raw JSONL output (`wordlist_raw_all.jsonl`, `v2_entries.jsonl`, etc.) into `data/raw/` alongside the existing `amis-moedict` mirror.
  - Fix the Wu Ming-yi / Manoel Fey correction so it's consistent everywhere.

- **Indivore (thin pointer, consumption-specific)**:
  - New section in `docs/kilang-moe-api.md` or a new `docs/ilrdf-v2-source.md`: "canonical source/scripts live in YCM_Citadel at [path] — see [Citadel doc] for full methodology. Consumed in Indivore via `apps/web/lib/corpus/ilrdf.ts` (not yet built) → `ilrdf_entries` table (not yet created), gated `glid === '01'` (Amis only — confirmed empirically, see Citadel doc for the test)."
  - `plan-v+.md`'s already-logged copyright-verification deferred task gets its file paths updated if things move.
  - Nothing else — no raw data duplicated into Indivore.

**Not done yet** — this is a proposal. Cross-repo file moves + doc edits in a project you also own separately felt like something to lay out and confirm rather than just do. Say go and I'll execute it (or tell me to adjust the split first).

---

## Step 4: Affix-recovery extension (bounded part of the not-found backlog)

Do before step 5. Same shape of work as the slash-split extension: 514 of the Amis not-found words (15.9% of single-token not-found) are affix-strippable to a stem that *was* found (confirms v2 is stem-indexed, per its own `is_stem` field) — e.g. `adihayan` → stem `adihay` (found), `kakapah` → stem `kapah` (found, prefix `ka-`). Extend `harvest_v2_slash_extra.mjs`'s pattern (or its eventual Python port) to also retry these against the `MOE_COMMON_PREFIXES`/`MOE_COMMON_SUFFIXES` tables from `apps/web/lib/lang/amis-fuzzy.ts`.

---

## Step 5: Handoff brief — cross-source overlap analysis + HTML report (LAST)

**For a future session** (do not start now — this is last in the sequence, after steps 1-4). Goal: a self-contained HTML report (matching the existing `scrap/analysis/compare_languages.html` + `compare_languages.py` pattern — Python crunches data into a `.js` blob, HTML+client-JS renders it) giving a clear visual breakdown of every Amis dictionary source, their pairwise overlaps, and known data-quality issues.

**Sources to map** (post-reconciliation, so pull from wherever step 2 lands them):
- Kilang / `kilang_entries`: 4 sub-dictionaries by `dict_code` — `s` (蔡中涵, 57,627), `p` (博利亞潘世光, 6,085), `m` (Manoel Fey/French, 101), `old-s` (3), plus `吳明義阿美族語辭典` (8, separately added).
- ePark / `corpus_vocabulary` (glid='01'): all `source` values (九階教材, 學習詞表, 文化篇, 族語線上辭典 [[the OLD stale Siuguluan-only ILRDF import — 7,930 words, should be refreshed by step 1 before this report runs]], 每日讀報, 生活會話篇, 閱讀書寫篇).
- New ILRDF v2 harvest: `v2_entries.jsonl`'s per-dictionary breakdown (蔡中涵大辭典, 方敏英字典, 學習詞表×5 dialects, 吳明義阿美族語辭典, 博利亞潘世光×2, 原住民族語言線上辭典).

**Comparisons wanted**:
- Venn/overlap between Kilang's `s`/`p`/`m` and the new v2 harvest's `蔡中涵大辭典`/`博利亞潘世光`/`吳明義` (same underlying dictionaries, two different scrapes/vintages — how much do they actually agree?).
- Old (post-step-1-refresh) `corpus_vocabulary` ILRDF import vs new v2-harvested ILRDF — prior measurement (87.9% ILRDF-tag-specific, 96.3% found-under-any-tag, 296 truly missing) is already stale after the slash-extra pass, and will be stale again after step 1's refresh; re-measure against final state.
- Data-quality issues found so far (`scrap/analysis/dirty_entries_report.md`, `scrap/analysis/minimal_pairs_report.md`) — fold into the same report as a "known issues" panel rather than three disconnected documents.

**Output location**: `scrap/analysis/` in Indivore (gitignored, matches convention — this is investigation output, not app code).

**Do not start this until steps 1-4 are resolved** — the source data locations and multiple numbers used above will all still move.

---

## Step 6: Deep morphology backlog (back burner, reference only)

Three categories originally identified, from `v2_entries.jsonl`'s Amis `notFound` rows (3,772 total):
1. ~530 multi-word phrases — out of scope for single-term lookup by design, not fixable.
2. 514 (15.9% of single-token not-found) — affix-strippable to a stem that *was* found. **Moved to step 4 above, no longer back-burner.**
3. 2,728 — unexplained by simple prefix/suffix stripping; deeper morphology, reduplication, or genuine absence from all 5 source dictionaries. Chasing this further means re-implementing `amis-fuzzy.ts`'s fuzzy/affix-recovery logic against the harvest — not started, uncertain yield.
