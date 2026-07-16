import { getCorpusClient } from './db'
import { GLID_NAMES_EN } from '@/lib/lang/dialects'

export type WordRow = {
  id: string
  word_ab: string
  word_ch: string
  dialect_name: string
  glid: string
  exact: boolean
  source?: 'epark' | 'moe'
  // Kilang/MoE only — which mechanism found this row when it wasn't a literal
  // headword match. See docs/kilang-moe-api.md + apps/web/app/api/dict/search/route.ts.
  moeMatch?: 'contains' | 'similar' | 'altSpelling'
  // Whether this word has any example sentences at all — lets the dict tab hide
  // the expand chevron instead of showing it for every card regardless. `undefined`
  // (not queried, e.g. searchWordsByCandidates) is treated as "unknown, show it"
  // by callers, not as false.
  hasExamples?: boolean
}

export type SentenceRow = {
  id: string
  ab: string
  zh: string
  dialect_name: string
  source: string
  audio_url: string | null
  // AB-direction only — whether the query appears as a standalone word in `ab`
  // (vs. only as part of a longer derived word). See route.ts's isWordBoundaryMatch.
  sentMatch?: 'exact' | 'extended'
}

export type DialectRow = {
  glid: string
  group_name: string
  sub_dialects: string
}

// Apostrophe variants used in Formosan romanizations — treated as word-forming
// characters (not boundaries), since e.g. "si" and "si’" are distinct words.
export const FORMOSAN_APOSTROPHES = '\u2018\u2019\u02BC\uA78C'
const WORD_CHAR = `a-zA-Z'${FORMOSAN_APOSTROPHES}`

// Does `query` appear in `text` as a standalone word (vs. only as part of a
// longer word, e.g. "misalama" inside "misalamaay")? Mirrors the Postgres
// `imatch` boundary pattern used server-side in searchSentences below.
export function isWordBoundaryMatch(text: string, query: string): boolean {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(^|[^${WORD_CHAR}])${escaped}($|[^${WORD_CHAR}])`, 'i')
  return re.test(text)
}

export async function searchWords(
  q: string,
  glid?: string,
  dialect?: string,
  fuzzy = false,
): Promise<WordRow[]> {
  const db = getCorpusClient()

  let query = db
    .from('corpus_vocabulary')
    .select('id, word_ab, word_ch, dialect_name, glid, has_examples')
    .limit(200)

  const hasCJK = /[㐀-鿿]/.test(q)
  if (hasCJK) {
    query = query.ilike('word_ch', `%${q}%`)
  } else if (q.length < 3) {
    // pg_trgm can't use the GIN index for prefix patterns under 3 chars — a 2-char
    // prefix (e.g. "ma%") falls back to a seq scan and returns tens of thousands of
    // rows. Exact match stays index-backed (idx_cv_ab_trgm) and answers the actually
    // useful question for short input: "does this word exist (in this language)?"
    query = query.ilike('word_ab', q)
  } else {
    // Contains-anywhere regardless of the fuzzy toggle — matches Kilang's own
    // base tier (DEC-D03): "icep" should surface "micepo" the same way in both
    // sources. `fuzzy` no longer distinguishes prefix vs contains for word
    // matching; it still matters for searchSentences below.
    query = query.ilike('word_ab', `%${q}%`)
  }

  if (glid)    query = query.eq('glid', glid)
  if (dialect) query = query.eq('dialect_name', dialect)

  const { data, error } = await query
  if (error || !data) return []

  const qLower = q.toLowerCase()
  return (data as any[]).map(row => ({
    id:           row.id,
    word_ab:      row.word_ab,
    word_ch:      row.word_ch ?? '',
    dialect_name: row.dialect_name ?? '',
    glid:         row.glid ?? '',
    exact:        hasCJK ? (row.word_ch ?? '') === q : row.word_ab.toLowerCase() === qLower,
    hasExamples:  row.has_examples ?? false,
  })).sort((a, b) => (b.exact ? 1 : 0) - (a.exact ? 1 : 0) || a.word_ab.length - b.word_ab.length)
}

// "Swaps" toggle (Amis only) — look up specific curated candidate spellings
// (see lib/lang/amis-fuzzy.ts) directly, instead of a blind substring search.
// `_` (SQL single-char wildcard) stands in for the apostrophe position so a
// straight-quote candidate still matches ePark rows using the curly variants
// (both forms coexist in the corpus, e.g. "'icep" and "’icep").
export async function searchWordsByCandidates(candidates: string[], glid: string, dialect?: string): Promise<WordRow[]> {
  if (candidates.length === 0) return []
  const db = getCorpusClient()
  const patterns = candidates.map(c => c.replaceAll("'", '_'))
  const orFilter = patterns.map(p => `word_ab.ilike.${p}`).join(',')
  let query = db
    .from('corpus_vocabulary')
    .select('id, word_ab, word_ch, dialect_name, glid')
    .eq('glid', glid)
    .or(orFilter)
    .limit(200)
  if (dialect) query = query.eq('dialect_name', dialect)
  const { data, error } = await query
  if (error || !data) return []
  return (data as any[]).map(row => ({
    id:           row.id,
    word_ab:      row.word_ab,
    word_ch:      row.word_ch ?? '',
    dialect_name: row.dialect_name ?? '',
    glid:         row.glid ?? '',
    exact:        false,
    source:       'epark' as const,
    moeMatch:     'altSpelling' as const,
  }))
}

export async function searchSentences(
  q: string,
  glid?: string,
  dialect?: string,
  fuzzy = false,
): Promise<SentenceRow[]> {
  const db = getCorpusClient()

  // Step 1: find matching sentences by ab text
  let sentQuery = db
    .from('corpus_sentences')
    .select('id, ab, zh, glid')
    .limit(300)

  const hasCJK = /[㐀-鿿]/.test(q)
  if (hasCJK) {
    sentQuery = sentQuery.ilike('zh', `%${q}%`)
  } else if (fuzzy) {
    sentQuery = sentQuery.ilike('ab', `%${q}%`)
  } else {
    // Non-fuzzy: match q as a standalone word anywhere in the sentence, not
    // just where the sentence happens to start — the old `${q}%` prefix
    // missed every mid-sentence occurrence (e.g. "hreq" only matched
    // sentences literally starting with "hreq", missing "kiya hreq na
    // waw..." entirely). Verified this stays index-backed (idx_cs_ab_trgm)
    // for ordinary word lengths too, not just short queries — Postgres's
    // trigram index only falls back to a seq scan when the literal pattern
    // text is under 3 chars, which only bites when q itself is 1-2 chars.
    //
    // Postgres's \m/\M treat the apostrophe as a boundary character, but in
    // these romanizations it's a real glottal-stop consonant — e.g. corpus
    // has both "si" (function word, several meanings) and "si\u2019" (a
    // Wenshui-Atayal word meaning "you") as distinct entries. \m/\M would
    // match "si\u2019" as if it were plain "si". Build the boundary
    // ourselves, treating apostrophe variants as word-forming characters.
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const apos = '\u2018\u2019\u02BC\uA78C' // apostrophe variants used in Formosan romanizations
    const wordChar = `a-zA-Z'${apos}`
    sentQuery = sentQuery.filter('ab', 'imatch', `(^|[^${wordChar}])${escaped}($|[^${wordChar}])`)
  }

  if (glid) sentQuery = sentQuery.eq('glid', glid)

  const { data: sents, error: sErr } = await sentQuery
  if (sErr || !sents || sents.length === 0) return []

  const sentIds = (sents as any[]).map(s => s.id)
  const sentMap = new Map((sents as any[]).map(s => [s.id, s]))

  // Step 2: fetch one occurrence per sentence (prefer entry with audio_url)
  let occQuery = db
    .from('corpus_occurrences')
    .select('sentence_id, dialect_name, source, audio_url')
    .in('sentence_id', sentIds)
    .order('source', { ascending: true })
    .limit(500)

  if (dialect) occQuery = occQuery.eq('dialect_name', dialect)

  const { data: occs, error: oErr } = await occQuery
  if (oErr || !occs) return []

  // Deduplicate by sentence_id, prefer entry with audio_url
  const seen = new Map<string, SentenceRow>()
  for (const occ of occs as any[]) {
    const sent = sentMap.get(occ.sentence_id)
    if (!sent) continue
    const existing = seen.get(occ.sentence_id)
    if (!existing || (!existing.audio_url && occ.audio_url)) {
      seen.set(occ.sentence_id, {
        id:           occ.sentence_id,
        ab:           sent.ab,
        zh:           sent.zh ?? '',
        dialect_name: occ.dialect_name ?? '',
        source:       occ.source ?? '',
        audio_url:    occ.audio_url ?? null,
      })
    }
  }

  return Array.from(seen.values())
}

export async function listDialects(): Promise<DialectRow[]> {
  const db = getCorpusClient()
  const { data } = await db
    .from('corpus_vocabulary')
    .select('glid, dialect_name')
    .not('glid', 'is', null)
    .order('glid')
    .limit(1000)

  if (!data) return []

  const groups = new Map<string, string[]>()
  for (const row of data as any[]) {
    if (!groups.has(row.glid)) groups.set(row.glid, [])
    const arr = groups.get(row.glid)!
    if (!arr.includes(row.dialect_name)) arr.push(row.dialect_name)
  }

  return Array.from(groups.entries()).map(([glid, dialects]) => ({
    glid,
    group_name:   GLID_NAMES_EN[glid] ?? glid,
    sub_dialects: dialects.join(', '),
  }))
}
