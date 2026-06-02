# Project Portfolio Summary

## Project name
**Indivore** — a personal Formosan-language study notebook.
(The GitHub repo and Vercel project are named **Indilog**; "Indivore" is the product name.)

## One-line pitch
A fast, mobile-first PWA for learning Taiwan's 16 indigenous (Formosan) languages — capture what you hear, look it up, translate it, and review it with a built-from-scratch spaced-repetition engine, all in one personal notebook.

## Target users / clients
- Self-directed learners and heritage speakers of Taiwan's 16 official Formosan (Austronesian) languages.
- Students working through the official klokah.tw curriculum who want their own capture + review layer on top.
- Secondary / future: language teachers and revitalisation organisations who need a lightweight study tool for an under-resourced language.

## Problem it solves
Formosan languages are endangered and under-resourced. The learning material that *does* exist is scattered across government sites — the klokah.tw curriculum, the ILRDF dictionary — none of which let a learner keep a personal record of words they hear in the wild, look them up, translate, and drill them over time. Indivore unifies **capture, dictionary, translation, structured curriculum, and spaced-repetition review** into a single personal app, so the daily learning loop lives in one place instead of five browser tabs and a paper notebook.

## What I built
A complete full-stack PWA (Next.js 15 / React 19 / TypeScript) on a Supabase backend, deployed on Vercel. It includes:
- A **capture flow** for saving words / sentences / notes with rich provenance (source, speaker, dialect, place-heard).
- A **dictionary** over a ~293k-entry indigenous-language corpus with full-text search, dialect filters, de-duplication, and inline audio.
- **AI translation** between Traditional Chinese and 6 Formosan languages via a custom inference model.
- A **structured Learn curriculum** spanning five content sources (12-level lessons, grammar patterns, essays, dialogues, conversations) across 42 dialects, with audio, bookmarkable straight into the review queue.
- A **custom spaced-repetition system** (FormoSRS-1) with daily goals, streaks, a heatmap, per-language stats, and a full-screen review session.
- A **note-centric data model** with a documented architecture, plus a corpus data pipeline (scrape → distill → migrate) feeding ~185k sentences / 201k occurrences into Postgres.

## Top 5 features
1. **Custom SRS engine (FormoSRS-1)** — SM-2 base with ease-recovery (an "ease hell" fix), interval fuzz, and mature-lapse relearn bursts. Full-screen review with tap-to-reveal, swipe gestures, keyboard shortcuts, single-level undo, defer, daily goal ring, streak heatmap, and a session-summary screen.
2. **Quick capture** — save a word/sentence/note in seconds with optional source, speaker, dialect, and place-heard metadata; everything captured flows into the review queue.
3. **Corpus dictionary** — search a 293k-entry vocabulary corpus with FTS, per-dialect filtering, romanisation-aware de-duplication, and inline audio playback.
4. **Structured Learn curriculum** — five aligned content sources (lessons, grammar patterns, essays, dialogues, conversations) × 42 dialects, with sentence/word audio and one-tap bookmarking into your own deck.
5. **AI translation** — Traditional Chinese ↔ 6 Formosan languages through a custom FormoBank model, with output saveable as a captured note.

## What makes it impressive
- **A genuinely thoughtful SRS architecture.** Notes are the unit of knowledge; review "modes" (forward / audio / STS) are presentation lenses, not duplicated card rows — which keeps the browser one-row-per-word while still supporting multiple drill styles. Every non-obvious decision is written up in a `decisions.md` ADR log.
- **An end-to-end data-engineering story.** Scraping the official klokah.tw curriculum, distilling it into a structured corpus (185k sentences, 201k occurrences, 293k vocabulary entries), homogenising lesson "geometry," and migrating the whole thing from a 215 MB git-LFS SQLite file to Supabase Postgres to kill the serverless-SQLite awkwardness.
- **A custom, documented scheduling algorithm** rather than an off-the-shelf library — with written rationale for each parameter (Good +0.02 ease recovery, ±5% fuzz, Anki-style Hard, 3-restart relearn cap).
- **It's a real, working app for an endangered language family** — culturally meaningful infrastructure, not a to-do-list clone.

## What it proves I can do
- **Full-stack product engineering:** Next.js App Router, strict TypeScript, Supabase (Google OAuth, Postgres, row-level security, Storage), Vercel — auth, data, and UI shipped end to end.
- **Data engineering / ETL:** web scraping, a distillation pipeline, schema design, and a live SQLite → Postgres migration of ~680k rows.
- **Algorithm design:** implementing and tuning a spaced-repetition scheduler from first principles.
- **Engineering discipline at solo scale:** layered architecture, a directory contract, an ADR/decision log, a phase-gated plan, and a timestamped change log — maturity beyond "just shipping."
- **AI integration:** wiring a custom translation model behind a validated, server-only inference proxy.

## Current status
**Live prototype.** Deployed on Vercel and functional. Milestones M1 (SRS + review overhaul), M2 (library/browser), and M3 (corpus rescrape + DB homogenisation + Supabase migration) are complete; M4–M6 (sources DB, UI polish, broader testing/accessibility) are pending. Single-user / personal-use stage — actively developed by a solo builder, not yet publicly launched.

## Demo URL
Deployed on Vercel under the project **`indilog`** (latest production build is live/Ready).
- Probable stable alias: `https://indilog.vercel.app` — **confirm before sharing.** Sign-in is Google OAuth via Supabase.
- _Note:_ per-deployment URLs are team-scoped and may sit behind Vercel access protection; assign/confirm a public custom domain before using this as a public demo link.

## GitHub URL, if public
`https://github.com/BenAXiong/Indilog`
- **Visibility unconfirmed — likely private.** Confirm before listing publicly. If made public, ensure the scraped corpus and any `.env*` files stay out of the repo (the 215 MB corpus DB has already been removed from git history; see caveat below).

## Screenshots available?
Not captured yet, but trivial to produce from the live app (mobile-first; dashboard, capture, dictionary, learn, and review session all screenshot well). Claude Design HTML mockups also exist in `design-handoff/`.

## Short demo video available?
None yet. A 60–90s screen recording of the capture → review loop would be the highest-value asset to add.

## Tech stack
Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS v3 · Supabase (Auth/Google OAuth, Postgres + RLS, Storage) · Zod · Vercel · pnpm monorepo. Custom translation model (FormoBank) served via Modal. Corpus migrated from SQLite/better-sqlite3 to Supabase Postgres.

## Data / copyright / privacy caveats
**Do not publicly overstate content ownership.** The dictionary and curriculum corpus is **derived from third-party Taiwanese government / educational sources** — primarily the klokah.tw curriculum (Council of Indigenous Peoples / Ministry of Education) and the ILRDF dictionary. That content is copyrighted by those bodies; it cannot be redistributed or commercialised without permission, and audio is referenced/snapshotted from klokah.tw. The corpus database was deliberately removed from git and should never be published. The translation model is custom; the app code is original work. User-captured data is private and protected by Supabase row-level security. **Framing should be: original application + pipeline built *on top of* openly available official educational content — not "my dataset."**

## Best commercial angle
The reusable IP is the **capture + corpus + SRS + curriculum stack**, which is largely language-agnostic. Plausible buyers/funders:
- **Indigenous-language revitalisation bodies** in Taiwan (Council of Indigenous Peoples, ILRDF, indigenous schools) wanting a modern study/companion app over their existing curriculum.
- **Grant-funded language-preservation NGOs and universities** for *other* endangered or minority language families — the same architecture re-skins onto a new corpus.
- **EdTech** angle: a white-label "personal notebook + spaced-repetition + structured curriculum" engine for any under-resourced language where Duolingo-scale products will never invest.
Direct consumer monetisation is weak (small audience, content-rights constraints); the value is as funded/commissioned infrastructure or a reusable engine.

## Best portfolio angle
Lead with the **systems story, not the feature list.** Emphasise:
1. A solo-built, genuinely full-stack product (auth → DB/RLS → custom SRS → AI translation → data pipeline) for a hard, real-world domain.
2. The **data-engineering narrative**: scrape → distill 680k rows → homogenise → migrate SQLite-in-serverless to Postgres, with the architectural reasoning documented.
3. The **custom spaced-repetition algorithm** with written design rationale — shows you can reason about a system, not just call a library.
4. **Engineering maturity**: ADR log, layered architecture, phase-gated planning — evidence you build maintainably, not just quickly.
5. **Mission framing**: technology serving endangered indigenous languages — memorable, differentiated, and easy for a reviewer to root for.
The case study should show the architecture diagram and the SRS decision write-up; that's what separates this from a typical bootcamp CRUD app.
