import type { SentenceRow } from './dict'
import { getCorpusClient } from './db'

// ILRDF v2 dictionary data — harvested from new-amis.moedict.tw's v2 API
// (which itself aggregates 原住民族語言線上辭典 + 5 other Amis dictionaries)
// into Indivore's own Supabase (ilrdf_entries). Canonical source/harvester
// lives in YCM_Citadel (core/ilrdf_v2_harvester.py, export/ycm_master.db's
// ilrdf_v2_* tables) — see docs/ilrdf-v2-source.md for the full writeup and
// plan-ilrdf-harvest.md for live status. Mirrors kilang.ts's shape closely
// since it's the same kind of "external dict data ported into a local
// table" pattern — read kilang.ts first if extending this.
export type IlrdfRow = {
  word_ab: string
  definition: string
  dialect_name: string
  dictionary: string
  examples_json?: string
}

type IlrdfExample = { ab?: string; zh?: string }

type IlrdfEntryRow = {
  id: string
  word_ab: string
  definition: string | null
  dialect_name: string | null
  dictionary: string | null
  examples_json: string | null
}

const ILRDF_COLS = 'id, word_ab, definition, dialect_name, dictionary, examples_json'

// Same escaping rationale as kilang.ts's escapeIlike — ILIKE treats % and _
// as wildcards, exact lookups need them literal.
const escapeIlike = (s: string) => s.replace(/[%_\\]/g, c => `\\${c}`)

function toIlrdfRow(r: IlrdfEntryRow): IlrdfRow {
  return {
    word_ab:       r.word_ab,
    definition:    r.definition ?? '',
    dialect_name:  r.dialect_name ?? '阿美語',
    dictionary:    r.dictionary ?? '',
    examples_json: r.examples_json ?? undefined,
  }
}

// Two separate queries + JS-side dedup — same rationale as kilang.ts's
// kilangFetch (sidesteps PostgREST .or() filter-syntax escaping for keyword
// text containing commas/parentheses).
export async function ilrdfFetch(keyword: string, exact: boolean): Promise<IlrdfRow[]> {
  const db = getCorpusClient()
  const seen = new Map<string, IlrdfEntryRow>()
  function collect(rows: IlrdfEntryRow[] | null | undefined) {
    for (const r of rows ?? []) if (!seen.has(r.id)) seen.set(r.id, r)
  }

  if (exact) {
    const literal = escapeIlike(keyword)
    const { data } = await db.from('ilrdf_entries').select(ILRDF_COLS).ilike('word_ab', literal).limit(500)
    collect(data as IlrdfEntryRow[] | null)
  } else {
    const [byAb, byDef] = await Promise.all([
      db.from('ilrdf_entries').select(ILRDF_COLS).ilike('word_ab', `%${keyword}%`).limit(500),
      db.from('ilrdf_entries').select(ILRDF_COLS).ilike('definition', `%${keyword}%`).limit(500),
    ])
    collect(byAb.data as IlrdfEntryRow[] | null)
    collect(byDef.data as IlrdfEntryRow[] | null)
  }

  return Array.from(seen.values())
    .sort((a, b) => a.word_ab.localeCompare(b.word_ab))
    .slice(0, 500)
    .map(toIlrdfRow)
}

// Cheap presence check — same role as kilang.ts's moeRowHasExamples.
export function ilrdfRowHasExamples(row: IlrdfRow): boolean {
  if (!row.examples_json) return false
  try {
    const parsed = JSON.parse(row.examples_json)
    return Array.isArray(parsed) && parsed.length > 0
  } catch {
    return false
  }
}

// examples_json rows carry the same `` ` ``/`~` stress-boundary markup as
// MoE's (the v2 harvest's source dictionaries use the same convention) —
// stripped here, not at import time, matching kilang.ts's parseMoeExamples.
export function parseIlrdfExamples(row: IlrdfRow, dialectName: string): SentenceRow[] {
  if (!row.examples_json) return []
  let examples: IlrdfExample[]
  try {
    examples = JSON.parse(row.examples_json)
  } catch {
    return []
  }
  if (!Array.isArray(examples)) return []
  const cleanAb = (s: string) => s.replace(/[`~]/g, '').replace(/\s+/g, ' ').trim()
  return examples
    .map(ex => ({ ab: cleanAb(ex.ab ?? ''), zh: (ex.zh ?? '').trim() }))
    .filter(ex => ex.ab)
    .map(ex => ({
      id:           ex.ab,
      ab:           ex.ab,
      zh:           ex.zh,
      dialect_name: dialectName,
      source:       'ilrdf',
      audio_url:    null,
    }))
}

// Example sentences for one already-known word — literal headword lookup,
// exact=true, same pattern as kilang.ts's fetchMoeWordExamples.
export async function fetchIlrdfWordExamples(word: string): Promise<SentenceRow[]> {
  const rows = await ilrdfFetch(word, true)
  const seen = new Map<string, SentenceRow>()
  for (const row of rows) {
    for (const ex of parseIlrdfExamples(row, row.dialect_name)) {
      if (!seen.has(ex.id)) seen.set(ex.id, ex)
    }
  }
  return Array.from(seen.values())
}
