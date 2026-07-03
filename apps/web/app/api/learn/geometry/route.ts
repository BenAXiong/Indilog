import { NextRequest, NextResponse } from 'next/server'
import rawGeo from '@/lib/learn/corpus_geometry.json'
import labels from '@/lib/learn/grmpts_type_labels.json'

export const runtime = 'nodejs'

type Geo = typeof rawGeo & {
  twelve: {
    levels: string[]
    classes: number[]
    titles: Record<string, Record<string, string>>
  }
  grmpts: {
    levels: string[]
    types: string[]
    counts: Record<string, Record<string, Record<string, number>>>
  }
  essay: Array<{ index: number; title_zh: string; alignment: Record<string, string> }>
  dialogue: Array<{ index: number; title_zh: string; alignment: Record<string, string> }>
  con_practice: Array<{ index: number; title_zh: string; title_ab: string; alignment: Record<string, string> }>
}

const geo = rawGeo as unknown as Geo

// Static bundled JSON, public — let the CDN cache it (perf S2); deploys purge the cache
const cached = (body: unknown) =>
  NextResponse.json(body, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } })

export async function GET(req: NextRequest) {
  const p      = req.nextUrl.searchParams
  const source = p.get('source') ?? ''
  const glid   = p.get('glid')   ?? ''
  const level  = p.get('level')  ?? ''
  const dialect = p.get('dialect') ?? ''

  if (source === 'twelve') {
    return cached({
      levels:  geo.twelve.levels,
      classes: geo.twelve.classes,
      titles:  geo.twelve.titles,
    })
  }

  if (source === 'grmpts') {
    if (!glid) return NextResponse.json({ error: 'missing glid' }, { status: 400 })
    const allCounts = geo.grmpts.counts[glid] ?? {}
    // Strip leading "N - " prefix from labels for display
    const cleanLabels: Record<string, string> = {}
    for (const [k, v] of Object.entries(labels as Record<string, string>)) {
      cleanLabels[k] = v.replace(/^\d+\s*-\s*/, '')
    }
    if (level) {
      return cached({
        patterns: Object.keys(allCounts[level] ?? {}).sort(),
        labels: cleanLabels,
      })
    }
    return cached({
      levels: geo.grmpts.levels,
      counts: allCounts,
      labels: cleanLabels,
    })
  }

  if (source === 'essay' || source === 'dialogue' || source === 'con_practice') {
    type Entry = { index: number; title_zh: string; alignment: Record<string, string> }
    const items = ((geo[source] ?? []) as Entry[]).map(e => ({
      index:    e.index,
      title_zh: e.title_zh,
      available: dialect ? dialect in e.alignment : true,
    }))
    return cached({ items })
  }

  return NextResponse.json({ error: 'unknown source' }, { status: 400 })
}
