// TEMPORARY — corpus connectivity diagnostic
import { getCorpusClient } from '@/lib/corpus/db'

export const runtime = 'nodejs'

export async function GET() {
  const db = getCorpusClient()

  const checks: Record<string, unknown> = {}

  try {
    const { count: sentCount } = await db
      .from('corpus_sentences')
      .select('*', { count: 'exact', head: true })
    checks.corpus_sentences = { ok: true, count: sentCount }
  } catch (e) {
    checks.corpus_sentences = { ok: false, error: String(e) }
  }

  try {
    const { count: occCount } = await db
      .from('corpus_occurrences')
      .select('*', { count: 'exact', head: true })
    checks.corpus_occurrences = { ok: true, count: occCount }
  } catch (e) {
    checks.corpus_occurrences = { ok: false, error: String(e) }
  }

  try {
    const { count: vocabCount } = await db
      .from('corpus_vocabulary')
      .select('*', { count: 'exact', head: true })
    checks.corpus_vocabulary = { ok: true, count: vocabCount }
  } catch (e) {
    checks.corpus_vocabulary = { ok: false, error: String(e) }
  }

  return Response.json(checks)
}
