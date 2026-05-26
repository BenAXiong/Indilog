create or replace function increment_captured_today(p_user_id uuid, p_date date)
returns void language plpgsql security definer as $$
begin
  insert into ind_daily_stats (user_id, date, captured_count, reviewed_count, streak_day)
  values (p_user_id, p_date, 1, 0, 0)
  on conflict (user_id, date)
  do update set captured_count = ind_daily_stats.captured_count + 1;
end;
$$;
