import { NextRequest, NextResponse } from 'next/server'
import { searchWords, searchSentences, type SentenceRow, type WordRow } from '@/lib/corpus/dict'

export const runtime = 'nodejs'

const CITADEL_MOE = 'https://ycm-citadel.vercel.app/api/moe_shadow'
const AMIS_GLID   = '01'

type MoeRow = {
  word_ab: string
  definition: string
  dialect_name: string
  dict_code: string
}

// Module-level helpers keep fetchMoeWords simple enough to pass complexity checks
const normMoeAb  = (s: string) => s.replace(/\|+$/, '').trim()
const normMoeKey = (s: string) =>
  normMoeAb(s).toLowerCase().normalize('NFC').replace(/[‘’'ʼꞌ]/g, "'")
const stripAuthor = (s: string) =>
  (s ?? '阿美語').replace(/\s*\([^)]*\)\s*$/, '').trim() || '阿美語'

type MoeMerged = { word_ab: string; defs: string[]; dialect_name: string; exact: boolean }

function mergeMoeRow(merged: Map<string, MoeMerged>, row: MoeRow, qKey: string) {
  const ab = normMoeAb(row.word_ab)
  if (!ab) return
  const key     = normMoeKey(ab)
  const isExact = key === qKey
  const entry   = merged.get(key)
  if (entry) {
    if (row.definition && !entry.defs.includes(row.definition)) entry.defs.push(row.definition)
    if (isExact) entry.exact = true
  } else {
    merged.set(key, {
      word_ab: ab,
      defs: row.definition ? [row.definition] : [],
      dialect_name: stripAuthor(row.dialect_name),
      exact: isExact,
    })
  }
}

async function fetchMoeWords(q: string): Promise<WordRow[]> {
  try {
    const url = `${CITADEL_MOE}?keyword=${encodeURIComponent(q)}&exact=false&mode=moe`
    const res  = await fetch(url, { next: { revalidate: 60 } })
    if (!res.ok) return []
    const data: { rows?: MoeRow[] } = await res.json()
    const qKey   = normMoeKey(q)
    const merged = new Map<string, MoeMerged>()
    for (const row of data.rows ?? []) mergeMoeRow(merged, row, qKey)
    return Array.from(merged.values()).map((e, i) => ({
      id:           `moe-${i}`,
      word_ab:      e.word_ab,
      word_ch:      e.defs.join(' · '),
      dialect_name: e.dialect_name,
      glid:         AMIS_GLID,
      exact:        e.exact,
      source:       'moe' as const,
    }))
  } catch {
    return []
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q          = searchParams.get('q')?.trim() ?? ''
  const glid       = searchParams.get('glid')    ?? undefined
  const dialect    = searchParams.get('dialect') ?? undefined
  const fuzzy      = searchParams.get('fuzzy') === '1'
  const includeMoe = searchParams.get('moe')   === '1'

  const minLen = /[㐀-鿿]/.test(q) ? 1 : 3
  if (!q || q.length < minLen) {
    return NextResponse.json({ words: [], sentences: [] })
  }

  try {
    // Fetch ePark words, sentences, and (optionally) MoE in parallel
    const moeActive = includeMoe && (!glid || glid === AMIS_GLID)
    const [rawWords, rawSentences, moeWords] = await Promise.all([
      searchWords(q, glid, dialect, fuzzy),
      searchSentences(q, glid, dialect, fuzzy),
      moeActive ? fetchMoeWords(q) : Promise.resolve<WordRow[]>([]),
    ])

    // Dedup ePark words by (space-collapsed ab, dialect_name).
    // ILRDF corpus contains both "mafana'to" and "mafana' to" as separate entries;
    // keep the longest among duplicates — the spaced form is the correct romanisation.
    function normWordKey(ab: string): string {
      return ab.toLowerCase().normalize('NFC')
        .replace(/[‘’'ʼꞌ]/g, "'").replace(/\s+/g, '')
    }
    const wordMap = new Map<string, WordRow>()
    for (const w of rawWords) {
      const key      = `${normWordKey(w.word_ab)}|${w.dialect_name}`
      const existing = wordMap.get(key)
      if (!existing || w.word_ab.length > existing.word_ab.length) wordMap.set(key, w)
    }
    const eparkWords = Array.from(wordMap.values())

    // Merge ePark + MoE, exact matches first
    const words = [...eparkWords, ...moeWords]
      .sort((a, b) => (b.exact ? 1 : 0) - (a.exact ? 1 : 0) || a.word_ab.length - b.word_ab.length)

    // Deduplicate sentences by id — prefer entries with audio_url
    const sentenceMap = new Map<string, SentenceRow>()
    for (const s of rawSentences) {
      if (!sentenceMap.has(s.id) || (!sentenceMap.get(s.id)!.audio_url && s.audio_url)) {
        sentenceMap.set(s.id, s)
      }
    }
    const sentences = Array.from(sentenceMap.values())

    return NextResponse.json({ words, sentences })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'dict error'
    return NextResponse.json({ error: msg, words: [], sentences: [] }, { status: 500 })
  }
}
