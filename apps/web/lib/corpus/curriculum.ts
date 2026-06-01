import { getCorpusClient } from './db'

export type CurriculumRow = {
  ab: string
  zh: string | null
  audio_url: string | null
  original_uuid: string
  category: string
}

export type LookupRow = {
  word_ab: string
  word_ch: string
  dialect_name: string
  vocab_source: string
}

function repairAudioUrl(url: string | null): string | null {
  if (!url) return null
  return url.replace('file.klokah.tw', 'web.klokah.tw').replace('http://', 'https://')
}

async function queryBySourceDialectCategory(
  source: string,
  dialect: string,
  category: string,
): Promise<CurriculumRow[]> {
  const db = getCorpusClient()

  const { data, error } = await db
    .from('corpus_occurrences')
    .select('audio_url, original_uuid, category, position, corpus_sentences!inner(ab, zh)')
    .eq('source', source)
    .eq('dialect_name', dialect)
    .eq('category', category)
    .order('position', { ascending: true })
    .limit(500)

  if (error || !data) return []

  return (data as any[]).map(row => ({
    ab:            row.corpus_sentences.ab,
    zh:            row.corpus_sentences.zh ?? null,
    audio_url:     repairAudioUrl(row.audio_url),
    original_uuid: row.original_uuid,
    category:      row.category,
  }))
}

export async function queryTwelve(dialect: string, category: string): Promise<CurriculumRow[]> {
  return queryBySourceDialectCategory('twelve', dialect, category)
}

export async function queryGrmpts(dialect: string, patternId: string, level: string): Promise<CurriculumRow[]> {
  const db = getCorpusClient()

  const { data, error } = await db
    .from('corpus_occurrences')
    .select('audio_url, original_uuid, category, position, corpus_sentences!inner(ab, zh)')
    .eq('source', 'grmpts')
    .eq('dialect_name', dialect)
    .eq('category', patternId)
    .eq('level', level)
    .order('position', { ascending: true })
    .limit(500)

  if (error || !data) return []

  return (data as any[]).map(row => ({
    ab:            row.corpus_sentences.ab,
    zh:            row.corpus_sentences.zh ?? null,
    audio_url:     repairAudioUrl(row.audio_url),
    original_uuid: row.original_uuid,
    category:      row.category,
  }))
}

export async function queryEssayOrDialogue(
  source: 'essay' | 'dialogue' | 'con_practice',
  dialect: string,
  category: string,
): Promise<CurriculumRow[]> {
  return queryBySourceDialectCategory(source, dialect, category)
}

export async function lookupWord(cleanedToken: string): Promise<LookupRow[]> {
  const db = getCorpusClient()

  const { data, error } = await db
    .from('corpus_vocabulary')
    .select('word_ab, word_ch, dialect_name, source')
    .ilike('word_ab', cleanedToken)
    .limit(6)

  if (error || !data) return []

  return (data as any[]).map(row => ({
    word_ab:      row.word_ab,
    word_ch:      row.word_ch ?? '',
    dialect_name: row.dialect_name ?? '',
    vocab_source: row.source ?? '',
  }))
}
