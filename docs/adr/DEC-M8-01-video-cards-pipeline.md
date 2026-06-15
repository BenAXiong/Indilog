---
status: accepted
---

# Video Cards — pipeline, storage schema, player, and planned extensions

**Date:** 2026-06-15

---

## Context

ILRDF (原住民族語言研究發展基金會) publishes a colloquial corpus at `ailt.ilrdf.org.tw` — interview videos with bilingual Amis/Chinese subtitle tracks. Each subtitle segment becomes one flashcard: the spoken sentence with a short video clip and audio clip attached.

---

## Decision 1 — Data sources and pipeline scripts

All scripts live in `C:\Users\Ben\Documents\LL\6_ycm\Datasets\ILRDF\videos\`.

**Step 1 — Scrape video listings** (`scrape_ilrdf.py`)
- Hits the ILRDF AJAX API (`/colloquial/list`), covers all 16 tribes.
- Output: `all_videos.jsonl` (all tribes) and `videos.jsonl` (Amis only).
- Each entry: `{ ilrdf_url, lang_id, tribe_zh, yt_video_id, title_ind, title_zh, views, scraped_at }`.
- `all_videos_full.jsonl` is a hand-enriched version with `dialect`, `yt_url`, `duration_s`.

**Step 2 — Transcripts** (`transcripts/{video_id}.jsonl`)
- One JSONL file per video. Each line: `{ "t": <seconds>, "amis": "...", "zh": "..." }`.
- Segment end time = next segment's `t`; last segment ends at `duration_s`.
- Some videos (e.g. 750) have CJK in `amis` field — `get_ab_zh()` detects and promotes correctly.

**Step 3 — Card generation** (`gen_ilrdf_cards.py`)
- `--user-id <UUID>` required; `--skip-download` reuses cached local files.
- Downloads full video via yt-dlp at 480p MP4 → `output/video/{id}/full.mp4`.
- Extracts full audio with ffmpeg → `output/audio/{id}/full.mp3`.
- Per segment: slices audio (`64k MP3`) and video (`H.264 crf28, 480px wide, faststart`).
- Skips segments shorter than 1 second.
- Outputs:
  - `output/cards.json` — full card manifest
  - `output/import.sql` — INSERT statements for `ind_items`
  - `output/upload_audio.ps1` / `output/upload_video.ps1` — PowerShell upload scripts

**Step 4 — Upload to Supabase** (`upload_to_supabase.py`)
- Reads `output/cards.json`, uploads matching local files concurrently (8 workers) via REST.
- Uses Supabase service key directly (not CLI). 409 (already exists) treated as success.
- `--audio` / `--video` flags upload one bucket only.

**Step 5 — Create collections** (`create_collections.py`)
- Creates one `ind_learn_collections` row per video named `ILRDF · {title_zh}`.
- Links existing `ind_items` rows to their collection via `(metadata->>'ilrdf_id')::int = {id}`.
- Sets `note_source = 'collection'` on those rows.

**Current demo set:** IDs 142, 151, 704, 750. ~100 transcript files exist in `transcripts/` covering many more videos not yet processed.

---

## Decision 2 — Storage layout

```
ind-audio  bucket:  ilrdf/{video_id}/seg_{n:04d}.mp3    (64k MP3)
ind-video  bucket:  ilrdf/{video_id}/seg_{n:04d}.mp4    (H.264 480px, crf28, faststart)
```

Both buckets are **public**. Public URLs follow the pattern:
```
https://gnmcttlpkiexxoilwhfa.supabase.co/storage/v1/object/public/{bucket}/{path}
```

Clip sizes run ~135 KB per MP4 segment, ~40 KB per MP3. File size is a concern on the free Supabase storage tier — WebM conversion is planned (see Decision 5).

---

## Decision 3 — `ind_items` schema for video cards

Video cards are regular `ind_items` rows. Key fields:

| Field | Value |
|---|---|
| `ab` | Amis sentence text |
| `zh` | Chinese translation |
| `audio` | Public URL → `ind-audio` bucket |
| `type` | `'sentence'` |
| `note_source` | `'collection'` (after `create_collections.py`; `'import'` before) |
| `language` | `'ami'` |
| `collection_id` | FK → `ind_learn_collections` |

`metadata` JSONB carries all video-specific fields:

```json
{
  "ilrdf_id":   142,
  "seg_n":      16,
  "start_t":    38,
  "end_t":      43,
  "tribe_zh":   "阿美族",
  "title_zh":   "傳說故事—皮膚病",
  "yt_url":     "https://www.youtube.com/watch?v=...",
  "video_clip": "https://...supabase.co/storage/v1/object/public/ind-video/ilrdf/142/seg_0016.mp4"
}
```

`created_at` is staggered by 1ms per segment so `ORDER BY created_at` preserves playback order across transaction boundaries.

---

## Decision 4 — Merge feature and tombstoning

`mergeVideoCards()` in `lib/db/video/queries.ts` combines consecutive cards:
- New `ind_items` row: concatenated `ab`/`zh` with ` · ` separator; `video_segments: string[]` and `audio_segments: string[]` collect all clip URLs; `video_clip` = first segment URL.
- Source cards are tombstoned: `metadata.merged_into = <new_id>`.
- All list queries filter `.is('metadata->>merged_into', null)` to hide tombstones.
- Merged card `videoSegs` is resolved as `metadata.video_segments ?? [metadata.video_clip]`; same pattern for audio.

---

## Decision 5 — Clip compression: H.264 CRF 42 (not WebM)

**Why not WebM:** VP9 WebM at CRF 33 produces *larger* files than H.264 for these short low-res clips due to container overhead. VP9 only beats H.264 at CRF 40+, and at that point quality loss is similar. H.264 has hardware-accelerated decode on old devices; VP9 often does not.

**Decision:** Re-encode all clips as H.264 CRF 42, same MP4 format, upsert to the same Supabase paths. No DB changes, no VideoPage changes.

**Result:** 426 MB → 49 MB (88% reduction). Per-clip: ~135 KB → ~53 KB. Script: `compress_clips.py` in the ILRDF videos dataset folder. Pipeline (`gen_ilrdf_cards.py`) updated to use CRF 42 + 48k audio for new clips.

Status: done (2026-06-15).

---

## Decision 6 — Planned: lite decks (image) and media-presence-driven rendering

**Goal:** Most of the ~100+ transcript files have no downloaded video yet. A "lite" card uses a still image (single frame at segment midpoint) instead of a video clip — much smaller storage footprint. Full clips can be added later to enrich a lite card.

**Universal card model constraint:** Indivore has one card type with the same available fields for all cards. There is no stored "deck mode" — the player derives available modes from which media fields are present in `metadata`:
- `video_clip` present → full video mode available
- `image` present → image (lite) mode available
- `audio` present → audio-only mode available

The field is named `image` (not `screenshot`) to retain the universal aspect — any card may carry an image regardless of origin.

`metadata` extension:
```json
{
  "video_clip": "...webm",
  "image":      "...jpg",
  "video_segments":  ["...webm", "...webm"],
  "audio_segments":  ["...mp3",  "...mp3"]
}
```

VideoPage renders whichever media is present and lets the user toggle between available modes. `gen_ilrdf_cards.py` needs a `--lite` flag that runs `ffmpeg -ss {mid} -frames:v 1` to extract the midpoint frame instead of slicing video.

Status: design only — scripts and UI not yet updated.

---

## Files

| Path | Role |
|---|---|
| `apps/web/components/video/VideoPage.tsx` | Fullscreen video player page |
| `apps/web/lib/db/video/queries.ts` | `listVideoCollections`, `listCollectionVideoCards`, `mergeVideoCards` |
| `C:\...\ILRDF\videos\gen_ilrdf_cards.py` | Card generation + ffmpeg slicing pipeline |
| `C:\...\ILRDF\videos\upload_to_supabase.py` | Concurrent REST uploader |
| `C:\...\ILRDF\videos\create_collections.py` | SQL generator for `ind_learn_collections` linking |
| `C:\...\ILRDF\videos\scrape_ilrdf.py` | ILRDF video listing scraper |
| `C:\...\ILRDF\videos\transcripts/*.jsonl` | Per-video subtitle transcripts |
| `C:\...\ILRDF\videos\all_videos_full.jsonl` | Enriched video metadata (dialect, yt_url, duration_s) |
