---
status: accepted
---

# Chrome Extension Import — format, mechanism, dedup, and note_source

**Date:** 2026-06-04

**Decision 1 — Import mechanism: deep link with hash payload**
- Extension calls `chrome.tabs.create({ url: 'https://<app>/import#v1:<base64>' })`
- `/import` page reads `window.location.hash` client-side (never sent to server)
- No API key required; auth handled by the existing Supabase session in the browser
- UTF-8 safe encoding: `btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(payload))))` on the extension side

**Decision 2 — IndiHunt Import Format v1 (flat list)**
```json
{
  "version": 1,
  "source": "ycm-popupdict",
  "exportedAt": "ISO",
  "items": [
    { "ab": "mato'as", "zh": "老；年老的", "type": "word", "language": "ami", "dialect": "馬蘭阿美語", "audio": "https://…", "notes": "…", "tags": ["KILANG"] }
  ]
}
```
- `language` must be the short Indivore code (`ami`, `tay`, …). NLLB script suffixes stripped if present.
- `type` defaults to `"word"` if omitted. All fields except `ab`, `language` are optional.

**Decision 3 — `note_source = 'import'`**
- No DB migration needed — `ind_items.note_source` is an unconstrained text column.

**Decision 4 — Deduplication**
- Dedup on exact `(ab, language)` per user at import time.
- Duplicates shown as greyed-out rows, skipped on confirm. Preview shows "N new · M already saved."

**Decision 5 — Item cap**
- Max 200 items per import batch; excess trimmed to first 200 with a warning.
