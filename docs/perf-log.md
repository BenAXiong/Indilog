# Performance Campaign — Results Log

Measurement protocol and step definitions: [perf-plan.md](perf-plan.md).
One entry per step, appended after each deploy + harness round. Verdict: keep / revert.

---

## S0 — Baseline (instrumentation only) — 2026-07-03

**Deploy**: 0382c1f (indilog-76em53bvl)

### Machine probes (warm, seconds; first cold run excluded)

| Probe | p50 | Notes |
|---|---|---|
| edge static `/login` | **0.18** | HK edge, cache HIT |
| function no-DB `/auth/callback` | **0.42** | +240ms vs edge = the iad1 detour |
| machine → Supabase Sydney REST | **0.29** | per-request TLS; in-app keep-alive ≈ ~150ms |
| full corpus API path | n/a until S2 | middleware 302s unauthenticated requests |

### Harness flow medians (`--step S0`)

| Flow | p50 (ms) | min | max | n |
|---|---|---|---|---|
| cold:home | **2575** | 2350 | 3484 | 7 |
| cold:learn-landing | **3556** | 3474 | 4293 | 5 |
| dict (control) | **44** | 43 | 46 | 5 |
| epark-essay | **1678** | 1627 | 2364 | 5 |
| epark-twelve | **913** | 696 | 1112 | 20 |
| home (RSC) | **2529** | 2312 | 3179 | 5 |
| review-landing | **4010** | 3946 | 4077 | 5 |
| study-hub | **2779** | 2743 | 3628 | 15 |

Reading: every DB-touching flow sits at 1–4s; the pure-client control is 44ms. `review-landing`
(4.0s) and `study-hub` (2.8s) are dominated by client→Sydney query stacks (`ensureFlashcards`
pagination, per-helper `getUser()`); `home` (2.5s) is an RSC render through iad1→Sydney;
`epark-twelve` (0.9s) is one corpus API call; `epark-essay` (1.7s) pays the geometry→curriculum
waterfall on top.

### Phone spot-check (`S0-phone`, optional)

_(pending)_

---

<!-- Template for each step:

## S1 — <name> — YYYY-MM-DD

**Deploy**: <commit> / build <stamp>

### Machine probes
| Probe | p50 | Δ vs prev |
|---|---|---|

### Harness flow medians (`--step S1`)
| Flow | p50 (ms) | Δ vs S0 | n |
|---|---|---|---|

**Verdict**: keep / revert — <one line why>
-->
