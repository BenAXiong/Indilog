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

### S6 — Ship `corpus_geometry.json` client-side — **SUPERSEDED, skipped**
S2's edge cache already serves geometry in ~50ms warm, and S8's pack removes the content fetch
entirely; the waterfall this targeted no longer costs enough to spend a deploy on.

### S7 — Stale-while-revalidate content + prefetch — **SUPERSEDED, skipped**
Same reasoning: S2 covers repeat fetches at the edge, S8 covers everything for packed dialects.

### S8 — Dialect content pack (Amis first)
**Change (as built)**: `scripts/build-content-packs.mjs` bakes per-dialect JSON packs into
`public/packs/` (CDN-served, version-busted by content hash) + `lib/learn/pack-manifest.json`.
Two packs: `amis-malan` (twelve/essay/dialogue/con_practice, 3,131 rows, 654KB raw) and
`amis-grammar` (grmpts lives under the language-level dialect_name 阿美語, 2,021 rows, 348KB).
Client (`lib/learn/packs.ts`) caches packs in IndexedDB; EparkView reads pack-first with API
fallback for unpacked dialects/keys. Rebuild + commit after corpus edits.
**Expected**: all epark content loads → ~0ms network after first pack download; works offline
(audio still streams from klokah.tw).

### S9 — Middleware: `getUser()` → `getClaims()` (local JWT verification)
**Change**: per current Supabase guidance, verify the JWT locally in middleware instead of a
network call on **every** navigation and API request. Requires asymmetric JWT signing keys
enabled on the project.
**Expected**: −120–250ms on every page navigation and API call (stacks with S1).

### S10 — Migrate Supabase project to Tokyo — **INVESTIGATED 2026-07-03, DEFERRED**

**Region choice (measured from home network)**: Tokyo `ap-northeast-1` RTT ≈ **35ms** vs
Singapore ≈ 70ms vs Sydney (current) ≈ **160ms** → Tokyo, functions to `hnd1`.
**Inventory (measured)**: DB 258MB · storage 108MB / 2,923 objects (`ind-audio`) · **1 auth user**.
**Expected when done**: −120ms per client↔DB round trip, compounding across chains —
review-landing ~2.7s → ~1.6s, study-hub ~760 → ~550ms, home ~670 → ~500ms; packs unaffected (29ms).

**Mechanics** (Supabase has no in-place region move → new project + cutover):
1. Create Tokyo project (same project can serve as dry-run target, then production)
2. pg_dump/restore (public + auth schemas: RLS, all 4 RPCs, corpus tables come along)
3. Scripted storage copy (`ind-audio`)
4. Repoint the new project ref everywhere: Vercel env + `apps/web/.env.local`,
   **Google OAuth callback** (`https://<new-ref>.supabase.co/auth/v1/callback` in Google Cloud
   Console + provider config in new project — forgetting this breaks login entirely),
   Grimoire extension, ILRDF pipeline scripts, perf harness (`mint-session.mjs` hardcodes ref),
   `supabase link`, `vercel.json` `syd1`→`hnd1`
5. Sessions invalidate (new signing keys) — trivial with 1 user
6. Cutover: brief writes-freeze → delta dump/restore → env flip + deploy → harness round as S10
7. Rollback: Sydney project **paused, not deleted** for ≥1 week

**Why deferred**: (a) free-tier project slots are occupied — IA DuBoulot is needed and stays;
(b) **FormosanEchoes hosts multiple hitchhiking projects beyond Indivore**, so migration scope
= every tenant of the DB, not just this app — too messy for now. Revisit when the shared
project gets consolidated, or with one month of Pro for the transition window.
(Read-replica alternative rejected: SRS writes on every card rating would still go to Sydney.)

### S11 — Session-queue loading (a+b+c DONE 2026-07-03)
**Problem**: after S1–S5, `review-landing` (2.7s) and `learn-landing` (2.8s) are dominated by
`listDueFlashcards` / `listLearnFlashcards` downloading the **entire** due/new queue with joined
item data, even though a session uses only `sessionCap` cards.
**Sketch**: fetch `sessionCap + buffer` rows with a DB `LIMIT`, plus a cheap count for the
badge/overflow numbers.
**Why it needs a decision first**: both functions apply **priority-deck ordering client-side
across the full queue** (`listLearnFlashcards` sorts by priority deck → level/lesson/position;
review sorts due cards by priority deck). A naive DB LIMIT selects cards *before* priority
ordering, changing which cards enter a session — that's SRS behavior, not just perf. Options:
push priority ordering into SQL (needs the virtual-deck matching logic server-side), or fetch
per-priority-deck in order until the cap is filled. Read `CONTEXT.md` + priority-deck ADRs and
get sign-off before implementing.
**Expected if done**: review/learn landings well under 1s.

## Out of scope
- Audio files come from `web.klokah.tw` (external).
