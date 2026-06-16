---
status: accepted
---

# Daily target architecture — two-layer model and source of truth

**Date:** 2026-06-06 (updated 2026-06-17)

## Problem

Daily target lived only in `localStorage` (`srs_daily_cap`, default 100). When settings were changed via `SettingsSheet` on one device, the review session on another device still used the old localStorage default. Dashboard and session were computing the target from different sources.

## Two-layer model

The daily target is split into two distinct layers, each with a separate purpose:

**Layer 1 — Persistent preference** (`ind_profiles.preferences.review_target`, `learn_target`)
The user's intended daily volume. Set manually in GoalSheet / SettingsSheet. Survives across days. When no simulation is active, this IS today's target. When simulation is active, `review_target` acts as a floor (`max(pref, existingDue)`); `learn_target` is ignored by the server simulation (which computes raw pace from deadline math) but used as a ceiling in the GoalSheet client-side preview.

**Layer 2 — Frozen daily value** (`ind_daily_stats.learn_target`, `review_target`)
Computed once per day via `freeze_daily_targets` RPC (COALESCE — never overwrites). Sources: simulation output when active, otherwise the preference. Locked for the rest of the day regardless of mid-day pref changes or sim recomputes. This is the ring denominator and session cap source of truth.

The freeze exists to guarantee **intra-day stability**: the ring denominator must not shift as you work through the session. Without it, every dashboard load would recompute the target, and the denominator could move.

## Decisions

**Decision 1 — `ind_profiles.preferences` is the authoritative persistent store.**
`loadSessionContext()` fetches preferences on every session load and syncs to localStorage. Session always uses the profile value, not the stale localStorage default.

**Decision 2 — Session cap formula:** `sessionCap = max(0, reviewTarget − reviewedToday)`. Custom sessions (`?custom=1`) and "Review more" sessions (`?more=1`) bypass this.

**Decision 3 — Dashboard "Review more?" state:** Three states:
- `dueCount > 0` and `reviewedToday < reviewTarget` → crimson "Review N" button
- `reviewedToday >= reviewTarget` and `totalDue > 0` → amber "Review N more?" → `/review?start=1&more=1`
- `totalDue === 0` → "All caught up!" (no button)

**Decision 4 — All settings sync to cloud.** Any setter writing to `localStorage` must also call `patchPreferences(patch)`. See `architecture.md` Settings sync rule.

## Terminology note (2026-06-17)

`daily_cap` (original) → `review_cap` (DEC-M5-01, 2026-06-06) → `review_target` (2026-06-17). The "cap" framing was dropped because in manual mode it IS the target, and in simulation mode it is either ignored or used as a floor — never a hard ceiling. "Target" is consistent with `ind_daily_stats.learn_target` / `review_target` and unambiguous: the preference is the manual target, the daily stat is the frozen target.

## Future consideration

The two-layer model could be collapsed into one if the simulation stopped recomputing on every dashboard load and instead wrote the daily target once at day-start (e.g., a dedicated `begin_day` RPC). The preference layer would still exist as the input, but the frozen daily stat would be the only runtime value consulted. This would eliminate the freeze-on-first-load pattern and make the architecture easier to reason about. Deferred — requires rethinking the simulation trigger model.
