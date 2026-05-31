-- T3-D audio step 3: audio snapshot (for curriculum cards) + metadata jsonb (for STS and future card templates)
ALTER TABLE ind_flashcards ADD COLUMN IF NOT EXISTS audio_url text;
ALTER TABLE ind_flashcards ADD COLUMN IF NOT EXISTS metadata jsonb;
