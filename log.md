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
| 2026-05-26 12:11 | CONFIG | Git LFS enabled for *.db; packages/dictionary/ created for ycm_master.db (225MB, user must copy). |
| 2026-05-26 12:11 | FEATURE | lib/dict/client.ts — better-sqlite3 singleton, path fallback (repo root vs apps/web), searchWords (ilrdf_vocabulary_fts FTS), searchSentences (sentences_fts + occurrences), listDialects. |
| 2026-05-26 12:11 | FEATURE | /api/dict/search (GET ?q=&glid=) and /api/dict/dialects — server-side Route Handlers with nodejs runtime. |
| 2026-05-26 12:11 | FEATURE | Dictionary page — debounced search, dialect filter, exact match card, sentence examples, partial matches list, save/capture actions, DB error banner. |
| 2026-05-26 12:11 | FEATURE | Capture page — reads ?text= and ?notes= query params for prefill from Dictionary. |
| 2026-05-26 12:11 | PHASE COMPLETE | Phase 5 — Dictionary integration. Awaiting ycm_master.db at packages/dictionary/. tsc clean. |
| 2026-05-26 12:53 | FEATURE | Phase 6 — /api/translate route: FormoBank Modal inference proxy, Zod validation, 800-char limit, 45s timeout, mock fallback when INFERENCE_API_URL unset. |
| 2026-05-26 12:53 | FEATURE | translation-pairs.ts — real FormoBank language codes (zho_Hant ↔ ami/tay/bnn/pyu/pwn/dru _Latn), getValidTargets helper. |
| 2026-05-26 12:53 | FEATURE | Translate page — pair selectors (all 7 langs, invalid targets disabled), char counter, Translate button (Cmd+Enter), loading shimmer, copy/save actions. |
| 2026-05-26 12:53 | PHASE COMPLETE | Phase 6 — Translation integration. Mock works; wire INFERENCE_API_URL + INFERENCE_API_KEY for live model. tsc clean. |
| 2026-05-26 13:15 | FEATURE | PWA icon — ornate book logo (icon128.png) placed at app/icon.png, app/apple-icon.png, public/icon.png, public/icons/icon-{192,512}.png. manifest.json updated. |
| 2026-05-26 13:15 | FEATURE | Phase 8 — QuickAction CTA on Dashboard: crimson card → /review if dueCount > 0, sage card → /capture otherwise. Lessons stat row added (dimmed placeholder). |
| 2026-05-26 13:15 | PHASE COMPLETE | Phase 8 — Dashboard completion. All stats real. Quick resume action contextual. tsc clean. |
| 2026-05-26 14:00 | FEATURE | Learn L0 — corpus_geometry.json (400KB), lang-bridge.ts (GLID mapping, dialect helpers), dialects.ts (DIALECT_TO_EN, GLID_FAMILIES, shortDialectLabel). |
| 2026-05-26 14:00 | FEATURE | Learn L1 — ind_completions migration (item_key, RLS, get_completion_count RPC); ind_learn_collections + ind_learn_cards migration; /api/curriculum, /api/geometry, /api/lookup routes (nodejs runtime, better-sqlite3). |
| 2026-05-26 14:00 | FEATURE | Learn L2 — StudyView ('use client', 4 sources), StudyCard (tokenized lookup, zh-blur), ActionBar (fixed above BottomNav), ContentSheet (62dvh sheet, level/lesson/pattern/essay navigation), SettingsPanel (zh-mode, lookup toggle), LookupInline (ILRDF word lookup). |
| 2026-05-26 14:00 | FEATURE | Learn L3 — /learn/new 3-step creation flow (CollectionEditor, ImportDropzone); hub page redesigned (single-column, dialect selector, live completion %, icon+progress bars); dialect persisted to ind_profiles.default_dialect + localStorage; dashboard Lessons stat wired to get_completion_count. |
| 2026-05-26 14:00 | FIX | Learn — grmpts dialect bug: StudyView now always uses getGrmptsDialect() for patterns (language-level dialect, not sub-dialect). |
| 2026-05-26 14:00 | FIX | Learn — hub dialect pills use shortDialectLabel() to strip family name (e.g. "Nanshi Amis" → "Nanshi"). |
| 2026-05-26 14:00 | REFACTOR | ScreenHeader — replaced CSS blob home icon with actual app icon.png. |
| 2026-05-26 14:00 | PHASE COMPLETE | Learn L0–L3 — full study view for all 4 sources, collection creation, hub with progress. Merged feat/learn → main. |
| 2026-05-26 14:10 | REFACTOR | Login page — replaced tagline and disclaimer text with --- placeholders (landing copy TBD). |
| 2026-05-26 14:10 | REFACTOR | Rename Indivore → Indilog across layout.tsx, manifest.json, Wordmark.tsx, settings page, en.ts, alt texts. |
| 2026-05-26 14:10 | FEATURE | Login page — triple logo size (64→192px). |
| 2026-05-26 14:10 | REFACTOR | Learn hub — remove dialect pills and per-card dialect label; source cards are now dialect-agnostic. |
| 2026-05-26 14:10 | FEATURE | Settings — replace 3-lang language selector with single-row trigger + bottom-sheet picker covering all 16 languages; dialect step shown for multi-dialect languages; saves active_study_language + default_dialect together. |
| 2026-05-26 14:10 | FIX | StudyView — dialect now always sourced from profile (Settings), never from stale localStorage; fixes "no content" bug after dialect change in Settings. |
| 2026-05-26 14:10 | FEATURE | useActiveLang hook + getActiveLangServer — all app pages (Learn, Capture, Review, Dict, Translate, Dashboard, DesktopSidebar) now wire eyebrow/header to real profile language and dialect instead of ACTIVE_LANG mock. |
| 2026-05-26 14:10 | FIX | StudyView Lessons — DB stores twelve categories as "Level X Lesson Y"; geometry titles ('你好嗎？' etc.) were never the right key. Now builds category directly from level+lesson state. Also removed bogus geometry fetch for twelve and added missing `lesson` dep to curriculum effect. |
| 2026-05-26 14:30 | FIX | StudyView — grmpts itemKey changed from `pattern` to `${level}::${pattern}` for per-level-per-pattern completion tracking (~41 items vs 11). |
| 2026-05-26 14:30 | FEATURE | Learn hub — dynamic totals from geometry API (grmpts = sum of level×pattern pairs; essay/dialogue respect dialect availability). "Next: <label>" shown inline on each collection card (L1·3 for Lessons, L2·名詞 for Patterns, truncated title_zh for Essays/Dialogs). |
| 2026-05-27 00:00 | FEATURE | Grmpts difficulty level names — 初級/中級/中高級/高級 in ContentSheet tabs, StudyView pill, and hub Next: labels. ContentSheet done-check key fixed to match level::pattern format. |
| 2026-05-27 00:30 | FEATURE | Learn ContentSheet — Lessons redesigned: 4 difficulty tabs → 3 stage buttons (第一階…) → 2×5 lesson grid with large numbers and full titles. Patterns/Essays/Dialogs get sequential item numbers. Essay/Dialog groups renamed 初級/中級/高級. |
| 2026-05-27 00:30 | FIX | Patterns sort fixed (numeric 1,2,3… not alphabetical 1,10,11…) in ContentSheet, StudyView navOrder, and learn hub. |
| 2026-05-27 00:30 | FEATURE | Hub Next: labels now include difficulty — Lessons: 初級·第一階·3; Patterns: 初級·1 名詞; Essays/Dialogs: 初級·1·問候… |
| 2026-05-27 01:00 | FIX | Lessons ContentSheet: 12-col CSS grid — 4 difficulty labels each span 3 cols (aligned above their stages); 12 numbered stage buttons in row below; 2×5 lesson grid kept, cards updated with big number + ab/zh title rows (ab blank until scraped). |
| 2026-05-27 01:15 | FIX | Lessons ContentSheet: outlined border on difficulty labels (aligns with 3 stages below); lesson card numbers increased to 26px and vertically centered. |
| 2026-05-27 01:30 | FIX | BottomNav: capture button translate-y 18→10px. ActionBar: bottom 64→100px (clears full navbar). StudyView header: sticky. StudyCard: category pill removed, action buttons moved to header row, bottom action row eliminated (~50px height reduction per card). |
| 2026-05-27 02:00 | FIX | ActionBar: glass blur background (rgba + backdropFilter), removed borderTop. StudyView header: switched position:sticky → position:fixed (top/left/right 0) with same glass blur; card scroll area top padding 14→66px to compensate. |
| 2026-05-27 02:00 | CONFIG | Investigated essay/dialogue corpus count anomaly (73/61 vs expected 60). Root cause traced to geometry_crystallizer.py max_len alignment + vocabulary TIDs scraped alongside sentence TIDs + duplicate title_zh from first-sentence heuristic. Documented in plan.md "Corpus Data Issues" section with Citadel checklist. |
| 2026-05-27 02:30 | FEATURE | Learn hub SourceCard: Next: label right-aligned (justifyContent: space-between). |
| 2026-05-27 02:30 | FEATURE | HubSearch component — bottom-sheet from Learn hub header (search + settings in ScreenHeader right slot). Titles tab searches all 4 sources by label/sublabel, tap writes localStorage + navigates. Sentences tab debounced dict API search. tsc clean. |
| 2026-05-27 03:00 | REFACTOR | StudyCard overhaul: 2-column layout (text left, 3 buttons stacked right); index number floated outside card top-left; ab+zh copy merged into single button; divider retained; vertical centering; buttons round (borderRadius:999). tsc clean. |
| 2026-05-27 03:00 | FIX | Add missing useActiveLang.ts hook and profiles-server.ts to git — were untracked, caused Vercel build failure. |
| 2026-05-27 12:39 | CONFIG | Add scrollbar-thin CSS utility; strengthen commit-cadence rule in agents.md. |
| 2026-05-27 12:39 | SCHEMA | Add RLS policies migration for ind-audio Supabase Storage bucket (insert/select/delete per UID folder). |
| 2026-05-27 12:40 | FEATURE | BatchImport: segmented Paste/Import toggle inline with sheet title; fixed-height content area (360px) prevents sheet jump on tab switch. |
| 2026-05-27 12:40 | FEATURE | Capture page polish: audio upload to ind-audio on save + pre-save playback button; sparkle moved to meaning section with "AI translation coming soon" hint; lookup (search) moved right-aligned with mic; Definitions section collapses to 1 result per token (chevron expands rest), punctuation trimmed from display tokens; Recent filter icon removed, dropdown uses scrollbar-thin. |
| 2026-05-27 13:07 | FEATURE | Icon: add stop (filled square) and trash icons. |
| 2026-05-27 13:07 | FIX | InlineSelector: move clear button outside trigger to fix button-in-button hydration error; .find→.some, Readonly<Props>. Better createItem error logging. |
| 2026-05-27 13:07 | FEATURE | Capture polish round 2: dialect select from GLID_FAMILIES (defaults to profile dialect); mic→stop icon when recording, separate trash+play when has-recording; AI hint inline; lookup placeholder; sort by current dialect; remove type pill from Recent. |
| 2026-05-27 14:30 | FIX | items.ts: defined() helper strips undefined from INSERT/UPDATE — fixes PGRST204 "could not find meaning column". |
| 2026-05-27 14:30 | FEATURE | Settings: tabbed layout (General / Capture) via ?tab= param; back arrow uses ?from= query param; removed profile card, daily goal, account section; Capture tab adds auto-lookup toggle (localStorage ind_auto_lookup). |
| 2026-05-27 14:30 | FEATURE | ScreenHeader: 'use client' + usePathname; settings gear link auto-appends ?from=<pathname>. |
| 2026-05-27 14:30 | FEATURE | Capture polish round 3: iconBtn border shorthand fix (lookup style interference); inline lookup hint in ab footer; button order [lookup | mic]; custom themed dialect dropdown with shortDialectLabel(); Context card overflow:visible; speaker pill in Recent; auto-lookup debounced 600ms; settings link includes ?from=/capture. |
| 2026-05-28 00:00 | FIX | Settings: remove tab bar UI — tab switching is caller-driven via ?tab= param, no widget shown. Definitions: expand chevron+count inline on first result row. Definitions: dedup rows by word_ch (keeps dialect-sorted first match). |
| 2026-05-28 00:30 | FEATURE | Definitions card: ab word + definition (centered) + dialect (right) all inline; whole card clickable to expand; +x more / ↑ less at bottom-center. Definitions header: X→chevron toggle, persists when collapsed for re-expand. Auto-lookup no longer force-expands a manually collapsed panel. |
| 2026-05-28 01:00 | FEATURE | Settings: tab bar restored. Capture tab: tags manager (add/remove, localStorage ind_custom_tags). Capture page: Tags chip-select row in Context (only when tags defined); tags saved to ind_items.tags. Ab textarea rows 3→2. Migration: tags text[] on ind_items. Icon: tag. |
| 2026-05-28 02:00 | FIX | Definitions: word_ch absolutely centered vs full card width (position:absolute left:50%). Settings: tab bar removed again — ?tab= routes silently; general tab gets account card back with '...' dropdown (change account, about, sign out); capture tab shows only lookup+tags. Icon: more-v. |
| 2026-05-28 01:17 | FEATURE | capture: Tags row always visible inline in context section with inline add; dialect dropdown uncapped height; settings capture tab: Tags section removed |
| 2026-05-28 01:30 | CONFIG | Regenerate all icons from modified Book_1_nocirc_nobg source — icon.png 512×512, apple-icon.png 180×180, icon-192.png 192×192, icon-512.png 512×512 |
| 2026-05-28 01:37 | FIX | cross-env for Windows-compatible NODE_OPTIONS in build script; Toast position:fixed (was absolute, clipped by scroll containers); flashcards use meaning column for card back with notes fallback; commit previously untracked meaning + audio_url migration files |
