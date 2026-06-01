-- M3-arch: corpus tables replacing ycm_master.db (SQLite LFS)
-- corpus_sentences  — unique sentence content, deduplicated by logic_hash
-- corpus_occurrences — one row per (sentence × dialect × source), enriched with unit/lesson/role
-- corpus_vocabulary  — ILRDF dictionary (word-level, from ilrdf_vocabulary in SQLite)

-- ── Enable pg_trgm for fast ILIKE searches ──────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ── corpus_sentences ─────────────────────────────────────────────────────────
CREATE TABLE corpus_sentences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logic_hash  TEXT UNIQUE NOT NULL,
  glid        TEXT,
  ab          TEXT NOT NULL,
  zh          TEXT
);

CREATE INDEX idx_cs_glid     ON corpus_sentences(glid);
CREATE INDEX idx_cs_ab_trgm  ON corpus_sentences USING gin(ab gin_trgm_ops);

ALTER TABLE corpus_sentences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "corpus_sentences: public read"
  ON corpus_sentences FOR SELECT USING (true);

-- ── corpus_occurrences ───────────────────────────────────────────────────────
CREATE TABLE corpus_occurrences (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sentence_id   UUID NOT NULL REFERENCES corpus_sentences(id),
  dialect_name  TEXT NOT NULL,
  source        TEXT NOT NULL,
  category      TEXT,
  level         TEXT,
  unit          SMALLINT,
  lesson        TEXT,
  role          TEXT,
  audio_url     TEXT,
  original_uuid TEXT,
  position      SMALLINT
);

CREATE INDEX idx_co_lookup   ON corpus_occurrences(source, dialect_name, category);
CREATE INDEX idx_co_sentence ON corpus_occurrences(sentence_id);
CREATE INDEX idx_co_source   ON corpus_occurrences(source);

ALTER TABLE corpus_occurrences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "corpus_occurrences: public read"
  ON corpus_occurrences FOR SELECT USING (true);

-- ── corpus_vocabulary ────────────────────────────────────────────────────────
CREATE TABLE corpus_vocabulary (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  glid         TEXT,
  dialect_name TEXT,
  word_ab      TEXT NOT NULL,
  word_ch      TEXT,
  source       TEXT,
  num          INTEGER
);

CREATE INDEX idx_cv_glid     ON corpus_vocabulary(glid);
CREATE INDEX idx_cv_ab_trgm  ON corpus_vocabulary USING gin(word_ab gin_trgm_ops);
CREATE INDEX idx_cv_ab_lower ON corpus_vocabulary(lower(word_ab));

ALTER TABLE corpus_vocabulary ENABLE ROW LEVEL SECURITY;
CREATE POLICY "corpus_vocabulary: public read"
  ON corpus_vocabulary FOR SELECT USING (true);
