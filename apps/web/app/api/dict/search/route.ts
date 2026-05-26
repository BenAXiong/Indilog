import { NextRequest, NextResponse } from 'next/server'
import { searchWords, searchSentences } from '@/lib/dict/client'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q    = searchParams.get('q')?.trim() ?? ''
  const glid = searchParams.get('glid') ?? undefined

  if (!q || q.length < 1) {
    return NextResponse.json({ words: [], sentences: [] })
  }

  try {
    const [words, sentences] = [
      searchWords(q, glid),
      searchSentences(q, glid),
    ]
    return NextResponse.json({ words, sentences })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'dict error'
    return NextResponse.json({ error: msg, words: [], sentences: [] }, { status: 500 })
  }
}
