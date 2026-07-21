import { NextRequest, NextResponse } from 'next/server'
import { searchSentences, type SentenceRow } from '@/lib/corpus/dict'
import { fetchMoeWordExamples } from '@/lib/corpus/kilang'
import { fetchIlrdfWordExamples } from '@/lib/corpus/ilrdf'

// Kilang/MoE and ILRDF v2 only cover Amis — matches AMIS_GLID in
// apps/web/app/api/dict/search/route.ts.
const AMIS_GLID = '01'
const MAX_EXAMPLES = 5

// Example sentences for one already-known word — used by the dict tab's
// tap-to-expand word cards (plan-dict-v2.md Phase 4 base test), not a broad
// search, so results are capped small.
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const word          = searchParams.get('word')?.trim() ?? ''
  const glid          = searchParams.get('glid')    ?? undefined
  const dialect       = searchParams.get('dialect') ?? undefined
  // Must mirror the same source toggles as the main search (route.ts) —
  // a word found while ePark/Kilang/ILRDF is disabled shouldn't have that
  // source's sentences sneak back in just because the card got expanded.
  const includeMoe    = searchParams.get('moe')    === '1'
  const includeKlokah = searchParams.get('klokah') === '1'
  const includeYtd    = searchParams.get('ytd')    === '1'
  if (!word) return NextResponse.json({ sentences: [] })

  try {
    const [eparkSentences, moeSentences, ytdSentences] = await Promise.all([
      includeKlokah ? searchSentences(word, glid, dialect, false) : Promise.resolve([] as SentenceRow[]),
      (includeMoe && (!glid || glid === AMIS_GLID)) ? fetchMoeWordExamples(word) : Promise.resolve([] as SentenceRow[]),
      (includeYtd && (!glid || glid === AMIS_GLID)) ? fetchIlrdfWordExamples(word) : Promise.resolve([] as SentenceRow[]),
    ])

    const seen = new Map<string, SentenceRow>()
    for (const s of [...eparkSentences, ...moeSentences, ...ytdSentences]) {
      if (!seen.has(s.id)) seen.set(s.id, s)
    }

    return NextResponse.json({ sentences: Array.from(seen.values()).slice(0, MAX_EXAMPLES) })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'dict error'
    return NextResponse.json({ error: msg, sentences: [] }, { status: 500 })
  }
}
