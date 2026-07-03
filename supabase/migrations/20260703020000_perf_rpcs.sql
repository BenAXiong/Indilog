-- Perf S4/S5 (docs/perf-plan.md): move ensureFlashcards' backfill diff and
-- getDueStats' counting server-side. Both SECURITY INVOKER — they run as the
-- calling authenticated role, so RLS on ind_flashcards/ind_items still applies.
-- Sidesteps the PostgREST 1000-row cap (DEC-SRS04) by transferring no rows at all.

-- S4: one default Card per Note that doesn't have one (architecture.md § Card generation).
-- ON CONFLICT closes the two-tabs race the client-side diff had (both compute
-- "missing", both insert; ind_flashcards_user_note_unique made that throw).
CREATE OR REPLACE FUNCTION ensure_flashcards()
RETURNS integer
LANGUAGE sql
SECURITY INVOKER
AS $$
  WITH ins AS (
    INSERT INTO ind_flashcards (user_id, note_id)
    SELECT i.user_id, i.id
    FROM ind_items i
    WHERE i.user_id = auth.uid()
      AND NOT EXISTS (
        SELECT 1 FROM ind_flashcards f
        WHERE f.user_id = i.user_id AND f.note_id = i.id
      )
    ON CONFLICT ON CONSTRAINT ind_flashcards_user_note_unique DO NOTHING
    RETURNING 1
  )
  SELECT count(*)::integer FROM ins;
$$;

-- S5: grouped due counts (was: paginate every due row to the client and count there).
-- True inner-join exclusion semantics — the old non-inner embed filters nulled the
-- joined item instead of excluding the row, so excluded cards still counted as captures.
CREATE OR REPLACE FUNCTION get_due_stats(
  p_exclude_langs       text[]  DEFAULT '{}',
  p_exclude_collections uuid[]  DEFAULT '{}',
  p_exclude_captures    boolean DEFAULT false
)
RETURNS TABLE (collection_id uuid, captures boolean, n integer)
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT
    CASE WHEN i.note_source = 'collection' THEN i.collection_id END AS collection_id,
    (i.note_source <> 'collection' OR i.collection_id IS NULL)      AS captures,
    count(*)::integer                                               AS n
  FROM ind_flashcards f
  JOIN ind_items i ON i.id = f.note_id
  WHERE f.user_id = auth.uid()
    AND f.due_at <= now()
    AND f.repetitions > 0
    AND f.suspended_at IS NULL
    AND (cardinality(p_exclude_langs) = 0
         OR i.language IS NULL
         OR i.language <> ALL(p_exclude_langs))
    AND NOT (p_exclude_captures AND i.note_source <> 'collection')
    AND NOT (i.note_source = 'collection'
             AND i.collection_id IS NOT NULL
             AND i.collection_id = ANY(p_exclude_collections))
  GROUP BY 1, 2;
$$;
