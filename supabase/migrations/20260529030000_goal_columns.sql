ALTER TABLE ind_profiles
  ADD COLUMN IF NOT EXISTS goal_collection_id text,
  ADD COLUMN IF NOT EXISTS goal_due_date       date;
