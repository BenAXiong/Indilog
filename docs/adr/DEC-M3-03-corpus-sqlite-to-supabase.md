---
status: accepted
---

# Corpus DB migration — SQLite LFS → Supabase

**Date:** 2026-06-01

Migrated `corpus_sentences` (185k) + `corpus_occurrences` (201k) + `corpus_vocabulary` (293k) to the existing Supabase project. `packages/dictionary/ycm_master.db` removed from git; `better-sqlite3` uninstalled.

**Context:** `ycm_master.db` was a 215MB SQLite file git-tracked via LFS and bundled with every Vercel deployment. Every corpus update required: distill → copy → git commit → push → Vercel redeploys.

**Why this works:**
- ~380k rows ≈ 100–150MB in Postgres — fits Supabase free tier (500MB) alongside app data
- Corpus queries are small (10–30 rows per request), so PostgREST 1000-row cap is not an issue
- Content updates become: distill → upsert — no git commit, no redeploy
- Eliminates the SQLite-in-serverless architectural awkwardness
- Curriculum API swaps `better-sqlite3` queries for `supabase.from()` calls — isolated change
