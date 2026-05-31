# Indivore — Agent Workflow Guidelines

This document governs how Claude Code agents should work on this project. Read it at the start of every session.

---

## Core principle

Build in layers. Complete each phase before moving to the next. Do not half-wire multiple phases at once.

---

## Key documents — always keep updated

| Doc | Purpose | When to update |
|-----|---------|---------------|
| `plan.md` | Detailed todo, phase by phase | Mark tasks done as you complete them; add sub-tasks as discovered |
| `log.md` | Timestamped record of features, fixes, schema changes, and decisions | Every meaningful change — at least one entry per session |
| `decisions.md` | Open questions and resolved architectural/product decisions | When a new ambiguity is discovered or resolved |
| `agents.md` (this file) | Workflow rules for agents | When a new pattern or rule is established |
| `CLAUDE.md` | Project-level setup notes for Claude Code | When env vars, commands, or tooling change |
| `architecture.md` | Canonical data model — Note/Card schema, session modes, audio resolution, migration status | When schema or model decisions change |

**Rule:** Do not end a session without updating `log.md` and checking that `plan.md` reflects completed work.

---

## Session startup checklist

1. Read `plan.md` — identify the current phase and next task.
2. Read `decisions.md` — check for open questions that affect the current task.
3. Check `log.md` — orient yourself to what was last done.
4. If a design checkpoint is due, fetch the Claude Design output before writing UI code.
5. **Before starting a new phase:** run the phase-start confirmation gate (see "Clarify before you build").

---

## Design checkpoints

The workflow doc specifies design checkpoints at phases 0, 1, 2, 3, 4, 5, 6, and 7. At each checkpoint:

1. Fetch the current Claude Design output.
2. Update `docs/design-system.md` and `docs/ui-screens.md`.
3. Reconcile the running implementation against the design before continuing.
4. Log what was updated in `log.md`.

Do not improvise visual direction when design output is available for the component being built.

---

## Phase progression rules

- Each phase has explicit exit criteria in the workflow doc — verify them before declaring a phase complete.
- Log phase completions in `log.md` with a `[PHASE COMPLETE]` marker.
- Update `plan.md` to mark the phase done and surface the next phase.

---

## Clarify before you build

**Default rule: when in doubt, ask. Never assume.**

If any design or implementation detail is not 100% clear from the spec, `decisions.md`, or prior conversation — stop and ask the user before writing code. A short clarifying question costs nothing. Implementing the wrong thing costs a rewrite.

This applies to:
- UX behavior that could reasonably go two ways
- Data model choices with real migration consequences
- API contracts or external service behavior
- Visual/layout decisions not covered by a design checkpoint
- Any "I'll just assume X" moment — don't assume, ask

### Phase-start confirmation gate

**Before writing any code for a new phase**, summarize your understanding of the phase to the user and ask for go-ahead. Include:
- What you're about to build
- Any open questions from `decisions.md` that touch this phase
- Any design/implementation detail you're uncertain about

Do not proceed until the user confirms. This is mandatory, not optional.

### When you encounter an ambiguity mid-phase

1. Check `decisions.md` — it may already be resolved.
2. If unresolved, stop and ask the user. Do not self-resolve and move on.
3. Once answered, log the resolution in `decisions.md` under Resolved before continuing.

Do not silently make any decision — minor or major — without logging it and getting user sign-off.

---

## Architecture rules

**Data model:** Before touching `ind_items`, `ind_flashcards`, or any file in `lib/db/srs/` or `lib/db/notebook/`, read `architecture.md`. It is the canonical reference for the Note/Card model, field names, session modes, and migration status. Do not add `front`/`back` fields to notes or cards under any circumstances.

Before creating any new file in `apps/web/lib/` or `apps/web/components/`, check the directory contract in **DEC-ARCH01** (`decisions.md`) and place it in the right folder:

| What you're building | Where it goes |
|---|---|
| New Supabase helper | `lib/db/<subdomain>/` — `notebook/` `srs/` `progress/` `profile/` |
| New SQLite query | `lib/corpus/dict.ts` or `lib/corpus/curriculum.ts` (or a new file in `lib/corpus/`) |
| Static YCM / dialect metadata | `lib/lang/` |
| Cross-app UI component | `components/lookup/` or a new `components/<domain>/` — **never** inside a feature folder like `components/learn/` |
| Utility imported by 3+ features | `lib/lang/` or another neutral `lib/` folder — never inside a feature folder |

**Lang/dialect state:** Never write a new profile fetch. Use `useLang()` from `lib/context/LangDialectProvider`. If `setLang` / `setDialect` don't cover the use case, extend the provider — don't bypass it.

**API routes:** Dict routes → `app/api/dict/`. Learn/corpus routes → `app/api/learn/`. New feature routes → `app/api/<feature>/`.

When in doubt: grep for where similar code already lives, then match it.

---

## Code hygiene

- Follow the repo structure in the workflow doc (`apps/web/`, `packages/`, `supabase/`).
- All Supabase tables use the `ind_` prefix.
- All visible UI strings go through the i18n helper — no hardcoded English strings in components.
- Keep shared constants and validation out of page components.
- TypeScript throughout — no `any` without a comment explaining why.
- Inline React style objects are the project convention — do not introduce Tailwind utility classes on components that already use inline styles. Tailwind is used only for animations/keyframes defined in `tailwind.config.js`.

---

## Out-of-scope guard

Before adding any feature, check the explicit out-of-scope list in the workflow doc. If a feature is listed there, do not build it for v0 even if it seems useful.

---

## Commit cadence

**Commit after every meaningful unit of work — not at the end of a session.**

A "unit of work" is one component, one screen, one schema change, or one self-contained fix. Never accumulate multiple features/fixes into a single commit.

Why this matters: `log.md` timestamps come from `git log -1 --format="%ai"`. If you batch an entire session into one commit, all log entries get the same timestamp, making the history unreadable.

Concrete triggers to commit:
- New file created (component, migration, lib)
- Existing screen has a complete, working change
- Schema migration added
- Bug fixed and verified

Do not wait until the user asks. Do not wait until the end of the session.

---

## Log entry format

Table columns: `Timestamp | Type | Description`

Timestamp format: `YYYY-MM-DD HH:MM` — use the **actual git commit timestamp** (`git log -1 --format="%ai"`), not a made-up or sequential time. Commit granularly (per screen, per component, per meaningful change) so entries get distinct real timestamps.

Types: `FEATURE`, `FIX`, `SCHEMA`, `DECISION`, `PHASE COMPLETE`, `CHECKPOINT`, `CONFIG`, `REFACTOR`

**Rule:** Commit before logging. Get the real timestamp from git. Never invent timestamps.

---

## What not to do

- Do not push to remote or create PRs without explicit user instruction.
- Do not implement features from the out-of-scope list.
- Do not skip design checkpoints when a new major screen is being built.
- Do not make silent decisions about translation pairs, dictionary API shape, or auth flow — these belong in `decisions.md`.
- Do not end a session with `plan.md` still showing tasks that were completed in that session.
- Do not invent log timestamps — always derive them from `git log -1 --format="%ai"` after committing.
- Do not batch all work into one commit per phase — commit per screen or meaningful unit so log entries get real distinct timestamps.
- Do not start a new phase without running the phase-start confirmation gate.
- Do not self-resolve an ambiguity and keep coding — stop, ask, log the answer.
