import { NextRequest, NextResponse } from 'next/server'
import { searchWords, searchSentences, type SentenceRow } from '@/lib/corpus/dict'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q       = searchParams.get('q')?.trim() ?? ''
  const glid    = searchParams.get('glid')    ?? undefined
  const dialect = searchParams.get('dialect') ?? undefined
  const fuzzy   = searchParams.get('fuzzy') === '1'

  if (!q || q.length < 3) {
    return NextResponse.json({ words: [], sentences: [] })
  }

  try {
    const rawWords = searchWords(q, glid, dialect, fuzzy)

    // Dedup words by (space-collapsed ab, dialect_name).
    // ILRDF corpus contains both "mafana'to" and "mafana' to" as separate entries
    // (and similar spacing inconsistencies elsewhere). Keep the longest word_ab among
    // duplicates — the spaced form is always longer and is the correct romanisation.
    function normWordKey(ab: string): string {
      return ab.toLowerCase().normalize('NFC').replace(/['\u2018\u2019\u02BC\uA78C]/g, "'").replace(/\s+/g, '')
    }
    const wordMap = new Map<string, typeof rawWords[number]>()
    for (const w of rawWords) {
      const key = `${normWordKey(w.word_ab)}|${w.dialect_name}`
      const existing = wordMap.get(key)
      if (!existing || w.word_ab.length > existing.word_ab.length) wordMap.set(key, w)
    }
    const words = Array.from(wordMap.values())
      .sort((a, b) => (b.exact ? 1 : 0) - (a.exact ? 1 : 0) || a.word_ab.length - b.word_ab.length)

    const rawSentences = searchSentences(q, glid, dialect, fuzzy)

    // Deduplicate by sentence id — one sentence can have multiple occurrences
    // (different dialect recordings). Prefer entries with audio_url.
    const sentenceMap = new Map<number, SentenceRow>()
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
