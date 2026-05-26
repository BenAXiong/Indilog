# Indivore — Implementation Log

| Timestamp | Type | Description |
|-----------|------|-------------|
| 2026-05-26 02:34 | CONFIG | Created project docs: agents.md, plan.md, log.md, decisions.md from workflow spec |
| 2026-05-26 02:34 | CHECKPOINT | Design Checkpoint 0 complete — read design handoff bundle (zip); created docs/design-system.md and docs/ui-screens.md. Resolved DEC-003. Opened DEC-006/007 (both confirmed v0 by user). |
| 2026-05-26 02:34 | FEATURE | Scaffolded pnpm workspace monorepo — apps/web/ (Next.js 15, TypeScript strict, Tailwind v3), packages/ stubs (shared, dictionary-client, translator, scheduler), supabase/ dir. |
| 2026-05-26 02:34 | FEATURE | Added app shell — root layout with Google Fonts + PWA meta, (main) route group layout with BottomNav, placeholder pages for /, /learn, /review, /capture, /dict, /translate, /settings. |
| 2026-05-26 02:34 | FEATURE | Added lib/ layer — Supabase browser + server clients, auth middleware, i18n helper + full English message catalog, LANGUAGES constant (16 Formosan languages), SUPPORTED_PAIRS constant (mock, pending DEC-002). |
| 2026-05-26 02:34 | FEATURE | Added Tailwind config with full design token palette (cream/paper/ink/crimson/terra/amber/sage) and animation keyframes (iv-rise, iv-flip, iv-toast, iv-shimmer, iv-pulse). |
| 2026-05-26 02:34 | FIX | Typed cookiesToSet parameter explicitly as `{ name, value, options: CookieOptions }[]` in server.ts and middleware.ts to satisfy TypeScript strict mode. |
| 2026-05-26 02:34 | PHASE COMPLETE | Phase 0 — build passes clean (11 routes, 0 type errors). Vercel deploy pending DEC-005 (Supabase env vars). |
| 2026-05-26 02:45 | FIX | Resolved Vercel output directory double-prefix — changed outputDirectory from `apps/web/.next` to `.next` in vercel.json. |
| 2026-05-26 10:56 | FEATURE | Phase 1 — design token system (lib/tokens.ts) and mock data layer (lib/mock-data.ts). |
| 2026-05-26 10:56 | FEATURE | Phase 1 — full UI component library: Icon (40+ SVG icons), Chip, Card, Button, SectionHead, LangAvatar, Stat, Toast, Wordmark. |
| 2026-05-26 10:56 | FEATURE | Phase 1 — nav components: DesktopSidebar (232px sticky, usePathname active detection), ScreenHeader (CSS sphere home link, lang chip, title, settings link). |
| 2026-05-26 10:56 | FEATURE | Phase 1 — responsive layout: lg:grid sidebar + main column; BottomNav hidden on lg+; DesktopSidebar hidden on mobile. |
| 2026-05-26 10:56 | FEATURE | Phase 1 — Dashboard screen: deterministic heatmap (seed-based), streak banner, 2×2 stats grid, recent captures list. |
| 2026-05-26 10:56 | FEATURE | Phase 1 — Capture screen: textarea + token chips + metadata form (source/speaker/place/notes) + Toast save confirmation. |
| 2026-05-26 10:56 | FEATURE | Phase 1 — Review screen: landing page with dialogue drills + session flashcard view with animate-iv-flip and rating buttons. |
| 2026-05-26 10:56 | FEATURE | Phase 1 — Dictionary screen: search input + exact match card with definitions/examples + partial matches list. |
| 2026-05-26 10:56 | FEATURE | Phase 1 — Translate screen: 3-column pair selector, source textarea, output panel with crimson accent, copy/save actions. |
| 2026-05-26 10:56 | FEATURE | Phase 1 — Settings screen: profile card, language selector, interface locale toggle, daily goal slider, account rows. |
| 2026-05-26 10:56 | FEATURE | Phase 1 — Learn screen: empty-state placeholder (lessons coming soon). |
| 2026-05-26 10:56 | FIX | Phase 1 — TypeScript literal widening: explicit `string` annotation on labelColor in settings page to allow multi-token assignment. |
| 2026-05-26 10:56 | CONFIG | package.json build script: added `NODE_OPTIONS='--max-old-space-size=4096'` to prevent webpack OOM crash on Windows. |
| 2026-05-26 10:56 | PHASE COMPLETE | Phase 1 — all 7 screens built. Build clean (11 routes, 0 type errors). Design Checkpoint 1 satisfied against Claude Design handoff. |
| 2026-05-26 11:15 | SCHEMA | ind_profiles migration — user_id, active_study_language, default_dialect, ui_locale, daily_goal; RLS enabled; updated_at trigger. |
| 2026-05-26 11:15 | FEATURE | /login page — Google OAuth sign-in via Supabase, on-brand design, redirects to /auth/callback. |
| 2026-05-26 11:15 | FEATURE | /auth/callback route — exchanges OAuth code for session, upserts ind_profiles row on first login. |
| 2026-05-26 11:15 | FEATURE | Middleware — redirects unauthenticated users to /login; allows /login and /auth/* through. |
| 2026-05-26 11:15 | FEATURE | Settings page — wired to real ind_profiles data; saves language, locale, and daily goal on change; sign-out action. |
| 2026-05-26 11:35 | SCHEMA | Phase 3 migrations — ind_sources, ind_speakers, ind_items, ind_item_tokens, ind_flashcards, ind_reviews, ind_daily_stats; increment_captured_today() RPC function. |
| 2026-05-26 11:36 | FEATURE | Data helpers — lib/db/items.ts, sources.ts, speakers.ts, stats.ts (browser), stats-server.ts (server component). |
| 2026-05-26 11:36 | FEATURE | InlineSelector component — searchable dropdown with inline create, used for source/speaker in Capture. |
| 2026-05-26 11:36 | FEATURE | Capture page — saves real ind_items rows; type toggle (word/sentence/note); source/speaker InlineSelector; increments daily stats. |
| 2026-05-26 11:36 | FEATURE | Dashboard — reads real stats (streak, totals, due count) and recent captures from Supabase. |
| 2026-05-26 11:36 | PHASE COMPLETE | Phase 3 — full data layer live. User can capture, view recent items on dashboard, and stats reflect real data. |
| 2026-05-26 11:39 | REFACTOR | Icon component — switch statement (42 cases) refactored to lookup map Record<IconName, fn> to resolve SonarLint S1479. |
| 2026-05-26 11:45 | FEATURE | Phase 4 — Capture dialect field (wave icon), recent captures list (last 5), tap-to-edit (loadItem), edit mode banner, Update/Cancel buttons, set-as-default language action. |
| 2026-05-26 11:45 | PHASE COMPLETE | Phase 4 — Capture / SeMi v0. Core capture workflow complete: save, edit, recent items, dialect, set-default. tsc clean. |
| 2026-05-26 11:52 | SCHEMA | Phase 7 migration — due_at column on ind_flashcards; increment_reviewed_today() RPC. |
| 2026-05-26 11:52 | FEATURE | lib/db/flashcards.ts — ensureFlashcards (auto-generate cards for new items), listDueFlashcards, rateCard (fixed intervals: 10m/1d/3d/7d, writes ind_reviews + updates due_at). |
| 2026-05-26 11:52 | FIX | dueCount in stats.ts and stats-server.ts — now queries ind_flashcards.due_at (null = due) instead of ind_reviews. |
| 2026-05-26 11:52 | FEATURE | Review page — live flashcard session (ensureFlashcards on mount, reveal/rate loop), real due count card, saved items browsing, completion banner. |
| 2026-05-26 11:52 | PHASE COMPLETE | Phase 7 — Review and Flashcards v0. Cards auto-generated from captured items. Rating writes history + schedules next due. Dashboard dueCount fixed. tsc clean. |
