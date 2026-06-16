# Corpus Contamination Report — 馬蘭阿美語 ← 建和卑南語

**Date detected:** 2026-06-16  
**Detected by:** Cross-dialect sentence deduplication analysis  
**Status:** Fixed (see below)

## Summary

66 sentences of **建和卑南語 (Kasavakan Puyuma)** content were incorrectly scraped into the **馬蘭阿美語 (Malan Amis)** corpus under `source = 'twelve'`. The contaminated sentences had distinct `corpus_sentences` rows with `glid = '01'` (Amis), but their `ab` (indigenous-language) text was identical to existing `glid = '05'` (Puyuma) rows linked to 建和卑南語 occurrences. Each contaminated sentence row had exactly one occurrence (the bad Malan Amis one), making them full orphans after cleanup.

The error originated in the YCM Citadel scraper, which mis-assigned Kasavakan Puyuma lesson content to Malan Amis during ingestion.

## Affected Lessons (23 total)

| Lesson | Sentences removed |
|---|---|
| Level 1 Lesson 1  | 1 |
| Level 5 Lesson 2  | 1 |
| Level 6 Lesson 7  | 1 |
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

## Broader Cross-Dialect Analysis

A full cross-dialect sentence-sharing audit (all pairs in `source = 'twelve'` by `sentence_id`) returned 33 dialect pairs — **all within the same language family** (Amis↔Amis, Puyuma↔Puyuma, Paiwan↔Paiwan, etc.). No cross-family sentence_id duplicates were found. High within-family counts (e.g., 知本卑南語/西群卑南語: 55 shared) are expected — ePark reuses lesson content across closely related dialects.

The Malan Amis contamination was only detectable via **text-based dedup** (`ab` column match across different `sentence_id`s and `glid`s), not by `sentence_id` join, because the scraper created duplicate sentence rows with the wrong GLID.

## Probable Cause (low confidence)

Inspecting the remaining genuine Malan Amis sentences in each affected lesson reveals a consistent pattern: they occupy a contiguous block starting at position 0, with no gaps. The contaminated Kasavakan Puyuma sentences would have occupied the positions immediately after — i.e., they were appended as a tail, not scattered randomly.

Example: Level 10 Lesson 8 has 3 genuine Malan Amis sentences (positions 0–2) and had 10 contaminated ones (presumably positions 3–12). Level 12 Lesson 6: 5 genuine (0–4), 5 contaminated (5–9).

This tail-append pattern is consistent with a **pagination fault during a re-scrape or overwrite run**: the scraper fetched the first N pages of a lesson correctly for Malan Amis, then on the last page(s) accidentally requested the Kasavakan Puyuma version — possibly due to a dialect URL parameter being dropped, a fallback triggering the wrong dialect code, or a URL collision at lesson boundaries. The resulting rows were appended to the existing Malan Amis lesson content rather than replacing it.

The scattered distribution across levels (L1, L5–6, L10–12) and the varying contamination counts suggest the bug was position- or page-count-dependent — some lessons happened to trigger it, others didn't.

**This is inferred, not confirmed.** The scraper source code and its run history would be needed to verify.

## Fix Applied

Two DELETE operations executed on 2026-06-16:

1. **`corpus_occurrences`**: deleted 66 rows where `dialect_name = '馬蘭阿美語'`, `source = 'twelve'`, and the linked sentence's `ab` text matched a 建和卑南語 sentence.

2. **`corpus_sentences`**: deleted the 66 orphaned sentence rows (all `glid = '01'`, ab text is Puyuma) that had no remaining occurrences after step 1.

## Why the True Corpus Entries Were Kept

The **correct** 建和卑南語 occurrences (and their `glid = '05'` sentence rows) were **not modified**. Only the spurious Malan Amis duplicates were removed.
