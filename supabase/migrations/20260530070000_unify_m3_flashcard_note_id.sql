-- T-UNIFY M3: remap ind_flashcards to note_id, drop legacy columns + front/back
-- Prerequisite: M2 must be applied (ind_items has legacy_learn_card_id mapping)

-- 1. Add note_id FK
ALTER TABLE ind_flashcards ADD COLUMN IF NOT EXISTS note_id uuid REFERENCES ind_items(id) ON DELETE CASCADE;

-- 2. Remap from item_id
UPDATE ind_flashcards SET note_id = item_id WHERE item_id IS NOT NULL;

-- 3. Remap from collection_card_id via legacy mapping
UPDATE ind_flashcards f
SET note_id = i.id
FROM ind_items i
WHERE i.legacy_learn_card_id = f.collection_card_id
  AND f.collection_card_id IS NOT NULL;

-- 4. Remove reverse cards (replaced by session mode)
DELETE FROM ind_flashcards WHERE card_type = 'reverse';

-- 5. Rename forward → default
UPDATE ind_flashcards SET card_type = 'default'
WHERE card_type = 'forward' OR card_type IS NULL;

-- 6. Drop deprecated columns
ALTER TABLE ind_flashcards DROP COLUMN IF EXISTS item_id;
ALTER TABLE ind_flashcards DROP COLUMN IF EXISTS collection_card_id;
ALTER TABLE ind_flashcards DROP COLUMN IF EXISTS front;
ALTER TABLE ind_flashcards DROP COLUMN IF EXISTS back;
