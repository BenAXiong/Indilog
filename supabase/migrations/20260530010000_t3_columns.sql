ALTER TABLE ind_flashcards
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz,
  ADD COLUMN IF NOT EXISTS flagged       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS card_type     text    NOT NULL DEFAULT 'forward';
