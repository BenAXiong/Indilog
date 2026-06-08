-- Freeze daily simulation targets in ind_daily_stats.
-- learn_target / review_target are written once per study date (on first dashboard load)
-- and never overwritten (COALESCE keeps the original value).
-- This prevents the ring denominator from shifting after sessions complete.

ALTER TABLE ind_daily_stats
  ADD COLUMN learn_target  int4 DEFAULT NULL,
  ADD COLUMN review_target int4 DEFAULT NULL;

-- Upsert with COALESCE: sets learn_target/review_target only when they are NULL.
-- Safe to call multiple times — subsequent calls are no-ops.
CREATE OR REPLACE FUNCTION freeze_daily_targets(
  p_user_id      uuid,
  p_date         date,
  p_learn_target int4,
  p_review_target int4
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO ind_daily_stats
    (user_id, date, captured_count, reviewed_count, learned_count, streak_day, learn_target, review_target)
  VALUES
    (p_user_id, p_date, 0, 0, 0, 0, p_learn_target, p_review_target)
  ON CONFLICT (user_id, date) DO UPDATE
    SET learn_target  = COALESCE(ind_daily_stats.learn_target,  EXCLUDED.learn_target),
        review_target = COALESCE(ind_daily_stats.review_target, EXCLUDED.review_target);
END;
$$;
