-- Atomic graduation: updates flashcard, inserts review record, and increments
-- learned_count in a single transaction. Replaces the three separate client-side
-- writes that could leave flashcards in a partially-graduated state on network error.
CREATE OR REPLACE FUNCTION public.graduate_learn_card(
  p_flashcard_id uuid,
  p_user_id      uuid,
  p_type         text,   -- 'good' | 'easy'
  p_date         date
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_interval_days real;
  v_due_at        timestamptz;
BEGIN
  v_interval_days := CASE WHEN p_type = 'easy' THEN 4.0 ELSE 0.5 END;
  v_due_at        := now() + (v_interval_days * interval '1 day');

  UPDATE ind_flashcards
  SET due_at        = v_due_at,
      ease_factor   = 2.5,
      interval_days = v_interval_days,
      repetitions   = 1
  WHERE id = p_flashcard_id AND user_id = p_user_id;

  INSERT INTO ind_reviews (user_id, flashcard_id, rating, due_at, mode)
  VALUES (p_user_id, p_flashcard_id, p_type, v_due_at, 'learn');

  INSERT INTO ind_daily_stats (user_id, date, captured_count, reviewed_count, learned_count, streak_day)
  VALUES (p_user_id, p_date, 0, 0, 1, 0)
  ON CONFLICT (user_id, date)
  DO UPDATE SET learned_count = ind_daily_stats.learned_count + 1;
END;
$$;
