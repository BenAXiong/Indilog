import { NextRequest, NextResponse } from 'next/server'
import { lookupWord } from '@/lib/corpus/curriculum'

export const runtime = 'nodejs'

function cleanToken(token: string): string {
  return token.replace(/^[^a-zA-ZÀ-ſ']+|[^a-zA-ZÀ-ſ']+$/g, '').toLowerCase()
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('word')?.trim() ?? ''
  const word = cleanToken(raw)
  if (!word) return NextResponse.json({ results: [] })

  try {
    return NextResponse.json({ results: await lookupWord(word) })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'lookup error'
    return NextResponse.json({ error: msg, results: [] }, { status: 500 })
  }
}
