-- Sources: where material was found/heard
create table ind_sources (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references auth.users(id) on delete cascade not null,
  name       text        not null,
  url        text,
  notes      text,
  language   text,
  created_at timestamptz not null default now()
);

alter table ind_sources enable row level security;
create policy "Users own their sources" on ind_sources
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Speakers: people from whom material was heard
create table ind_speakers (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references auth.users(id) on delete cascade not null,
  name       text        not null,
  notes      text,
  created_at timestamptz not null default now()
);

alter table ind_speakers enable row level security;
create policy "Users own their speakers" on ind_speakers
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Items: the core notebook entries
create table ind_items (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        references auth.users(id) on delete cascade not null,
  text        text        not null,
  type        text        not null check (type in ('word', 'sentence', 'note')),
  language    text        not null,
  dialect     text,
  place_heard text,
  notes       text,
  source_id   uuid        references ind_sources(id) on delete set null,
  speaker_id  uuid        references ind_speakers(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table ind_items enable row level security;
create policy "Users own their items" on ind_items
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger ind_items_updated_at
  before update on ind_items
  for each row execute function update_updated_at();

-- Item tokens: tokenized chunks for dictionary lookup
create table ind_item_tokens (
  id            uuid  primary key default gen_random_uuid(),
  item_id       uuid  references ind_items(id) on delete cascade not null,
  token_text    text  not null,
  definition_id text,
  position      integer not null
);

alter table ind_item_tokens enable row level security;
create policy "Users own tokens via items" on ind_item_tokens
  using (exists (
    select 1 from ind_items
    where ind_items.id = ind_item_tokens.item_id
      and ind_items.user_id = auth.uid()
  ));

-- Flashcards: front/back cards derived from items
create table ind_flashcards (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        references auth.users(id) on delete cascade not null,
  item_id    uuid        references ind_items(id) on delete cascade not null,
  front      text        not null,
  back       text        not null,
  created_at timestamptz not null default now()
);

alter table ind_flashcards enable row level security;
create policy "Users own their flashcards" on ind_flashcards
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Reviews: per-rating history with simple scheduling
create table ind_reviews (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        references auth.users(id) on delete cascade not null,
  flashcard_id uuid        references ind_flashcards(id) on delete cascade not null,
  rating       text        not null check (rating in ('again', 'hard', 'good', 'easy')),
  reviewed_at  timestamptz not null default now(),
  due_at       timestamptz not null
);

alter table ind_reviews enable row level security;
create policy "Users own their reviews" on ind_reviews
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Daily stats: captured + reviewed counts per day for streak tracking
create table ind_daily_stats (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        references auth.users(id) on delete cascade not null,
  date           date        not null,
  captured_count integer     not null default 0,
  reviewed_count integer     not null default 0,
  streak_day     integer     not null default 0,
  unique (user_id, date)
);

alter table ind_daily_stats enable row level security;
create policy "Users own their daily stats" on ind_daily_stats
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
