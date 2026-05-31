-- FormoSRS-1 state columns on ind_flashcards.
-- Column defaults handle all existing cards (ease 2.5, interval 0, reps 0).

ALTER TABLE ind_flashcards
  ADD COLUMN IF NOT EXISTS ease_factor   real    NOT NULL DEFAULT 2.5,
  ADD COLUMN IF NOT EXISTS interval_days integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repetitions   integer NOT NULL DEFAULT 0;
