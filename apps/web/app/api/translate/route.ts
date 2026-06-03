import { NextResponse } from 'next/server'
import { z } from 'zod'

export const runtime = 'nodejs'

// ── ILRDF MT — ai-labs.ilrdf.org.tw Gradio 5 ─────────────────────────────────
// Endpoints: /gradio_api/call/translate  (Formosan→zh)
//            /gradio_api/call/translate_1 (zh→Formosan)
// Language codes are dialect-level: ami_Coas|Heng|Mala|Sout|Xiug
// Only Amis supported by ILRDF for now; other languages fall back to Modal.run
const ILRDF_MT_BASE = process.env.ILRDF_MT_URL ?? ''

// Map our NLLB dialect names (Chinese) to ILRDF dialect codes
const DIALECT_TO_ILRDF: Record<string, string> = {
  '海岸阿美語': 'ami_Coas',
  '恆春阿美語': 'ami_Heng',
  '馬蘭阿美語': 'ami_Mala',
  '南部阿美語': 'ami_Sout',
  '秀姑巒阿美語': 'ami_Xiug',
}

// ── FormosanBank / Modal.run fallback ─────────────────────────────────────────
const MODEL_ID                = 'FormosanBank/nllb200-formosan-zh'
const FORMOSAN_TO_ZH_MODEL_ID = 'FormosanBank/nllb200-formosan-zh-spm8k'
const ZH_TO_FORMOSAN_MODEL_ID = 'FormosanBank/nllb200-zh-formosan-spm8k'

const MAX_INPUT_CHARS         = 800
const MAX_NEW_TOKENS          = 160
const MAX_TRANSLATE_BODY_BYTES = 4096
const INFERENCE_TIMEOUT_MS    = 45000

const supportedPairs = [
  ['ami_Latn', 'zho_Hant'],
  ['zho_Hant', 'ami_Latn'],
  ['tay_Latn', 'zho_Hant'],
  ['zho_Hant', 'tay_Latn'],
  ['bnn_Latn', 'zho_Hant'],
  ['zho_Hant', 'bnn_Latn'],
  ['pyu_Latn', 'zho_Hant'],
  ['zho_Hant', 'pyu_Latn'],
  ['pwn_Latn', 'zho_Hant'],
  ['zho_Hant', 'pwn_Latn'],
  ['dru_Latn', 'zho_Hant'],
  ['zho_Hant', 'dru_Latn'],
] as const

const translateRequestSchema = z
  .object({
    text:         z.string().trim().min(1, 'Enter text to translate.').max(MAX_INPUT_CHARS, `Please keep input under ${MAX_INPUT_CHARS} characters.`),
    sourceLang:   z.string(),
    targetLang:   z.string(),
    dialect:      z.string().optional(), // user's current dialect (Chinese name) for ILRDF code mapping
    maxNewTokens: z.number().int().positive().max(MAX_NEW_TOKENS).optional(),
  })
  .refine(
    p => supportedPairs.some(([s, t]) => s === p.sourceLang && t === p.targetLang),
    { message: 'Unsupported translation direction.', path: ['targetLang'] }
  )

const translateResponseSchema = z.object({
  translation:  z.string(),
  sourceLang:   z.string(),
  targetLang:   z.string(),
  modelId:      z.string().default(MODEL_ID),
  modelVersion: z.string().nullable(),
  latencyMs:    z.number().nonnegative(),
})

type TranslateRequest  = z.infer<typeof translateRequestSchema>
type TranslateResponse = z.infer<typeof translateResponseSchema>

function getRuntimeModelId(sourceLang: string, targetLang: string): string {
  if (targetLang === 'zho_Hant') return FORMOSAN_TO_ZH_MODEL_ID
  if (sourceLang === 'zho_Hant') return ZH_TO_FORMOSAN_MODEL_ID
  return MODEL_ID
}

function createMockTranslation(payload: TranslateRequest, latencyMs: number): TranslateResponse {
  const mockOutput = payload.sourceLang === 'zho_Hant'
    ? 'Sa ko local mock translation. Ira ko real model inference i kalas no service setup.'
    : '這是本地模擬翻譯。實際模型推論請在設定完成後再來。'
  return {
    translation:  `${mockOutput}\n\n[${payload.sourceLang} -> ${payload.targetLang}] ${payload.text}`,
    sourceLang:   payload.sourceLang,
    targetLang:   payload.targetLang,
    modelId:      getRuntimeModelId(payload.sourceLang, payload.targetLang),
    modelVersion: 'local-mock',
    latencyMs,
  }
}

// Gradio 5 SSE: POST to get event_id, then GET to stream result
async function gradioCall(base: string, fn: string, data: unknown[], signal: AbortSignal): Promise<string | null> {
  // Step 1: submit
  const submitRes = await fetch(`${base}/gradio_api/call/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
    signal,
  })
  if (!submitRes.ok) return null
  const { event_id } = await submitRes.json() as { event_id?: string }
  if (!event_id) return null

  // Step 2: stream result
  const streamRes = await fetch(`${base}/gradio_api/call/${fn}/${event_id}`, { signal })
  if (!streamRes.ok || !streamRes.body) return null

  const reader = streamRes.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    // Look for complete event
    if (buf.includes('event: complete')) {
      const dataLine = buf.split('\n').find(l => l.startsWith('data:') && buf.includes('event: complete'))
      if (dataLine) {
        try {
          const arr = JSON.parse(dataLine.slice(5).trim()) as string[]
          return arr[0] ?? null
        } catch { return null }
      }
    }
  }
  return null
}

async function requestIlrdf(payload: TranslateRequest): Promise<TranslateResponse | null> {
  if (!ILRDF_MT_BASE) return null

  // Only Amis ↔ Chinese supported by ILRDF
  const isAmiSrc = payload.sourceLang === 'ami_Latn'
  const isAmiTgt = payload.targetLang === 'ami_Latn'
  if (!isAmiSrc && !isAmiTgt) return null

  // Resolve dialect code — default to Coastal if no match
  const dialectCode = DIALECT_TO_ILRDF[payload.dialect ?? ''] ?? 'ami_Coas'

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), INFERENCE_TIMEOUT_MS)

  try {
    let translation: string | null
    if (isAmiSrc) {
      // Formosan → Chinese: /translate(text, src_lang, tgt_lang)
      translation = await gradioCall(ILRDF_MT_BASE, 'translate', [payload.text, dialectCode, 'zho_Hant'], controller.signal)
    } else {
      // Chinese → Formosan: /translate_1(text, src_lang, tgt_lang)
      translation = await gradioCall(ILRDF_MT_BASE, 'translate_1', [payload.text, 'zho_Hant', dialectCode], controller.signal)
    }
    if (!translation) return null
    return {
      translation,
      sourceLang:   payload.sourceLang,
      targetLang:   payload.targetLang,
      modelId:      `ilrdf/mt·${dialectCode}`,
      modelVersion: null,
      latencyMs:    0,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function requestInference(payload: TranslateRequest): Promise<TranslateResponse> {
  const inferenceApiUrl = process.env.INFERENCE_API_URL
  if (!inferenceApiUrl) throw new Error('Inference API is not configured.')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), INFERENCE_TIMEOUT_MS)

  try {
    const response = await fetch(new URL('/translate', inferenceApiUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.INFERENCE_API_KEY ? { Authorization: `Bearer ${process.env.INFERENCE_API_KEY}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Inference API returned ${response.status}.`)
    return translateResponseSchema.parse(await response.json())
  } finally {
    clearTimeout(timeout)
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now()
  const contentLength = request.headers.get('content-length')
  if (contentLength && Number(contentLength) > MAX_TRANSLATE_BODY_BYTES) {
    return NextResponse.json({ error: 'Translation request is too large. Please shorten the input.' }, { status: 413 })
  }

  let body: unknown
  try { body = await request.json() }
  catch { return NextResponse.json({ error: 'Invalid translation request.' }, { status: 400 }) }

  const parsed = translateRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid translation request.' }, { status: 400 })
  }

  // Try ILRDF first (Amis only; other languages fall through)
  if (ILRDF_MT_BASE) {
    const ilrdfResult = await requestIlrdf(parsed.data)
    if (ilrdfResult) {
      ilrdfResult.latencyMs = Date.now() - startedAt
      return NextResponse.json(ilrdfResult)
    }
  }

  if (!process.env.INFERENCE_API_URL) {
    return NextResponse.json(createMockTranslation(parsed.data, Date.now() - startedAt))
  }

  try {
    return NextResponse.json(await requestInference(parsed.data))
  } catch (error) {
    console.error('Translation request failed', { message: error instanceof Error ? error.message : 'Unknown inference error' })
    return NextResponse.json({ error: 'Translation service is unavailable right now.' }, { status: 502 })
  }
}
