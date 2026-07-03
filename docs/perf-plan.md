# Performance Campaign — Plan & Results Log

Goal: cut Study content loading latency (and app-wide response times), measuring the
**actual gain of each step** before moving to the next. One step = one commit = one deploy = one
measurement round. Keep what pays, revert what doesn't.

## Diagnosis (2026-07-03)

Request geography is the dominant cost. Measured/confirmed:

| Leg | Where | Evidence |
|---|---|---|
| User | Taiwan | — |
| Vercel edge PoP | Hong Kong (`hkg1`) | `X-Vercel-Id: hkg1::…` |
| Vercel functions | **Washington DC (`iad1`)** | `X-Vercel-Id: hkg1::iad1::…` (no `regions` in vercel.json) |
| Supabase | **Sydney (`ap-southeast-2`)** | `npx supabase projects list` |

Every authed API call pays: HK→DC forward, then DC→Sydney for middleware `auth.getUser()`
(network call, every request), then DC→Sydney again for the actual query. ≈ 800ms+ before render.
Client-side Supabase queries pay Taiwan→Sydney (~150ms/round trip) — and most db helpers
prepend an extra `auth.getUser()` network round trip.

## Measurement infrastructure (Step 0)

### Phone / real-flow timings (click → painted)
- Open the app with **`?perf=1`** appended to any URL (e.g. `https://indilog.vercel.app/?perf=1`).
  A dark pill appears bottom-right; it persists until `?perf=0` or "off".
- Every tap on a link/button is timestamped; each instrumented page reports when its content is
  painted (double-rAF after data lands). The pill shows the last flow + ms; tap it for the full list.
- Samples auto-upload to **`ind_perf_samples`** (user-scoped RLS) with `build` (deploy timestamp),
  `step` tag, `flow`, `ms`, `device`. The HUD panel has a `step` field — **set it to the current
  step tag (S0, S1, …) before a measurement round**.
- Flows with no preceding tap are recorded once per page load as `cold:<flow>` (cold start,
  measured from navigationStart).

Pulling medians (run after each round):

```sh
npx supabase db query --linked "SELECT step, flow, device, count(*) n, round(percentile_cont(0.5) WITHIN GROUP (ORDER BY ms)) p50, min(ms), max(ms) FROM ind_perf_samples GROUP BY 1,2,3 ORDER BY 1,2,3"
```

### Machine-side network probes (run after each deploy)
```sh
# edge static        — control, should never change
for i in 1 2 3 4 5; do curl -s -o /dev/null -w "%{time_total} " https://indilog.vercel.app/login; done
# function, no DB    — isolates the function-region hop
for i in 1 2 3 4 5; do curl -s -o /dev/null -w "%{time_total} " https://indilog.vercel.app/auth/callback; done
# direct Supabase REST (anon key from apps/web/.env.local) — isolates user→DB
curl -s -o /dev/null -w "%{time_total}" -H "apikey: $KEY" "https://gnmcttlpkiexxoilwhfa.supabase.co/rest/v1/corpus_occurrences?select=original_uuid&source=eq.twelve&limit=5"
# full corpus API path (measurable unauthenticated from S2 onward; before S2 middleware 302s it)
curl -s -o /dev/null -w "%{time_total}" "https://indilog.vercel.app/api/learn/curriculum?source=twelve&dialect=<dialect>&title_zh=Level%201%20Lesson%201"
```
`/api/learn/curriculum` also returns a `Server-Timing: db;dur=…` header (visible in DevTools →
Network → Timing) separating DB time from network time.

### Test protocol (per step, on the phone)
1. Set the HUD `step` tag to the step being measured. Verify the build stamp in the HUD matches the new deploy.
2. **Cold start ×2**: kill the PWA/tab fully, open app → wait for home. (`cold:home`)
3. **Warm flows ×5 each**, in this order, pausing ~2s between taps:
   - F1 `study-hub` — Home → Study tab
   - F2 `epark-twelve` — Study hub → Lessons (play button)
   - F3 `epark-twelve` again — next-lesson arrow inside Lessons ×5
   - F4 `epark-essay` — Study hub → Essays (the waterfall case)
   - F5 `review-landing` — Study hub → Saved/Review entry
   - F6 `learn-landing` — Home → Learn entry
   - F7 `home` — Study → Home tab (RSC page)
   - F8 `dict` — Home → Dictionary (**control**: no blocking data; should stay flat across all steps)
4. Medians get pulled via SQL and appended to the results tables below.

Controls: F8 (`dict`) isolates pure client-navigation cost; edge-static probe isolates network
weather. If a control moves, the round is suspect (different network, phone thermal state) — rerun.

## Results log

### S0 — Baseline (instrumentation only) — deployed 2026-07-03

Machine probes (warm, seconds; first cold run excluded):

| Probe | p50 | Notes |
|---|---|---|
| edge static `/login` | **0.18** | HK edge, cache HIT |
| function no-DB `/auth/callback` | **0.42** | +240ms = the iad1 detour |
| machine → Supabase Sydney REST | **0.29** | per-request TLS; in-app keep-alive ≈ ~150ms |
| full corpus API path | n/a until S2 | middleware 302s unauthenticated requests |

Phone flow medians (fill after baseline round):

| Flow | p50 (ms) | n |
|---|---|---|
| cold:home | | |
| study-hub | | |
| epark-twelve | | |
| epark-essay | | |
| review-landing | | |
| learn-landing | | |
| home | | |
| dict (control) | | |

---

### S1 — Pin Vercel functions to Sydney (`"regions": ["syd1"]`)
**Change**: vercel.json only. Function↔DB drops ~200ms→~2ms per round trip; user↔function rises
slightly (HK→SYD ~120ms vs HK→IAD ~200ms). Net win on every route that touches the DB
(which is all of them — middleware `getUser` too).
**Expected**: F2/F4 −300–500ms; F7 (RSC home) −300ms+; `/auth/callback` probe ~0.30.
**Status**: pending
**Measured**: _(fill)_
**Verdict**: _(keep/revert)_

### S2 — Corpus API: public + CDN-cached
**Change**: exclude `/api/learn/curriculum` + `/api/learn/geometry` from the middleware matcher
(public corpus data, no auth inside); add `Cache-Control: public, s-maxage=86400,
stale-while-revalidate=604800` to both. Repeat content loads then serve from the HK edge.
**Expected**: warm-cache F2/F3/F4 → ~50–150ms for the fetch leg; first-hit unchanged from S1.
**Status**: pending
**Measured**: _(fill)_

### S3 — Drop per-call `auth.getUser()` network round trips (client db helpers)
**Change**: `lib/db/**` helpers use `getSession()` / cached user id instead of `auth.getUser()`
(each call = 1 network round trip to Sydney; the Study hub triggers 6+ per load).
**Expected**: F1 study-hub −150–400ms; review/learn landings −150–300ms.
**Status**: pending
**Measured**: _(fill)_

### S4 — `ensureFlashcards` → single RPC
**Change**: replace the download-everything backfill (all flashcard note_ids + all item ids,
paginated 1000/page, on every Study hub + review load) with one
`INSERT … SELECT … WHERE NOT EXISTS` RPC.
**Expected**: F1/F5 −(N/1000 × ~300ms) for large vaults; grows with collection size.
**Status**: pending
**Measured**: _(fill)_

### S5 — `getDueStats` → count RPC
**Change**: one `GROUP BY` RPC returning `{total, captures, byCollection}` instead of paginating
every due row to the client.
**Expected**: F1 −100–400ms depending on due count.
**Status**: pending
**Measured**: _(fill)_

### S6 — Ship `corpus_geometry.json` client-side (kill the essays waterfall)
**Change**: import geometry data in the client bundle (~300KB raw ≈ ~40KB gz, cached with the
bundle) instead of `/api/learn/geometry`; EparkView computes navOrder locally, removing the serial
geometry→curriculum fetch for essays/dialogues/conversations.
**Expected**: F4 ≈ F2 (one fetch instead of two).
**Status**: pending
**Measured**: _(fill)_

### S7 — Stale-while-revalidate content + prefetch
**Change**: cache last-viewed lesson sentences per selection key in localStorage, paint instantly,
revalidate in background; prefetch next/prev lesson on idle.
**Expected**: F3 (next-lesson) → near-0 perceived; repeat F2 → near-0.
**Status**: pending
**Measured**: _(fill)_

### S8 — Middleware: `getUser()` → `getClaims()` (local JWT verification)
**Change**: per current Supabase guidance, verify the JWT locally in middleware instead of a
network call to Sydney on **every** navigation and API request. Requires asymmetric JWT signing
keys enabled on the project.
**Expected**: −120–250ms on every page navigation and API call (stacks with S1).
**Status**: pending
**Measured**: _(fill)_

### S9 — Migrate Supabase project to Tokyo or Singapore (final step)
**Change**: user is in Taiwan; Sydney adds ~2–3× the RTT of Tokyo (`ap-northeast-1`, ~50ms) or
Singapore (`ap-southeast-1`, ~70ms). Migrate the project (pause + restore-to-region via Supabase
dashboard, or dump/restore into a fresh project), then repoint `vercel.json` regions to
`hnd1`/`sin1` and update env URLs if the project ref changes.
**Why last**: it's the only step with real migration risk (data, auth users, storage buckets,
RLS, edge cases), and every earlier step's measurement stays valid — this shifts the whole
baseline down afterward.
**Checklist when we get here**:
- [ ] Inventory: DB size, storage buckets (`ind-audio`), auth users, RPCs, RLS policies
- [ ] Choose region: Tokyo vs Singapore (probe both from phone network)
- [ ] Dry-run restore into a scratch project; verify RLS + RPCs + storage
- [ ] Migration window; repoint `NEXT_PUBLIC_SUPABASE_URL`/keys in Vercel env + Grimoire extension + scripts
- [ ] Flip `vercel.json` regions to match; re-run full protocol as **S9**
**Expected**: user↔DB −80–100ms per round trip on top of everything above.
**Status**: pending
**Measured**: _(fill)_

---

## Notes
- Never compare numbers across different `build` stamps within one step tag.
- Client-nav flows (F8, and F1 when data is cached) also validate that instrumentation overhead is negligible.
- Audio files come from `web.klokah.tw` (external) — out of scope for this campaign.
