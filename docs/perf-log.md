# Performance Campaign — Results Log

Measurement protocol and step definitions: [perf-plan.md](perf-plan.md).
One entry per step, appended after each deploy + harness round. Verdict: keep / revert.

---

## S0 — Baseline (instrumentation only) — 2026-07-03

**Deploy**: pending push (commit 8b48ea9)

### Machine probes (warm, seconds; first cold run excluded)

| Probe | p50 | Notes |
|---|---|---|
| edge static `/login` | **0.18** | HK edge, cache HIT |
| function no-DB `/auth/callback` | **0.42** | +240ms vs edge = the iad1 detour |
| machine → Supabase Sydney REST | **0.29** | per-request TLS; in-app keep-alive ≈ ~150ms |
| full corpus API path | n/a until S2 | middleware 302s unauthenticated requests |

### Harness flow medians (`--step S0`)

_(pending: deploy + `node scripts/perf/measure.mjs --step S0`)_

| Flow | p50 (ms) | min | max | n |
|---|---|---|---|---|
| | | | | |

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
