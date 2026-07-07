# Indivore — Learn Feature Plan

> Status: **Planning** · Source: `temp_learn/` handoff from Citadel / YCM Portal
> Created: 2026-05-26

---

## 1. What the feature is

The Learn tab turns Indivore into a structured study environment backed by `ycm_master.db`. Users navigate four content sources — 12-level curriculum lessons, grammar pattern drills, prose essays, and conversational dialogues — rendered as study cards with Indigenous text, Chinese translation, and audio. Sentences can be saved directly into the user's notebook (`ind_items`), which feeds the flashcard/review queue automatically.

This is the most complex feature in the app. It requires a multi-table SQLite query layer, a navigation geometry map, cross-device completion tracking, and a new study card UI built to Indivore's design token system.

---

## 2. Relationship to the Citadel / YCM source

The `temp_learn/` directory contains a direct handoff from the YCM Portal (Citadel project):

| File | Status | Notes |
|---|---|---|
| `portal/lib/corpus_geometry.json` | **Copy as-is** | Navigation + alignment map. Required before any API query. |
| `portal/lib/grmpts_type_labels.json` | **Copy as-is** | Pattern ID → human-readable label. |
| `portal/lib/dialects.ts` | **Copy adapted** | GLID maps, dialect families, Chinese/English names. |
| `portal/app/[language]/learn/page.tsx` | **Reference only** | ~660-line working source. Heavily YCM-themed; not drop-in. |
| `portal/app/api/curriculum/route.ts` | **Port logic** | SQLite query variants per source + audio URL repair. |
| `portal/app/api/lookup/route.ts` | **Port logic** | ILRDF word lookup. |
| `portal/hooks/usePersistedState.ts` | **Reference** | Pattern for localStorage persistence. |
| `portal/hooks/useProgress.ts` | **Reference** | Completion state logic. |
| `portal/components/views/SingleDialectView.tsx` | **Reference** | Card grid rendering logic. |
| `portal/components/views/WordTooltip.tsx` | **Reference** | Word lookup tooltip logic. |

**Do not copy visual style.** YCM uses Tailwind CSS variable theming (`theme-matrix`, `var(--accent)`, lucide icons). Indivore uses design tokens (`T.crimson`, `T.sage`, etc.), inline styles, and a shared component library. All UI must be written from scratch in the Indivore idiom.

---

## 3. Data assets

### 3.1 SQLite schema (already in `ycm_master.db`)

```sql
sentences(id, glid, ab, zh, word_data_json, logic_hash)
occurrences(id, sentence_id, dialect_name, source, level, category, audio_url, local_path, original_uuid)
ilrdf_vocabulary(id, dialect_id, dialect_name, word_ab, word_ch, source, num, glid)
```

`sentences JOIN occurrences` is the primary read pattern for curriculum content.
`ilrdf_vocabulary` is used for word lookup only.

**Source values in `occurrences.source`:**
- `twelve` — 12-level curriculum (12 levels × 10 lessons = 120 entries per dialect)
- `grmpts` — grammar pattern drills
- `essay` — prose topics
- `dialogue` — conversational topics
- `nine_year` — exists in DB but not surfaced in the four-source UI

### 3.2 Asset files to copy

**Destination:** `apps/web/lib/learn/`

```
apps/web/lib/learn/
  corpus_geometry.json      ← copy from temp_learn/portal/lib/
  grmpts_type_labels.json   ← copy from temp_learn/portal/lib/
  dialects.ts               ← adapted copy from temp_learn/portal/lib/
  lang-bridge.ts            ← new file (see §4)
```

### 3.3 `corpus_geometry.json` shape (critical)

```ts
type CorpusGeometry = {
  twelve: {
    levels: string[];               // ["1","2",...,"12"]
    classes: number[];              // [1,2,...,10]
    titles?: Record<string, Record<string, string>>; // level → lesson → title
  };
  grmpts: {
    levels?: string[];
    titles?: Record<string, string>;
    counts?: Record<string, Record<string, Record<string, number>>>; // glid → level → patternId → count
  };
  essay: Array<{ index: number; title_zh: string; alignment: Record<string, string> }>;
  dialogue: Array<{ index: number; title_zh: string; alignment: Record<string, string> }>;
};
```

`essay` and `dialogue` items **cannot** be queried by `title_zh` directly. The `alignment[dialectName]` value must be resolved first to get the DB-level `occurrences.category` string. If alignment is missing for a dialect, return `[]`.

---

## 4. Language code bridge

`ind_profiles.active_study_language` stores the Indivore language code (`ami`, `tay`, `pwn`, etc.) from `lib/languages.ts`. YCM's DB uses numeric GLIDs (`01`–`16`) and Chinese dialect names. A bridge is required at every query site.

### 4.1 Indivore code → GLID

```ts
// apps/web/lib/learn/lang-bridge.ts
export const INDIVORE_TO_GLID: Record<string, string> = {
  'ami': '01',  // Amis
  'tay': '02',  // Atayal
  'pwn': '03',  // Paiwan
  'bnn': '04',  // Bunun
  'pyu': '05',  // Puyuma
  'dru': '06',  // Rukai
  'tsu': '07',  // Tsou
  'xsy': '08',  // Saisiyat
  'tao': '09',  // Tao (Yami)
  'ssf': '10',  // Thao
  'ckv': '11',  // Kavalan
  'trv': '12',  // Truku
  'szy': '13',  // Sakizaya
  'see': '14',  // Seediq
  'sxr': '15',  // Saaroa (Hla'alua) — YCM GLID 15 = 拉阿魯哇語
  'xnb': '16',  // Kanakanavu
}
```

**Note on `sxr`/`15`:** Indivore uses code `sxr` (Saaroa) for the language YCM records as GLID `15` (拉阿魯哇語, Hla'alua). These are considered the same language group. The DB uses the Chinese name — resolve via `GLID_FAMILIES['15']`.

### 4.2 Resolution helpers

```ts
export function getGlid(indivoreCode: string): string | null {
  return INDIVORE_TO_GLID[indivoreCode] ?? null
}

export function getDefaultDialect(indivoreCode: string): string | null {
  const glid = getGlid(indivoreCode)
  if (!glid) return null
  return GLID_FAMILIES[glid]?.[0] ?? null
}
```

---

## 5. Routing strategy

### Decision: single `/learn` route, no per-language URL segments

YCM uses `/:language/learn` (e.g., `/amis/learn`). Indivore should **not** mirror this because:

- Indivore's app model is one active study language at a time, changed in Settings (DEC-R05 equivalent).
- Adding per-language dynamic segments would require URL-aware middleware, conflict with the existing route group `(main)`, and imply a multi-language simultaneous model that doesn't exist.
- The active language is already persisted in `ind_profiles.active_study_language`.

**Route:** `app/(main)/learn/page.tsx` — the existing placeholder.

The source, selected item, level, and grammar comparison state are persisted in `localStorage` keyed by GLID (matching YCM's pattern), so switching the active study language in Settings produces a fresh cursor for that language.

**Alternative considered:** A `/learn/[language]` sub-route for deep linking. Rejected for v1 — adds route complexity with no user-facing benefit at this stage.

---

## 6. Dialect selection

### Persistence model

Within Learn, the user selects a dialect for the active language (e.g., 南勢阿美語 within Amis). This selection should persist cross-device.

**Decision:** Store the selected dialect in `ind_profiles.default_dialect` (already in schema, currently deferred per plan-v0.md Phase 2). This field is wired up as part of the Learn feature.

- On Learn page mount: read `default_dialect` from `ind_profiles`. If null, fall back to `GLID_FAMILIES[glid][0]`.
- When user changes dialect in Learn: write back to `ind_profiles.default_dialect`.
- The stored value is the Chinese dialect name (e.g., `"南勢阿美語"`), matching the DB's `occurrences.dialect_name` column directly.

**Note:** The Learn dialect picker is session-sticky but writes to the same profile field as the future Settings dialect selector (which was deferred in Phase 2). These are the same field.

---

## 7. API routes

### 7.1 `/api/curriculum`

```
GET /api/curriculum?dialect=<dialectName>&source=<source>&title_zh=<itemId>&level=<level?>
```

Response:
```ts
{ results: Array<{ ab: string; zh: string; audio_url: string | null; original_uuid: string; category: string }> }
// on error: { error: string; results: [] }
```

**Query logic by source:**

| Source | Dialect param | Category param | Level param | Sort |
|---|---|---|---|---|
| `twelve` | `selectedDialect` | `Level {n} Lesson {m}` | — | `original_uuid ASC` |
| `grmpts` | `GLID_NAMES[glid].replace('族','語')` | `patternId` (e.g. `t1`) | required (1–4) | `original_uuid ASC` |
| `essay` | `selectedDialect` | `alignment[dialectName]` | — | numeric extraction from `original_uuid` |
| `dialogue` | `selectedDialect` | `alignment[dialectName]` | — | numeric extraction from `original_uuid` |

**Critical `grmpts` note:** Grammar drills are stored at language level, not sub-dialect. The query dialect is derived as `GLID_NAMES[glid].replace('族', '語')` regardless of which sub-dialect the user selected. Using the sub-dialect name will return zero rows.

**Audio URL repair** must be applied to every row before returning:

> **Stale snippet (2026-07-08):** the current implementation lives in `apps/web/lib/corpus/curriculum.ts` (mirrored in `scripts/build-content-packs.mjs`) and additionally handles grmpts plus the two-segment `/sound/{tid}/{id}.mp3` shape that all dialogue rows carry — the version below misses it and leaves those URLs dead. See architecture.md → Known data notes.

```ts
function repairAudioUrl(row: { audio_url?: string | null; source?: string; original_uuid?: string }) {
  if (!row.audio_url || !row.audio_url.includes('klokah.tw')) return row.audio_url
  let url = row.audio_url
    .replace('file.klokah.tw', 'web.klokah.tw')
    .replace('http://', 'https://')
  if ((row.source === 'essay' || row.source === 'dialogue') && !url.includes('/text/')) {
    const parts = (row.original_uuid || '').split('_')
    const contextId = parts.length >= 3 ? parts[parts.length - 2] : null
    const soundMatch = url.match(/\/sound\/(\d+)\.mp3/)
    if (contextId && /^\d+$/.test(contextId) && soundMatch?.[1]) {
      return `https://web.klokah.tw/text/sound/${contextId}/${soundMatch[1]}.mp3`
    }
  }
  return url
}
```

**Runtime:** `export const runtime = 'nodejs'` (SQLite is Node-only, same as `/api/dict/search`).

### 7.2 `/api/lookup`

```
GET /api/lookup?word=<token>&dialect=<dialectName>&glid=<glid>
```

Response:
```ts
{ results: Array<{ word_ab: string; word_ch: string; dialect_name: string; vocab_source: string }> }
```

SQL:
```sql
SELECT word_ab, word_ch, dialect_name, source AS vocab_source
FROM ilrdf_vocabulary
WHERE LOWER(word_ab) = LOWER(?)
LIMIT 6;
```

Token cleaning before lookup:
```ts
function cleanToken(token: string): string {
  return token.replace(/^[^a-zA-ZÀ-ſ']+|[^a-zA-ZÀ-ſ']+$/g, '').toLowerCase()
}
```

**Note:** This endpoint may eventually be unified with the Dictionary search. For now it is a separate route with simpler semantics (exact match, no FTS).

---

## 8. Completion tracking

### Why this matters

Lesson completion state is meaningful progress data, not just display decoration:

- It drives "N lessons completed" in the dashboard Lessons stat (currently showing "—").
- It enables "continue where you left off" cursor behavior on the dashboard and within Learn.
- It is cross-language: a user studying both Amis and Atayal has separate completion records per language.
- Over time it enables streaks, milestones, and level-completion celebrations.

### Decision: Supabase table, not localStorage

YCM stores completion in `localStorage`. Indivore has Supabase — use it.

**New migration required:** `ind_completions`

```sql
CREATE TABLE ind_completions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users NOT NULL,
  language   text NOT NULL,          -- Indivore language code (e.g. 'ami')
  source     text NOT NULL,          -- 'twelve' | 'grmpts' | 'essay' | 'dialogue'
  item_key   text NOT NULL,          -- 'Level 1 Lesson 1', 't1', title_zh, etc.
  completed_at timestamptz DEFAULT now(),
  UNIQUE(user_id, language, source, item_key)
);
ALTER TABLE ind_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user owns completions" ON ind_completions
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

**Completion key format:** `source:item_key` — e.g. `twelve:Level 1 Lesson 1`, `grmpts:t1`, `essay:我早上七點鐘到學校。`

**Toggle behavior:** inserting a row marks complete; deleting the row marks incomplete. The UI shows toggle state based on row existence.

**Dashboard integration:** `SELECT COUNT(*) FROM ind_completions WHERE user_id = ? AND language = ?` gives the total for the Lessons stat.

---

## 9. Saved sentences → ind_items integration

When a user saves a sentence from Learn, it creates an `ind_item` row via `createItem()`. This is the core Indivore loop:

```
Learn → Save sentence → ind_items row → ensureFlashcards() → Review queue
```

Save payload:
```ts
createItem({
  text: row.ab,
  type: 'sentence',
  language: indivoreCode,        // from active study language
  dialect: selectedDialectName,  // Chinese dialect name
  notes: row.zh,                 // Chinese translation stored as notes
})
```

The `original_uuid` is not stored in `ind_items` directly, but the `notes` field carries the translation so the flashcard front/back is meaningful.

**Saved view within Learn:** The "Saved" source tab filters `ind_items` by `language = activeLanguageCode AND type = 'sentence'` — fetched from Supabase, not from a local saved-sentences array. This is the key difference from YCM (which uses a localStorage `yc_saved_sentences` array).

---

## 10. Word lookup

**Scope decision:** Word lookup is a cross-app feature and should be built as a standalone component (`WordLookup`) that can be mounted anywhere — in Learn study cards, in Capture, in the Dictionary detail view.

For the Learn feature specifically, the lookup need is:
- Tap any word token in the Indigenous (`ab`) text → show definition panel
- Mobile: sticky panel above bottom nav
- Desktop: floating tooltip near the tapped word

**Dependency:** Learn v1 can ship with a simplified inline lookup (tapping a word opens the Dictionary tab prepopulated, or shows a small modal). The full cross-app `WordLookup` component is a separate feature, developed in parallel or just after.

Token splitting: whitespace tokenization + `cleanToken()` stripping leading/trailing non-letter characters.

---

## 11. UI design — key decisions

### Departure from Citadel

YCM's Learn page is a full-screen immersive experience with a collapsible sidebar, themed CSS variables, and a header bar. **Indivore's Learn page is a tab within the app shell.** It uses:

- The existing `ScreenHeader` component (title + lang chip)
- The existing bottom navigation (always visible)
- Inline styles + design tokens (`T.*`)
- The shared `Card`, `Button`, `Icon`, `SectionHead` components

### Layout

**Mobile (primary):**
```
ScreenHeader
[Source tabs: Lessons | Patterns | Essays | Dialogs | Saved]
[Content selector: collapsible panel — lesson grid, pattern list, essay list, etc.]
[Study cards — vertical scroll]
[Prev | Mark Complete | Next]
```

**Desktop:**
```
ScreenHeader
[Left: 240px content selector sidebar]  [Right: study card feed]
[Source tabs in header — horizontal]
```

### Study card anatomy

```
[seq #]  [dialect badge]
[ab text — large serif, Newsreader, crimson accent on hover tokens]
[zh text — smaller, inkSoft, reveal/hide toggle]
[───────────────────────────────────]
[▶ Audio]  [Copy ab]  [Copy zh]  [Save ✓]
```

Settings panel (accessible from header icon):
- Chinese: Show all / Hide by default / Hide entirely
- Layout: Vertical / Side-by-side
- Lookup: On / Off

### Source tabs

| Source | Icon | Label |
|---|---|---|
| `twelve` | `learn` | Lessons |
| `grmpts` | `card` | Patterns |
| `essay` | `pen` | Essays |
| `dialogue` | `wave` | Dialogs |
| `saved` | `bookmark` | Saved |

### Content selector — per-source behavior

**Lessons (`twelve`):**
- Level row: `1` through `12` (scrollable chips)
- Lesson row: `1` through `10` (scrollable chips)
- Each lesson chip shows title from `geometry.twelve.titles[level][lesson]` if present
- Completed lessons shown with a filled check mark / muted style

**Patterns (`grmpts`):**
- Level row: `1` through `4`
- Pattern list: `t1`…`tN` sorted numerically, labels from `grmpts_type_labels.json`
- Only patterns present in `geometry.grmpts.counts[glid][level]` shown

**Essays / Dialogs:**
- Group row: `Intro` (0–19) / `Intermediate` (20–39) / `Advanced` (40–59)
- List of `title_zh` entries in the active group
- Completed entries visually muted

---

## 12. Implementation phases

### Phase L0 — Assets & Data Bridge

1. Copy `corpus_geometry.json` → `apps/web/lib/learn/corpus_geometry.json`
2. Copy `grmpts_type_labels.json` → `apps/web/lib/learn/grmpts_type_labels.json`
3. Create `apps/web/lib/learn/dialects.ts` — adapted from Citadel source (GLID maps, no YCM-specific imports)
4. Create `apps/web/lib/learn/lang-bridge.ts` — `INDIVORE_TO_GLID` map + helpers
5. Wire `ind_profiles.default_dialect` read/write in learn dialect picker

**Exit:** Asset files in place, GLID resolution works for all 16 languages. No UI changes yet.

### Phase L1 — API Routes

1. Extend `lib/dict/client.ts` with curriculum query functions (or create `lib/learn/db.ts` — preferred to keep concerns separate)
2. Build `/api/curriculum` — all four source query variants + audio URL repair
3. Build `/api/lookup` — exact-match ILRDF word lookup
4. Apply `ind_completions` migration

**Exit:** API routes return correct rows for all four sources. Audio URLs repaired. Validation: Amis `Level 1 Lesson 1` + grmpts `t1` + one essay + one dialogue, checked in browser.

### Phase L2 — Learn Page UI (Session A — Navigation)

1. Replace `/learn` placeholder with live page
2. Source tab bar (mobile bottom strip, desktop horizontal)
3. Content selector panel per source
4. Data fetch on selection change
5. Prev/next navigation
6. Loading shimmer, empty states, error banner

**Exit:** User can navigate sources and see content rendered as raw text (unstyled cards acceptable).

### Phase L2 — Learn Page UI (Session B — Study Cards)

1. Study card component: ab text, zh reveal/hide, sequence number, dialect badge
2. Audio playback (singleton `<audio>` ref, one active at a time)
3. Copy ab / Copy zh actions
4. Save to notebook (→ `createItem`, toast confirmation)
5. Mark complete (toggle → `ind_completions` row)
6. Settings panel (zh visibility, layout, lookup on/off)
7. Saved view — filters `ind_items` by language + type sentence

**Exit:** Full study loop working. Saving a sentence creates an item visible in Capture recent list and in the Review queue.

### Phase L3 — Word Lookup + Polish

1. Simplified inline lookup: tap word → `/api/lookup` → small result panel
2. Completion counts feeding the Dashboard Lessons stat
3. Default dialect wired to `ind_profiles.default_dialect`
4. Mobile spacing pass on learn page
5. Accessibility: ARIA labels on audio/save/copy buttons

---

## 13. Deferred

- **Grammar comparison mode** — side-by-side pattern comparison for `grmpts` on desktop. Citadel source implements it fully. Deferred: complex state management, desktop-only use case, not needed for v1 MVP.
- **Language dashboard** (per-language progress cards with "Next" shortcuts) — YCM has a `/:language` dashboard. Indivore's equivalent is the main Dashboard tab; dedicated per-language pages are out of scope.
- **nine_year source** — exists in DB, not surfaced.
- **Full cross-app WordLookup component** — planned as a separate feature after Learn v1 ships.
- **MOE dictionary fallback** (Amis) — YCM checks a secondary DB for Amis lookups. Not available in Indivore's current DB setup.
- **Offline / local audio cache** — `occurrences.local_path` exists but audio is served remotely.

---

## 14. Open decisions

| ID | Question | Default if unresolved |
|---|---|---|
| DEC-L01 | Should Learn be available for all 16 languages, or only the 6 FormoBank translation languages? | **All 16** (per user confirmation) |
| DEC-L02 | Should the Saved view in Learn show all captured sentences for the language, or only sentences captured *from* Learn? | All `ind_items` of type `sentence` for the active language — gives full context |
| DEC-L03 | Grammar comparison mode: defer to v2, or include in v1? | **Defer** |
| DEC-L04 | `corpus_geometry.json` update cadence: static file checked into repo, or fetched from Citadel API? | **Static file in repo** — the geometry is stable curriculum structure, not live data |

---

## 15. Cross-references

- `plan-v0.md` Phase 10 — Learn feature v1
- `decisions.md` — DEC-L01 through DEC-L04, DEC-R05 (Learn was placeholder in v0)
- `log.md` — implementation entries as phases complete
- `temp_learn/` — source handoff directory (can be deleted after Phase L0 assets are copied)
