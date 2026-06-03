import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const TIMEOUT_MS = 20000
const MAX_CHARS  = 400

export async function POST(request: Request) {
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { text, language } = body as { text?: string; language?: string }
  if (!text?.trim() || text.trim().length > MAX_CHARS) {
    return NextResponse.json({ error: 'Invalid or too-long text.' }, { status: 400 })
  }

  // Try ILRDF TTS first if configured
  const ilrdfTts = process.env.ILRDF_TTS_URL
  if (ilrdfTts) {
    try {
      const res = await fetch(`${ilrdfTts}/api/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [text.trim(), language ?? ''], fn_index: 0 }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (res.ok) {
        const json = await res.json()
        // Gradio TTS typically returns { data: [{ name, url }] } or base64 audio
        const audioUrl = json?.data?.[0]?.url ?? json?.data?.[0] ?? null
        if (audioUrl) return NextResponse.json({ url: audioUrl })
      }
    } catch { /* fall through */ }
  }

  // Try inference server TTS
  const inferenceUrl = process.env.INFERENCE_API_URL
  if (inferenceUrl) {
    try {
      const res = await fetch(new URL('/tts', inferenceUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.INFERENCE_API_KEY ? { Authorization: `Bearer ${process.env.INFERENCE_API_KEY}` } : {}),
        },
        body: JSON.stringify({ text: text.trim(), language }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (res.ok) {
        const json = await res.json()
        if (json?.url) return NextResponse.json({ url: json.url })
      }
    } catch { /* fall through */ }
  }

  return NextResponse.json({ error: 'TTS service unavailable.' }, { status: 503 })
}
