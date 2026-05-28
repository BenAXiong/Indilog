# Klokah Essay And Dialogue Scrape Report

*Created: 2026-05-27*

This report explains how YCM scraped Klokah `/essay` and `/dialogue`, how those rows entered `ycm_master.db`, and how the current portal derives titles for the learn feature.

## Executive Summary

The `essay` and `dialogue` corpora were scraped from Klokah JSON endpoints into raw JSON, appended into `data/distilled/sentences.jsonl`, distilled into `export/ycm_master.db`, and then "crystallized" into `portal/lib/corpus_geometry.json` for learn-page navigation.

The important title caveat:

- The scrapers did not store official topic titles as first-class metadata.
- In the DB, `occurrences.category` is a technical content ID:
  - `essay`: numeric TID such as `34045`.
  - `dialogue`: string such as `Dialogue TID 26928`.
- The learn UI display titles in `corpus_geometry.json` are inferred later by `core/geometry_crystallizer.py`.
- That inference uses the first short Chinese sentence of one aligned item as `title_zh`.
- Therefore `title_zh` is a display label and lookup handle in the current portal, but it is not a stable canonical source ID.
- There are duplicate inferred titles, so a more robust Indivore implementation should use `source:index` or an explicit internal ID instead of `title_zh` alone.

## Current Data Counts

From the current `export/ycm_master.db`:

```text
source    occurrences  distinct dialects  distinct categories
dialogue       53,273                42                 2,520
essay          40,775                42                 3,023
```

Raw file inventory:

```text
data/raw/essay
  ES*.json master/index files: 42
  numeric TID content files: 3,023

data/raw/dialogue
  index_d*.json index files: 42
  tid_*.json content files: 2,520
```

Current portal geometry:

```text
corpus_geometry.essay topics:    73
corpus_geometry.dialogue topics: 61
```

The geometry topic count is not the same as the global distinct category count. Geometry aligns per-dialect categories by ordinal position and creates cross-dialect topic slots.

## File Map

Primary scrape files:

```text
scrapers/essay_scraper.py
scrapers/dialogue_scraper.py
```

Shared helpers:

```text
core/network.py
core/processors.py
core/constants.py
```

Distillation and runtime geometry:

```text
core/master_distiller.py
core/geometry_crystallizer.py
portal/lib/corpus_geometry.json
portal/app/api/curriculum/route.ts
```

Sample raw inputs copied with this report:

```text
samples/essay/ES11201.json
samples/essay/34045.json
samples/dialogue/index_d1.json
samples/dialogue/tid_26928.json
```

Generated title audit files:

```text
title_audit/geometry_titles.csv
title_audit/duplicate_titles.csv
```

## Essay Scrape

Source file:

```text
scrapers/essay_scraper.py
```

Endpoints:

```text
GET https://web.klokah.tw/essay/json/{code}.json
GET https://web.klokah.tw/essay/php/getEssay.php?tid={tid}
Referer: https://web.klokah.tw/essay/index.php
```

The scraper is called with ES-code ranges, for example:

```text
ES11201-ES11205
```

It expands ranges with `expand_codes()`, fetches each ES master JSON, then extracts TIDs from the master JSON's `S1` and `S2` lesson structures.

Example master file:

```text
data/raw/essay/ES11201.json
```

Shape:

```json
{
  "title": "南勢阿美語 族語短文",
  "S1": {
    "L1": [34045, 34046, 34047]
  },
  "S2": {}
}
```

The master `title` is a dialect/corpus label, not a topic title.

For each TID, the scraper fetches content from `getEssay.php`.

Example content file:

```text
data/raw/essay/34045.json
```

Shape:

```json
[
  {
    "sn": "34045/529922",
    "ab": "I pituay ku tuki tayra tu kaku i cacudadan.",
    "ch": "我今天七點到學校。",
    "en": "I arrived at school at seven today.",
    "img": "img/33751/525420.jpg",
    "snd": true
  }
]
```

For each item, the scraper writes a distilled sentence record:

```text
uuid:     essay_{code}_{tid}_{idx}
source:   essay
dialect:  sanitized master["title"]
category: {tid}
level:    0
ab:       item["ab"]
zh:       item["ch"]
audio:    https://file.klokah.tw/sound/{audio_id}.mp3
```

Important consequence:

The essay topic title is not scraped as a separate field. The only durable content grouping field is `category = tid`.

## Dialogue Scrape

Source file:

```text
scrapers/dialogue_scraper.py
```

Endpoints:

```text
GET https://web.klokah.tw/dialogue/json/SN112{d_id:02d}.json
GET https://web.klokah.tw/dialogue/php/getDiaData.php?tid={tid}
Referer: https://web.klokah.tw/dialogue/index.php
```

The scraper iterates dialect IDs from `core/constants.py`:

```text
TWELVE_DIALECTS
```

For each dialect ID, it fetches an index file:

```text
data/raw/dialogue/index_d1.json
```

Shape:

```json
{
  "title": "南勢阿美語 情境族語",
  "S1": [26928, 26929],
  "S2": {
    "L1": [35917, 35918]
  },
  "S3": {}
}
```

The index `title` is a dialect/corpus label, not a topic title.

`extract_dialogue_tids()` collects unique integer TIDs from `S1`, `S2`, and `S3`.

For each TID, it fetches content from `getDiaData.php`.

Example content file:

```text
data/raw/dialogue/tid_26928.json
```

Shape:

```json
[
  {
    "sn": "26928/440458",
    "ab": "Initu haw kita, ta! Malingatu tu kita.",
    "ch": "大家好。我們開始了。",
    "en": "Hello everyone. Here we go.",
    "snd": true
  }
]
```

For each item, the scraper writes a distilled sentence record:

```text
uuid:     dialogue_{d_id}_{tid}_{idx}
source:   dialogue
dialect:  TWELVE_DIALECTS[d_id]
category: Dialogue TID {tid}
ab:       item["ab"]
zh:       item["ch"]
audio:    https://file.klokah.tw/sound/{sn}.mp3
```

Important consequence:

The dialogue topic title is not scraped as a separate field. The only durable content grouping field is `category = "Dialogue TID {tid}"`.

## Distillation Into SQLite

Source file:

```text
core/master_distiller.py
```

Input:

```text
data/distilled/sentences.jsonl
```

Output:

```text
export/ycm_master.db
portal/ycm_master.db
```

The distiller creates two core tables:

```sql
sentences(id, glid, ab, zh, word_data_json, logic_hash)
occurrences(id, sentence_id, dialect_name, source, level, category, audio_url, local_path, original_uuid)
```

It deduplicates "souls" by:

```text
GLID + normalized Indigenous text + normalized Chinese text
```

Then it stores every source occurrence separately.

For `essay` and `dialogue`, the fields that matter at runtime are:

```text
sentences.ab
sentences.zh
occurrences.dialect_name
occurrences.source
occurrences.category
occurrences.audio_url
occurrences.original_uuid
```

## Geometry Crystallization And Titles

Source file:

```text
core/geometry_crystallizer.py
```

Output:

```text
portal/lib/corpus_geometry.json
```

For `essay` and `dialogue`, it does not read official topic titles. Instead:

1. Query all distinct `(dialect_name, category)` pairs for a source.
2. Build `dialect_map[dialect_name] = [category1, category2, ...]`.
3. Compute `max_len` across dialects.
4. For each ordinal index `i`, align each dialect's `i`th category into one topic slot.
5. Pick a display title by opening one raw TID JSON file and using the first Chinese sentence if it is shorter than 20 characters.

Simplified:

```py
for source in ["essay", "dialogue"]:
    rows = SELECT DISTINCT dialect_name, category FROM occurrences WHERE source=...
    dialect_map[dialect].append(category)

    for i in range(max_len):
        alignment = {}
        sample_zh = f"Topic {i+1}"

        for dialect, tids in dialect_map.items():
            tid = tids[i]
            alignment[dialect] = tid

            if not found_title:
                data = json.load(raw_file_for(tid))
                first_ch = data[0].get("ch", "")
                if first_ch and len(first_ch) < 20:
                    sample_zh = first_ch

        topics.append({
            "index": i,
            "title_zh": sample_zh,
            "alignment": alignment
        })
```

This creates useful cross-dialect navigation, but it means:

- `title_zh` is inferred.
- `title_zh` may duplicate.
- `title_zh` should not be treated as the canonical primary key.
- The true stable category for a selected dialect is found in `alignment[dialectName]`.

## Current Duplicate Title Findings

From `portal/lib/corpus_geometry.json`:

```text
essay duplicate inferred titles:    11 title values
dialogue duplicate inferred titles: 3 title values
```

Examples:

```text
essay:
  我的名字是Ljumeg。          appears 3 times
  這辣椒很辣，你吃少一點。   appears 3 times
  今天老師帶我們去動物園。   appears 2 times

dialogue:
  A:今天天氣如何?             appears 2 times
  A:大家好                    appears 2 times
  M:你今天有空嘛?             appears 2 times
```

Full duplicate list:

```text
title_audit/duplicate_titles.csv
```

## Runtime Learn API

Source file:

```text
portal/app/api/curriculum/route.ts
```

For `essay` and `dialogue`, the API expects a selected display title from geometry:

```text
GET /api/curriculum?dialect={dialectName}&source=essay&title_zh={title_zh}
GET /api/curriculum?dialect={dialectName}&source=dialogue&title_zh={title_zh}
```

It resolves the display title back to a dialect-specific category:

```ts
const entries = geometryData[sourceKey] || [];
const entry = entries.find((e) => e.title_zh === titleZh);
const targetCategory = entry.alignment[dialect];
```

Then it queries:

```sql
SELECT s.ab, s.zh, o.audio_url, o.original_uuid, o.category
FROM sentences s
JOIN occurrences o ON s.id = o.sentence_id
WHERE o.dialect_name = ?
  AND o.source = ?
  AND o.category = ?
ORDER BY CAST(SUBSTR(o.original_uuid, INSTR(o.original_uuid, '_') + 1) AS INTEGER) ASC;
```

Because it uses `.find(e => e.title_zh === titleZh)`, duplicate titles can select the first matching topic, not necessarily the intended duplicate. This is acceptable only while titles are unique enough for the UI; it is not a durable API contract.

## Recommendation For Indivore

Use `corpus_geometry.json`, but do not make `title_zh` the stable selector.

Preferred selection object:

```ts
type NarrativeSelection = {
  source: "essay" | "dialogue";
  index: number;
  title_zh: string;
};
```

Then resolve by index:

```ts
const entry = geometry[source][index];
const targetCategory = entry.alignment[dialectName];
```

The API should accept:

```text
source=essay&index=0&dialect=南勢阿美語
source=dialogue&index=0&dialect=南勢阿美語
```

instead of:

```text
source=essay&title_zh=...
```

The UI can still display `title_zh`, but the data lookup should use `index`.

If Indivore wants true official titles later, add a new crystallization step that captures titles from Klokah HTML or another authoritative metadata endpoint. The current raw JSON content does not preserve clean official topic titles in a dedicated field.

## Known Hazards

- Some dialect names differ between corpora, especially older Seediq/Rukai naming variants. Use the same dialect maps/normalization as YCM when resolving language families.
- `essay` audio URLs may need runtime repair because some DB URLs use `file.klokah.tw/sound/{audio_id}.mp3`, while the working text path can require `https://web.klokah.tw/text/sound/{contextId}/{audio_id}.mp3`.
- `dialogue` audio URLs use an `sn` containing `{tid}/{audioId}`.
- `essay`/`dialogue` category ordering is central to the current geometry alignment. If the DB is rebuilt with a different category sort, regenerate and validate `corpus_geometry.json`.
- `title_zh` values are sometimes sentence fragments, not pedagogical titles.
- Duplicate inferred titles exist and should be handled before building a new app API.

## Validation Queries

Use these against `ycm_master.db`:

```sql
SELECT source, COUNT(*) AS occurrences, COUNT(DISTINCT dialect_name) AS dialects, COUNT(DISTINCT category) AS categories
FROM occurrences
WHERE source IN ('essay','dialogue')
GROUP BY source;
```

```sql
SELECT source, dialect_name, COUNT(DISTINCT category) AS categories, COUNT(*) AS rows
FROM occurrences
WHERE source IN ('essay','dialogue')
GROUP BY source, dialect_name
ORDER BY source, dialect_name;
```

```sql
SELECT s.ab, s.zh, o.audio_url, o.original_uuid, o.category
FROM sentences s
JOIN occurrences o ON s.id = o.sentence_id
WHERE o.dialect_name = '南勢阿美語'
  AND o.source = 'essay'
  AND o.category = '34045'
ORDER BY CAST(SUBSTR(o.original_uuid, INSTR(o.original_uuid, '_') + 1) AS INTEGER) ASC;
```

```sql
SELECT s.ab, s.zh, o.audio_url, o.original_uuid, o.category
FROM sentences s
JOIN occurrences o ON s.id = o.sentence_id
WHERE o.dialect_name = '南勢阿美語'
  AND o.source = 'dialogue'
  AND o.category = 'Dialogue TID 26928'
ORDER BY CAST(SUBSTR(o.original_uuid, INSTR(o.original_uuid, '_') + 1) AS INTEGER) ASC;
```

