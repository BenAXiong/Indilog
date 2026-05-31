# Indivore — Data Architecture

> **Canonical reference for the data model.**
> Read this before touching `ind_items`, `ind_flashcards`, or any query layer.
> Last updated: 2026-05-31

---

## Core concepts

| Term | Definition |
|------|-----------|
| **Note** | The underlying knowledge unit — a word, sentence, or phrase the user is learning. Stored in `ind_items`. |
| **Card** | A review question derived from a Note. Stores SRS scheduling state. One Card per Note by default. Stored in `ind_flashcards`. |
| **Session Mode** | How a Card is *presented* during review — `forward`, `reverse`, `audio`. A display-only setting; stored in `localStorage`, never in the DB. Does NOT produce separate Card rows. |
| **Card Template** | A stored Card variant that requires extra metadata beyond the Note's fields. Currently only `sts`. |
| **Note Source** | Where a Note came from. Determines provenance badge and UI context — not editability. |

**Key rule:** `front` and `back` are banned from Notes and Cards. They are view-layer concepts computed at render time from Note fields + Session Mode. Do not add them back.

---

## Notes — `ind_items`

The universal Note table. All knowledge units flow here regardless of source.

### Schema

| Field | Type | Notes |
|-------|------|-------|
| `id` | uuid | PK |
| `user_id` | uuid | FK auth.users |
| `ab` | text | Target-language form (the aboriginal / study-language text) |
| `zh` | text | Chinese translation or definition |
| `notes` | text | Personal user annotation — always writable |
| `audio` | text | `null` · full URL · Supabase Storage path (see Audio resolution) |
| `type` | text | `word \| sentence \| note` |
| `note_source` | text | See Note Sources below |
| `collection_id` | uuid | FK `ind_learn_collections` — null for non-collection notes |
| `language` | text | Language code (e.g. `ami`) |
| `dialect` | text | Dialect name in Chinese (e.g. `馬蘭阿美語`) |
| `place_heard` | text | Observational metadata |
| `source_id` | uuid | FK `ind_sources` |
| `speaker_id` | uuid | FK `ind_speakers` |
| `tags` | text[] | User tags |
| `level` | int | Collection structural position — null for non-collection notes |
| `lesson` | int | Collection structural position — null for non-collection notes |
| `lesson_title` | text | Collection lesson label — null for non-collection notes |
| `position` | int | Card position within a lesson — null for non-collection notes |
| `metadata` | jsonb | Reserved for future note-level structured data |
| `created_at`, `updated_at` | timestamptz | |

### Note Sources

| Value | Meaning | Status |
|-------|---------|--------|
| `captured` | Manually captured by user (typed or recorded) | Active |
| `collection` | Imported from a user CSV/JSON deck | Active |
| `dict` | Saved from a dictionary lookup | Active |
| `curriculum` | Bookmarked from the Learn tab | Active |
| `text` | Saved from reading a text article | Future |
| `video` | Saved from watching a video | Future |
| `podcast` | Saved from listening to a podcast | Future |

**Editability:** All fields are always editable by the user. `ab` and `zh` are the user's personal copy — editing is customisation, not corruption of the source. `note_source` is provenance, not a lock.

---

## Cards — `ind_flashcards`

One Card per Note by default. Session mode never generates additional Card rows (except STS — see Card Templates).

### Schema

| Field | Type | Notes |
|-------|------|-------|
| `id` | uuid | PK |
| `user_id` | uuid | FK auth.users |
| `note_id` | uuid | FK `ind_items` — the source Note |
| `card_type` | text | `default \| sts` |
| `audio` | text | Curriculum audio snapshot (from SQLite at bookmark time). Null for all other sources. `cardAudio()` checks this first, then falls back to `note.audio`. |
| `metadata` | jsonb | Template-specific data — see Card Templates |
| `ease_factor` | real | FormoSRS-1; default 2.5 |
| `interval_days` | int | FormoSRS-1 |
| `repetitions` | int | FormoSRS-1 |
| `due_at` | timestamptz | |
| `suspended_at` | timestamptz | |
| `flag_color` | text | `red \| orange \| yellow \| green \| blue \| null` |

> **Pre-unification fields (to be dropped in T-UNIFY):** `front`, `back`, `item_id`, `collection_card_id`.

---

## Session Modes (display only — not stored in DB)

Persisted in `localStorage` key `srs_session_mode`. Set in the review OptionsSheet.

| Mode | Prompt shown | Reveal shows |
|------|-------------|-------------|
| `forward` | `note.ab` | `note.zh` |
| `reverse` | `note.zh` | `note.ab` |
| `audio` | Audio play button (autoplay on load); falls back to `forward` if no audio | `note.ab` + `note.zh` |

**Rule:** Never create a new `ind_flashcards` row just because a different session mode is needed. Modes are view logic only.

---

## Card Templates (stored — `card_type = 'sts'` only)

STS = Single Target Sentence. Tests a specific word in the context of a sentence. Requires stored metadata.

### STS metadata shape

```json
{
  "target_word": "mato'as",
  "hint_sentence": "Mato'as to 'afeʼay ci Lifok.",
  "hint_meaning": "Lifok's grandfather is old.",
  "hint_sentence_note_id": "<uuid — future: link to sentence Note>"
}
```

- `target_word` — the word to test (typed manually for now)
- `hint_sentence` — example sentence (typed manually; future: auto-populated via sentence search on the linked Note)
- `hint_sentence_note_id` — future: links to a sentence Note so changes propagate; not yet implemented

### STS review rendering

| Stage | Shows |
|-------|-------|
| Front | `target_word` (large serif) + blurred `hint_sentence` below |
| Tap hint | Sentence unblurs |
| Reveal | Meaning of `target_word` + full unblurred sentence |

STS Cards are created explicitly by the user — never auto-generated by `ensureFlashcards()`.

---

## Audio resolution — `cardAudio(card)`

```
priority:  card.audio  →  note.audio  →  null
```

- `card.audio` — set only for curriculum bookmarks (snapshot from `CurriculumRow.audio_url` at `createItem()` time in `StudyView.handleSave`)
- `note.audio` — set when user records/uploads, or when a curriculum item is bookmarked (same path)

### `note.audio` rendering

| Value | Resolution |
|-------|-----------|
| `null` | No audio |
| starts with `https://` | Use URL directly (external: klokah.tw etc.) |
| anything else | Supabase Storage path — resolve via `supabase.storage.from('ind-audio').getPublicUrl(path)` |

---

## Card generation — `ensureFlashcards()`

Single unified function. Creates one `default` Card per Note that doesn't already have one.

**When called:**
- On Study page mount
- Immediately after collection import completes (ensures new cards appear without needing a page reload)

**Contract:**
1. Fetch all existing `note_id` values in `ind_flashcards` for this user
2. Fetch all `ind_items` for this user
3. Insert one `default` Card per unmatched Note (no `front`/`back` — rendering is live from Note)

**STS Cards** are NOT auto-generated. Created explicitly by the user on a per-Note basis.

`generateFlashcardsFromCollection()` and `generateReverseCardsForCollection()` are **deprecated** — to be deleted in T-UNIFY. Their behaviour is fully covered by `ensureFlashcards()` after unification.

---

## Collections

`ind_learn_collections` — deck metadata (name, language, user_id, created_at). Unchanged.

After T-UNIFY: collection notes live in `ind_items` with `collection_id` set, replacing `ind_learn_cards`. The deck is still `ind_learn_collections`; its notes are `ind_items` rows filtered by `collection_id`.

`ind_learn_cards` — **deprecated, to be dropped in T-UNIFY.**

---

## Browser (BrowserView)

| Concern | Source |
|---------|--------|
| Note content | `ind_items` |
| SRS state (ease, interval, due) | `ind_flashcards` (joined) |
| Suspension, flags | `ind_flashcards` (joined) |

**Editing:** `ind_items.ab`, `ind_items.zh`, `ind_items.notes`, `ind_items.audio`, `ind_items.tags` — all via direct update.
SRS actions (ease reset, suspend, flag) — update `ind_flashcards` directly.
Show `note_source` badge and `type` badge per row.

---

## Query layer — `listDueFlashcards()` (post-unification)

One join (simplified from pre-unification two-join approach):

```
ind_flashcards
  JOIN ind_items ON note_id = ind_items.id
  WHERE (due_at <= now() OR due_at IS NULL)
    AND suspended_at IS NULL
  ORDER BY due_at ASC NULLS FIRST
  LIMIT 20
```

### Supabase row cap — pagination pattern

Supabase's PostgREST server enforces a hard max-rows limit (1000 by default). `.limit(N)` in the JS client is capped server-side regardless of N. Any query that may return >1000 rows must use `.range()` pagination:

```typescript
const PAGE = 1000
const results = []
let from = 0
while (true) {
  const { data } = await buildQuery().range(from, from + PAGE - 1)
  if (data?.length) results.push(...data)
  if (!data?.length || data.length < PAGE) break
  from += PAGE
}
```

Affected functions (all paginated as of 2026-05-31): `listDueFlashcards`, `getDueStats`, `listUserLanguages`, `resetCollectionSRS`, `resetCapturesSRS`, `listBrowserCards` (split into two parallel queries by `note_source` instead).

---

## Migration status

✅ **T-UNIFY complete (2026-05-30, branch `redesign/srs-overhaul`).** All four migrations applied:

- M1: `ind_items.text→ab`, `meaning→zh`, `audio_url→audio`; added `note_source`, `collection_id`
- M2: Migrated all `ind_learn_cards` rows into `ind_items` with `note_source='collection'`; added `level`/`lesson`/`position` structural columns
- M3: Added `note_id` FK to `ind_flashcards`; dropped `item_id`, `collection_card_id`, `front`, `back`; deleted reverse cards; renamed `forward→default`
- M4: Dropped `ind_learn_cards` table; deleted `generateFlashcardsFromCollection` / `generateReverseCardsForCollection`

---

## Known data notes

- `StudyView.handleSave` now saves zh to `ind_items.zh` directly (fixed in T-UNIFY / audio step 6).
- `front`/`back` snapshots eliminated — cards render live from `note.ab`/`note.zh`.
- Pre-existing `card_type='reverse'` rows deleted in M3 (no production users).
- Pre-fix curriculum bookmarks (before audio step 6) have `ind_items.audio = null` — no auto-repair.
