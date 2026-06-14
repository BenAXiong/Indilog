# Indivore — Refactor Backlog

> Areas of latent friction identified through code review and architecture analysis.
> Not bugs — these are accumulation risks: places where continuing to build without intervention will make the codebase harder to change.
> Last updated: 2026-06-14

---

## 1. Session page monoliths

**Files:** `apps/web/app/(main)/learn/page.tsx` (745 lines), `apps/web/app/(main)/review/page.tsx`

**Problem:** Both session pages are single large client components that mix session orchestration (queue state, phase transitions, grading logic) with render. Every new card action, phase variant, or session mode gets added inline. The hook extractions (`useSwipeGesture`, `useAudioPlayer`, `useUndoStack`) removed the worst duplication, but the core orchestration — queue mutation, undo stack wiring, keyboard/touch dispatch, session end logic — remains inlined in the component body.

**Risk:** As new session modes or grading mechanics are added (STS mode, audio-only mode, GoalSheet integration), the session components will keep growing and the orchestration logic will become harder to follow and test in isolation.

**Direction:** Extract a `useLearnSession` / `useReviewSession` hook that owns queue state, phase transitions, and grading actions. The component becomes a renderer wired to the hook — no logic. This also makes the session logic independently testable without rendering.

---

## 2. Study hub growth

**File:** `apps/web/app/(main)/study/page.tsx` (733 lines)

**Problem:** The Study hub already handles deck management, SRS due counts, curriculum progress, browser view, stats view, and collapse state. Planned features — curriculum subtab, GoalSheet, mastery grades — all target this page. It's a coordination hub, which is fine, but the render for each concern is inline rather than delegated.

**Risk:** Each new subtab or section lands in this file. At 1000+ lines it becomes hard to navigate and the component re-renders more than needed because unrelated state is colocated.

**Direction:** Extract each subtab into its own component (`DecksTab`, `BrowserTab`, `StatsTab`). The hub page becomes a thin shell: tab state, shared data fetching, and composition. This is a clean split because the tabs are already conditionally rendered with `activeTab === 'x'`.

---

## 3. Preferences sync pattern — structural fragility

**Files:** `apps/web/lib/db/profile/preferences.ts`, `apps/web/components/widgets/SettingsSheet.tsx`, any page with a setting toggle

**Problem:** Adding a new user preference requires threading through four places manually:
1. Add field to `UserPreferences` type + `DEFAULT_PREFERENCES`
2. Add localStorage setter + `patchPreferences()` call in the toggle handler
3. Add `localStorage.setItem(...)` in `SettingsSheet` on-open cloud sync
4. Add `localStorage.getItem(...)` passthrough in `SettingsSheet.buildPrefs`

Miss any one of these and the preference either doesn't persist to the cloud, or gets silently overwritten when the user opens Settings. We hit this with `shuffle_tests` / `shuffle_exposure` (2026-06-14).

**Risk:** Every future setting has the same failure mode. The pattern is documented in `architecture.md` but there's no structural enforcement.

**Direction:** Consider a preferences registry — a single map of `{ key, localStorage key, default }` that drives all four steps. `SettingsSheet` reads from the registry to sync on open and build the write payload; toggle handlers use a shared `setSetting(key, value)` helper. Adding a setting becomes one entry in the registry, not four scattered edits.

---

## 4. `flashcards.ts` — load-bearing file with growing surface

**File:** `apps/web/lib/db/srs/flashcards.ts`

**Problem:** This file is the most-touched in the codebase. It owns SRS scheduling, pagination, due stats, learn/review card fetching, user language listing, collection/capture resets, and the `paginate<T>` helper. It's the right place for all of these, but the surface area is large and growing.

**Risk:** Any new SRS concept defaults here first. As M5-B (priority list, GoalSheet, mastery grades) ships, the file will accumulate more query functions and scheduling logic. At some point the file becomes hard to navigate and the mental model of what it owns becomes fuzzy.

**Direction:** Not urgent — the current split is logical. Watch for: scheduling logic (ease factor, interval math) drifting away from DB operations into this file. If that happens, extract a `lib/db/srs/scheduling.ts` for pure SRS math. The `paginate<T>` helper and `computeDueStats` are already well-factored and exportable from a shared util if needed.

---

## 5. Weak typing at the DB boundary

**File:** `apps/web/lib/db/srs/flashcards.ts`, `apps/web/lib/db/srs/browser.ts`

**Problem:** Supabase query responses are typed via `as` casts (`data as FlashcardWithItem[]`, `data as T[]` in `paginate<T>`). The `paginate<T>` helper uses `buildQ: () => any`. If a query's select shape changes, TypeScript won't catch the mismatch — the cast silently passes and the bug surfaces at runtime when a field is `undefined`.

**Risk:** Low friction today, but as queries evolve (new joins, renamed columns) the gap between declared types and actual response shapes widens quietly.

**Direction:** Supabase's `@supabase/supabase-js` v2 can infer types from the generated `Database` type if the project uses `supabase gen types`. If the project ever generates types from the schema, the `as` casts become unnecessary and the DB boundary becomes type-safe end to end. Not worth doing manually, but worth enabling if the Supabase CLI workflow is already in use.

---

## Signals to watch while building

These aren't items to fix now — they're the signs that one of the above is getting worse:

- A session page exceeds 900 lines without a new major feature landing
- A new setting requires touching more than 2 files
- `flashcards.ts` acquires a function that returns a computed value with no DB call (scheduling math belongs elsewhere)
- Any component re-renders visibly because unrelated state changed in the same page component

---

## Already completed (2026-06-14)

- `paginate<T>` helper centralised — pagination loops eliminated from 7 functions
- `computeDueStats` extracted — pure function, testable without DB
- Browser filter predicates pushed to DB — O(result) not O(vault)
- `shuffle_tests` / `shuffle_exposure` wired to `patchPreferences` — cloud sync complete
- Route names corrected: `/learn-session` → `/learn`, `/learn/*` → `/study/*`
