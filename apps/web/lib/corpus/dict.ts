import { getCorpusClient } from './db'

export type WordRow = {
  id: string
  word_ab: string
  word_ch: string
  dialect_name: string
  glid: string
  exact: boolean
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

  if (fuzzy) {
    query = query.ilike('word_ab', `%${q}%`)
  } else {
    query = query.ilike('word_ab', `${q}%`)
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
    exact:        row.word_ab.toLowerCase() === qLower,
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

  sentQuery = fuzzy
    ? sentQuery.ilike('ab', `%${q}%`)
    : sentQuery.ilike('ab', `${q}%`)

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
    group_name:   glid,
    sub_dialects: dialects.join(', '),
  }))
}
