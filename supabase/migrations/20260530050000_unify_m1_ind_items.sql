-- T-UNIFY M1: rename ind_items fields to canonical Note schema
-- text → ab (target-language form), meaning → zh (translation),
-- audio_url → audio (accepts URL or storage path)
-- Add note_source (provenance) and collection_id (FK for collection notes)
ALTER TABLE ind_items RENAME COLUMN text TO ab;
ALTER TABLE ind_items RENAME COLUMN meaning TO zh;
ALTER TABLE ind_items RENAME COLUMN audio_url TO audio;
ALTER TABLE ind_items ADD COLUMN IF NOT EXISTS note_source text NOT NULL DEFAULT 'captured';
ALTER TABLE ind_items ADD COLUMN IF NOT EXISTS collection_id uuid REFERENCES ind_learn_collections(id) ON DELETE SET NULL;
