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
}

export type SentenceRow = {
  id: string
  ab: string
  zh: string
  dialect_name: string
  source: string
  audio_url: string | null
}

export type DialectRow = {
  glid: string
  group_name: string
  sub_dialects: string
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
    .select('id, word_ab, word_ch, dialect_name, glid')
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
    query = query.ilike('word_ab', fuzzy ? `%${q}%` : `${q}%`)
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
  })).sort((a, b) => (b.exact ? 1 : 0) - (a.exact ? 1 : 0) || a.word_ab.length - b.word_ab.length)
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
