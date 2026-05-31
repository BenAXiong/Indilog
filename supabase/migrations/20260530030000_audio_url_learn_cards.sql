-- T3-D audio step 2: audio URL on collection note cards
ALTER TABLE ind_learn_cards ADD COLUMN IF NOT EXISTS audio_url text;
