import { NextRequest, NextResponse } from 'next/server'
import geometryData from '@/lib/learn/corpus_geometry.json'
import { queryTwelve, queryGrmpts, queryEssayOrDialogue } from '@/lib/corpus/curriculum'

export const runtime = 'nodejs'

type AlignedEntry = { index: number; title_zh: string; alignment: Record<string, string> }

export async function GET(req: NextRequest) {
  const p        = req.nextUrl.searchParams
  const dialect  = p.get('dialect')?.trim() ?? ''
  const source   = p.get('source')?.trim()  ?? ''
  const titleZh  = p.get('title_zh')?.trim() ?? ''
  const level    = p.get('level')?.trim()   ?? '1'
  const indexRaw = p.get('index')?.trim()   ?? ''

  const isIndexed = source === 'essay' || source === 'dialogue' || source === 'con_practice'

  if (!dialect || !source) {
    return NextResponse.json({ error: 'Missing required params', results: [] }, { status: 400 })
  }
  if (isIndexed && !indexRaw) {
    return NextResponse.json({ error: 'Missing index param', results: [] }, { status: 400 })
  }
  if (!isIndexed && !titleZh) {
    return NextResponse.json({ error: 'Missing title_zh param', results: [] }, { status: 400 })
  }

  try {
    if (source === 'twelve') {
      return NextResponse.json({ results: queryTwelve(dialect, titleZh) })
    }

    if (source === 'grmpts') {
      return NextResponse.json({ results: queryGrmpts(dialect, titleZh, level) })
    }

    if (isIndexed) {
      const idx   = Number.parseInt(indexRaw, 10)
      const items = ((geometryData as unknown) as Record<string, AlignedEntry[]>)[source] ?? []
      const entry = items.find(e => e.index === idx)
      const category = entry?.alignment?.[dialect]
      if (!category) return NextResponse.json({ results: [] })
      return NextResponse.json({ results: queryEssayOrDialogue(source, dialect, category) })
    }

    return NextResponse.json({ error: 'Unknown source', results: [] }, { status: 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'curriculum error'
    return NextResponse.json({ error: msg, results: [] }, { status: 500 })
  }
}
