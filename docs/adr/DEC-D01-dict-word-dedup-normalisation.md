---
status: accepted
---

# Dictionary word dedup: space-stripping normalisation

When returning word results from `/api/dict/search`, deduplicate entries that differ only by internal whitespace. Two rows are considered duplicates when their `(dialect_name, normWordKey(word_ab))` matches, where `normWordKey` = lowercase → NFC → unify apostrophe variants (U+0027/U+2019/U+02BC/U+A78C → `'`) → strip all whitespace. Among duplicates keep the entry with the longest original `word_ab`.

**Date:** 2026-05-28

**Root cause:** The ILRDF corpus contains both `mafana'to` and `mafana' to` as separate rows with the same dialect and overlapping definitions. The unspaced form is a data entry error — in Amis romanisation, `'` represents a glottal stop and the morpheme boundary requires a space before the following syllable.

**Why full space-strip, not just apostrophe-adjacent spaces:** Stripping only spaces immediately adjacent to apostrophes would fix the known case but miss equivalent errors involving other characters. Stripping all whitespace from the comparison key catches all spacing variants at once and carries negligible false-positive risk.

**Applied in two places:**
1. `apps/web/app/api/dict/search/route.ts` — dedup pass after `searchWords`, before sending response.
2. `apps/web/app/(main)/dict/page.tsx` `normKey()` — safety net for the Merged tab grouping.

**Trade-off:** If a future corpus update introduces two genuinely distinct words identical after normalisation, they would be silently merged. Mitigation: `normWordKey` is only used for dedup/grouping — the display always shows the preserved (spaced, correct) form.
