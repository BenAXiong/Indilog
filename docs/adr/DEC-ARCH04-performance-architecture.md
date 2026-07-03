---
status: accepted
---

# Performance architecture — decisions from the 2026-07-03 campaign

Nine measured deploy steps took every flow from 0.9–4.0s to under 1s (Study content to ~30ms).
Full step-by-step evidence: `docs/perf-plan.md` (plan) + `docs/perf-log.md` (results). This ADR
records the *standing decisions* those steps established.

**Date:** 2026-07-03

## Geography

1. **Vercel functions are pinned to `syd1`** (`vercel.json` `regions`), co-located with the
   Supabase project (Sydney). If the database ever moves (see perf-plan § S10 — Tokyo migration,
   deferred), move this pin in the same deploy. Function↔DB round trips are ~2ms co-located vs
   ~200ms cross-region; this dominates everything else.
2. The Supabase project is shared by multiple apps and both free-tier slots are taken — any
   project-level change (region, keys, pausing) affects every tenant.

## Auth access patterns (three tiers — do not mix)

| Where | Call | Why |
|---|---|---|
| Client code (`lib/db/**`, pages) | `getSessionUser()` (`lib/supabase/session.ts`) | reads local session, no network; the id is only a query filter — RLS authorizes server-side regardless |
| Middleware | `auth.getClaims()` | local ES256 JWT verification against cached JWKS; no per-navigation auth round trip. Tradeoff on record: revoked-but-unexpired tokens pass for ≤1h — the same window PostgREST already allows |
| Server code (RSC, API routes, `*/server.ts`) | `auth.getUser()` | server-side verification is where it belongs |

Never reintroduce `auth.getUser()` in client helpers — each call is a full round trip to the
auth server and they stack per page load.

## Query layer

3. **Set-oriented work runs in the database, not the client.** `ensure_flashcards()` (backfill
   insert-select, `ON CONFLICT` closes the two-tab race) and `get_due_stats()` (grouped counts)
   are `SECURITY INVOKER` RPCs — RLS still applies. Precedent: `graduate_learn_card`,
   `increment_reviewed_today`. Download-and-compute loops over whole tables are an anti-pattern.
4. **`paginate<T>` fetches pages in parallel batches** (4 × 1000) and appends an `.order('id')`
   tiebreaker — OFFSET pagination without a deterministic ORDER BY is unsound. DEC-SRS04's rule
   (never trust >1000-row queries without the helper) stands; `.limit(N > 1000)` is still
   silently capped (that bug bit `getStudyStats` until 2026-07-03).
5. Embed filters require `!inner` — see DEC-ARCH03.

## Content delivery

6. **Corpus API routes are public + CDN-cached** (`/api/learn/curriculum`, `/api/learn/geometry`:
   excluded from the auth middleware matcher, `s-maxage=86400, stale-while-revalidate`). Corpus
   edits made directly in the DB appear after ≤1 day or the next deploy (deploys purge the cache).
7. **Dialect content packs** (`scripts/build-content-packs.mjs` → `public/packs/*.json` +
   `lib/learn/pack-manifest.json`): the entire study content for a dialect ships as one hashed,
   CDN-served JSON, cached in IndexedDB (`lib/learn/packs.ts`). EparkView reads pack-first with
   API fallback for unpacked dialects. **Rebuild + commit packs after corpus edits.** Note:
   grmpts content lives under the language-level dialect_name (阿美語), not the specific dialect.

## Sessions

8. **Two-phase session loading**: Learn/Review landings paint from a fast head-count
   (`countDueFlashcards` / `countLearnFlashcards` — sharing the exact predicate builder with the
   queue fetch) + context; the full queue (overflow buffer intact, DEC-M5-01) downloads in the
   background and Begin/autostart await it. The displayed count reconciles when the queue lands.
   The overflow buffer's load-in-full design is intentional — do not replace it with DB LIMITs
   (priority ordering is client-side; a LIMIT changes which cards enter a session).

## Measurement discipline

9. **Perf claims need harness numbers.** `node scripts/perf/mint-session.mjs && node
   scripts/perf/measure.mjs --step <tag>` drives production in headless Chromium and records
   click→paint medians (in-app instrumentation: `?perf=1` HUD, `PerfMark`, `ind_perf_samples`).
   One change = one deploy = one measured round, logged in `docs/perf-log.md` with a keep/revert
   verdict. The `dict` flow and the edge-static curl probe are controls — if they move, the
   round is invalid. Google blocks OAuth in automated browsers; `mint-session.mjs` mints the
   session programmatically (service key fetched via Supabase CLI, gitignored).
