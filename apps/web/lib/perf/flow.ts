'use client'

// Client-side flow timing: click → content painted.
// Enabled via ?perf=1 (persisted in localStorage). Samples are buffered in
// localStorage for the PerfHUD and uploaded fire-and-forget to
// ind_perf_samples so medians can be pulled per step/build.
// Protocol + results log: docs/perf-plan.md

import { createClient } from '@/lib/supabase/client'

export type PerfSample = {
  flow: string
  ms: number
  at: string
  build: string
  step: string
  device: string
  meta?: Record<string, unknown>
}

const ENABLED_KEY  = 'iv_perf'
const STEP_KEY     = 'iv_perf_step'
const CLICK_KEY    = 'iv_perf_click'
const LOG_KEY      = 'iv_perf_log'
const CLICK_MAX_AGE = 15_000
const LOG_MAX       = 300

export function perfEnabled(): boolean {
  return typeof window !== 'undefined' && localStorage.getItem(ENABLED_KEY) === '1'
}

export function setPerfEnabled(on: boolean) {
  localStorage.setItem(ENABLED_KEY, on ? '1' : '0')
}

export function getStep(): string  { return localStorage.getItem(STEP_KEY) ?? 'S0' }
export function setStep(s: string) { localStorage.setItem(STEP_KEY, s) }

type ClickMark = { t: number; epoch: number; label: string }

function markClick(label: string) {
  const mark: ClickMark = { t: performance.now(), epoch: Date.now(), label }
  try { sessionStorage.setItem(CLICK_KEY, JSON.stringify(mark)) } catch {}
}

function takeClick(): ClickMark | null {
  try {
    const raw = sessionStorage.getItem(CLICK_KEY)
    if (!raw) return null
    const m = JSON.parse(raw) as ClickMark
    if (Date.now() - m.epoch > CLICK_MAX_AGE) return null
    return m
  } catch { return null }
}

// Captures the tap that starts a flow. 'click' (not pointerdown) so scroll
// touches don't set spurious marks.
export function installClickListener(): () => void {
  const handler = (e: Event) => {
    if (!perfEnabled()) return
    const el = (e.target as HTMLElement)?.closest?.('a,button')
    if (!el) return
    const href = el.getAttribute('href')
    const label = href
      ?? el.getAttribute('aria-label')
      ?? el.textContent?.trim().slice(0, 40)
      ?? el.tagName
    markClick(`${location.pathname} → ${label}`)
  }
  document.addEventListener('click', handler, { capture: true })
  return () => document.removeEventListener('click', handler, { capture: true })
}

let coldRecorded = false

// Call when a page's primary content is ready. Measures from the last tap;
// with no tap, the first call since page load is recorded as a cold start
// (ms from navigationStart). Double-rAF lands the measurement after paint.
export function flowDone(flow: string, meta?: Record<string, unknown>) {
  if (!perfEnabled()) return
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const click = takeClick()
    let ms: number
    let name = flow
    if (click) {
      ms = performance.now() - click.t
      try { sessionStorage.removeItem(CLICK_KEY) } catch {}
    } else if (!coldRecorded) {
      ms = performance.now()
      name = `cold:${flow}`
    } else {
      return
    }
    coldRecorded = true
    record({
      flow:   name,
      ms:     Math.round(ms),
      at:     new Date().toISOString(),
      build:  process.env.NEXT_PUBLIC_BUILD_TIME ?? '',
      step:   getStep(),
      device: matchMedia('(pointer:coarse)').matches ? 'phone' : 'desktop',
      meta:   { ...meta, from: click?.label },
    })
  }))
}

export function readLog(): PerfSample[] {
  try { return JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]') } catch { return [] }
}

export function clearLog() { localStorage.removeItem(LOG_KEY) }

const listeners = new Set<() => void>()
export function onPerfLog(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

function record(s: PerfSample) {
  const log = readLog()
  log.push(s)
  while (log.length > LOG_MAX) log.shift()
  try { localStorage.setItem(LOG_KEY, JSON.stringify(log)) } catch {}
  listeners.forEach(fn => fn())

  try {
    createClient().from('ind_perf_samples')
      .insert({ flow: s.flow, ms: s.ms, build: s.build, step: s.step, device: s.device, meta: s.meta ?? {} })
      .then(({ error }) => { if (error) console.warn('perf upload:', error.message) })
  } catch {}
}
