---
status: accepted
---

# DB homogenisation — add structural metadata to occurrences

Add `unit` (int), `lesson` (text), `role` (text) columns to `corpus_occurrences`. Populate during scraping.

**Date:** 2026-06-01

**Context:** `twelve`/`nine_year`/`grmpts` store structural metadata in `occurrences.level` + `occurrences.category` and can be navigated by direct DB query. Essays, dialogues, and con_practice carried no structural metadata — navigation relied on `corpus_geometry.json` as an external routing file. This was heterogeneous.

| Column | Essay | Dialogue | Con-practice | Twelve/Grmpts |
|--------|-------|----------|--------------|---------------|
| `unit` | 0–11 (unit index) | 0–11 | 0–29 (lesson index) | grade level |
| `lesson` | L1–L12 | L1–L12 | L1–L30 | lesson number |
| `role` | 學習一/學習二/原版/詞彙/練習 | 對話一/二/三 | dialogue/word | null |

After migration, `corpus_geometry.json` is reduced to a lightweight nav index (titles, ordering) rather than a routing table.

**Sequence:** Combined with Supabase migration (DEC-M3-03) so the schema landed once in Postgres rather than being migrated twice.
