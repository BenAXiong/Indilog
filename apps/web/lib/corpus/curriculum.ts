import { getDb } from './db'

export type CurriculumRow = {
  ab: string
  zh: string
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

function repairAudioUrl(url: string | null, source: string, uuid: string): string | null {
  if (!url || !url.includes('klokah.tw')) return url
  let fixed = url
    .replace('file.klokah.tw', 'web.klokah.tw')
    .replace('http://', 'https://')
  if ((source === 'essay' || source === 'dialogue') && !fixed.includes('/text/')) {
    const parts = uuid.split('_')
    const contextId = parts.length >= 3 ? parts[parts.length - 2] : null
    const soundMatch = fixed.match(/\/sound\/(\d+)\.mp3/)
    if (contextId && /^\d+$/.test(contextId) && soundMatch?.[1]) {
      return `https://web.klokah.tw/text/sound/${contextId}/${soundMatch[1]}.mp3`
    }
  }
  return fixed
}

function repair(rows: CurriculumRow[], source: string): CurriculumRow[] {
  return rows.map(r => ({ ...r, audio_url: repairAudioUrl(r.audio_url, source, r.original_uuid) }))
}

export function queryTwelve(dialect: string, category: string): CurriculumRow[] {
  const rows = getDb().prepare(`
    SELECT s.ab, s.zh, o.audio_url, o.original_uuid, o.category
    FROM sentences s
    JOIN occurrences o ON s.id = o.sentence_id
    WHERE o.dialect_name = ? AND o.source = 'twelve' AND o.category = ?
    ORDER BY o.original_uuid ASC
  `).all(dialect, category) as CurriculumRow[]
  return repair(rows, 'twelve')
}

export function queryGrmpts(dialect: string, patternId: string, level: string): CurriculumRow[] {
  const rows = getDb().prepare(`
    SELECT s.ab, s.zh, o.audio_url, o.original_uuid, o.category
    FROM sentences s
    JOIN occurrences o ON s.id = o.sentence_id
    WHERE o.dialect_name = ? AND o.source = 'grmpts' AND o.category = ? AND o.level = ?
    ORDER BY o.original_uuid ASC
  `).all(dialect, patternId, level) as CurriculumRow[]
  return repair(rows, 'grmpts')
}

export function queryEssayOrDialogue(
  source: 'essay' | 'dialogue' | 'con_practice',
  dialect: string,
  category: string,
): CurriculumRow[] {
  const rows = getDb().prepare(`
    SELECT s.ab, s.zh, o.audio_url, o.original_uuid, o.category
    FROM sentences s
    JOIN occurrences o ON s.id = o.sentence_id
    WHERE o.dialect_name = ? AND o.source = ? AND o.category = ?
    ORDER BY CAST(SUBSTR(o.original_uuid, INSTR(o.original_uuid, '_') + 1) AS INTEGER) ASC
  `).all(dialect, source, category) as CurriculumRow[]
  return repair(rows, source)
}

export function lookupWord(cleanedToken: string): LookupRow[] {
  return getDb().prepare(`
    SELECT word_ab, word_ch, dialect_name, source AS vocab_source
    FROM ilrdf_vocabulary
    WHERE LOWER(word_ab) = ?
    LIMIT 6
  `).all(cleanedToken) as LookupRow[]
}
