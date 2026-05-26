-- ind_learn_collections + ind_learn_cards: user-authored custom curriculum
-- Collections are language-specific (one language per collection).
-- Cards are grouped into levels and lessons (Lx-y); position = order within lesson.

CREATE TABLE IF NOT EXISTS ind_learn_collections (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        REFERENCES auth.users NOT NULL,
  name         text        NOT NULL,
  language     text        NOT NULL,  -- Indivore language code e.g. 'ami'
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE ind_learn_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user owns collections" ON ind_learn_collections
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS ind_learn_cards (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid        REFERENCES ind_learn_collections ON DELETE CASCADE NOT NULL,
  level         integer     NOT NULL CHECK (level >= 1),
  lesson        integer     NOT NULL CHECK (lesson >= 1),
  position      integer     NOT NULL,  -- order within the Lx-y lesson
  ab            text        NOT NULL,
  zh            text,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE ind_learn_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user owns cards" ON ind_learn_cards
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM ind_learn_collections c
      WHERE c.id = collection_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ind_learn_collections c
      WHERE c.id = collection_id AND c.user_id = auth.uid()
    )
  );

CREATE INDEX ind_learn_cards_collection_idx ON ind_learn_cards (collection_id, level, lesson, position);
