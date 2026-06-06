-- Track cards learned (graduated from new) per day
ALTER TABLE ind_daily_stats ADD COLUMN IF NOT EXISTS learned_count int NOT NULL DEFAULT 0;

-- Increment learned_count for a user on a given study date
CREATE OR REPLACE FUNCTION increment_learned_today(p_user_id uuid, p_date date)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO ind_daily_stats (user_id, date, captured_count, reviewed_count, learned_count, streak_day)
  VALUES (p_user_id, p_date, 0, 0, 1, 0)
  ON CONFLICT (user_id, date)
  DO UPDATE SET learned_count = ind_daily_stats.learned_count + 1;
END;
$$;
