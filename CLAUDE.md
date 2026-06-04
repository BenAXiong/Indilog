# Indivore — Claude Code Instructions

## At the start of every session
- Read `agents.md`, `plan-v1.md`, `decisions.md` to orient (also skim `plan.md` for v0 history if needed; `archive/plan-srs.md` for completed SRS work)
- If touching `ind_items`, `ind_flashcards`, or any query/type layer: read `architecture.md` first

## After every commit
- Append one or more rows to `log.md` covering what changed
- Format: `| 2026-MM-DD HH:MM | TYPE | Description |`
- Types: FEATURE, FIX, REFACTOR, SCHEMA, CONFIG, PHASE COMPLETE

## Code constraints
- Never put non-ASCII characters literally inside regex character classes in `.ts` files — SWC rejects them at build time and the Write/Edit tools corrupt them silently via JSON encoding. Always use `\uXXXX` escapes: e.g. `/[‘’ʼꞌ]/g` for apostrophe variants, NOT the literal curly-quote characters.

## Security
- `INFERENCE_API_URL` and `INFERENCE_API_KEY` must NEVER have `NEXT_PUBLIC_` prefix — server-side only
- Never commit `.env.local`
