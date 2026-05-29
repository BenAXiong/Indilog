# Indivore — Claude Code Instructions

## At the start of every session
- Read `agents.md`, `plan-v1.md`, `plan-srs.md`, `decisions.md` to orient (also skim `plan.md` for v0 history if needed)

## After every commit
- Append one or more rows to `log.md` covering what changed
- Format: `| 2026-MM-DD HH:MM | TYPE | Description |`
- Types: FEATURE, FIX, REFACTOR, SCHEMA, CONFIG, PHASE COMPLETE

## Security
- `INFERENCE_API_URL` and `INFERENCE_API_KEY` must NEVER have `NEXT_PUBLIC_` prefix — server-side only
- Never commit `.env.local`
