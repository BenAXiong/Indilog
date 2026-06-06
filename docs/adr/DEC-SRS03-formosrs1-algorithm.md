---
status: accepted
---

# FormoSRS-1 algorithm — exact spec and rationale

Implemented in `lib/db/srs/schedule.ts`. Uses SM-2 base + Anki Hard behavior + fuzz + ease recovery on Good, rather than vanilla SM-2 or FSRS.

**Date:** 2026-05-30

**Rating → algorithm mapping:**

| Rating | Interval | Ease delta | Reps |
|---|---|---|---|
| Again | 1 day | −0.20 | reset to 0 |
| Hard  | max(1, prev × 1.2) | −0.15 | unchanged |
| Good  | prev × ease (min 1 day on rep 0) | **+0.02** | +1 |
| Easy  | prev × ease × 1.3 | +0.15 | +1 |

Min ease factor: 1.3. Initial ease: 2.5.

**Good +0.02 (ease hell fix):** Vanilla SM-2 has zero ease delta on Good, so ease only moves down (Again/Hard) or up (Easy). After ~6 total Again ratings a card hits the 1.3 floor and stays there permanently even if the user answers correctly every time after. +0.02 on Good means 10 consecutive Goods = +0.2 ease recovery. This avoids ease hell without the complexity of FSRS mean-reversion.

**Fuzz ±5%:** `interval = Math.round(interval * (0.95 + Math.random() * 0.1))` applied to all intervals ≥ 2 days. Prevents cards reviewed on the same day from clustering into the same future review date.

**Anki Hard behavior:** Hard uses `prev × 1.2` rather than Anki's full SM-2 Hard (which resets interval). Keeps progress while penalizing ease. Hard is not shown by default (toggle in OptionsSheet) because it confuses new users.

**Relearn burst (mature lapse):** Cards with `interval_days ≥ 7` that get Again enter a relearn burst (same learning-steps depth). "Got it!" = 50% interval recovery via `nextRelearn()` + `rateCardRelearn()`. Cap: 3 full restarts, then forced `rateCard('again')` full reset.

**Why not FSRS:** Better scheduling quality via Bayesian optimization of forgetting curve. Deferred because it requires meaningful production data (weeks of real reviews) to tune parameters. Revisit after 4+ weeks on prod.
