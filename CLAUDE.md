# Indivore — Claude Code Instructions

## At the start of every session
- Read `agents.md`, `plan-v1.md`, `decisions.md` (ADR index — individual ADRs in `docs/adr/`) to orient (also skim `plan-v0.md` for v0 history if needed; `docs/archive/plan-srs.md` for completed SRS work)
- Skim `design-questions.md` (cross-cutting open questions) and `plan-v+.md` (beyond-v1 ideas) to avoid re-raising settled deferrals
- If working on M5-B SRS overhaul (Learn/Review split, priority list, GoalSheet, mastery grades): read `plan-v1-M5-srs.md` and `CONTEXT.md` before starting
- If touching `ind_items`, `ind_flashcards`, or any query/type layer: read `architecture.md` first

## After every commit
- Append one or more rows to `log.md` covering what changed
- Format: `| 2026-MM-DD HH:MM | TYPE | Description |`
- Types: FEATURE, FIX, REFACTOR, SCHEMA, CONFIG, PHASE COMPLETE

## Pushing
- **Never push without explicit approval.** When a commit or batch of commits seems ready to ship, say so and ask — do not push until the user confirms.
- After an approved push, check Vercel build status with `npx vercel ls`.

## Commit cadence
- Commit after each complete, self-contained unit: one bug fix, one feature, one schema change
- Multiple small related tweaks (e.g. 2–3 copy fixes in one session) can be batched into one commit if they're trivially related
- Never commit mid-feature when code is broken or partial
- Never batch unrelated changes — a bug fix + a new feature = two commits
- Rule of thumb: if the `git log` entry for this commit reads as one complete thing, it's the right size

## Code constraints
- Never put non-ASCII characters literally inside regex character classes in `.ts` files — SWC rejects them at build time and the Write/Edit tools corrupt them silently via JSON encoding. Always use `\uXXXX` escapes: e.g. `/[‘’ʼꞌ]/g` for apostrophe variants, NOT the literal curly-quote characters.
- **Never use `new Date().toISOString().slice(0, 10)` to get a "today" date string** — `toISOString()` returns UTC, which is wrong for any user not in UTC±0. Always use `localDateStr()` or `getStudyDate()` from `@/lib/db/srs/flashcards`. These return `LocalDateString` (branded type); raw strings from `toISOString().slice()` are plain `string` and will be rejected by TypeScript wherever `LocalDateString` is required.
- **Supabase embed filters exclude nothing without `!inner`** — `.filter('ind_items.x', …)` on a non-inner embed nulls the join and keeps the row (DEC-ARCH03). Mark the embed `!inner` or push the logic into an RPC.
- **Client code never calls `auth.getUser()`** — use `getSessionUser()` from `@/lib/supabase/session` (local read, no network; RLS authorizes server-side anyway). `getUser()` is for server code only; middleware uses `getClaims()`. (DEC-ARCH04)
- **`.limit(N)` is silently capped at 1000 by PostgREST** — any possibly->1000-row query goes through `paginate<T>` (DEC-SRS04).
- **After corpus edits**: rebuild dialect content packs (`node scripts/build-content-packs.mjs`) and commit; the corpus API's CDN cache purges on deploy.

## Performance work
- Perf claims need measurements: `node scripts/perf/mint-session.mjs && node scripts/perf/measure.mjs --step <tag>` (headless-Chromium harness against production; `?perf=1` shows the in-app HUD). One change = one deploy = one measured round, appended to `docs/perf-log.md`. Standing decisions: DEC-ARCH04; baseline history: `docs/perf-log.md`.
- Vercel functions are region-pinned to the Supabase region in `vercel.json` — if the DB ever moves (perf-plan § S10), move the pin in the same deploy.

## Security
- `INFERENCE_API_URL` and `INFERENCE_API_KEY` must NEVER have `NEXT_PUBLIC_` prefix — server-side only
- Never commit `.env.local`

## Global skills (`~/.claude/skills/`)

| Slash command | What it does |
|---|---|
| `/grill-with-docs` | Stress-test a plan against the domain model — interview style, one question at a time; updates `CONTEXT.md` and creates ADRs inline. Read `SKILL.md` + `CONTEXT-FORMAT.md` + `ADR-FORMAT.md` before running. |
| `/zoom-out` | Map all relevant modules and callers for an unfamiliar area of code using domain glossary vocabulary. |
| `/prototype` | Build throwaway code to answer a design question — logic branch (terminal state machine) or UI branch (variant switcher). Read `SKILL.md` + `LOGIC.md` + `UI.md`. |
| `/to-prd` | Synthesize the current conversation context into a PRD and publish it to the issue tracker. Read `SKILL.md`. |
| `/to-issues` | Break a plan or PRD into independently-grabbable vertical-slice issues on the issue tracker. Read `SKILL.md`. |
| `/triage` | Move issues through the triage state machine (`needs-triage` → `ready-for-agent` / `ready-for-human` / `wontfix` etc.). Read `SKILL.md` + `AGENT-BRIEF.md` + `OUT-OF-SCOPE.md`. |
| `/improve-codebase-architecture` | Find deepening opportunities; produces an HTML report of candidates with before/after diagrams. Read `SKILL.md`. |
