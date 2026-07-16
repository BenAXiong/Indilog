import type { SentenceRow } from './dict'
import { getCorpusClient } from './db'

// Kilang/MoE word data — ported from YCM_Citadel's amis_moe_test.db
// (moe_entries) into Indivore's own Supabase (kilang_entries), replacing the
// external ycm-citadel.vercel.app/api/moe_shadow HTTP proxy this used to call.
// See docs/kilang-moe-api.md for the response-shape quirks (still accurate —
// the ported columns are identical) and the manual re-import path.
export type MoeRow = {
  word_ab: string
  definition: string
  dialect_name: string
  dict_code: string
  examples_json?: string
}

type MoeExample = { ab?: string; zh?: string }

export const stripAuthor = (s: string) =>
  (s ?? '阿美語').replace(/\s*\([^)]*\)\s*$/, '').trim() || '阿美語'

type KilangEntryRow = {
  id: string
  word_ab: string
  definition: string | null
  dialect_name: string | null
  dict_code: string | null
  examples_json: string | null
}

const KILANG_COLS = 'id, word_ab, definition, dialect_name, dict_code, examples_json'

// ILIKE treats % and _ as wildcards — the original SQLite `exact=true` path used
// plain equality (LOWER(word_ab)=LOWER(?)), which has no such risk, so escape
// them here to keep exact lookups literal. The `exact=false` (contains) path
// intentionally leaves the keyword unescaped, matching the original `%${q}%`
// LIKE behavior (wildcard chars in a free-text query already passed through).
const escapeIlike = (s: string) => s.replace(/[%_\\]/g, c => `\\${c}`)

function toMoeRow(r: KilangEntryRow): MoeRow {
  return {
    word_ab:       r.word_ab,
    definition:    r.definition ?? '',
    dialect_name:  r.dialect_name ?? '阿美語 (MOE)',
    dict_code:     r.dict_code ?? '',
    examples_json: r.examples_json ?? undefined,
  }
}

// Two separate queries + JS-side dedup (rather than a single `.or()` filter
// string) sidestep PostgREST filter-syntax escaping for keyword text that
// contains commas or parentheses.
export async function kilangFetch(keyword: string, exact: boolean): Promise<MoeRow[]> {
  const db = getCorpusClient()
  const seen = new Map<string, KilangEntryRow>()
  function collect(rows: KilangEntryRow[] | null | undefined) {
    for (const r of rows ?? []) if (!seen.has(r.id)) seen.set(r.id, r)
  }

  if (exact) {
    const literal = escapeIlike(keyword)
    const [byAb, byClean] = await Promise.all([
      db.from('kilang_entries').select(KILANG_COLS).ilike('word_ab', literal).limit(500),
      db.from('kilang_entries').select(KILANG_COLS).ilike('word_ab_clean', literal).limit(500),
    ])
    collect(byAb.data as KilangEntryRow[] | null)
    collect(byClean.data as KilangEntryRow[] | null)
  } else {
    const [byAb, byDef] = await Promise.all([
      db.from('kilang_entries').select(KILANG_COLS).ilike('word_ab', `%${keyword}%`).limit(500),
      db.from('kilang_entries').select(KILANG_COLS).ilike('definition', `%${keyword}%`).limit(500),
    ])
    collect(byAb.data as KilangEntryRow[] | null)
    collect(byDef.data as KilangEntryRow[] | null)
  }

  return Array.from(seen.values())
    .sort((a, b) => a.word_ab.localeCompare(b.word_ab))
    .slice(0, 500)
    .map(toMoeRow)
}

// MoE's own rows carry example sentences inline (examples_json) — id is the sentence
// text itself so callers' own dedup-by-id naturally collapses the same example
// when it's attached to several related word entries (e.g. a root and its derived forms).
export function parseMoeExamples(row: MoeRow, dialectName: string): SentenceRow[] {
  if (!row.examples_json) return []
  let examples: MoeExample[]
  try {
    examples = JSON.parse(row.examples_json)
  } catch {
    return []
  }
  if (!Array.isArray(examples)) return []
  // MoE's example ab text carries its own stress/boundary markup (backtick, tilde)
  // around words — not part of the orthography, unlike the apostrophe or "^" marker.
  const cleanMoeAb = (s: string) => s.replace(/[`~]/g, '').replace(/\s+/g, ' ').trim()
  return examples
    .map(ex => ({ ab: cleanMoeAb(ex.ab ?? ''), zh: (ex.zh ?? '').trim() }))
    .filter(ex => ex.ab)
    .map(ex => ({
      id:           ex.ab,
      ab:           ex.ab,
      zh:           ex.zh,
      dialect_name: dialectName,
      source:       'moe',
      audio_url:    null,
    }))
}

// Example sentences for one already-known word (e.g. expanding a word card in
// the dict tab) — a literal headword lookup, not a broad search, so exact=true.
export async function fetchMoeWordExamples(word: string): Promise<SentenceRow[]> {
  const rows = await kilangFetch(word, true)
  const seen = new Map<string, SentenceRow>()
  for (const row of rows) {
    for (const ex of parseMoeExamples(row, stripAuthor(row.dialect_name))) {
      if (!seen.has(ex.id)) seen.set(ex.id, ex)
    }
  }
  return Array.from(seen.values())
}
