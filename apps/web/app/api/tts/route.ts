import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const ILRDF_TTS_BASE = process.env.ILRDF_TTS_URL ?? ''
const TIMEOUT_MS     = 20000
const MAX_CHARS      = 300

// Map ILRDF MT dialect codes → TTS speaker names
const DIALECT_CODE_TO_SPEAKER: Record<string, string> = {
  'ami_Coas': '阿美_海岸_男聲',
  'ami_Heng': '阿美_恆春_女聲',
  'ami_Mala': '阿美_馬蘭_女聲',
  'ami_Sout': '阿美_南勢_女聲',
  'ami_Xiug': '阿美_秀姑巒_女聲1',
}
// Map Chinese dialect names (from ind_profiles.default_dialect) → TTS speaker names
const DIALECT_NAME_TO_SPEAKER: Record<string, string> = {
  '海岸阿美語': '阿美_海岸_男聲',
  '恆春阿美語': '阿美_恆春_女聲',
  '馬蘭阿美語': '阿美_馬蘭_女聲',
  '南部阿美語': '阿美_南勢_女聲',
  '秀姑巒阿美語': '阿美_秀姑巒_女聲1',
}

function resolvesSpeaker(dialectCode?: string, dialectName?: string): string {
  return DIALECT_CODE_TO_SPEAKER[dialectCode ?? '']
    ?? DIALECT_NAME_TO_SPEAKER[dialectName ?? '']
    ?? '阿美_海岸_男聲'
}

async function gradioFileCall(base: string, fn: string, data: unknown[]): Promise<string | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const submitRes = await fetch(`${base}/gradio_api/call/${fn}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data }),
      signal: controller.signal,
    })
    if (!submitRes.ok) return null
    const { event_id } = await submitRes.json() as { event_id?: string }
    if (!event_id) return null

    const streamRes = await fetch(`${base}/gradio_api/call/${fn}/${event_id}`, { signal: controller.signal })
    if (!streamRes.ok || !streamRes.body) return null

    const reader = streamRes.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''
    let result: string | null = null
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const match = /event:\s*complete[\r\n]+data:\s*(\[[\s\S]+?\])\s*$/.exec(buf)
        if (match) {
          const arr = JSON.parse(match[1]) as unknown[]
          const fileData = arr[0] as { url?: string | null }
          result = fileData?.url ?? null
          break
        }
      }
    } finally {
      reader.cancel().catch(() => { /* ignore — already cancelled or closed */ })
    }
    return result
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function POST(request: Request) {
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { text, dialectCode, dialectName } = body as { text?: string; dialectCode?: string; dialectName?: string }
  if (!text?.trim() || text.trim().length > MAX_CHARS) {
    return NextResponse.json({ error: 'Invalid or too-long text.' }, { status: 400 })
  }

  if (ILRDF_TTS_BASE) {
    const speaker = resolvesSpeaker(dialectCode, dialectName)
    const url = await gradioFileCall(ILRDF_TTS_BASE, 'default_speaker_tts', [speaker, text.trim()])
    if (url) return NextResponse.json({ url })
  }

  return NextResponse.json({ error: 'TTS service unavailable.' }, { status: 503 })
}
