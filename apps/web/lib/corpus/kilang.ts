import type { SentenceRow } from './dict'

// Kilang/MoE shadow API client — external, undocumented upstream. See
// docs/kilang-moe-api.md for the param contract and response quirks, and
// apps/web/app/api/dict/search/route.ts for the fuller word-search consumer.
const CITADEL_MOE = 'https://ycm-citadel.vercel.app/api/moe_shadow'

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

export async function kilangFetch(keyword: string, exact: boolean): Promise<MoeRow[]> {
  const url = `${CITADEL_MOE}?keyword=${encodeURIComponent(keyword)}&exact=${exact}&mode=moe`
  const res = await fetch(url, { next: { revalidate: 60 } })
  if (!res.ok) return []
  const data: { rows?: MoeRow[] } = await res.json()
  return data.rows ?? []
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
