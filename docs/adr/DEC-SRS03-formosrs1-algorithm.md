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
| Again (lapse recovery) | 50% of pre-lapse interval (min 1d) | −0.20 | unchanged |
| Hard  | max(1, prev × 1.2) | −0.15 | unchanged |
| Good  | prev × ease (min 1 day on rep 0) | **+0.02** | +1 |
| Easy  | prev × ease × 1.3 | +0.15 | +1 |

Min ease factor: 1.3. Initial ease: 2.5.

**Good +0.02 (ease hell fix):** Vanilla SM-2 has zero ease delta on Good, so ease only moves down (Again/Hard) or up (Easy). After ~6 total Again ratings a card hits the 1.3 floor and stays there permanently even if the user answers correctly every time after. +0.02 on Good means 10 consecutive Goods = +0.2 ease recovery. This avoids ease hell without the complexity of FSRS mean-reversion.

**Fuzz ±5%:** `interval = Math.round(interval * (0.95 + Math.random() * 0.1))` applied to all intervals ≥ 2 days. Prevents cards reviewed on the same day from clustering into the same future review date.

**Anki Hard behavior:** Hard uses `prev × 1.2` rather than Anki's full SM-2 Hard (which resets interval). Keeps progress while penalizing ease. Hard is not shown by default (toggle in OptionsSheet) because it confuses new users.

**Review Again — requeue + 50% recovery (all reviewed cards):** Any card rated Again during a Review session is immediately requeued +10 positions in the current session (or at the back if fewer than 10 cards remain). No DB write on the first failure. When the requeued card is re-rated: Good/Easy → `rateCardRelearn` writes 50% of the pre-lapse interval (min 1d), repetitions unchanged; Hard → treated as Good for recovery purposes; Again again → `rateCard('again')` full SM-2 lapse penalty, no further requeue. Rationale: preserves earned interval on near-misses, avoids resetting genuinely known cards to day 1, zombie cards handled by future leech flagging.

**Time-based requeue (deferred):** A time-delay requeue (e.g. 10 min) would survive app close and long card dwell time (dictionary lookup etc). Deferred — adds scheduling complexity not warranted yet. Revisit when leech/lapse analytics are in place.

**Relearn burst spec (original, now superseded for young cards):** The original spec described a "relearn burst" for mature cards (interval ≥ 7d) with a 3-restart cap. Superseded by the simpler uniform requeue above. `nextRelearn()` and `rateCardRelearn()` remain in use for the 50% recovery write.

**Why not FSRS:** Better scheduling quality via Bayesian optimization of forgetting curve. Deferred because it requires meaningful production data (weeks of real reviews) to tune parameters. Revisit after 4+ weeks on prod.

**Open: Again preserving `repetitions` vs SM-2 reset (deferred):** In vanilla SM-2, Again resets `repetitions` to 0. In FormoSRS-1 as implemented, Again in Review is requeued without any DB write; the card is only written when rated Good/Easy/Hard, at which point `rateCardRelearn` leaves `repetitions` unchanged (or increments it). This departs from SM-2's "reset the streak on failure" logic. Rationale: "don't erase reps", lapse events captured in `ind_reviews.phase`. Risk: maturity scores inflate on weak cards, intervals drift upward without penalty. Revisit when lapse-rate data is available.
