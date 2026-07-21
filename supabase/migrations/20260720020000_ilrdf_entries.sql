-- ILRDF v2 dictionary port — the 3rd dict-source toggle ('ytd' / 族語辭典 in
-- SettingsSheet.tsx, previously disabled). Sourced from YCM_Citadel's
-- export/ycm_master.db (ilrdf_v2_words/ilrdf_v2_dict_entries/
-- ilrdf_v2_descriptions/ilrdf_v2_examples), harvested from
-- new-amis.moedict.tw's v2 API — confirmed Amis-only (glid='01'), see
-- docs/ilrdf-v2-source.md and plan-ilrdf-harvest.md for the full writeup.
-- Mirrors kilang_entries' shape closely (one row per word x dictionary,
-- examples flattened to JSON) so ilrdf.ts can mirror kilang.ts's interface.

CREATE TABLE ilrdf_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id     BIGINT UNIQUE NOT NULL, -- ilrdf_v2_dict_entries.id from the SQLite source, for idempotent re-import
  dictionary    TEXT,                   -- e.g. 原住民族語言線上辭典, 蔡中涵大辭典, 學習詞表－秀姑巒阿美語
  word_ab       TEXT NOT NULL,
  definition    TEXT,                   -- joined description content(s), zh
  examples_json TEXT,                   -- JSON array of { ab, zh } — mirrors kilang_entries.examples_json shape
  dialect_name  TEXT,
  glid          TEXT DEFAULT '01',
  is_stem       BOOLEAN,
  audio_url     TEXT
);

CREATE INDEX idx_ie_ab_trgm     ON ilrdf_entries USING gin(word_ab gin_trgm_ops);
CREATE INDEX idx_ie_def_trgm    ON ilrdf_entries USING gin(definition gin_trgm_ops);
CREATE INDEX idx_ie_ab_lower    ON ilrdf_entries(lower(word_ab));
CREATE INDEX idx_ie_dictionary  ON ilrdf_entries(dictionary);

ALTER TABLE ilrdf_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ilrdf_entries: public read"
  ON ilrdf_entries FOR SELECT USING (true);
