import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const ILRDF_MT_BASE = process.env.ILRDF_MT_URL ?? 'https://ithuan-formosan-translation.hf.space'
const TIMEOUT_MS = 12000

async function tryFetch(url: string): Promise<{ ok: boolean; status: number; data?: unknown; error?: string }> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (!res.ok) return { ok: false, status: res.status, error: `HTTP ${res.status}` }
    const data = await res.json().catch(() => null)
    return { ok: true, status: res.status, data }
  } catch (e) {
    return { ok: false, status: 0, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

async function tryPredict(text: string, src: string, tgt: string): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    const res = await fetch(`${ILRDF_MT_BASE}/api/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [text, src, tgt], fn_index: 0 }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    return { ok: true, data: await res.json().catch(() => null) }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// Phase 0: endpoint discovery + Phase 1: one test call
export async function GET() {
  const results: Record<string, unknown> = { base: ILRDF_MT_BASE }

  // Phase 0a: /info
  results.info = await tryFetch(`${ILRDF_MT_BASE}/info`)

  // Phase 0b: Gradio OpenAPI
  results.openapi = await tryFetch(`${ILRDF_MT_BASE}/gradio_api/openapi.json`)

  // Phase 0c: bare root
  results.root = await tryFetch(`${ILRDF_MT_BASE}/`)

  // Phase 1: attempt a predict call if info endpoint responded
  const infoResult = results.info as { ok: boolean }
  if (infoResult.ok) {
    results.predict_test = await tryPredict('你好', 'zho_Hant', 'ami_Latn')
  } else {
    results.predict_test = { skipped: 'info endpoint unavailable' }
  }

  return NextResponse.json(results, { status: 200 })
}
