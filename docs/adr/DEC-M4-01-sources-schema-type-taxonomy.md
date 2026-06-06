---
status: accepted
---

# Sources db — schema, type taxonomy, FK consolidation

**Date:** 2026-06-02

**Schema:**
```sql
CREATE TABLE ind_sources (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('person', 'media', 'reference')),
  dialect_name TEXT,
  language     TEXT,
  location     TEXT,
  url          TEXT,
  notes        TEXT,
  avatar_color TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

**Type taxonomy:**
| Type | Covers | Pre-fills |
|------|--------|-----------|
| `person` | speakers, teachers, elders, friends | dialect + language |
| `media` | movies, TV shows, music, podcasts, story books, YouTube | dialect + language |
| `reference` | dictionaries, textbooks, grammar books, websites | dialect + language |

The distinctions are cosmetic (icon) — all three share the same core fields and capture workflow.

**FK consolidation:**
- `ind_items.source_id` is the single FK to `ind_sources.id`
- `ind_items.speaker_id` is deprecated — ignored in all new code; will not be migrated or removed (low-risk orphan column)
- No shared sources between users in v1 — each user maintains their own library
