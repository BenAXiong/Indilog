// Perf harness — drives the production app in a real (headless) Chromium and
// records the same click→paint samples the in-app HUD produces (lib/perf/flow.ts).
// Runs on the dev machine (same network as the user) so numbers anchor to the
// real connection. Protocol + step log: docs/perf-plan.md / docs/perf-log.md
//
// One-time:  node scripts/perf/measure.mjs --login        (headed; log in, then wait)
// Measure:   node scripts/perf/measure.mjs --step S1 [--runs 5] [--headed] [--base URL]
//
// Samples also upload to ind_perf_samples (tagged with --step and the deploy's
// build stamp), so results can be re-queried later.

import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR  = path.dirname(fileURLToPath(import.meta.url))
const AUTH = path.join(DIR, '.auth.json')

const args = process.argv.slice(2)
const opt  = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] ? args[i + 1] : dflt }
const has  = name => args.includes(`--${name}`)

const BASE = opt('base', 'https://indilog.vercel.app')
const STEP = opt('step', 'S?')
const RUNS = Number.parseInt(opt('runs', '5'), 10)
const COLD = Number.parseInt(opt('cold', '2'), 10)

// ── One-time login ────────────────────────────────────────────────────────────
// Waits for the actual Supabase session cookie (sb-…-auth-token), not just a
// navigation — OAuth detours through accounts.google.com before returning.
const hasSessionCookie = cookies => cookies.some(c => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))

if (has('login')) {
  const browser = await chromium.launch({ headless: false })
  const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/login`)
  console.log('Log in in the browser window… (waiting up to 5 min for the session cookie)')
  const deadline = Date.now() + 300_000
  while (!hasSessionCookie(await ctx.cookies(BASE))) {
    if (Date.now() > deadline) { console.error('Timed out — no session cookie appeared.'); process.exit(1) }
    await page.waitForTimeout(1000)
  }
  await page.waitForTimeout(1500)
  await ctx.storageState({ path: AUTH })
  await browser.close()

  // Verify: a fresh headless context with this state must reach the app, not /login.
  const check = await chromium.launch()
  const cctx = await check.newContext({ storageState: AUTH })
  const cpage = await cctx.newPage()
  await cpage.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  const landed = new URL(cpage.url()).pathname
  await check.close()
  if (landed.startsWith('/login')) { console.error('Session saved but not accepted (landed on /login). Try again.'); process.exit(1) }
  console.log(`Session verified (landed on ${landed}) → ${AUTH}`)
  process.exit(0)
}

if (!fs.existsSync(AUTH)) {
  console.error('No saved session. Run first:  node scripts/perf/measure.mjs --login')
  process.exit(1)
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function newContext(browser) {
  const ctx = await browser.newContext({
    storageState: AUTH,
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  })
  await ctx.addInitScript(step => {
    try {
      localStorage.setItem('iv_perf', '1')
      localStorage.setItem('iv_perf_step', step)
    } catch {}
  }, STEP)
  return ctx
}

const logLen = page =>
  page.evaluate(() => JSON.parse(localStorage.getItem('iv_perf_log') ?? '[]').length)

async function waitSample(page, prevLen) {
  await page.waitForFunction(
    n => JSON.parse(localStorage.getItem('iv_perf_log') ?? '[]').length > n,
    prevLen, { timeout: 30_000 },
  )
  const log = await page.evaluate(() => JSON.parse(localStorage.getItem('iv_perf_log') ?? '[]'))
  return log[log.length - 1]
}

const results = []
const record = s => { results.push({ flow: s.flow, ms: s.ms }); process.stdout.write(`  ${s.flow} ${s.ms}ms\n`) }

async function clickFlow(page, selector) {
  const n = await logLen(page)
  // .filter visible — the desktop sidebar duplicates nav links, hidden at mobile width
  await page.locator(selector).filter({ visible: true }).first().click()
  record(await waitSample(page, n))
}

async function gotoFlow(page, url) {
  const n = await logLen(page)
  await page.goto(BASE + url)
  record(await waitSample(page, n))
}

// ── Run ───────────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: !has('headed') })

// Session guard — fail loud instead of timing out on every flow.
{
  const ctx = await newContext(browser)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  const landed = new URL(page.url()).pathname
  await ctx.close()
  if (landed.startsWith('/login')) {
    console.error('Session expired/invalid — rerun:  node scripts/perf/measure.mjs --login')
    await browser.close()
    process.exit(1)
  }
}

// Cold starts: fresh context each, straight to home.
for (let i = 0; i < COLD; i++) {
  const ctx = await newContext(browser)
  const page = await ctx.newPage()
  try {
    console.log(`cold run ${i + 1}/${COLD}`)
    await page.goto(`${BASE}/`)
    record(await waitSample(page, 0))
  } catch (e) { console.error(`  cold run failed: ${e.message.split('\n')[0]}`) }
  await ctx.close()
}

// Warm flows: one context, repeated rounds.
const ctx = await newContext(browser)
const page = await ctx.newPage()
await page.goto(`${BASE}/`)
await waitSample(page, 0).catch(() => {})   // absorb the initial cold:home

for (let run = 1; run <= RUNS; run++) {
  console.log(`warm round ${run}/${RUNS}`)
  try {
    await clickFlow(page, 'a[href="/study"]')                          // F1 study-hub
    await clickFlow(page, 'a[href="/study/lessons"]')                  // F2 epark-twelve
    for (let i = 0; i < 3; i++)
      await clickFlow(page, 'button:has-text("Next")')                 // F3 next-lesson ×3
    await clickFlow(page, 'a[href="/study"]')                          // back (study-hub again)
    await clickFlow(page, 'a[href="/study/essays"]')                   // F4 epark-essay
    await clickFlow(page, 'a[href="/study"]')                          // back
    await clickFlow(page, 'a[href^="/review?noteSource=curriculum"]')  // F5 review-landing
    await clickFlow(page, 'a[href="/dict"]')                           // F8 dict (control)
    await clickFlow(page, 'a[href="/"]')                               // F7 home (RSC)
    await gotoFlow(page, '/learn')                                     // F6 cold:learn-landing
    await gotoFlow(page, '/')                                          // reset for next round
  } catch (e) {
    console.error(`  round ${run} aborted: ${e.message.split('\n')[0]}`)
    await page.goto(`${BASE}/`).catch(() => {})
  }
}

await browser.close()

// ── Aggregate ─────────────────────────────────────────────────────────────────
const byFlow = new Map()
for (const r of results) {
  if (!byFlow.has(r.flow)) byFlow.set(r.flow, [])
  byFlow.get(r.flow).push(r.ms)
}
const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }

console.log(`\n=== ${STEP} @ ${BASE} — medians ===`)
console.log('| Flow | p50 (ms) | min | max | n |')
console.log('|---|---|---|---|---|')
for (const [flow, arr] of [...byFlow.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  console.log(`| ${flow} | **${median(arr)}** | ${Math.min(...arr)} | ${Math.max(...arr)} | ${arr.length} |`)
}

const outDir = path.join(DIR, 'results')
fs.mkdirSync(outDir, { recursive: true })
const outFile = path.join(outDir, `${STEP}-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`)
fs.writeFileSync(outFile, JSON.stringify({ step: STEP, base: BASE, at: new Date().toISOString(), results }, null, 1))
console.log(`\nraw → ${outFile}`)
