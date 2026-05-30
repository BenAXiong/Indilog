-- T-UNIFY M4: drop ind_learn_cards (fully replaced by ind_items with collection_id)
-- and temp mapping column (legacy_learn_card_id used only in M3 flashcard remapping)
ALTER TABLE ind_items DROP COLUMN IF EXISTS legacy_learn_card_id;
DROP TABLE IF EXISTS ind_learn_cards;
