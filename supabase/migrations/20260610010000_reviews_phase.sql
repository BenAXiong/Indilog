-- Add phase column to ind_reviews for non-scheduled event tracking.
-- NULL  = normal scheduled review (algo reads these; existing rows unaffected)
-- 'review_requeue' = Review Again requeue event (data only, no scheduling change)
-- 'learn'          = Learn test-pass Again event (data only, no scheduling change)
ALTER TABLE ind_reviews ADD COLUMN IF NOT EXISTS phase TEXT DEFAULT NULL;
