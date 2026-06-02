CREATE TABLE ind_sources (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('person', 'media', 'reference')),
  dialect_name TEXT,
  language     TEXT,
  location     TEXT,
  url          TEXT,
  notes        TEXT,
  avatar_color TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ind_sources_user ON ind_sources(user_id);

ALTER TABLE ind_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sources: user owns rows"
  ON ind_sources FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
