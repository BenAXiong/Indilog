import { NextRequest, NextResponse } from 'next/server'
import { searchWords, searchSentences, type SentenceRow } from '@/lib/dict/client'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q       = searchParams.get('q')?.trim() ?? ''
  const glid    = searchParams.get('glid')    ?? undefined
  const dialect = searchParams.get('dialect') ?? undefined

  if (!q || q.length < 1) {
    return NextResponse.json({ words: [], sentences: [] })
  }

  try {
    const words = searchWords(q, glid, dialect)
    const rawSentences = searchSentences(q, glid, dialect)

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
