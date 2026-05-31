# Indivore — Implementation Log

| Timestamp | Type | Description |
|-----------|------|-------------|
| 2026-06-01 03:49 | FIX | Review: mid-session close (0 reviews) also navigates to / when autostart=true, not review landing |
| 2026-06-01 03:44 | FIX | ensureFlashcards: run both pagination loops in parallel (was sequential — ~48 serial requests for 24k cards; now ~24 parallel) |
| 2026-06-01 03:44 | FIX | Review: Done button navigates to / when autostart=true (dashboard entry) instead of staying on review landing |
| 2026-06-01 03:38 | FIX | ensureFlashcards: paginate both ind_flashcards and ind_items queries — 1000-row cap was causing ~23k duplicate cards on every page load, inflating due count and daily stats |
| 2026-06-01 03:38 | SCHEMA | Add UNIQUE(user_id, note_id) to ind_flashcards; delete existing duplicate rows (kept oldest per pair) |
| 2026-06-01 03:29 | FEATURE | M5-B: skip review landing from Dashboard — /review?start=1 auto-starts session; autostartedRef prevents re-fire on reload |
| 2026-06-01 03:29 | FIX | M5-B: spurious increment_reviewed_today — session-end effect re-fired when ReviewPage re-renders (inline onExit ref changes); fix: onExitRef + sessionEndFiredRef one-shot guard |
| 2026-06-01 03:13 | SCHEMA | Add mode column to ind_reviews — logs review mode (forward/audio/sts) per event for future retention-transfer analysis; scheduling unchanged |
| 2026-06-01 03:13 | CONFIG | Update DEC-SRS05 — document duplicates problem, hybrid instrument-first approach, mode taxonomy, deferred migration decision |
| 2026-05-31 18:05 | FIX | Wrap review page in Suspense — useSearchParams() requires Suspense boundary for Next.js 15 static generation |
| 2026-05-31 18:03 | FIX | Add 'use client' to learn sub-pages (dialogues, essays, lessons, patterns) — RSC bundler failed to include StudyView in client manifest after learn/page.tsx became a redirect |
| 2026-05-31 17:59 | FIX | Add missing curriculum-progress API route + learn page to git (were untracked, broke Vercel build) |
| 2026-05-31 17:33 | FIX | Paginate getDueStats, listUserLanguages, resetCollectionSRS, resetCapturesSRS — all had .limit(10000) silently capped at 1000 by PostgREST server |
| 2026-05-31 17:29 | FIX | listDueFlashcards: paginate with .range() loop (PAGE=1000) to bypass Supabase server row cap; was silently truncating review queues >1000 cards |
| 2026-05-31 17:23 | FEATURE | M2: dict lookup in expanded card — Lookup button on empty zh field; auto-fills first result; chips for alternatives; "No results" on miss |
| 2026-05-31 17:21 | REFACTOR | Browser: remove checkmark circle from batch selection — row highlight only |
| 2026-05-31 17:12 | FEATURE | M2: batch select — Select button in header toggles selection mode; tap row to highlight/select; bottom action bar with All/None, Delete (confirm), Suspend, Flag; batchDeleteNotes/batchSuspendCards/batchSetFlag in browser.ts |
| 2026-05-31 17:04 | FEATURE | M2: date range filter in browser — from/to date inputs filtering created_at; clear ✕ button when active |
| 2026-05-31 17:02 | REFACTOR | Browser: delete button inline with Suspend/Reset row (right-aligned); Save/Cancel restored to own row |
| 2026-05-31 16:57 | FEATURE | M2: delete note from browser — hard delete (cascades to ind_flashcards + ind_reviews); inline confirmation with warning about heatmap/stats impact; suggests Suspend as alternative |
| 2026-05-31 16:53 | FIX | Browser: split listBrowserCards into 2 parallel queries (captured + collection) to bypass Supabase 1000-row server cap; type dropdown inline; collapsible filter row removed |
| 2026-05-31 16:48 | REFACTOR | Browser: SRS state pills → dropdown; source/deck dropdown inline next to it; filter icon now handles lang/type/tags only |
| 2026-05-31 16:40 | FIX | Browser: raise listBrowserCards limit 500→10000 (Amis1k import was pushing captured items out of results); rename "Captures" → "Captured" in browser.ts, study page, DeckRow |
| 2026-05-31 16:00 | FEATURE | M2: browser field filters — language, type, source, tags; collapsible filter row; active-count badge; derived from loaded cards client-side |
| 2026-05-31 15:42 | PHASE COMPLETE | M1 — SRS + Review Overhaul complete (M1-A through M1-F) |
| 2026-05-31 15:40 | FEATURE | M1-F: card strength metric (model B) — computeStrength() in schedule.ts; R×S_norm score (0–100%), R + S components; displayed in BrowserView expanded card panel |
| 2026-05-31 15:26 | REFACTOR | CustomSessionSheet: flag swatches inline with label; plan-v1 M5: add note/card type architecture task |
| 2026-05-31 15:20 | REFACTOR | CustomSessionSheet: remove Any/None flag pills; uniform select width (168px); language conditional on >1 lang; add place_heard filter; place_heard + tags in listDueFlashcards join |
| 2026-05-31 15:11 | REFACTOR | CustomSessionSheet: flag dropdown → dot toggles (Any/None pills + color circles, multi-select); due-only toggle moved to top; multi-flag URL param (red,green); includeFlagColors post-filter in listDueFlashcards |
| 2026-05-31 15:04 | FEATURE | Custom session filters expanded: note type, card type, tags (chip multi-select), flag; listDueFlashcards gains includeNoteTypes/includeCardType/includeTags opts + flagColor 'none'; FlashcardWithItem adds tags to ind_items join; listCustomSessionMeta() added |
| 2026-05-31 14:56 | FEATURE | M1-F: custom review sessions — filter icon button next to Review all; CustomSessionSheet (lang/dialect/source/dueOnly); review page reads custom params, bypasses global exclusions; listDueFlashcards gains inclusion opts + dueOnly |
| 2026-05-31 14:32 | FEATURE | M1-F: goal deck priority — reload() post-sorts due cards with goal_collection_id cards first; goalCollectionId added to SessionContext |
| 2026-05-31 14:24 | REFACTOR | listDueFlashcards: remove 20/200 batch limit, replace with 10k safety cap; remove slice(0,20); post-filters now always apply unconditionally |
| 2026-05-31 13:50 | REFACTOR | Move daily reset stepper from review OptionsSheet → Settings page (general tab, Study section) |
| 2026-05-31 13:41 | FEATURE | M1-F: daily reset time — getStudyDate() (localStorage srs_reset_hour, default 4am); rateCard/rateCardRelearn/undoRating updated; stepper in OptionsSheet (12am–6am) |
| 2026-05-31 13:41 | FEATURE | M1-F: GoalSheet linear simulator — now / peak / long-term daily load estimates below existing hint |
| 2026-05-31 13:28 | CONFIG | plan-v1.md: M1-E undo + defer marked complete |
| 2026-05-31 13:00 | FEATURE | M1-E: defer (skip-fwd button top-right of session, sets due_at=tomorrow) + undo (rotate-ccw below progress bar, single-level, DB-write only); deferCard() + undoRating() in flashcards.ts; skip-fwd icon added |
| 2026-05-31 12:50 | CONFIG | plan-v1.md: all M4 SRS items → M1-F–J sub-milestones; M4 removed; M5 polish → M4 |
| 2026-05-31 12:45 | CONFIG | plan-v1.md: goal priority → M1-F; curriculum layouts → M5 polish; M5 standalone removed; renumber M6→M5 |
| 2026-05-31 12:40 | CONFIG | plan-v1.md: add M3 (rescrape), M4 (SRS enhancements), M5 (Learn tab), M6 (polish extended); deferred + longterm sections |
| 2026-05-31 12:35 | FIX | Browser: cardless notes show neutral "—" badge instead of misleading "NEW" |
| 2026-05-31 12:30 | FIX | Browser: audioEl useState → useRef; updateNoteContent dead code already removed in rewrite |
| 2026-05-31 12:20 | REFACTOR | Browser note-centric: base query switches to ind_items with left join to ind_flashcards; BrowserCard.id=noteId, card_id nullable; SRS filters post-filtered client-side |
| 2026-05-31 12:20 | CONFIG | plan-v1.md M2 updated: Browser = Library, done/remaining items listed |
| 2026-05-31 02:55 | CONFIG | Update plan-v1.md: M1 marked complete with actual implementation notes; M2 + M3 unchanged |
| 2026-05-31 02:50 | CONFIG | Extract DEC-SRS03 into decisions.md: FormoSRS-1 full spec, ease hell fix rationale, fuzz formula, relearn burst |
| 2026-05-31 02:45 | CONFIG | Archive plan-srs.md → archive/plan-srs.md; remove from CLAUDE.md session-start read list |
| 2026-05-31 02:40 | FEATURE | Browser overhaul: BrowserCard gains all note fields (notes, audio, note_type, language, dialect, place_heard, tags, target_word, metadata); expanded row shows editable notes/place/target_word, STS layout toggle, info badges, audio playback |
| 2026-05-31 02:30 | FEATURE | T1-B include_in_review: boolean on ind_learn_collections + ind_profiles; getExcludeFromReview(); getDueStats/listDueFlashcards filter excluded decks; DeckActionSheet toggle; Study + Review pages wired |
| 2026-05-31 02:30 | SCHEMA | T1-B: migration 20260531040000 adds include_in_review to ind_learn_collections + ind_profiles |
| 2026-05-31 02:05 | CONFIG | Update plan-srs.md + decisions.md: T3-D STS spec, T2-D/E/F done, DEC-NOTE03 metadata shape corrected, DEC-SRS02 marked implemented |
| 2026-05-31 02:02 | SCHEMA | T3-D STS: add target_word text to ind_items; migration 20260531030000 |
| 2026-05-31 02:02 | FEATURE | T3-D STS: ensureFlashcards() creates card_type='sts' for notes with target_word; setTargetWord() syncs note + card; target dot button on lookup cards in Capture; STS word/sentence layout in ReviewSession |
| 2026-05-31 01:27 | FEATURE | Pin button inline on DeckRow (between due pill and kebab); collapsible section headers with chevron in Study Decks tab; collapse state persisted in localStorage |
| 2026-05-31 01:19 | FEATURE | T2-E pin collections: pinned boolean on ind_learn_collections; Pin/Unpin in DeckActionSheet; pin indicator on DeckRow; optimistic sort; Captures moved above My Collections in Study tab |
| 2026-05-31 01:10 | FEATURE | T2-D language filter: getLangName(), listUserLanguages(), excludeLangs on getDueStats/listDueFlashcards; Study + Review OptionsSheet wired with toggle + dynamic checkboxes; session remounts on filter change |
| 2026-05-31 00:43 | FEATURE | T2-F reset SRS: wipeReviewsAndReset() deletes ind_reviews + resets scheduling; Reset moved to danger zone in DeckActionSheet; confirm copy updated |
| 2026-05-31 00:43 | DECISION | DEC-SRS02: reset scope = SRS state + ind_reviews; ind_daily_stats preserved (habit record, hard to subtract retroactively) |
| 2026-05-31 00:19 | REFACTOR | Architecture polish: ind_flashcards.audio_url→audio; ensureFlashcards() called after saveCollection(); cardMeta() fallback removed; architecture.md updated with M2 columns |
| 2026-05-30 20:13 | SCHEMA | T-UNIFY M4: DROP ind_learn_cards; DROP legacy_learn_card_id; delete generateFlashcardsFromCollection/generateReverseCardsForCollection; listCollections counts via ind_items; collection page uses ensureFlashcards; reverse card button removed |
| 2026-05-30 20:10 | SCHEMA | T-UNIFY M3: note_id FK on ind_flashcards; remap from item_id + legacy mapping; delete reverse cards; rename forward→default; DROP item_id/collection_card_id/front/back; update review/browser/stats/goal |
| 2026-05-30 20:00 | SCHEMA | T-UNIFY M2: add level/lesson/position/metadata/legacy_learn_card_id to ind_items; migrate 1063 ind_learn_cards rows into ind_items (note_source=collection); saveCollection + listCollectionCards updated |
| 2026-05-30 19:54 | SCHEMA | T-UNIFY M1: ind_items text→ab, meaning→zh, audio_url→audio; add note_source/collection_id; all createItem() call sites updated; note_source set per save point |
| 2026-05-30 19:39 | DECISION | DEC-ARCH02 + architecture.md: unified Note/Card model settled — ab/zh fields, front/back banned, one card per note, session modes display-only, note_source enum, STS spec drafted; T-UNIFY migration plan written; CLAUDE.md + agents.md updated |
| 2026-05-30 18:40 | FEATURE | Audio step 6 — curriculum save now threads audio_url through onSave → createItem → ind_items; cardAudio() join resolves at review time; T1-F reframed: bookmarks-only, universal pipeline, no bulk generation |
| 2026-05-30 18:18 | FEATURE | T2-F reset SRS data: rotate-ccw icon; resetCollectionSRS/resetCapturesSRS; DeckActionSheet reset view (confirm dialog); Captures row now has kebab → action sheet (reset only); collections get Reset in menu above Delete; handleReset refreshes due stats |
| 2026-05-30 18:06 | FEATURE | Audio step 5 — audio session mode: OptionsSheet toggle (srs_audio_mode localStorage); audioMode front = large crimson play button; fallback to text + "♪ no audio" when card has no audio; reveal shows card.front above meaning; autoplay on card advance |
| 2026-05-30 17:50 | SCHEMA | Audio steps 2+3: ind_learn_cards.audio_url, ind_flashcards.audio_url (curriculum snapshot), ind_flashcards.metadata jsonb (STS/future card templates); Flashcard type + FlashcardWithItem updated; cardAudio() priority chain; listDueFlashcards select updated |
| 2026-05-30 17:48 | FEATURE | Audio step 1: wire playback on captured-item cards — listDueFlashcards joins ind_items.audio_url; cardAudio() helper; review/page speaker button shown + wired when audio present; audio stops on card advance |
| 2026-05-30 17:48 | DECISION | DEC-NOTE01/02/03: Note/Card/Note Type/Card Template terminology adopted; note unification deferred (trigger = STS impl); metadata jsonb approach for extensible card templates |
| 2026-05-30 15:14 | FEATURE | Curriculum row overhaul + ensureFlashcards: Study Curriculum rows now show language pill (Amis), Next: label, thin progress bar (completed/total); CurriculumRow component replaces static DeckRow; /api/learn/curriculum-progress route computes all 4 sources server-side (geometry JSON + completions query); ensureFlashcards() now called on Study landing so captures are due-counted before first review |
| 2026-05-30 14:30 | FEATURE | Kebab menu + /learn redirect: DeckActionSheet bottom sheet (rename, export JSON, share, delete with confirm); wired into Study → My Collections rows; /learn root replaced with server-side redirect to /study; plan-srs.md T2-D language selector added |
| 2026-05-30 13:08 | CONFIG | plan-srs.md: full status update — all T1/T2/T3 checkboxes, T3-A content rewritten (Repeat/Easy/Got it! design), stale labels removed, sequence section updated, open items listed |
| 2026-05-30 12:27 | FEATURE | T3-A learning UX: 2-button redesign (Repeat + Easy/Got it!); Easy→Got it! after first restart or on final pass; Repeat resets to pass 0 on final; cap at 3 restarts → forced Good graduation; pass dot indicator (●●○) below card; card border tint (sage=learning, amber=relearn); interval sub-labels ↩/↩ 0/real interval |
| 2026-05-30 03:11 | FEATURE | T3-A Learn phase + Relearn burst: QueueEntry[]-based session (replaces cards+idx); learning for new cards (reps=0, interval=0) — learningSteps passes (default 3, configurable 1-5 in OptionsSheet), Easy graduates immediately, Hard=Again; relearn burst for mature lapse (interval≥7d) — Good/Easy→50% recovery via nextRelearn/rateCardRelearn, exhausted Again→full reset; phase label (New/Learning/Relearning), ↩ N returning indicator, context-aware button labels |
| 2026-05-30 02:42 | FEATURE | Gestures + 5-color flags + stats fixes: swipe ↑=Easy, ↓=Suspend (4-dir detection, absX vs absY threshold); ArrowUp/Down keyboard; bottom gesture hint removed; OptionsSheet updated. Flags redesigned: boolean → flag_color text (5 colors: red/orange/yellow/green/blue); inline picker in review; colored dot badge + color sub-filter in Browser; /review?filter=flagged or /review?flag=X. getDueStats/stats-server/stats-client all exclude suspended from due counts. DEC-SRS01 added to decisions.md |
| 2026-05-30 02:26 | FEATURE | T3-B/C/D Suspension + Flags + Reverse cards: suspended_at/flagged/card_type columns; review session archive (suspend+skip) + bookmark (flag) buttons; /review?filter=flagged; Browser adds Flagged/Suspended filters, SUSP/bookmarkF badges, Suspend+Flag actions, amber "Review flagged" CTA; generateReverseCardsForCollection (zh→ab, card_type=reverse); collection page "Generate reverse cards" button; dedup type-aware |
| 2026-05-30 02:13 | FEATURE | T2-C Card browser: Browser subtab now live — search bar, All/Due/New filter chips, sort by due date/ease/added; tap row to expand inline front/back edit + Reset ease action; optimistic local state updates; BrowserView self-contained component, browser.ts data layer |
| 2026-05-30 02:02 | FEATURE | T2-A/B Goal feature + study stats: GoalWidget (dashboard card, opens GoalSheet bottom drawer), goal.ts (saveGoalData/clearGoal/getDeckGoalStats), ind_profiles migration adds goal_collection_id+goal_due_date; T2-B stats-client.ts + Study Stats subtab — overview 2×2 (total/due/known/mastered), per-deck coverage bars, 14-day pace bar chart |
| 2026-05-29 22:11 | FEATURE | T1-D/E Review session overhaul: full-screen card (contained on cream bg), tap-to-reveal, swipe ←/→ (Again/Good), rating buttons with live FormoSRS-1 interval labels, Hard+Easy toggle, full-immersion mode (buttons hidden), options bottom sheet (localStorage-persisted), keyboard shortcuts (Space/1-4/arrows), session end screen (confetti on goal met, due tomorrow, share, CTAs); schedule.ts: estimateInterval + formatDays |
| 2026-05-29 21:43 | FEATURE | T1-C Dashboard overhaul: real streak (reviewed_count-based), 7-day chain, today's ring (reviewed/goal SVG), Review N due CTA, real 16-week heatmap, quick stats (Mastered/Active/This week/Due tomorrow), goal widget placeholder; removed seed-based heatmap and fake streak |
| 2026-05-29 21:35 | FEATURE | T1-B Study tab: /study page with Curriculum/Collections/Captures deck list, Decks/Browser/Stats subtabs (Browser+Stats placeholders), getDueStats() per-source due counts; BottomNav updated to Dashboard·Study·Capture·Translate·Dict; DesktopSidebar updated |
| 2026-05-29 21:12 | FEATURE | T1-A FormoSRS-1: schedule.ts pure algorithm (SM-2 + Anki Hard + ±5% fuzz + ease recovery on Good); migration 20260529020000 adds ease_factor/interval_days/repetitions; rateCard updated, INTERVALS removed |
| 2026-05-29 18:25 | FIX | package.json: pnpm.onlyBuiltDependencies — pnpm v10 blocked better-sqlite3 native binary compilation; all corpus content (Lessons/Patterns/Essays/Dialogs) was silently empty on Vercel |
| 2026-05-29 18:02 | FIX | next.config.ts: outputFileTracingIncludes for ycm_master.db — ensures 215MB SQLite file is traced into serverless function bundles (LFS + tracing both required) |
| 2026-05-29 17:11 | CONFIG | design-handoff: SRS screens from Claude Design — Dashboard, Study tab, Review session (4-btn + 2-btn + options sheet), Review end (goal-met + low-due variants) |
| 2026-05-29 16:23 | CONFIG | plan-srs.md: full design decisions — FormoSRS-1 algo (SM-2 + fuzz + ease recovery), nav overhaul (Dashboard·Study·Capture·Translate·Dict), Study tab deck architecture (Curriculum/Collections/Captures + subtab bar), Dashboard widget order, review session spec, session end screen spec; FSRS marked not-v1 |
| 2026-05-29 02:44 | FIX | collections: batch card inserts in chunks of 200 to avoid PostgREST body limit on large imports |
| 2026-05-29 02:42 | SCHEMA | ind_learn_cards: add lesson_title column (migration 20260529); saveCollection persists it; browse page shows it; all lessons collapsed by default |
| 2026-05-29 02:39 | FIX | collection browse page: .limit(10000) overrides PostgREST 1000-row default; add rename (inline pencil) + delete (confirm trash) |
| 2026-05-29 02:37 | FIX | learn/new import flow: after "Import N cards" show collapsible summary before Save — not CollectionEditor |
| 2026-05-29 02:33 | FEATURE | Learn hub: saved collections visible below corpus sources (amber card, card count); /learn/collection/[id] browse page with collapsible lessons; ImportDropzone lessons collapsible by default |
| 2026-05-29 02:25 | DATA | Amis1k deck restructured: 4 difficulty lessons (初級 300 / 中級 200 / 中高級 300 / 高級 263) |
| 2026-05-29 02:20 | DATA | Amis1k vocab deck generated — 1063 cards, packages/amis1k/amis1k.json, importable via /learn/new |
| 2026-05-29 01:39 | CONFIG | gitignore temp_learn/ temp_scrape/ and logo source PNGs; untracked files removed from history |
| 2026-05-29 01:38 | REFACTOR | Full architecture restructure: lib/corpus/ (SQLite layer), lib/db/ subfolders (notebook/srs/progress/profile), LangDialectProvider (single profile fetch → instant Settings sync), components/lookup/, api/learn/ route group; tsc clean |
| 2026-05-29 01:01 | REFACTOR | lib/lang/ extracted — dialects.ts + lang-bridge.ts moved from lib/learn/; lib/dict/sqlite.ts extracted from client.ts; lib/learn/db.ts now imports from sqlite directly; 8 import sites updated; tsc clean |
| 2026-05-29 00:42 | FIX | dict normKey/normWordKey: replace literal U+2018/U+2019 with \\uXXXX escape sequences — Next.js 15.5.18 SWC rejects non-ASCII chars in regex char classes |
| 2026-05-28 15:47 | FIX | Dict: word dedup by space-stripped normalisation key (apostrophe unify + whitespace collapse) — removes corpus spacing inconsistencies e.g. mafana'to vs mafana' to; DEC-D01 documented in decisions.md |
| 2026-05-28 15:47 | FIX | Dict: 3-char search minimum (trimmed; guard in page + route); removed LIMIT from searchWords/searchSentences — 3-char floor keeps worst-case ~2K rows |
| 2026-05-28 15:47 | FIX | Dict filter sheet: height 82dvh; header "Filter results by language and dialect"; filterLabel shows dialect name alone or "language (all dialects)" |
| 2026-05-28 09:03 | FEATURE | Dictionary: Words/Sentences tabs (swipeable), language filter defaults to active study language, audio plays inline, duplicate key fix (dedup sentences by id in route handler) |
| 2026-05-28 10:00 | FEATURE | Dictionary: filter bottom sheet — search bar full width, lang/dialect picker moved to funnel button in header; closes on dialect select or outside tap; filter button turns crimson when active |
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
