---
status: accepted
---

# Session cap source of truth + "Review more" UX

`ind_profiles.preferences.daily_cap` is the source of truth; all OptionsSheet settings sync to cloud.

**Date:** 2026-06-06

**Problem:** Daily cap lived only in `localStorage` (`srs_daily_cap`, default 100). When settings were changed via `SettingsSheet` (which saves to `ind_profiles.preferences`) on one device, the review session on another device still used the old localStorage default. Dashboard and session were computing the cap from different sources.

**Decision 1 — `ind_profiles.preferences.daily_cap` is the source of truth.**
`loadSessionContext()` (called on every session load) fetches `preferences` from the profile and syncs `daily_cap` to localStorage. Session always uses the profile cap.

**Decision 2 — Session cap formula:** `sessionCap = max(0, cap − reviewedToday)`. Custom sessions (`?custom=1`) and "Review more" sessions (`?more=1`) bypass this. "Review more" loads one cap-sized batch (not the full queue).

**Decision 3 — Dashboard "Review more?" state:** Three states, not two:
- `due > 0` → crimson "Review N due" button
- `due = 0` but `totalDue > 0` (cap met, queue not empty) → amber "Review more?" → `/review?start=1&more=1`
- `due = 0` and `totalDue = 0` → "All caught up!" (no button)

**Decision 4 — All OptionsSheet settings sync to cloud.** Any setter that writes to `localStorage` must also call `patchPreferences(patch)`. See `architecture.md` Settings sync rule.
