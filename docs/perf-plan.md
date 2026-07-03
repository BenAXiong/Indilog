# Performance Campaign — Plan

Goal: cut Study content loading latency (and app-wide response times), measuring the
**actual gain of each step**. One step = one commit = one deploy = one measurement round.
Keep what pays, revert what doesn't. **Results live in [perf-log.md](perf-log.md).**

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

## Measurement

### Primary: browser harness (automated, dev machine)
`scripts/perf/measure.mjs` drives production in a real headless Chromium **on the dev machine
(same network as the user — correct anchor)** and records the app's own click→paint samples.
No phone involvement needed per step.

```sh
node scripts/perf/measure.mjs --login          # one-time, headed: log in, session saved locally
node scripts/perf/measure.mjs --step S1        # full round: 2 cold starts + 5 warm rounds
```

It prints a ready-to-paste medians table and writes raw JSON to `scripts/perf/results/`
(gitignored). Samples also upload to `ind_perf_samples` tagged with step + build stamp:

```sh
npx supabase db query --linked "SELECT step, flow, device, count(*) n, round(percentile_cont(0.5) WITHIN GROUP (ORDER BY ms)) p50 FROM ind_perf_samples GROUP BY 1,2,3 ORDER BY 1,2,3"
```

Flows per warm round: `study-hub` → `epark-twelve` → next-lesson ×3 → `epark-essay` →
`review-landing` → `dict` (**control**, no blocking data) → `home` (RSC) → `cold:learn-landing`.

### Phone spot-check (optional, only twice)
Open the app with `?perf=1` → dark pill bottom-right; tap for panel (set the `step` tag, e.g.
`S0-phone`). Tap through the same flows. Samples upload automatically. Worth doing once at
baseline and once after the final step — not per step.

### Machine-side network probes (per deploy, isolate the legs)
```sh
# edge static — control, should never change
for i in 1 2 3 4 5; do curl -s -o /dev/null -w "%{time_total} " https://indilog.vercel.app/login; done
# function, no DB — isolates the function-region hop
for i in 1 2 3 4 5; do curl -s -o /dev/null -w "%{time_total} " https://indilog.vercel.app/auth/callback; done
# direct Supabase REST (anon key from apps/web/.env.local) — isolates machine→DB
curl -s -o /dev/null -w "%{time_total}" -H "apikey: $KEY" "https://gnmcttlpkiexxoilwhfa.supabase.co/rest/v1/corpus_occurrences?select=original_uuid&source=eq.twelve&limit=5"
# full corpus API path (unauthenticated from S2 onward; before S2 middleware 302s it)
curl -s -o /dev/null -w "%{time_total}" "https://indilog.vercel.app/api/learn/curriculum?source=twelve&dialect=<dialect>&title_zh=Level%201%20Lesson%201"
```
`/api/learn/curriculum` returns `Server-Timing: db;dur=…` separating DB time from network time.

### Rules
- Set the harness `--step` tag to the step being measured; verify the HUD/build stamp matches the deploy.
- Never compare numbers across different `build` stamps within one step tag.
- If a control moves (edge probe, `dict` flow), the round is suspect — rerun.

## Steps

### S0 — Instrumentation + baseline ✅ (committed 8b48ea9)
Flow instrumentation (`?perf=1` HUD, PerfMark), `ind_perf_samples` table, Server-Timing on
curriculum route, browser harness.

### S1 — Pin Vercel functions to Sydney (`"regions": ["syd1"]`)
**Change**: vercel.json only. Function↔DB drops ~200ms→~2ms per round trip; user↔function rises
slightly (HK→SYD ~120ms vs HK→IAD ~200ms). Net win on every route that touches the DB —
middleware `getUser` included.
**Expected**: epark/essay −300–500ms; home (RSC) −300ms+; `/auth/callback` probe ~0.30s.

### S2 — Corpus API: public + CDN-cached
**Change**: exclude `/api/learn/curriculum` + `/api/learn/geometry` from the middleware matcher
(public corpus data, no auth inside); add `Cache-Control: public, s-maxage=86400,
stale-while-revalidate=604800`. Repeat content loads serve from the HK edge.
**Expected**: warm-cache epark flows → ~50–150ms fetch leg; first-hit unchanged from S1.

### S3 — Drop per-call `auth.getUser()` network round trips (client db helpers)
**Change**: `lib/db/**` helpers use `getSession()`/cached user id instead of `auth.getUser()`
(each = 1 round trip to Sydney; the Study hub triggers 6+ per load).
**Expected**: study-hub −150–400ms; review/learn landings −150–300ms.

### S4 — `ensureFlashcards` → single RPC
**Change**: replace the download-everything backfill (all flashcard note_ids + all item ids,
paginated 1000/page, on every Study hub + review load) with one
`INSERT … SELECT … WHERE NOT EXISTS` RPC.
**Expected**: study-hub/review −(N/1000 × ~300ms); grows with vault size.

### S5 — `getDueStats` → count RPC
**Change**: one `GROUP BY` RPC returning `{total, captures, byCollection}` instead of paginating
every due row to the client.
**Expected**: study-hub −100–400ms depending on due count.

### S6 — Ship `corpus_geometry.json` client-side (kill the essays waterfall)
**Change**: import geometry in the client bundle (~300KB raw ≈ ~40KB gz, cached with the bundle)
instead of `/api/learn/geometry`; EparkView computes navOrder locally, removing the serial
geometry→curriculum fetch for essays/dialogues/conversations.
**Expected**: epark-essay ≈ epark-twelve (one fetch instead of two).

### S7 — Stale-while-revalidate content + prefetch
**Change**: cache last-viewed lesson sentences per selection key (localStorage), paint instantly,
revalidate in background; prefetch next/prev lesson on idle.
**Expected**: next-lesson → near-0 perceived; repeat epark-twelve → near-0.
**Note**: evaluate after S2/S8 — may be largely superseded by the dialect content pack.

### S8 — Dialect content pack (Amis first)
**Change**: precompute one JSON pack per dialect with the **entire** study content
(twelve/grmpts/essay/dialogue/con_practice). Measured: Malan Amis = 3,131 sentences ≈ **472KB raw
≈ ~120KB gzipped** — smaller than many single images. Serve as a static CDN asset (or Supabase
Storage), download on first use into IndexedDB, version by a pack hash; EparkView reads locally
and falls back to the API for dialects without a pack.
**Expected**: all epark content loads → ~0ms network after first visit; works offline (audio still
streams from klokah.tw). Most users are Amis (Malan) — highest-value dialect first.

### S9 — Middleware: `getUser()` → `getClaims()` (local JWT verification)
**Change**: per current Supabase guidance, verify the JWT locally in middleware instead of a
network call on **every** navigation and API request. Requires asymmetric JWT signing keys
enabled on the project.
**Expected**: −120–250ms on every page navigation and API call (stacks with S1).

### S10 — Migrate Supabase project to Tokyo or Singapore (final step)
**Change**: user is in Taiwan; Sydney adds ~2–3× the RTT of Tokyo (`ap-northeast-1`, ~50ms) or
Singapore (`ap-southeast-1`, ~70ms). Migrate the project, then repoint `vercel.json` regions to
`hnd1`/`sin1` and update env URLs if the project ref changes.
**Why last**: the only step with real migration risk (data, auth users, storage buckets, RLS);
every earlier step's measurement stays valid — this shifts the whole baseline down afterward.
**Checklist**:
- [ ] Inventory: DB size, storage buckets (`ind-audio`), auth users, RPCs, RLS policies
- [ ] Choose region: Tokyo vs Singapore (probe both from home network)
- [ ] Dry-run restore into a scratch project; verify RLS + RPCs + storage
- [ ] Migration window; repoint `NEXT_PUBLIC_SUPABASE_URL`/keys in Vercel env + Grimoire extension + scripts
- [ ] Flip `vercel.json` regions to match; re-run full protocol as **S10**
**Expected**: user↔DB −80–100ms per round trip on top of everything above.

## Out of scope
- Audio files come from `web.klokah.tw` (external).
