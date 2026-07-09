# Known bugs

Active bug investigations. Strike through + add fix commit when resolved.

---

## BUG-02 — learned-today count overshoots target (26/20 after 2×10 sessions)

**Symptom:** dashboard's learned-today counter can end up above `learnTarget` by more than one
session's worth (e.g. 26/20 after only two 10-card Learn sessions), when the user deliberately runs
extra sessions past today's target via the "Learn N more?" link.

**Suspect:** `loadLearnContext()` in `apps/web/app/(main)/learn/page.tsx`. Once
`learnedToday >= learnTarget`, `remaining` is computed as the *full* `learnTarget` again instead of
`0`:

```ts
const remaining = Math.max(0, context.learnedToday >= context.learnTarget
  ? context.learnTarget        // resets to full target once exceeded, not 0
  : context.learnTarget - context.learnedToday)
```

This only matters when `nParam` (the URL's `n=`) isn't already pinning the session size — worth
checking whether `learnMoreN` (`DualRingCard.tsx`, feeds the "Learn N more?" link's `n=`) is derived
independently or ends up relying on this same `remaining` value. Not yet root-caused; logged
2026-07-09 for a follow-up session. User confirms doing extra sessions beyond target is intentional
— the bug is the *magnitude* of the overshoot, not that overshoot is possible at all.

---

## ~~BUG-01 — "Application error" on natural session completion~~ — FIXED

**Root cause (found 2026-07-09, none of the hypotheses below were it):** `useSwipeGesture()` was
called ~170 lines *after* the `if (!entry) return null` early-return guard in both `LearnSession`
(`learn/page.tsx`) and `ReviewSession` (`review/page.tsx`). On every render while a card was active,
`entry` was defined and the hook ran. On the natural-completion render — `qIdx` incrementing past
`queue.length` while the session component is still mounted for one extra pass, before the
session-end `useEffect` fires and the parent flips `mode` to `'done'` — `entry` becomes `undefined`,
the component bails out at the guard, and `useSwipeGesture` is skipped. A component calling a
different number of hooks between two consecutive renders is exactly React error #300 ("Rendered
fewer hooks than expected... accidental early return"), which is what "Application error" was
hiding in the minified production build. This is also why manual exit never crashed: exiting
mid-session never drives `qIdx` past `queue.length`, so `entry` never goes undefined while mounted.

**Confirmed via repro, not just static reading:** minted an authenticated Playwright session against
production, drove a real 2-card Learn session to natural completion (`ArrowUp` graduates a card in
every phase), and captured the actual `pageerror` — `Minified React error #300`, decoded via React's
public `codes.json`. Reproduced deterministically every run before the fix.

**Fix:** moved both `useSwipeGesture()` calls to above their respective `if (!entry) return null`
guards, with `entry?.exposureDone`/`entry?.goodCount` fallbacks for the one config field that used to
come from the post-guard destructure. The callback handlers (`handleGraduate`, `submit`, etc.) are
hoisted `function` declarations, so referencing them from the earlier call site is safe — they're
never actually invoked with `entry` undefined since no swipeable card is rendered on that pass.

None of the four hypotheses below were the cause. Kept for reference since the ruled-out list is
still accurate (those really were checked and are clean) — the bug was a hooks-order issue no one
had traced.

---

## BUG-01 (superseded — see above) — "Application error" on natural session completion

**Symptom:** "Application error: a client-side exception has occurred while loading indilog.vercel.app" on mobile. Happens when the card queue is fully exhausted (learn or review), does NOT happen when pressing X to exit mid-session. Console not accessible on mobile.

**Key distinction:** Mid-session exit with 0 cards completed → `setMode('landing')` → neither `ReviewEnd` nor `LearnEnd` renders. Natural completion → `completedRef.current.size > 0` → `setMode('done')` → `ReviewEnd`/`LearnEnd` renders. This implicates the end-screen render or the transition into it.

### What's been ruled out

- `flushReviewEvents` — Supabase insert, never throws, already fire-and-forget
- `reload()` — `paginate()` logs errors and breaks, never throws; all Supabase helpers return `{data, error}` and don't throw; `listPriorityDecks` returns `[]` on failure
- `LearnEnd` — trivial static JSX, no state, no effects
- `ReviewEnd` render path — all values are primitives with valid defaults; optional chaining throughout; `gradeHistory` and `reviewedCards` are always valid subsets of completed cards
- Stale `ctx` on first render of `ReviewEnd` — initial state has valid numeric defaults for all fields used
- `loadLearnContext` / `loadSessionContext` — all Supabase, no throws

### Hypotheses (unconfirmed, in rough order of likelihood)

1. **Stale chunk after deploy** — If a new Vercel deploy landed while a session was in progress, the chunk containing `ReviewEnd`/`LearnEnd` (code-split at the route level) would 404 when Next.js tries to load it at `mode='done'`. This is a one-time occurrence per deploy; the timestamp commit (016ef90) may have resolved the specific instance the user hit.

2. **Unhandled rejection from `reload()` in `handleSessionExit`** — `reload()` is async and called without `.catch()` in both pages. In rare network conditions it could reject, and Next.js 15 may surface unhandled rejections as "Application error". Risk: both learn and review are affected equally.

3. **Missing try-catch in `submit('again')` (review/page.tsx ~line 353)** — `setDueAt(card.id, ...)` is awaited inside `Promise.all` with no surrounding try-catch. If it rejects (Supabase error), the async `submit()` propagates an unhandled rejection from an event handler. Only relevant if the user clicked "Again" during the session.

4. **Unknown render error in `ReviewEnd`** — Something in the JSX that static analysis missed (e.g. an iOS-specific DOM API, a timing issue on first render). Cannot confirm without seeing the actual error message.

### What's missing to diagnose

No error boundaries in the app → "Application error" shows zero detail. Adding `app/global-error.tsx` and `app/(main)/error.tsx` would capture render errors and show the message on-screen. For unhandled rejections, a `window.addEventListener('unhandledrejection', ...)` listener writing to localStorage or a Supabase table would be needed.

### Proposed fixes (not yet applied)

- Add `app/global-error.tsx` + `app/(main)/error.tsx` to surface the actual error on mobile
- Wrap `setDueAt` call in `submit('again')` (review/page.tsx) in try-catch
- Add `.catch(() => {})` to `reload()` calls inside `handleSessionExit` in both pages
- Optionally: `supabase.from('ind_client_errors').insert(...)` in error handlers so crashes are queryable from the dashboard
