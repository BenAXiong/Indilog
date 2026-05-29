-- Allow flashcards to be sourced from ind_learn_cards (custom collections)
-- in addition to ind_items (captured notebook entries).
-- Exactly one of item_id / collection_card_id should be non-null per row.

ALTER TABLE ind_flashcards
  ALTER COLUMN item_id DROP NOT NULL;

ALTER TABLE ind_flashcards
  ADD COLUMN IF NOT EXISTS collection_card_id uuid
    REFERENCES ind_learn_cards(id) ON DELETE CASCADE;
