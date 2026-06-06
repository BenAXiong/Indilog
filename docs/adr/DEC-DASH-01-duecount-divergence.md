---
status: open
---

# Dashboard dueCount vs session count — known remaining gap

**Date:** 2026-06-05

**What matches (as of 2026-06-05):**
- Cap applied: both use `preferences.daily_cap`
- `reviewedToday` subtracted: dashboard now shows `min(rawDue, max(0, cap − reviewedToday))`
- Reset hour: dashboard uses `preferences.reset_hour` to determine study date

**What still diverges:**
- **Language exclusions** (`srs_excluded_langs` / `srs_show_all_langs`): dashboard counts all languages; session filters them out. Dashboard can overcount if user excludes languages.
- **Collection exclusions** (`ind_learn_collections.include_in_review`): dashboard counts all collections; session respects the per-deck toggle. Dashboard can overcount if user has excluded decks.

**Why deferred:** The learn/review workflow split (potentially separating learning from reviews) will change what "due today" means. Fixing language/collection exclusions server-side now risks having to redo them. Track alongside that redesign.

**Fix when:** learn vs review workflow decision is made (see M5-B "Separate learn from reviews?").
