import { getDb } from './db'

export type WordRow = {
  id: number
  word_ab: string
  word_ch: string
  dialect_name: string
  glid: string
  exact: boolean
}

export type SentenceRow = {
  id: number
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

export function searchWords(q: string, glid?: string, dialect?: string, fuzzy = false): WordRow[] {
  const db = getDb()

  if (fuzzy) {
    const like = `%${q}%`
    const base = `
      SELECT v.id, v.word_ab, v.word_ch, v.dialect_name, v.glid,
             (LOWER(v.word_ab) = LOWER(?)) as exact
      FROM ilrdf_vocabulary v
      WHERE LOWER(v.word_ab) LIKE LOWER(?)
      ${glid    ? 'AND v.glid = ?'         : ''}
      ${dialect ? 'AND v.dialect_name = ?' : ''}
      ORDER BY exact DESC, LENGTH(v.word_ab) ASC
    `
    const params: (string | number)[] = [q, like]
    if (glid)    params.push(glid)
    if (dialect) params.push(dialect)
    return db.prepare(base).all(...params) as WordRow[]
  }

  const pattern = `"${q.replaceAll('"', '""')}"*`
  const base = `
    SELECT v.id, v.word_ab, v.word_ch, v.dialect_name, v.glid,
           (LOWER(v.word_ab) = LOWER(?)) as exact
    FROM ilrdf_vocabulary_fts f
    JOIN ilrdf_vocabulary v ON v.id = f.rowid
    WHERE f.ab MATCH ?
    ${glid    ? 'AND v.glid = ?'         : ''}
    ${dialect ? 'AND v.dialect_name = ?' : ''}
    ORDER BY exact DESC, LENGTH(v.word_ab) ASC
  `
  const params: (string | number)[] = [q, pattern]
  if (glid)    params.push(glid)
  if (dialect) params.push(dialect)
  return db.prepare(base).all(...params) as WordRow[]
}

export function searchSentences(q: string, glid?: string, dialect?: string, fuzzy = false): SentenceRow[] {
  const db = getDb()

  if (fuzzy) {
    const like = `%${q}%`
    const base = `
      SELECT s.id, s.ab, s.zh, o.dialect_name, o.source, o.audio_url
      FROM sentences s
      JOIN occurrences o ON o.sentence_id = s.id
      WHERE LOWER(s.ab) LIKE LOWER(?)
      ${glid    ? 'AND s.glid = ?'         : ''}
      ${dialect ? 'AND o.dialect_name = ?' : ''}
      ORDER BY o.source
    `
    const params: (string | number)[] = [like]
    if (glid)    params.push(glid)
    if (dialect) params.push(dialect)
    return db.prepare(base).all(...params) as SentenceRow[]
  }

  const pattern = `"${q.replaceAll('"', '""')}"*`
  const base = `
    SELECT s.id, s.ab, s.zh, o.dialect_name, o.source, o.audio_url
    FROM sentences_fts f
    JOIN sentences s ON s.id = f.rowid
    JOIN occurrences o ON o.sentence_id = s.id
    WHERE f.ab MATCH ?
    ${glid    ? 'AND s.glid = ?'         : ''}
    ${dialect ? 'AND o.dialect_name = ?' : ''}
    ORDER BY o.source
  `
  const params: (string | number)[] = [pattern]
  if (glid)    params.push(glid)
  if (dialect) params.push(dialect)
  return db.prepare(base).all(...params) as SentenceRow[]
}

export function listDialects(): DialectRow[] {
  return getDb().prepare('SELECT glid, group_name, sub_dialects FROM dialects ORDER BY glid').all() as DialectRow[]
}
