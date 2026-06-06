---
status: accepted
---

# Lesson completion stored in `ind_completions` (Supabase)

Lesson/pattern/essay/dialogue completion state is stored server-side in `ind_completions`, not in localStorage.

**Date:** 2026-05-26

**Why:** Cross-device sync, queryable for Dashboard stats, enables future streaks and milestones. YCM used localStorage — Indivore has Supabase so use it.

**Schema:** `(user_id, language, source, item_key, completed_at)` with a UNIQUE constraint on `(user_id, language, source, item_key)`.
