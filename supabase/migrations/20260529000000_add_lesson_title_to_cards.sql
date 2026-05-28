-- Add lesson_title to ind_learn_cards so collection browse can show
-- human-readable lesson names (e.g. "初級") rather than just a number.
-- Stored denormalised on every card — same title for all cards in a lesson.
ALTER TABLE ind_learn_cards ADD COLUMN IF NOT EXISTS lesson_title text;
