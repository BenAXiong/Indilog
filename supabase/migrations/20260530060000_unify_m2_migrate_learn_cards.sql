-- T-UNIFY M2: migrate ind_learn_cards rows into ind_items
-- Adds structural columns (level/lesson/position) + temp legacy mapping column.
-- ind_learn_cards is kept until M4 (needed for M3 flashcard FK remapping).

ALTER TABLE ind_items ADD COLUMN IF NOT EXISTS metadata jsonb;
ALTER TABLE ind_items ADD COLUMN IF NOT EXISTS level int;
ALTER TABLE ind_items ADD COLUMN IF NOT EXISTS lesson int;
ALTER TABLE ind_items ADD COLUMN IF NOT EXISTS lesson_title text;
ALTER TABLE ind_items ADD COLUMN IF NOT EXISTS position int;
ALTER TABLE ind_items ADD COLUMN IF NOT EXISTS legacy_learn_card_id uuid;

INSERT INTO ind_items
  (user_id, ab, zh, audio, type, note_source, collection_id, language,
   level, lesson, lesson_title, position, legacy_learn_card_id)
SELECT
  lc.user_id, c.ab, c.zh, c.audio_url, 'word', 'collection', c.collection_id, lc.language,
  c.level, c.lesson, c.lesson_title, c.position, c.id
FROM ind_learn_cards c
JOIN ind_learn_collections lc ON lc.id = c.collection_id;
