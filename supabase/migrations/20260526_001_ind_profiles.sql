create table ind_profiles (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        references auth.users(id) on delete cascade not null unique,
  active_study_language text not null default 'ami',
  default_dialect       text,
  ui_locale             text not null default 'en',
  daily_goal            integer not null default 20,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table ind_profiles enable row level security;

create policy "Users can view own profile"
  on ind_profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert own profile"
  on ind_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own profile"
  on ind_profiles for update
  using (auth.uid() = user_id);

-- Auto-update updated_at on row change
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger ind_profiles_updated_at
  before update on ind_profiles
  for each row execute function update_updated_at();
