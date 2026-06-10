# Mastery grades — Seed / Planted / Rooted / Blooming

Four-tier card mastery classification using existing SRS columns. Replaces the binary "mastered" stat (`ease_factor >= 2.5 AND interval_days >= 21`).

**Grades and thresholds:**

| Grade | Condition |
|---|---|
| Seed | `repetitions === 0` |
| Planted | `repetitions >= 1` and `interval_days < 21` |
| Rooted | `interval_days >= 21 AND repetitions >= 5 AND ease_factor >= 2.5` |
| Blooming | `interval_days >= 60` (interval only — no ease gate) |

**Why Rooted uses three signals:** `interval_days >= 21` alone has a false-positive problem — a card that reached 21 days via frequent Again resets can look mature without being reliably known. Adding `repetitions >= 5` (5 consecutive successful reviews) and `ease_factor >= 2.5` (not struggling) filters these out. This is option C from the evaluated set; option A (`interval_days >= 21` only) should be tested in a future version as a less SRS-reliant alternative.

**Why Blooming is interval-only:** Blooming represents ongoing long-term retention, not an achievement gate. A card at 60+ days is genuinely embedded in long-term memory regardless of the path it took to get there. It is aspirational and beyond the Simulation's scope.

**Simulation finish line:** Rooted. The Simulation's deadline = the date by which selected priority deck cards should reach Rooted.

**Considered options for Rooted threshold:**
- A: `interval_days >= 21` — too permissive, false positives from Again-reset cards
- B: `interval_days >= 21 AND ease_factor >= 2.5` — better but misses consecutive-success signal
- C: `interval_days >= 21 AND repetitions >= 5 AND ease_factor >= 2.5` — chosen; best signal/complexity ratio
- D: A + B + C — marginal gain over C, not worth the additional strictness
