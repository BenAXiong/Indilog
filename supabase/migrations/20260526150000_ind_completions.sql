-- ind_completions: tracks which Learn lessons/patterns/essays/dialogues a user has completed
-- Stored server-side (not localStorage) for cross-device sync and dashboard stats.
-- item_key format: 'Level 1 Lesson 1' (twelve), 't1' (grmpts), title_zh (essay/dialogue)

CREATE TABLE IF NOT EXISTS ind_completions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        REFERENCES auth.users NOT NULL,
  language     text        NOT NULL,  -- Indivore language code e.g. 'ami'
  source       text        NOT NULL,  -- 'twelve' | 'grmpts' | 'essay' | 'dialogue'
  item_key     text        NOT NULL,
  completed_at timestamptz DEFAULT now(),
  UNIQUE(user_id, language, source, item_key)
);

ALTER TABLE ind_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user owns completions" ON ind_completions
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Helper: count completions per language (used by dashboard Lessons stat)
CREATE OR REPLACE FUNCTION get_completion_count(p_user_id uuid, p_language text)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT COUNT(*)::integer
  FROM ind_completions
  WHERE user_id = p_user_id AND language = p_language;
$$;
