---
status: accepted
---

# Learn routing: single /learn route, no per-language URL segments

Learn lives at `/learn` and always operates on `ind_profiles.active_study_language`. No `/:language/learn` routing.

**Date:** 2026-05-26

**Why:** YCM uses per-language URLs because it's a multi-language portal; Indivore is a single-active-language notebook. Cursor state (selected lesson, pattern, etc.) is persisted in localStorage keyed by GLID, so switching languages in Settings resumes where the user left off per language.
