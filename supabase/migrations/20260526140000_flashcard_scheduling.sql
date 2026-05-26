-- Add due_at to ind_flashcards for simple scheduling
-- New cards (due_at = null) are immediately due
alter table ind_flashcards add column if not exists due_at timestamptz;

-- Increment reviewed_count for a user on a given date
create or replace function increment_reviewed_today(p_user_id uuid, p_date date)
returns void language plpgsql security definer as $$
begin
  insert into ind_daily_stats (user_id, date, captured_count, reviewed_count, streak_day)
  values (p_user_id, p_date, 0, 1, 0)
  on conflict (user_id, date)
  do update set reviewed_count = ind_daily_stats.reviewed_count + 1;
end;
$$;
