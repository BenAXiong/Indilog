-- Add audio_url to ind_items for voice recordings attached to captured items.
-- Populated by Supabase Storage upload (bucket: ind-audio). Null until recording is attached.
alter table ind_items add column if not exists audio_url text;
