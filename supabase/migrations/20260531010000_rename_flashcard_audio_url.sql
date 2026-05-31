-- Architecture polish: rename ind_flashcards.audio_url → audio
-- Matches ind_items.audio (renamed in M1) for consistent naming across all Note/Card tables
ALTER TABLE ind_flashcards RENAME COLUMN audio_url TO audio;
