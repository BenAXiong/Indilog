import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import geoRaw from '@/lib/learn/corpus_geometry.json'
import labelsRaw from '@/lib/learn/grmpts_type_labels.json'
import { getGlid } from '@/lib/lang/lang-bridge'
import { GRMPTS_LEVEL_NAMES, stageName, lessonDifficultyOf } from '@/lib/lang/dialects'

type GeoType = {
  twelve: {
    levels: string[]
    classes: number[]
  }
  grmpts: {
    levels: string[]
    counts: Record<string, Record<string, Record<string, number>>>
  }
  essay:        Array<{ index: number; title_zh: string; alignment: Record<string, string> }>
  dialogue:     Array<{ index: number; title_zh: string; alignment: Record<string, string> }>
  con_practice: Array<{ index: number; title_zh: string; alignment: Record<string, string> }>
}

const geo = geoRaw as unknown as GeoType

const rawLabels = labelsRaw as Record<string, string>
const cleanLabels: Record<string, string> = {}
for (const [k, v] of Object.entries(rawLabels)) {
  cleanLabels[k] = v.replace(/^\d+\s*-\s*/, '')
}

function numSort(a: string, b: string) {
  return Number.parseInt(a.slice(1)) - Number.parseInt(b.slice(1))
}

export type CurriculumProgressItem = {
  completed: number
  total:     number
  nextLabel: string
}

export type CurriculumProgressResponse = {
  lessons:       CurriculumProgressItem
  patterns:      CurriculumProgressItem
  essays:        CurriculumProgressItem
  dialogues:     CurriculumProgressItem
  conversations: CurriculumProgressItem
}

const EMPTY: CurriculumProgressItem = { completed: 0, total: 0, nextLabel: '' }

export async function GET(req: NextRequest) {
  const p       = req.nextUrl.searchParams
  const lang    = p.get('lang') ?? ''
  const dialect = p.get('dialect') ?? null

  if (!lang) return NextResponse.json({ error: 'missing lang' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })

  const { data: rows } = await supabase
    .from('ind_completions')
    .select('source, item_key')
    .eq('user_id', user.id)
    .eq('language', lang)
    .in('source', ['twelve', 'grmpts', 'essay', 'dialogue', 'con_practice'])

  const bySource: Record<string, Set<string>> = {
    twelve: new Set(), grmpts: new Set(), essay: new Set(), dialogue: new Set(), con_practice: new Set(),
  }
  for (const row of rows ?? []) {
    bySource[row.source]?.add(row.item_key)
  }

  const glid = getGlid(lang) ?? '01'

  // ── Twelve (Lessons) ────────────────────────────────────────────────────────
  const tc = bySource.twelve
  type TwelveItem = { lv: string; cl: number; key: string }
  const twelveItems: TwelveItem[] = []
  for (const lv of geo.twelve.levels) {
    for (const cl of geo.twelve.classes) {
      twelveItems.push({ lv, cl, key: `Level ${lv} Lesson ${cl}` })
    }
  }
  const twelveNext = twelveItems.find(i => !tc.has(i.key))
  const lessons: CurriculumProgressItem = {
    completed: twelveItems.filter(i => tc.has(i.key)).length,
    total:     twelveItems.length,
    nextLabel: twelveNext
      ? `${lessonDifficultyOf(twelveNext.lv)} · ${stageName(twelveNext.lv)} · ${twelveNext.cl}`
      : '',
  }

  // ── Grmpts (Patterns) ───────────────────────────────────────────────────────
  const gc = bySource.grmpts
  const glCounts = geo.grmpts.counts[glid] ?? {}
  type GItem = { lv: string; pt: string; key: string }
  const grmptsItems: GItem[] = []
  for (const lv of geo.grmpts.levels) {
    for (const pt of Object.keys(glCounts[lv] ?? {}).sort(numSort)) {
      grmptsItems.push({ lv, pt, key: `${lv}::${pt}` })
    }
  }
  const grmptsNext = grmptsItems.find(i => !gc.has(i.key))
  const patterns: CurriculumProgressItem = {
    completed: grmptsItems.filter(i => gc.has(i.key)).length,
    total:     grmptsItems.length,
    nextLabel: grmptsNext
      ? `${GRMPTS_LEVEL_NAMES[grmptsNext.lv] ?? grmptsNext.lv} · ${parseInt(grmptsNext.pt.slice(1))} ${cleanLabels[grmptsNext.pt] ?? grmptsNext.pt}`
      : '',
  }

  // ── Text sources (Essays / Dialogs / Conversations) ─────────────────────────
  function textProgress(
    source: 'essay' | 'dialogue' | 'con_practice',
    done: Set<string>,
  ): CurriculumProgressItem {
    const items = geo[source]
    // Filter by dialect; fall back to all items if dialect doesn't match anything
    const filtered = dialect ? items.filter(i => dialect in i.alignment) : items
    const all = filtered.length > 0 ? filtered : items
    if (!all.length) return EMPTY
    const next = all.find(i => !done.has(i.title_zh))
    return {
      completed: all.filter(i => done.has(i.title_zh)).length,
      total:     all.length,
      nextLabel: next
        ? `${next.index + 1} · ${next.title_zh.length > 6 ? next.title_zh.slice(0, 5) + '…' : next.title_zh}`
        : '',
    }
  }

  const result: CurriculumProgressResponse = {
    lessons,
    patterns,
    essays:        textProgress('essay',        bySource.essay),
    dialogues:     textProgress('dialogue',     bySource.dialogue),
    conversations: textProgress('con_practice', bySource.con_practice),
  }

  return NextResponse.json(result)
}
