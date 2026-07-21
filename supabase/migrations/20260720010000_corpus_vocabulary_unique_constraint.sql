-- corpus_vocabulary had no natural unique key beyond its own random id UUID,
-- so the Citadel-side distiller's merge-duplicates upsert (no on_conflict
-- specified) could never actually dedupe against existing rows. In practice
-- this meant the table only ever got the first harvester pass — one primary
-- dialect per language (e.g. Amis -> only 秀姑巒阿美語, missing 南勢/海岸/
-- 馬蘭/恆春 entirely) — and was never safely re-pushable to backfill the
-- rest without risking duplicate rows. Verified (glid, dialect_name, word_ab,
-- source, num) is fully unique across all 292,983 rows in Citadel's
-- ilrdf_vocabulary source table before adding this constraint.
ALTER TABLE corpus_vocabulary
  ADD CONSTRAINT uq_corpus_vocabulary_natural_key
  UNIQUE (glid, dialect_name, word_ab, source, num);
