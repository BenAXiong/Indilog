import { NextResponse } from 'next/server'
import { z } from 'zod'

export const runtime = 'nodejs'

// ── ILRDF Gradio endpoint (Phase 0/1 experimental) ───────────────────────────
// Set ILRDF_MT_URL in .env.local to enable. Falls back to inference server.
const ILRDF_MT_BASE = process.env.ILRDF_MT_URL ?? ''

// ── FormosanBank fallback ─────────────────────────────────────────────────────
const MODEL_ID = 'FormosanBank/nllb200-formosan-zh'
const FORMOSAN_TO_ZH_MODEL_ID = 'FormosanBank/nllb200-formosan-zh-spm8k'
const ZH_TO_FORMOSAN_MODEL_ID = 'FormosanBank/nllb200-zh-formosan-spm8k'

const MAX_INPUT_CHARS = 800
const MAX_NEW_TOKENS = 160
const MAX_TRANSLATE_BODY_BYTES = 4096
const INFERENCE_TIMEOUT_MS = 45000

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
    text: z.string().trim().min(1, 'Enter text to translate.').max(MAX_INPUT_CHARS, `Please keep input under ${MAX_INPUT_CHARS} characters.`),
    sourceLang: z.string(),
    targetLang: z.string(),
    maxNewTokens: z.number().int().positive().max(MAX_NEW_TOKENS).optional(),
  })
  .refine(
    payload => supportedPairs.some(([s, t]) => s === payload.sourceLang && t === payload.targetLang),
    { message: 'Unsupported translation direction.', path: ['targetLang'] }
  )

const translateResponseSchema = z.object({
  translation: z.string(),
  sourceLang: z.string(),
  targetLang: z.string(),
  modelId: z.string().default(MODEL_ID),
  modelVersion: z.string().nullable(),
  latencyMs: z.number().nonnegative(),
})

type TranslateRequest = z.infer<typeof translateRequestSchema>
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
    translation: `${mockOutput}\n\n[${payload.sourceLang} -> ${payload.targetLang}] ${payload.text}`,
    sourceLang: payload.sourceLang,
    targetLang: payload.targetLang,
    modelId: getRuntimeModelId(payload.sourceLang, payload.targetLang),
    modelVersion: 'local-mock',
    latencyMs,
  }
}

// Phase 1: attempt ILRDF Gradio predict call
// Call signature is best-guess; run /api/translate/probe to verify/adjust
async function requestIlrdf(payload: TranslateRequest): Promise<TranslateResponse | null> {
  if (!ILRDF_MT_BASE) return null
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), INFERENCE_TIMEOUT_MS)
  try {
    const res = await fetch(`${ILRDF_MT_BASE}/api/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [payload.text, payload.sourceLang, payload.targetLang], fn_index: 0 }),
      signal: controller.signal,
    })
    if (!res.ok) return null
    const json = await res.json()
    const translation = typeof json?.data?.[0] === 'string' ? json.data[0] : null
    if (!translation) return null
    return {
      translation,
      sourceLang: payload.sourceLang,
      targetLang: payload.targetLang,
      modelId: 'ilrdf/formosan-mt',
      modelVersion: null,
      latencyMs: 0,
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

  // Phase 1: try ILRDF Gradio first (experimental)
  if (ILRDF_MT_BASE) {
    const ilrdfResult = await requestIlrdf(parsed.data)
    if (ilrdfResult) {
      ilrdfResult.latencyMs = Date.now() - startedAt
      return NextResponse.json(ilrdfResult)
    }
    console.warn('ILRDF MT unavailable — falling back to inference server')
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
