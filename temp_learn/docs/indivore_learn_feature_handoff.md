# Indivore Learn Feature Handoff

*Created: 2026-05-26*

This document explains how to reproduce the current YCM Portal "learn" feature in Indivore, assuming Indivore already has access to `ycm_master.db`.

The goal is feature parity for learning behavior and data access, not visual parity. Do not copy YCM-specific colors, theme names, or decorative styling unless Indivore wants them.

## Feature Summary

The learn feature is a single-language, single-dialect study surface backed by `ycm_master.db`.

It exposes four learning sources:

- `twelve`: 12-level curriculum lessons.
- `grmpts`: grammar pattern drills.
- `essay`: prose/text topics.
- `dialogue`: conversational topics.

It also has a local-only saved sentence view, but saved sentences are user progress state, not a fifth DB source.

Primary user flow:

1. User opens a language dashboard, e.g. `/amis`.
2. Dashboard shows four learn cards with completion progress and "next item" shortcuts.
3. User enters `/amis/learn`.
4. User selects a source, lesson/topic/pattern, and dialect.
5. App fetches sentence rows from `ycm_master.db`.
6. Rows render as study cards with Indigenous text, Chinese translation, audio playback, word lookup, copy, save, previous/next, and mark-complete behavior.

## Required Assets

### SQLite DB

Required DB:

```text
ycm_master.db
```

Required tables:

```sql
sentences(
  id INTEGER PRIMARY KEY,
  glid TEXT,
  ab TEXT,
  zh TEXT,
  word_data_json TEXT,
  logic_hash TEXT UNIQUE
)

occurrences(
  id INTEGER PRIMARY KEY,
  sentence_id INTEGER,
  dialect_name TEXT,
  source TEXT,
  level TEXT,
  category TEXT,
  audio_url TEXT,
  local_path TEXT,
  original_uuid TEXT
)

ilrdf_vocabulary(
  id INTEGER PRIMARY KEY,
  dialect_id INTEGER,
  dialect_name TEXT,
  word_ab TEXT,
  word_ch TEXT,
  source TEXT,
  num INTEGER,
  glid TEXT
)
```

The learn feature mainly reads `sentences` joined to `occurrences`. Word lookup uses `ilrdf_vocabulary`.

Important source values in `occurrences.source`:

```text
twelve
grmpts
essay
dialogue
```

`nine_year` exists in the DB but is not part of the current four-source learn experience.

### Geometry JSON

Required JSON from YCM:

```text
portal/lib/corpus_geometry.json
```

This file is not decorative. It is the navigation and cross-dialect alignment map for the learn feature.

Required shape:

```ts
type CorpusGeometry = {
  twelve: {
    levels: string[];
    classes: number[];
    titles?: Record<string, Record<string, string>>;
  };
  grmpts: {
    levels?: string[];
    titles?: Record<string, string>;
    counts?: Record<string, Record<string, Record<string, number>>>;
  };
  essay: Array<{
    index: number;
    title_zh: string;
    alignment: Record<string, string>;
  }>;
  dialogue: Array<{
    index: number;
    title_zh: string;
    alignment: Record<string, string>;
  }>;
};
```

Why it matters:

- `twelve` uses generated category IDs like `Level 1 Lesson 1`, plus titles from `twelve.titles`.
- `grmpts` uses language/level availability from `grmpts.counts`.
- `essay` and `dialogue` cannot be queried by display title directly. Their display title must be resolved through `alignment[dialectName]` to get the dialect-specific `occurrences.category`.

### Grammar Labels

Required JSON from YCM:

```text
portal/lib/grmpts_type_labels.json
```

This maps pattern IDs such as `t1`, `t2`, etc. to human-readable labels. If absent, fall back to the raw pattern ID.

### Language And Dialect Maps

Indivore needs the same core maps:

- `GLID_FAMILIES`: GLID to available dialect names.
- `GLID_NAMES`: GLID to Chinese language name.
- `GLID_NAMES_EN`: GLID to English language name.
- `LANGUAGE_SLUGS`: GLID to URL slug.
- `DIALECT_TO_EN`: Chinese dialect name to English display name.

The current portal maps slugs like:

```ts
{
  "01": "amis",
  "02": "atayal",
  "03": "paiwan",
  "04": "bunun",
  "05": "puyuma",
  "06": "rukai",
  "07": "tsou",
  "08": "saisiyat",
  "09": "tao",
  "10": "thao",
  "11": "kavalan",
  "12": "truku",
  "13": "sakizaya",
  "14": "seediq",
  "15": "hlaalua",
  "16": "kanakanavu"
}
```

## Route Model

YCM currently has two user-facing routes:

```text
/:language
/:language/learn
```

Recommended Indivore equivalent:

- Language dashboard route: shows source cards and saved count.
- Learn route: shows source navigation, content selection, study cards, settings, and progress controls.

`language` is a slug. Resolve it back to a GLID:

```ts
function getLanguageFromSlug(slug: string): string | null {
  return Object.entries(LANGUAGE_SLUGS).find(([, s]) => s === slug)?.[0] ?? null;
}
```

If slug resolution fails, redirect to the app's language hub.

## API Contract

### Curriculum Content API

The current portal uses:

```text
GET /api/curriculum?dialect=<dialectName>&source=<source>&title_zh=<idOrTitle>&level=<level?>
```

Required parameters:

- `dialect`: Chinese dialect name, except `grmpts` uses the language-level name described below.
- `source`: one of `twelve`, `grmpts`, `essay`, `dialogue`.
- `title_zh`: source-specific selected item ID.
- `level`: only required for `grmpts`.

Response:

```ts
type CurriculumResponse = {
  results: Array<{
    ab: string;
    zh: string;
    audio_url: string | null;
    original_uuid: string;
    category: string;
  }>;
};
```

Errors should return:

```ts
{ error: string, results: [] }
```

### Query Logic By Source

#### `twelve`

Selection ID format:

```text
Level {level} Lesson {lesson}
```

Example:

```text
Level 1 Lesson 1
```

SQL:

```sql
SELECT s.ab, s.zh, o.audio_url, o.original_uuid, o.category
FROM sentences s
JOIN occurrences o ON s.id = o.sentence_id
WHERE o.dialect_name = ?
  AND o.source = 'twelve'
  AND o.category = ?
ORDER BY o.original_uuid ASC;
```

Bind:

```ts
[selectedDialectName, selectedCategory]
```

Use `corpus_geometry.twelve.titles[level][lesson]` for the display title when present.

#### `grmpts`

Selection ID format:

```text
t1
t2
t3
...
```

There is also an active grammar level:

```text
1, 2, 3, or 4
```

Important: current YCM fetches `grmpts` with the language-level name, not the selected sub-dialect. It derives this from `GLID_NAMES[glid].replace('族', '語')`.

Example:

```ts
const queryDialect =
  source === "grmpts"
    ? GLID_NAMES[glid].replace("族", "語")
    : selectedDialect;
```

SQL:

```sql
SELECT s.ab, s.zh, o.audio_url, o.original_uuid, o.category
FROM sentences s
JOIN occurrences o ON s.id = o.sentence_id
WHERE o.dialect_name = ?
  AND o.source = 'grmpts'
  AND o.category = ?
  AND o.level = ?
ORDER BY o.original_uuid ASC;
```

Bind:

```ts
[languageLevelDialectName, patternId, String(level)]
```

Navigation should only list pattern IDs present in:

```ts
corpus_geometry.grmpts.counts[glid][level]
```

Also support padded GLID lookup as fallback:

```ts
const paddedGlid = glid.padStart(2, "0");
const langGrmpts =
  geometry.grmpts.counts?.[glid] ??
  geometry.grmpts.counts?.[paddedGlid];
```

#### `essay`

Display selection is a shared topic title:

```ts
entry.title_zh
```

Before querying, resolve the selected title and dialect to a dialect-specific category:

```ts
const entry = geometry.essay.find(e => e.title_zh === selectedTitle);
const targetCategory = entry?.alignment?.[selectedDialectName];
```

SQL:

```sql
SELECT s.ab, s.zh, o.audio_url, o.original_uuid, o.category
FROM sentences s
JOIN occurrences o ON s.id = o.sentence_id
WHERE o.dialect_name = ?
  AND o.source = 'essay'
  AND o.category = ?
ORDER BY CAST(SUBSTR(o.original_uuid, INSTR(o.original_uuid, '_') + 1) AS INTEGER) ASC;
```

Bind:

```ts
[selectedDialectName, targetCategory]
```

If no alignment exists for the dialect, return an empty result array.

#### `dialogue`

Same logic as `essay`, but using `geometry.dialogue`.

`alignment[dialectName]` values are usually strings like:

```text
Dialogue TID 26928
```

SQL:

```sql
SELECT s.ab, s.zh, o.audio_url, o.original_uuid, o.category
FROM sentences s
JOIN occurrences o ON s.id = o.sentence_id
WHERE o.dialect_name = ?
  AND o.source = 'dialogue'
  AND o.category = ?
ORDER BY CAST(SUBSTR(o.original_uuid, INSTR(o.original_uuid, '_') + 1) AS INTEGER) ASC;
```

Bind:

```ts
[selectedDialectName, targetCategory]
```

## Audio URL Repair

The DB has Klokah audio URLs that may need repair at read time.

Current portal behavior:

```ts
function repairAudioUrl(row: {
  audio_url?: string | null;
  source?: string;
  original_uuid?: string;
}) {
  if (!row.audio_url || !row.audio_url.includes("klokah.tw")) {
    return row.audio_url;
  }

  let url = row.audio_url
    .replace("file.klokah.tw", "web.klokah.tw")
    .replace("http://", "https://");

  if ((row.source === "essay" || row.source === "dialogue") && !url.includes("/text/")) {
    const parts = (row.original_uuid || "").split("_");
    const contextId = parts.length >= 3 ? parts[parts.length - 2] : null;
    const soundMatch = url.match(/\/sound\/(\d+)\.mp3/);

    if (contextId && /^\d+$/.test(contextId) && soundMatch?.[1]) {
      return `https://web.klokah.tw/text/sound/${contextId}/${soundMatch[1]}.mp3`;
    }
  }

  return url;
}
```

Apply this to every curriculum result before returning it to the client.

## Learn Page State

The current portal persists most state in `localStorage`. Indivore may use its own persistence layer, but these are the behavioral keys and concepts.

Per-language cursor state:

```text
yc_portal_source_{glid}
yc_portal_id_twelve_{glid}
yc_portal_id_grmpts_{glid}
yc_portal_id_essay_{glid}
yc_portal_id_dialogue_{glid}
yc_portal_level_{glid}
yc_portal_primary_{glid}
yc_dialect_{glid}
```

Global learn settings:

```text
yc_zh_hidden_default
yc_show_zh_entirely
yc_tooltip_enabled
yc_cards_per_row
yc_sentence_layout
```

Progress:

```text
yc_saved_sentences
yc_completed_lessons
```

Recommended TypeScript shapes:

```ts
type LearnSource = "twelve" | "grmpts" | "essay" | "dialogue";
type LearnMode = LearnSource | "saved";

type SavedSentence = {
  original_uuid: string;
  ab: string;
  zh: string;
  audio_url?: string | null;
  dialect_name: string;
  source: LearnSource;
  category: string;
  saved_at: number;
};

type CompletedLessons = Record<string, boolean>;
```

Completion key:

```ts
`${source}:${categoryOrSelectionId}`
```

Examples:

```text
twelve:Level 1 Lesson 1
grmpts:t1
essay:我早上七點鐘到學校。
dialogue:大家好
```

Saved sentence identity:

```ts
original_uuid
```

If `original_uuid` is missing, YCM falls back to:

```ts
`${dialectName}:${ab}`
```

## Dashboard Behavior

The language dashboard is a lightweight launcher and progress summary.

It should show four source cards:

```ts
[
  "twelve",
  "grmpts",
  "essay",
  "dialogue"
]
```

Each card needs:

- Label.
- Completed count.
- Total count.
- Progress percentage.
- Main click: enter learn route at current cursor.
- Next click: advance that source cursor to the next item, then enter learn route.

Total counts:

```ts
const twelveTotal =
  geometry.twelve.levels.length * geometry.twelve.classes.length;

const essayTotal =
  geometry.essay.length;

const dialogueTotal =
  geometry.dialogue.length;

const grmptsTotal =
  Object.values(geometry.grmpts.counts?.[glid] ?? {})
    .reduce((sum, levelCounts) => sum + Object.keys(levelCounts).length, 0);
```

Completion count:

```ts
function countCompleted(source: LearnSource, completed: CompletedLessons) {
  return Object.entries(completed)
    .filter(([key, value]) => key.startsWith(source + ":") && value)
    .length;
}
```

Saved count:

```ts
const savedCount = savedSentences
  .filter(s => GLID_FAMILIES[glid].includes(s.dialect_name))
  .length;
```

Next item logic:

- `twelve`: next lesson in the same level; after the last lesson, first lesson of the next level.
- `grmpts`: next sorted pattern ID within the current grammar level.
- `essay`: next item in `geometry.essay`.
- `dialogue`: next item in `geometry.dialogue`.

When the user clicks a source card:

```ts
setActiveSource(source);
navigate(`/${languageSlug}/learn`);
```

When the user clicks a next shortcut:

```ts
setCursorForSource(source, nextId);
setActiveSource(source);
navigate(`/${languageSlug}/learn`);
```

## Learn Page Behavior

### Source Navigation

Desktop:

- Show source tabs for `twelve`, `grmpts`, `essay`, `dialogue`.
- Show a saved button.
- Show a side navigation panel for content selection when the active source is not `saved`.

Mobile:

- Show bottom source navigation for the four sources.
- Opening a non-saved source should open the content selector.
- `saved` should skip the content selector.

Source change should clear grammar comparison state:

```ts
setCompareIds([]);
setCompareResults({});
setPrimarySelection(null);
```

### Content Selector Behavior

#### `twelve`

Selector:

- Level buttons from `geometry.twelve.levels`.
- Lesson buttons from `geometry.twelve.classes`.

Current selection:

```text
Level {level} Lesson {lesson}
```

Changing level keeps the current lesson number:

```ts
setSelection(`Level ${newLevel} Lesson ${currentLesson}`);
```

Changing lesson keeps the current level:

```ts
setSelection(`Level ${currentLevel} Lesson ${newLesson}`);
```

Display each lesson title from:

```ts
geometry.twelve.titles?.[currentLevel]?.[lesson]
```

#### `grmpts`

Selector:

- Level buttons `1` to `4`.
- Pattern buttons from `geometry.grmpts.counts[glid][level]`.

Sort pattern IDs numerically:

```ts
keys.sort((a, b) =>
  parseInt(a.replace("t", "")) - parseInt(b.replace("t", ""))
);
```

Display label:

```ts
grmptsLabels[patternId] ?? patternId
```

Remove leading numeric prefixes for compact display:

```ts
label.replace(/^\d+\s*-\s*/, "")
```

#### `essay` And `dialogue`

Selector:

- Three level-like groups by index:
  - Intro: indices `0..19`
  - Intermediate: indices `20..39`
  - Advanced: indices `40..59`
- List only items in the active group.

Selecting a group moves to the first item in that group.

Selecting an item uses:

```ts
item.title_zh
```

as the cursor.

### Fetching Content

On every change to selected dialect, active source, selected item, grammar level, or grammar comparison set, fetch content unless active source is `saved`.

Pseudo-code:

```ts
async function fetchLearnContent() {
  if (activeSource === "saved") return;
  if (!selectedDialect || !activeSource || !selection || !glid) return;

  const idsToFetch = [effectiveMainSelection, ...compareIds];
  const queryDialect =
    activeSource === "grmpts"
      ? GLID_NAMES[glid].replace("族", "語")
      : selectedDialect;

  const nextCompareResults: Record<string, CurriculumRow[]> = {};

  await Promise.all(idsToFetch.map(async composite => {
    let actualId = composite;
    let actualLevel = String(level);

    if (activeSource === "grmpts" && composite.includes(":")) {
      const [compositeLevel, patternId] = composite.split(":");
      actualLevel = compositeLevel;
      actualId = patternId;
    }

    const url = new URL("/api/curriculum", location.origin);
    url.searchParams.set("dialect", queryDialect);
    url.searchParams.set("source", activeSource);
    url.searchParams.set("title_zh", actualId);
    if (activeSource === "grmpts") {
      url.searchParams.set("level", actualLevel);
    }

    const data = await fetch(url).then(r => r.json());
    if (composite === effectiveMainSelection) {
      setResults(data.results ?? []);
    } else {
      nextCompareResults[composite] = data.results ?? [];
    }
  }));

  setCompareResults(nextCompareResults);
}
```

### Saved View

Saved view is local-state only.

When active source is `saved`:

```ts
let filtered = savedSentences
  .filter(s => GLID_FAMILIES[glid].includes(s.dialect_name));

if (savedFilter !== "all") {
  filtered = filtered.filter(s => s.source === savedFilter);
}

setResults(filtered);
```

Saved filters:

```text
all
twelve
grmpts
essay
dialogue
```

### Previous And Next Buttons

Show previous/next controls when:

```ts
activeSource !== "saved" && results.length > 0
```

Adjacent logic:

- `twelve`: previous/next through level/lesson grid.
- `grmpts`: previous/next through sorted pattern keys for current GLID and level.
- `essay`: previous/next in `geometry.essay`.
- `dialogue`: previous/next in `geometry.dialogue`.

### Mark Complete

Show a mark-complete button when content results exist and active source is not saved.

Toggle:

```ts
completedLessons[`${activeSource}:${selection}`] =
  !completedLessons[`${activeSource}:${selection}`];
```

The sidebar/source selector should visually mark completed selections by checking the same key.

## Study Card Behavior

Each curriculum result should render as a study card with:

- Sequence number within the current result list.
- Indigenous sentence text (`ab`).
- Optional Chinese translation (`zh`).
- Audio playback if `audio_url` exists.
- Copy Indigenous text.
- Copy Chinese text.
- Save/unsave sentence.
- Optional word lookup on Indigenous tokens.

Settings that affect cards:

```text
yc_zh_hidden_default
yc_show_zh_entirely
yc_tooltip_enabled
yc_cards_per_row
yc_sentence_layout
```

Behavior:

- If `showZhEntirely` is false, render only Indigenous text.
- If `zhHiddenByDefault` is true, render Chinese translation blurred/hidden until the user reveals it or until your UI equivalent makes it visible.
- If `sentenceLayout` is `vertical`, Indigenous and Chinese text stack.
- If `sentenceLayout` is `side`, Indigenous and Chinese text are side by side on wide screens.
- If cards-per-row is `auto`, allow a responsive grid; otherwise render a single-column reading flow.
- Clicking or tapping audio plays the row audio. Reuse one audio object so starting a new row stops the previous one.

Save payload:

```ts
{
  original_uuid: row.original_uuid ?? `${dialectName}:${row.ab}`,
  ab: row.ab,
  zh: row.zh,
  audio_url: row.audio_url,
  dialect_name: selectedDialect,
  source: activeSource,
  category: row.category ?? selection
}
```

## Word Lookup Behavior

The current portal tokenizes Indigenous text on whitespace and strips surrounding punctuation.

Token cleaner:

```ts
function cleanToken(token: string) {
  return token
    .replace(/^[^a-zA-ZÀ-ſ']+|[^a-zA-ZÀ-ſ']+$/g, "")
    .toLowerCase();
}
```

Lookup endpoint:

```text
GET /api/lookup?word=<token>&dialect=<dialectName>&glid=<glid>
```

Minimum Indivore implementation using only `ycm_master.db`:

```sql
SELECT word_ab, word_ch, dialect_name, source
FROM ilrdf_vocabulary
WHERE LOWER(word_ab) = ?
LIMIT 6;
```

Return shape:

```ts
{
  results: Array<{
    source: "ILRDF";
    word_ab: string;
    word_ch: string;
    dialect_name: string;
    vocab_source: string;
  }>;
}
```

Current YCM also attempts MOE lookup for Amis (`glid === "01"`) if the MOE shadow DB is available. Indivore can skip that for now if only `ycm_master.db` has been integrated.

Desktop behavior:

- On hover, wait about 220 ms before fetching.
- Cache by `word:dialectName`.
- Show a small lookup panel near the token.
- Dismiss shortly after mouse leave.

Mobile behavior:

- On tap, fetch immediately.
- Show a sticky lookup panel above the bottom navigation.
- Tap the same word or outside the panel to dismiss.

## Grammar Comparison Mode

This only applies to `grmpts` on desktop.

Behavior:

- A user can add up to three comparison patterns.
- Comparison IDs are stored as composite IDs:

```ts
`${level}:${patternId}`
```

- If the current selected pattern is added, it becomes `primarySelection`.
- Fetch the main selection plus comparison selections in parallel.
- Render each result set as a separate column.
- A reset action clears:

```ts
compareIds = [];
compareResults = {};
primarySelection = null;
```

This is not required for a minimal first Indivore port, but it is part of current portal behavior.

## Dialect Behavior

Dashboard:

- Selects a default dialect for the GLID.
- The default is persisted.
- Optionally allow a temporary session-only dialect if the user does not want to save it as default.

Learn page:

- Initializes from the dashboard default dialect.
- Dialect changes inside the learn page are session-only in current YCM. They do not overwrite the dashboard default.

For `grmpts`, the content query intentionally ignores sub-dialect and uses the language-level name:

```ts
GLID_NAMES[glid].replace("族", "語")
```

This is because grammar drill content is stored at language level, while normal lesson/content sources are stored at dialect level.

## Edge Cases And Gotchas

- Do not query `essay` or `dialogue` directly by `title_zh`; first resolve through `geometry[source].alignment[dialectName]`.
- If an essay/dialogue alignment is missing, return `[]`, not an error.
- Some dialect naming variants may differ between old geometry data and current dialect maps. If a dialect returns empty unexpectedly, inspect `corpus_geometry.json` alignment keys before assuming the DB lacks rows.
- `grmpts` selected dialect is not the same as `twelve`/`essay`/`dialogue` selected dialect.
- `nine_year` exists in the database but is not currently surfaced in the four-card learn UI.
- Audio is remote-first. Do not assume local media files exist.
- Saved sentences and completed lessons are client/user state, not database state.
- `original_uuid` ordering works for `twelve` and `grmpts`; `essay`/`dialogue` use a numeric extraction sort from `original_uuid`.
- If Indivore uses server components or API routes, keep SQLite access server-side.

## Minimal Implementation Order

1. Copy or recreate `corpus_geometry.json`, `grmpts_type_labels.json`, and dialect maps.
2. Implement `GET /api/curriculum`.
3. Implement `GET /api/lookup` against `ilrdf_vocabulary`.
4. Build language slug to GLID resolution.
5. Build dashboard source cards and progress counts.
6. Build learn route with source state and content fetching.
7. Build source-specific content selectors.
8. Build study card rendering, audio playback, save, copy, and completion.
9. Add saved view and saved filters.
10. Add optional grammar comparison mode.

## Validation Checklist

Use one Amis dialect and one non-Amis language family during validation.

API checks:

- `twelve` returns rows for a known dialect and `Level 1 Lesson 1`.
- `grmpts` returns rows when using language-level dialect name and level.
- `essay` returns rows only after resolving alignment.
- `dialogue` returns rows only after resolving alignment.
- Audio URLs are upgraded to HTTPS and essay/dialogue text audio paths include `/text/sound/{contextId}/...`.
- Missing essay/dialogue alignment returns an empty result array.

UI checks:

- Dashboard totals match geometry counts.
- Completed counts update after marking content complete.
- "Next" on dashboard advances the stored cursor before opening learn.
- Source switching preserves per-source cursor state.
- Previous/next navigation works for all four sources.
- Saved sentence toggling is stable by `original_uuid`.
- Saved view filters by current language family and selected source.
- Chinese translation visibility settings work.
- Word lookup returns ILRDF results for a known token.
- Audio playback stops the previous row when another row starts.

Regression checks:

- `grmpts` works even when a selected sub-dialect would not have direct grammar rows.
- `essay` and `dialogue` do not break if a topic exists for one dialect but not another.
- Mobile source navigation does not require the desktop sidebar.
- SQLite reads happen only server-side.

