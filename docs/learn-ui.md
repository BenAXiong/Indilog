# Indivore — Learn Feature UI Spec

> Companion to `docs/learn-feature.md`
> Created: 2026-05-26 · Status: Implemented (routes updated 2026-06-14)

---

## 1. Route map

```
/learn                    Learn session (SRS new-card learning mode)
/study                    Study hub — decks, browser, stats
/study/lessons            Corpus: 12-level curriculum
/study/patterns           Corpus: grammar pattern drills
/study/essays             Corpus: prose essays
/study/dialogues          Corpus: conversational dialogues
/study/collection/[id]    Custom collection browse page
/study/new                Create / import a custom collection
/review                   Review session (SRS review mode)
```

All corpus study routes (`/study/lessons`, `/study/patterns`, etc.) share the StudyView shell described in §3.

---

## 2. Hub page (`/study`)

### Layout

```
ScreenHeader — title "Learn", active lang chip

[2-column card grid]
  [Lessons card]    [Patterns card]
  [Essays card]     [Dialogs card]
  [Custom card 1]   [Custom card 2]   ← if they exist
  [+ New card]                        ← always last, pushes right if odd count
```

Bottom padding accounts for BottomNav.

### Source card anatomy

```
┌─────────────────────────┐
│ [icon]   SOURCE NAME    │
│                         │
│ progress bar (thin)     │
│ N / Total · label       │
│                         │
│ cursor: L3-4 ▸          │  ← current position, right-aligned
└─────────────────────────┘
```

- **Icon**: `learn` for Lessons, `card` for Patterns, `pen` for Essays, `wave` for Dialogs
- **Progress bar**: crimson fill, thin (3px), `completed/total` ratio
- **Cursor line**: shows where the user left off in small mono text; tapping the card resumes there
- **Accent**: crimson border-left (3px) when the source has content due / incomplete

### "+" card

```
┌─────────────────────────┐
│                         │
│    +  New collection    │
│                         │
└─────────────────────────┘
```

- Dashed border (`lineSoft`), muted background (`paperHi`), `inkFaint` text
- Always the last card in the grid
- Navigates to `/study/new`

### Custom collection card

Same anatomy as source cards, plus:
- Language badge (small chip, e.g. "Amis") below the title
- Three-dot menu (long-press or dedicated icon) → Edit / Delete

---

## 3. Shared study view layout

All corpus study routes (`/study/lessons`, `/study/patterns`, `/study/essays`, `/study/dialogues`) use the same StudyView shell.

### Header bar

```
[← back]  [Source name]  ···  [L3 · 4  ▾]  [⚙]
```

- **← back**: navigates to `/study`
- **Source name**: "Lessons", "Patterns", "Essays", "Dialogs", or the collection name
- **Current item pill** (right of center, tappable): shows the current selection in compact form
  - Lessons: `L3 · 4` (Level 3 Lesson 4)
  - Patterns: `L2 · t6`
  - Essays / Dialogs: truncated `title_zh` (max ~16 chars, ellipsis)
  - Custom: `L1 · 1`
  - Tapping this pill opens the **bottom sheet content selector**
- **⚙**: opens the settings panel (inline dropdown, see §6)

### Body

Single-column scroll of study cards (§4). Padding bottom = BottomNav height + action bar height.

### Action bar (fixed, above BottomNav)

```
[ ← Prev ]  [ ✓ Mark complete / ✓ Completed ]  [ Next → ]
```

- **Prev / Next**: disabled (opacity 0.3) when at boundaries; advance through curriculum items
- **Mark complete**: toggle — uncompleted state is outlined, completed state is crimson fill with check icon
  - Completion state persists to `ind_completions` (Supabase)
- Shown only when `results.length > 0` and source is not custom (custom collections don't use completion tracking in v1)

---

## 4. Study card

One card per sentence row. Cards stack in a single-column scroll.

### Card anatomy

```
┌────────────────────────────────────────┐
│  [N]                    [dialect chip] │
│                                        │
│  ab text                               │
│  (large serif, Newsreader 20–22px,     │
│   tokenized — each word tappable)      │
│                                        │
│  ────────────────────────────────────  │
│                                        │
│  [zh — blurred by default]             │
│  tap anywhere on zh row to reveal      │
│  (Newsreader 15px, inkSoft)            │
│                                        │
│  ────────────────────────────────────  │
│                                        │
│  [▶ Audio]  [Copy ab]  [Copy zh]  [☆ Save] │
└────────────────────────────────────────┘
```

- **[N]**: sequence number within the current result set (1-indexed), mono 10px, inkFaint
- **dialect chip**: small pill showing dialect name (English via `DIALECT_TO_EN`), inkMute
- **ab text**: tokenized on whitespace — each token is a tappable span; tap triggers word lookup (§7)
- **zh row**: `filter: blur(6px)` by default; tap anywhere on the row removes blur for that card only; re-blurs if card scrolls out of view (or stays revealed — see settings)
- **Audio button**: plays `audio_url` if present; shared singleton `<audio>` ref — starting one card stops any other; hidden if no audio URL
- **Copy ab / Copy zh**: copies to clipboard; icon flips to check for 1.5s
- **Save**: creates an `ind_item` (type: sentence, language: active lang, text: ab, notes: zh); icon fills on save; toast confirmation; idempotent (saves again if tapped again — user's responsibility)

### zh visibility states (controlled by settings)

| Setting | Default reveal state | Tap behaviour |
|---|---|---|
| `blurred` (default) | Blurred | Tap to unblur that card |
| `hidden` | Not rendered | Tap to show that card |
| `visible` | Always shown | No tap needed |

The setting persists in `localStorage` (`iv_learn_zh_mode`).

### Card when no audio

Audio button row is omitted; Copy + Save row fills the space.

### Card for custom collections

Same layout. No audio button (custom cards have no audio in v1). `zh` may be empty — if so, zh row is omitted.

---

## 5. Bottom sheet — content selector

### Mechanics

- **Trigger**: tap the current item pill in the header
- **Open**: sheet slides up from the bottom (`transform: translateY(0)` from `translateY(100%)`, 280ms ease-out)
- **Height**: 62% of viewport (`62dvh`)
- **Backdrop**: semi-transparent ink overlay (opacity 0.35), tap to dismiss
- **Dismiss**: tap backdrop · tap pill again · swipe down on sheet handle
- **Handle**: 36px wide × 4px tall rounded bar, centered at top of sheet, `lineSoft` color
- **z-index**: above study cards, below BottomNav

### Sheet header

```
[Source name]         [×]
[──────────────────────]
[sub-tabs: level / group row]
```

### Per-source content

#### Lessons

```
Level row (horizontal scroll):
  [1] [2] [3] … [12]   ← active level highlighted crimson

Lesson grid (below, 5 columns):
  [1] [2] [3] [4] [5]
  [6] [7] [8] [9] [10]
```

- Each lesson cell shows: lesson number + title (if in geometry, 1–2 word truncation)
- Completed lessons: muted bg + small check icon overlay
- Current selection: crimson outline

#### Patterns

```
Level row:
  [1] [2] [3] [4]

Pattern list (scrollable):
  t1  Sentence Negation
  t2  Topic Marker
  t3  …
```

- Only patterns present in `geometry.grmpts.counts[glid][level]` shown
- Label from `grmpts_type_labels.json`, stripping leading numeric prefix
- Completed: muted + check

#### Essays / Dialogs

```
Group row:
  [Intro] [Intermediate] [Advanced]

Item list (scrollable):
  ○  我早上七點鐘到學校。
  ✓  大家好                   ← completed
  ○  …
```

- Groups: indices 0–19 / 20–39 / 40–59
- Items not available for selected dialect (missing alignment): shown greyed, not tappable
- Selecting a group moves to its first item

#### Custom collection

```
Level row:
  [L1] [L2] [L3] …

Lesson list (scrollable):
  L1-1  Greetings  (8 cards)
  L1-2  Family     (6 cards)
```

---

## 6. Settings panel

Triggered by ⚙ in the header. Inline dropdown (not a sheet), right-aligned, dismisses on outside tap.

```
┌────────────────────────┐
│ CHINESE                │
│  ○ Blurred (default)   │
│  ○ Hidden              │
│  ○ Always visible      │
│                        │
│ LOOKUP                 │
│  [ON] [OFF]            │
└────────────────────────┘
```

Persisted in `localStorage` per key (no Supabase needed — these are display preferences, not progress data).

---

## 7. Word lookup (v1 inline)

When lookup is ON and user taps a word token in the `ab` text:

- POST to `/api/lookup?word=<token>`
- Show a small result panel directly below the tapped word (inline, not a modal)
- Panel: word + Chinese definitions list (up to 6 results from ILRDF)
- Tap outside or tap same word to dismiss
- If no results: "No dictionary entry found" in one line

Full cross-app `WordLookup` component (hover tooltip on desktop, sticky panel on mobile) is a separate feature — this is the Learn-only interim version.

---

## 8. Custom collection — creation flow (`/study/new`)

### Step 1 — Identity

```
ScreenHeader: "← New collection"

[Collection name]
  [___________________]

[Language]
  [Amis ▾]   ← language picker (all 16)

[Continue →]
```

### Step 2 — Entry method

```
How do you want to add content?

┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐
│  + Add manually │  │  ↑ Import file  │  │  ⊕ From captures        │
│                 │  │                 │  │  (coming soon)           │
│                 │  │  .json          │  │  [disabled, muted]       │
└─────────────────┘  └─────────────────┘  └─────────────────────────┘
```

### Step 3a — Manual editor

```
LEVEL 1
  LESSON 1  [Title (optional)_____]
  ──────────────────────────────────
  Card 1
    ab  [__________________________]
    zh  [__________________________]
  [+ Add card]

  [+ Add lesson]

[+ Add level]

[Save collection]
```

- Adding a card appends to the current lesson
- Adding a lesson appends to the current level with next lesson number
- Adding a level appends next level with L1
- Level / lesson numbers are auto-assigned; user cannot reorder in v1 (drag-reorder deferred)
- Validation: at least one card with non-empty `ab` to save

### Step 3b — File import

```
┌──────────────────────────────────────┐
│                                      │
│   Drop a .json file here             │
│   or  [Browse file]                  │
│                                      │
│   Expected format: docs/learn-ui.md  │
│   (link to format spec)              │
└──────────────────────────────────────┘
```

After file selected — preview panel:

```
✓  "My Amis Study"  ·  ami  ·  3 levels  ·  24 cards

  L1-1  Greetings         8 cards
  L1-2  Family            6 cards
  L2-1  At the market    10 cards

[Import 24 cards]   [Cancel]
```

- Name and language from the JSON; user can edit before confirming
- Validation errors shown inline (missing `ab`, unknown language code, malformed JSON)

### JSON import format (canonical)

```json
{
  "name": "Collection name",
  "language": "ami",
  "levels": [
    {
      "level": 1,
      "lessons": [
        {
          "lesson": 1,
          "title": "Optional title",
          "cards": [
            { "ab": "Indigenous text", "zh": "Chinese translation" }
          ]
        }
      ]
    }
  ]
}
```

- `name` and `language` required
- `title` optional per lesson
- `zh` optional per card
- `level` and `lesson` must be positive integers

---

## 9. Component inventory

### New components

| Component | Path | Notes |
|---|---|---|
| `LearnHubCard` | `components/learn/LearnHubCard.tsx` | Source card + custom card + "+" card |
| `StudyCard` | `components/learn/StudyCard.tsx` | Single sentence card with all actions |
| `ContentSheet` | `components/learn/ContentSheet.tsx` | Bottom sheet wrapper + per-source selectors |
| `ActionBar` | `components/learn/ActionBar.tsx` | Prev / Mark complete / Next bar |
| `SettingsPanel` | `components/learn/SettingsPanel.tsx` | ⚙ dropdown |
| `LookupInline` | `components/learn/LookupInline.tsx` | Inline word result panel |
| `CollectionEditor` | `components/learn/CollectionEditor.tsx` | Manual card entry form |
| `ImportDropzone` | `components/learn/ImportDropzone.tsx` | File drop + preview |

### Reused from existing UI

| Component | Where |
|---|---|
| `ScreenHeader` | All learn pages |
| `Icon` | Throughout |
| `Button` | Creation flow CTAs |
| `Toast` | Save confirmation |
| `SectionHead` | Sheet section labels |
| `Card` | Hub cards base |
| `LangAvatar` | Language picker in /study/new |

---

## 10. State management per study view

Persisted in `localStorage` keyed by `glid` (matching corpus cursor behavior):

```
iv_learn_source_{glid}        active source on last visit
iv_learn_sel_lessons_{glid}   current lesson selection "Level 3 Lesson 4"
iv_learn_sel_patterns_{glid}  current pattern "t6"
iv_learn_level_{glid}         current grammar level 1–4
iv_learn_sel_essays_{glid}    current essay title_zh
iv_learn_sel_dialogues_{glid} current dialogue title_zh
iv_learn_dialect_{glid}       selected dialect (initialised from ind_profiles.default_dialect)
iv_learn_zh_mode              zh visibility: 'blurred' | 'hidden' | 'visible'
iv_learn_lookup               lookup on/off: true | false
```

Custom collection cursor not stored in localStorage — the collection's last-viewed lesson is a v2 concern.

---

## 11. Open items / deferred

- Drag-to-reorder cards within a lesson in the manual editor
- Edit existing custom collection (`/study/collection/[id]/edit`)
- Completion tracking for custom collections (v1 ships without it)
- "From captures" import (option C in creation flow — visible but disabled)
- Cross-app `WordLookup` component (desktop hover tooltip, mobile sticky panel)
- Audio recording for custom cards
- Grammar comparison mode (grmpts desktop feature)
- Share / export collection
