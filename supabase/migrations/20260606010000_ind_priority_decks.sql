-- Priority decks: ordered list of collections the user wants to prioritise in Learn
CREATE TABLE ind_priority_decks (
  id                  uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collection_id       uuid    NOT NULL REFERENCES ind_learn_collections(id) ON DELETE CASCADE,
  position            int     NOT NULL,
  in_simulation       boolean NOT NULL DEFAULT false,
  simulation_deadline date,
  UNIQUE (user_id, collection_id),
  UNIQUE (user_id, position)
);

ALTER TABLE ind_priority_decks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their priority decks" ON ind_priority_decks
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Data migration: copy existing goal deck (if set) into position 1
-- goal_collection_id stored as text in ind_profiles; cast to uuid.
-- in_simulation = true when the user had a deadline set.
-- Do not drop goal_collection_id / goal_due_date yet (expand/contract).
INSERT INTO ind_priority_decks (user_id, collection_id, position, in_simulation, simulation_deadline)
SELECT
  p.user_id,
  p.goal_collection_id::uuid,
  1,
  (p.goal_due_date IS NOT NULL),
  p.goal_due_date
FROM ind_profiles p
WHERE p.goal_collection_id IS NOT NULL
  AND p.goal_collection_id != ''
  AND EXISTS (
    SELECT 1 FROM ind_learn_collections c
    WHERE c.id = p.goal_collection_id::uuid
  )
ON CONFLICT (user_id, collection_id) DO NOTHING;
