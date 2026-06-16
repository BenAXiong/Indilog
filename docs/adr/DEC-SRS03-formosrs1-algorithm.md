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

**Review Again — requeue at end + 10-min DB deferral:** Any card rated Again during a Review session is requeued at the **end** of the current session queue. `due_at = now + 600s` is written to the DB immediately so that if the session exits before the card resurfaces, it is genuinely unavailable for 10 minutes (prevents it re-entering the next short session while still in working memory). Undo restores the original `due_at`. When the requeued card is re-rated: Good/Easy → `rateCardRelearn` writes 50% of the pre-lapse interval (min 1d), repetitions unchanged; Hard → treated as Good for recovery purposes; Again again → `rateCard('again')` full SM-2 lapse penalty, no further requeue. Rationale: preserves earned interval on near-misses, avoids resetting genuinely known cards to day 1, zombie cards handled by future leech flagging.

**Anki comparison — minute-based learning steps:** Anki uses minute-based steps for both the learning phase (default [1m, 10m]) and relearning (lapsed review, default [10m]). A lapsed review card in Anki enters a 10-min relearn step via real wall-clock scheduling — the card reappears only once 10 min have elapsed, regardless of whether the session is still open. FormoSRS-1 enforces the 10-min floor via the `due_at = now+600s` DB write: if the session ends before the card resurfaces, it is genuinely unavailable until 10 min have passed. The end-of-deck position is a within-session best-effort — the card appears as late as possible, and in a typical session (≥10 min of cards remaining) 10 min will have elapsed by the time it resurfaces naturally. In a short or very fast session where the remaining queue is exhausted in under 10 min, the card can appear before the 10-min mark; the DB deferral catches this if the session closes first. Full minute-resolution scheduling (real intra-session timers, step queues) deferred to v+.

**Timestamp granularity and same-session clustering (deferred):** Cards graduated on the same day from the Learn phase all receive `due_at = now + 1day`. Because `fuzz()` returns the interval unchanged for `interval < 2`, there is zero sub-day randomisation. `listDueFlashcards` sorts by `due_at ASC`, so same-session graduates resurface in the same relative order every day. Anki avoids this by using day-integer due values (no sub-day timestamp) and shuffling within the same-day cohort by default. Fix options: (A) client-side shuffle within same-due-date groups on load — conflicts with the priority sort unless grouped by `(priority_bucket, due_date)`; (B) extend `fuzz()` to add a random 0–8h offset for `interval = 1` so graduates spread across an 8h window. Deferred to v+; not a correctness issue, only affects study variety.

**Relearn burst spec (original, now superseded for young cards):** The original spec described a "relearn burst" for mature cards (interval ≥ 7d) with a 3-restart cap. Superseded by the simpler uniform requeue above. `nextRelearn()` and `rateCardRelearn()` remain in use for the 50% recovery write.

**Why not FSRS:** Better scheduling quality via Bayesian optimization of forgetting curve. Deferred because it requires meaningful production data (weeks of real reviews) to tune parameters. Revisit after 4+ weeks on prod.

**Open: Again preserving `repetitions` vs SM-2 reset (deferred):** In vanilla SM-2, Again resets `repetitions` to 0. In FormoSRS-1 as implemented, Again in Review is requeued without any DB write; the card is only written when rated Good/Easy/Hard, at which point `rateCardRelearn` leaves `repetitions` unchanged (or increments it). This departs from SM-2's "reset the streak on failure" logic. Rationale: "don't erase reps", lapse events captured in `ind_reviews.phase`. Risk: maturity scores inflate on weak cards, intervals drift upward without penalty. Revisit when lapse-rate data is available.
