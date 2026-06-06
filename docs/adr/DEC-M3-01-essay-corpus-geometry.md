---
status: accepted
---

# Essay corpus geometry — 24-slot structure from master JSON role detection

**Date:** 2026-06-01 · Source: `Citadel/core/geometry_crystallizer.py`, branch `fix/essay-dialogue-geometry`

`corpus_geometry.json` essay section contains **24 slots** (6×3 + 6×1):
- S2 units → 3 texts: `學習一` (S2 current), `學習二` (S2 second text), `原版` (S1 original)
- S1-only units → 1 text: `學習一` (S1 original)

**Context:** The klokah.tw essay module has 12 thematic units across 3 levels (初級/中級/中高級). Each unit has content in two "sets": S1 (original) and S2 (later expansion). S2 covers exactly 6 units (L1,L2,L5,L6,L9,L10), uniform across all 42 dialects.

**TID role detection** (in `geometry_crystallizer.py`):
- `學習一` = TID appearing exactly **×1** in master JSON raw lesson list (solo TID)
- `學習二` = TID appearing **>1×** AND first item has >4 chars (sentence-level, not vocabulary)
- `詞彙` and `練習` TIDs are excluded from geometry (exercise content, not reading texts)

**Why not positional ordering?** The DB orders TIDs numerically, which maps loosely to lesson position but breaks for S2 units where S1 and S2 TID ranges are interleaved. Master JSON raw lists are authoritative.

**Non-essay content (詞彙, 練習, 互動 sections):** Excluded from geometry but still in corpus. Full slot mapping preserved in Citadel `brain/content_intel/` for future use.
