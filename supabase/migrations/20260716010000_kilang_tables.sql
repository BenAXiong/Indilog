-- M3-arch: Kilang/MoE dictionary port — replaces the external
-- ycm-citadel.vercel.app/api/moe_shadow HTTP proxy with local tables, sourced
-- from YCM_Citadel's amis_moe_test.db (moe_entries + moe_hierarchy_moe).
-- Indivore's kilangFetch only ever queries with mode=moe and never reads
-- ultimate_root/parent_word/depth/sort_path/sources today — moe_hierarchy_moe
-- is ported anyway for future lineage/root-browsing use; plus/star hierarchy
-- variants are unused duplicates of moe_hierarchy_moe's word_ab/parent_word/
-- ultimate_root/depth and are not ported. See docs/kilang-moe-api.md for the
-- manual re-import path.

CREATE TABLE kilang_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id     BIGINT UNIQUE NOT NULL, -- moe_entries.id from the SQLite source, for idempotent re-import
  dict_code     TEXT,
  word_ab       TEXT NOT NULL,
  word_ab_clean TEXT GENERATED ALWAYS AS (RTRIM(word_ab, '|')) STORED, -- mirrors RTRIM(e.word_ab,'|') used to join hierarchy in the SQLite source
  definition    TEXT,
  examples_json TEXT,
  dialect_name  TEXT DEFAULT '阿美語 (MOE)',
  glid          TEXT DEFAULT '01',
  stem          TEXT
);

CREATE INDEX idx_ke_ab_trgm        ON kilang_entries USING gin(word_ab gin_trgm_ops);
CREATE INDEX idx_ke_def_trgm       ON kilang_entries USING gin(definition gin_trgm_ops);
CREATE INDEX idx_ke_ab_clean_trgm  ON kilang_entries USING gin(word_ab_clean gin_trgm_ops); -- exact-match path (ILIKE without wildcards still needs pg_trgm, not a plain btree)
CREATE INDEX idx_ke_ab_clean_lower ON kilang_entries(lower(word_ab_clean));
CREATE INDEX idx_ke_dict_code      ON kilang_entries(dict_code);

ALTER TABLE kilang_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kilang_entries: public read"
  ON kilang_entries FOR SELECT USING (true);

CREATE TABLE kilang_hierarchy (
  word_ab       TEXT PRIMARY KEY,
  parent_word   TEXT,
  ultimate_root TEXT,
  depth         INTEGER,
  sort_path     TEXT,
  sources       TEXT
);

CREATE INDEX idx_kh_ultimate_root ON kilang_hierarchy(ultimate_root);
CREATE INDEX idx_kh_parent_word   ON kilang_hierarchy(parent_word);

ALTER TABLE kilang_hierarchy ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kilang_hierarchy: public read"
  ON kilang_hierarchy FOR SELECT USING (true);
