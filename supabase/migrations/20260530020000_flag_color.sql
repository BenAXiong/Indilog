ALTER TABLE ind_flashcards
  DROP COLUMN IF EXISTS flagged,
  ADD  COLUMN IF NOT EXISTS flag_color text;
