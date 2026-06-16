# Corpus Contamination Report — Amis Dialect Scraping Errors

**Date detected:** 2026-06-16  
**Detected by:** Cross-dialect sentence deduplication (`corpus_dupe_check.py`)  
**Status:** All fixed (see below)

---

## Overview

A systematic scraping bug in the YCM Citadel agent caused sentences from non-Amis dialects to be appended as tail content into all 5 Amis dialect corpora under `source = 'twelve'`. Each Amis dialect received contamination from a different set of non-Amis dialects, suggesting the scraper used a per-dialect fallback URL that was incorrectly mapped for each one. The contaminated sentences occupied positions immediately after the genuine Amis content (tail-append pattern), consistent with a pagination fault on the last page of a re-scrape run.

The bug was NOT detectable via `sentence_id` join (standard dedup). The Malan Amis contamination used newly-created `corpus_sentences` rows (wrong GLID), while the other four dialects reused the authentic non-Amis sentence rows directly (no orphaned sentences were created for those four). Detection required text-based dedup via the `ab` column.

**Total occurrences deleted: 510**  
**Orphaned `corpus_sentences` rows deleted: 66** (Malan Amis only)

---

## Per-Dialect Summary

| Amis dialect | Contaminating dialect(s) | Occurrences deleted | Sentences deleted | Lessons affected | Fixed |
|---|---|---|---|---|---|
| 馬蘭阿美語 | 建和卑南語 | 66 | 66 (orphaned) | 23 | 2026-06-16 |
| 南勢阿美語 | 西群卑南語, 北排灣語 | 91 | 0 (shared rows) | 33 | 2026-06-16 |
| 秀姑巒阿美語 | 知本卑南語, 東排灣語 | 92 | 0 (shared rows) | 38 | 2026-06-16 |
| 海岸阿美語 | 南王卑南語, 中排灣語, 東排灣語 | 107 | 0 (shared rows) | 48 | 2026-06-16 |
| 恆春阿美語 | 郡群布農語, 東魯凱語, 南排灣語 | 154 | 0 (shared rows) | 36 | 2026-06-16 |

---

## 馬蘭阿美語 — Lesson Breakdown (23 lessons)

| Lesson | Removed |
|---|---|
| Level 1 Lesson 1 | 1 |
| Level 5 Lesson 2 | 1 |
| Level 6 Lesson 7 | 1 |
| Level 10 Lesson 1 | 2 |
| Level 10 Lesson 2 | 2 |
| Level 10 Lesson 4 | 1 |
| Level 10 Lesson 6 | 1 |
| Level 10 Lesson 7 | 5 |
| Level 10 Lesson 8 | 10 |
| Level 11 Lesson 1 | 3 |
| Level 11 Lesson 3 | 1 |
| Level 11 Lesson 4 | 4 |
| Level 11 Lesson 5 | 2 |
| Level 11 Lesson 7 | 2 |
| Level 11 Lesson 9 | 1 |
| Level 12 Lesson 1 | 2 |
| Level 12 Lesson 2 | 3 |
| Level 12 Lesson 3 | 4 |
| Level 12 Lesson 4 | 4 |
| Level 12 Lesson 5 | 4 |
| Level 12 Lesson 6 | 5 |
| Level 12 Lesson 8 | 4 |
| Level 12 Lesson 10 | 3 |
| **Total** | **66** |

## 南勢阿美語 — Lesson Breakdown (33 lessons, 91 removed)

Contaminating: 西群卑南語, 北排灣語

| Lesson | Removed | Lesson | Removed |
|---|---|---|---|
| Level 1 Lesson 1 | 1 | Level 11 Lesson 5 | 1 |
| Level 2 Lesson 3 | 1 | Level 11 Lesson 6 | 7 |
| Level 2 Lesson 4 | 1 | Level 11 Lesson 7 | 1 |
| Level 2 Lesson 7 | 1 | Level 11 Lesson 8 | 3 |
| Level 2 Lesson 8 | 1 | Level 11 Lesson 9 | 3 |
| Level 3 Lesson 10 | 1 | Level 11 Lesson 10 | 2 |
| Level 6 Lesson 1 | 2 | Level 12 Lesson 1 | 2 |
| Level 6 Lesson 5 | 1 | Level 12 Lesson 3 | 4 |
| Level 6 Lesson 7 | 1 | Level 12 Lesson 4 | 3 |
| Level 8 Lesson 3 | 1 | Level 12 Lesson 6 | 9 |
| Level 8 Lesson 4 | 1 | Level 12 Lesson 7 | 12 |
| Level 9 Lesson 5 | 1 | Level 12 Lesson 8 | 4 |
| Level 9 Lesson 10 | 1 | Level 12 Lesson 10 | 1 |
| Level 10 Lesson 3 | 2 | Level 11 Lesson 1 | 2 |
| Level 10 Lesson 5 | 1 | Level 11 Lesson 2 | 1 |
| Level 10 Lesson 7 | 1 | Level 11 Lesson 4 | 5 |
| Level 10 Lesson 8 | 13 | | |

## 秀姑巒阿美語 — Lesson Breakdown (38 lessons, 92 removed)

Contaminating: 知本卑南語, 東排灣語

| Lesson | Removed | Lesson | Removed |
|---|---|---|---|
| Level 1 Lesson 1 | 1 | Level 11 Lesson 4 | 4 |
| Level 2 Lesson 10 | 1 | Level 11 Lesson 5 | 2 |
| Level 3 Lesson 3 | 1 | Level 11 Lesson 6 | 2 |
| Level 3 Lesson 4 | 1 | Level 11 Lesson 7 | 2 |
| Level 6 Lesson 1 | 1 | Level 11 Lesson 8 | 6 |
| Level 6 Lesson 6 | 1 | Level 11 Lesson 9 | 3 |
| Level 6 Lesson 7 | 1 | Level 11 Lesson 10 | 13 |
| Level 6 Lesson 10 | 1 | Level 12 Lesson 1 | 1 |
| Level 7 Lesson 5 | 1 | Level 12 Lesson 2 | 2 |
| Level 8 Lesson 3 | 1 | Level 12 Lesson 3 | 1 |
| Level 8 Lesson 4 | 1 | Level 12 Lesson 4 | 1 |
| Level 8 Lesson 7 | 1 | Level 12 Lesson 5 | 2 |
| Level 10 Lesson 1 | 1 | Level 12 Lesson 7 | 10 |
| Level 10 Lesson 2 | 3 | Level 12 Lesson 8 | 4 |
| Level 10 Lesson 3 | 6 | Level 12 Lesson 9 | 2 |
| Level 10 Lesson 5 | 4 | Level 12 Lesson 10 | 3 |
| Level 10 Lesson 6 | 1 | Level 11 Lesson 1 | 3 |
| Level 10 Lesson 8 | 1 | Level 11 Lesson 3 | 1 |
| Level 10 Lesson 9 | 1 | Level 10 Lesson 10 | 1 |

## 海岸阿美語 — Lesson Breakdown (48 lessons, 107 removed)

Contaminating: 南王卑南語, 中排灣語, 東排灣語

| Lesson | Removed | Lesson | Removed |
|---|---|---|---|
| Level 1 Lesson 1 | 3 | Level 10 Lesson 9 | 1 |
| Level 1 Lesson 3 | 1 | Level 11 Lesson 1 | 5 |
| Level 1 Lesson 6 | 1 | Level 11 Lesson 2 | 2 |
| Level 1 Lesson 10 | 2 | Level 11 Lesson 3 | 1 |
| Level 2 Lesson 1 | 1 | Level 11 Lesson 4 | 2 |
| Level 2 Lesson 2 | 1 | Level 11 Lesson 5 | 2 |
| Level 2 Lesson 4 | 1 | Level 11 Lesson 6 | 6 |
| Level 2 Lesson 5 | 1 | Level 11 Lesson 7 | 3 |
| Level 2 Lesson 7 | 1 | Level 11 Lesson 8 | 3 |
| Level 3 Lesson 4 | 1 | Level 11 Lesson 9 | 4 |
| Level 4 Lesson 7 | 1 | Level 11 Lesson 10 | 4 |
| Level 5 Lesson 2 | 2 | Level 12 Lesson 1 | 2 |
| Level 5 Lesson 4 | 1 | Level 12 Lesson 2 | 3 |
| Level 6 Lesson 2 | 1 | Level 12 Lesson 3 | 2 |
| Level 6 Lesson 7 | 1 | Level 12 Lesson 4 | 4 |
| Level 7 Lesson 1 | 1 | Level 12 Lesson 5 | 5 |
| Level 8 Lesson 1 | 1 | Level 12 Lesson 6 | 2 |
| Level 8 Lesson 3 | 2 | Level 12 Lesson 7 | 4 |
| Level 8 Lesson 5 | 1 | Level 12 Lesson 8 | 6 |
| Level 8 Lesson 8 | 1 | Level 12 Lesson 9 | 4 |
| Level 10 Lesson 1 | 3 | Level 12 Lesson 10 | 4 |
| Level 10 Lesson 2 | 1 | Level 10 Lesson 10 | 1 |
| Level 10 Lesson 3 | 3 | Level 10 Lesson 5 | 1 |
| Level 10 Lesson 6 | 2 | Level 10 Lesson 7 | 2 |

## 恆春阿美語 — Lesson Breakdown (36 lessons, 154 removed)

Contaminating: 郡群布農語, 東魯凱語, 南排灣語

| Lesson | Removed | Lesson | Removed |
|---|---|---|---|
| Level 1 Lesson 1 | 1 | Level 11 Lesson 3 | 3 |
| Level 2 Lesson 8 | 1 | Level 11 Lesson 4 | 2 |
| Level 6 Lesson 6 | 1 | Level 11 Lesson 5 | 2 |
| Level 7 Lesson 6 | 1 | Level 11 Lesson 6 | 6 |
| Level 7 Lesson 8 | 1 | Level 11 Lesson 8 | 27 |
| Level 8 Lesson 6 | 2 | Level 11 Lesson 10 | 6 |
| Level 9 Lesson 7 | 1 | Level 12 Lesson 1 | 3 |
| Level 10 Lesson 1 | 4 | Level 12 Lesson 2 | 10 |
| Level 10 Lesson 2 | 1 | Level 12 Lesson 3 | 16 |
| Level 10 Lesson 3 | 1 | Level 12 Lesson 4 | 4 |
| Level 10 Lesson 4 | 1 | Level 12 Lesson 5 | 3 |
| Level 10 Lesson 5 | 1 | Level 12 Lesson 6 | 9 |
| Level 10 Lesson 6 | 2 | Level 12 Lesson 7 | 11 |
| Level 10 Lesson 7 | 1 | Level 12 Lesson 8 | 12 |
| Level 10 Lesson 8 | 1 | Level 12 Lesson 9 | 4 |
| Level 10 Lesson 9 | 4 | Level 12 Lesson 10 | 5 |
| Level 10 Lesson 10 | 2 | Level 11 Lesson 1 | 3 |
| Level 11 Lesson 2 | 2 | | |

---

## Probable Cause (low confidence)

Inspecting the remaining genuine Malan Amis sentences in each affected lesson (the only case where position data was analysed before deletion) shows a consistent tail-append pattern: genuine content at positions 0…N, contaminated content appended at N+1 onward. This is consistent with a **pagination fault during a re-scrape**: the scraper fetched the correct Amis content for the first N pages, then on the last page accidentally requested the wrong dialect's URL.

The fact that each Amis dialect received contamination from a different set of dialects (not all Puyuma, not all Paiwan) suggests the fallback/routing bug produced a deterministic per-dialect mismatch — possibly from a static mapping error in the scraper's dialect-URL table.

**This is inferred, not confirmed.** The scraper source code and run history would be needed to verify.

---

## Detection Method

`scripts/corpus_dupe_check.py` — text-based dedup via `ab` column join across different sentence rows and GLIDs. The "Suspicious cross-family matches" section of the output report identified all cases. Standard `sentence_id` dedup misses these entirely.

## Verification

After each deletion, a COUNT query confirmed 0 remaining contaminated rows. All deletions were atomic (CTE transactions). Orphaned `corpus_sentences` rows were only deleted when no other occurrences remained (corrected after FK error on first attempt).
