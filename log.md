# Indivore — Implementation Log

| Date | Type | Description |
|------|------|-------------|
| 2026-05-25 | CONFIG | Created project docs: agents.md, plan.md, log.md, decisions.md from workflow spec |
| 2026-05-25 | CHECKPOINT | Design Checkpoint 0 complete — read design handoff bundle (zip); created docs/design-system.md and docs/ui-screens.md. Resolved DEC-003. Opened DEC-006/007 (both confirmed v0 by user). |
| 2026-05-25 | FEATURE | Scaffolded pnpm workspace monorepo — apps/web/ (Next.js 15, TypeScript strict, Tailwind v3), packages/ stubs (shared, dictionary-client, translator, scheduler), supabase/ dir. |
| 2026-05-25 | FEATURE | Added app shell — root layout with Google Fonts + PWA meta, (main) route group layout with BottomNav, placeholder pages for /, /learn, /review, /capture, /dict, /translate, /settings. |
| 2026-05-25 | FEATURE | Added lib/ layer — Supabase browser + server clients, auth middleware, i18n helper + full English message catalog, LANGUAGES constant (16 Formosan languages), SUPPORTED_PAIRS constant (mock, pending DEC-002). |
| 2026-05-25 | FEATURE | Added Tailwind config with full design token palette (cream/paper/ink/crimson/terra/amber/sage) and animation keyframes (iv-rise, iv-flip, iv-toast, iv-shimmer, iv-pulse). |
| 2026-05-25 | FIX | Typed cookiesToSet parameter explicitly as `{ name, value, options: CookieOptions }[]` in server.ts and middleware.ts to satisfy TypeScript strict mode. |
| 2026-05-25 | PHASE COMPLETE | Phase 0 — build passes clean (11 routes, 0 type errors). Vercel deploy pending DEC-005 (Supabase env vars). |
| 2026-05-26 | FEATURE | Phase 1 — design token system (lib/tokens.ts) and mock data layer (lib/mock-data.ts). |
| 2026-05-26 | FEATURE | Phase 1 — full UI component library: Icon (40+ SVG icons), Chip, Card, Button, SectionHead, LangAvatar, Stat, Toast, Wordmark. |
| 2026-05-26 | FEATURE | Phase 1 — nav components: DesktopSidebar (232px sticky, usePathname active detection), ScreenHeader (CSS sphere home link, lang chip, title, settings link). |
| 2026-05-26 | FEATURE | Phase 1 — responsive layout: lg:grid sidebar + main column; BottomNav hidden on lg+; DesktopSidebar hidden on mobile. |
| 2026-05-26 | FEATURE | Phase 1 — Dashboard screen: deterministic heatmap (seed-based), streak banner, 2×2 stats grid, recent captures list. |
| 2026-05-26 | FEATURE | Phase 1 — Capture screen: textarea + token chips + metadata form (source/speaker/place/notes) + Toast save confirmation. |
| 2026-05-26 | FEATURE | Phase 1 — Review screen: landing page with dialogue drills + session flashcard view with animate-iv-flip and rating buttons. |
| 2026-05-26 | FEATURE | Phase 1 — Dictionary screen: search input + exact match card with definitions/examples + partial matches list. |
| 2026-05-26 | FEATURE | Phase 1 — Translate screen: 3-column pair selector, source textarea, output panel with crimson accent, copy/save actions. |
| 2026-05-26 | FEATURE | Phase 1 — Settings screen: profile card, language selector, interface locale toggle, daily goal slider, account rows. |
| 2026-05-26 | FEATURE | Phase 1 — Learn screen: empty-state placeholder (lessons coming soon). |
| 2026-05-26 | FIX | Phase 1 — TypeScript literal widening: explicit `string` annotation on labelColor in settings page to allow multi-token assignment. |
| 2026-05-26 | CONFIG | package.json build script: added `NODE_OPTIONS='--max-old-space-size=4096'` to prevent webpack OOM crash on Windows. |
| 2026-05-26 | PHASE COMPLETE | Phase 1 — all 7 screens built. Build clean (11 routes, 0 type errors). Design Checkpoint 1 satisfied against Claude Design handoff. |
