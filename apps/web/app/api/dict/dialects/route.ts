import { NextResponse } from 'next/server'
import { listDialects } from '@/lib/dict/client'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const dialects = listDialects()
    return NextResponse.json({ dialects })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'dict error'
    return NextResponse.json({ error: msg, dialects: [] }, { status: 500 })
  }
}
