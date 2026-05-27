-- Add meaning field to ind_items for flashcard back-of-card content
-- This replaces the prior workaround of using notes as the flashcard answer.
alter table ind_items add column if not exists meaning text;
