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

## S1 — Pin Vercel functions to Sydney — 2026-07-03

**Deploy**: d1dce02 (indilog-2oex4xeon) · `X-Vercel-Id: hkg1::syd1::…` confirmed

### Machine probes
| Probe | p50 | Δ vs S0 |
|---|---|---|
| edge static `/login` | 0.19 | ✓ control flat |
| function no-DB `/auth/callback` | **0.31** | **−0.11s** (HK→SYD closer than HK→IAD) |

### Harness flow medians (`--step S1`)
| Flow | p50 (ms) | Δ vs S0 | n |
|---|---|---|---|
| cold:home | **858** | **−1717 (−67%)** | 7 |
| cold:learn-landing | 3492 | −64 (flat) | 5 |
| dict (control) | 45 | ✓ flat | 5 |
| epark-essay | 1729 | +51 (flat) | 5 |
| epark-twelve | **562** | **−351 (−38%)** | 20 |
| home (RSC) | **796** | **−1733 (−69%)** | 5 |
| review-landing | 4028 | +18 (flat) | 5 |
| study-hub | 2778 | −1 (flat) | 15 |

**Verdict**: **keep** — everything routed through functions collapsed (home −69%, cold start −67%,
lesson content −38%); flows bound by client→Sydney query stacks (study-hub, review-landing,
learn) didn't move, exactly as diagnosed — those are S3–S5. Essay flat: its serial
geometry→curriculum waterfall dominates (S6).

---

## S2 — Corpus API public + CDN-cached — 2026-07-03

**Deploy**: ec7520a (indilog-f4m7jf3ku) · unauthenticated 200 confirmed, `X-Vercel-Cache: MISS→HIT`

### Machine probes
| Probe | p50 | Notes |
|---|---|---|
| corpus API repeat (HIT) | 0.11–0.37s | curl pays fresh TLS each call; in-app warm connection ≈ 30–80ms |

### Harness flow medians (`--step S2`)
| Flow | p50 (ms) | Δ vs S1 | n |
|---|---|---|---|
| cold:home | 889 | +31 (flat) | 7 |
| cold:learn-landing | 3520 | +28 (flat) | 5 |
| dict (control) | 44 | ✓ flat | 5 |
| epark-essay | **180** | **−1549 (−90%)** | 5 |
| epark-twelve | **361** | **−201 (−36%)**, min **79** | 20 |
| home (RSC) | 842 | +46 (flat) | 5 |
| review-landing | 4010 | −18 (flat) | 5 |
| study-hub | 2795 | +17 (flat) | 15 |

**Verdict**: **keep** — content flows now serve from the HK edge on repeat visits (essay 1.7s→0.18s
cumulative from S0). Caveat: harness revisits the same lessons (cache-friendly); a first visit to
a lesson still pays ~S1 cost until the S8 content pack. Client-query flows unchanged, as expected.

---

## S3 — Local session read replaces client `auth.getUser()` — 2026-07-03

**Deploy**: 0676f90 · 57 callsites → `getSessionUser()`; server-side code unchanged

### Harness flow medians (`--step S3`)
| Flow | p50 (ms) | Δ vs S2 | n |
|---|---|---|---|
| cold:home | 874 | −15 (flat) | 7 |
| cold:learn-landing | **2805** | **−715 (−20%)** | 5 |
| dict (control) | 40 | ✓ flat | 5 |
| epark-essay | 178 | −2 (flat) | 5 |
| epark-twelve | 363 | +2 (flat) | 20 |
| home (RSC) | 745 | −97 | 5 |
| review-landing | **3540** | **−470 (−12%)** | 5 |
| study-hub | **1542** | **−1253 (−45%)** | 15 |

**Verdict**: **keep** — the auth round trips were stacked deepest in study-hub (−45%). Remaining
weight in review-landing (3.5s) and study-hub (1.5s) is data transfer: `ensureFlashcards`
downloading every note/card id (S4) and due-stats/queue pagination (S5). All session flows
worked normally in the harness → the swapped auth pattern holds up end-to-end.

---

## S4+S5 — `ensure_flashcards` + `get_due_stats` RPCs — 2026-07-03

**Deploy**: d624c37 · migration 20260703020000 applied via `db query --linked`
**Verified first**: the old client-side shape was fallout from the 2026-06-01 duplicate-cards
incident (PostgREST 1000-row cap), not intentional design; RPCs already established practice
(`graduate_learn_card`). Grouping logic smoke-tested against live data before deploy.

### Harness flow medians (`--step S4S5`)
| Flow | p50 (ms) | Δ vs S3 | n |
|---|---|---|---|
| cold:home | 893 | +19 (flat) | 7 |
| cold:learn-landing | 2827 | +22 (flat) | 5 |
| dict (control) | 46 | ✓ flat | 5 |
| epark-essay | 177 | −1 (flat) | 5 |
| epark-twelve | 363 | ±0 (flat) | 20 |
| home (RSC) | 761 | +16 (flat) | 5 |
| review-landing | **2713** | **−827 (−23%)** | 5 |
| study-hub | **696** | **−846 (−55%)** | 15 |

**Verdict**: **keep** — study-hub now 696ms (was 2779 at S0, −75% cumulative). Note: due counts
may shift *correctly* for users with language exclusions (old embed filters leaked excluded rows
into captures; RPC applies true join semantics).
**Remaining weight**: review-landing (2.7s) = `listDueFlashcards` downloading the full due queue
with joined items; learn-landing (2.8s) = `listLearnFlashcards` downloading all rep-0 cards.
Both are session-queue fetches — capping them changes overflow behavior, so that's a separate
proposal, not part of this step.

---

## S8 — Amis content packs (IndexedDB) — 2026-07-03

**Deploy**: 61010af + measurement fix (PerfMark `signal` prop — pack loads swap content with no
committed loading frame; first S8 round lost its next-lesson samples to that and was rerun)

### Harness flow medians (`--step S8`, rerun)
| Flow | p50 (ms) | Δ vs S4+S5 | n |
|---|---|---|---|
| cold:home | 969 | +76 (variance) | 7 |
| cold:learn-landing | 2856 | +29 (flat) | 5 |
| dict (control) | 45 | ✓ flat | 5 |
| epark-essay | **95** | **−82 (−46%)** | 5 |
| epark-twelve | **29** | **−334 (−92%)**, max 1447 = one-time pack download | 20 |
| home (RSC) | 960 | +199 (variance; min 660) | 5 |
| review-landing | 2745 | +32 (flat) | 5 |
| study-hub | 728 | +32 (flat) | 15 |

**Verdict**: **keep** — packed content renders in ~30–95ms with zero network (offline-capable).
Unpacked dialects fall back to the API (S2 edge cache). Rebuild packs after corpus edits:
`node scripts/build-content-packs.mjs` + commit.

---

## S9 — Middleware `getClaims()` (local JWT verification) — 2026-07-03

**Deploy**: S9 middleware commit · project already on ES256 asymmetric keys (JWKS verified live)

### Harness flow medians (`--step S9`)
| Flow | p50 (ms) | Δ vs S8 | n |
|---|---|---|---|
| cold:home | 855 | −114 | 7 |
| cold:learn-landing | 2941 | +85 (noise) | 5 |
| dict (control) | 46 | ✓ flat | 5 |
| epark-essay | 97 | +2 (flat) | 5 |
| epark-twelve | 29 | ±0 (flat) | 20 |
| home (RSC) | **668** | **−292** | 5 |
| review-landing | 2663 | −82 | 5 |
| study-hub | 762 | +34 (noise) | 15 |

**Verdict**: **keep** — the per-navigation auth round trip is gone; auth gating verified working
(all logged-in flows ran; unauthenticated requests still 302). Tradeoff on record: revoked
sessions pass middleware until token expiry (≤1h) — same window PostgREST already allows.

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
