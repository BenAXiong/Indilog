'use client'

import { useState, useEffect } from 'react'
import { T } from '@/lib/tokens'
import { Icon } from '@/components/ui'
import { patchPreferences } from '@/lib/db/profile/preferences'
import {
  listPriorityDecks, addPriorityDeck, addVirtualPriorityDeck,
  addCurriculumSourceDeck, addCaptureFilterDeck, listCaptureLanguages,
  removePriorityDeckById, reorderPriorityDecks, setPriorityDeckSimulation,
  VIRTUAL_DECK_LABELS, EPARK_SOURCES, type PriorityDeck, type CaptureLangOption,
} from '@/lib/db/srs/priority'
import { getDeckRootedStats } from '@/lib/db/profile/goal'
import { localDateStr, getStudyDate } from '@/lib/db/srs/flashcards'
import { listCollections, type CollectionMeta } from '@/lib/db/progress/collections'
import { projectSimulation, buildCurveFromDays, type SimulationCurve, type TodayTarget } from '@/lib/db/srs/simulation-client'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

type GoalMode = 'manual' | 'calculated'
type Tab = 'goals' | 'priority' | 'simulate'

type DeckStat = { total: number; rooted: number }

// ─── Sub-components ───────────────────────────────────────────────────────────

function TabBar({ active, onSelect }: { active: Tab; onSelect: (t: Tab) => void }) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'goals',    label: 'Goals'    },
    { id: 'priority', label: 'Priority' },
    { id: 'simulate', label: 'Simulate' },
  ]
  return (
    <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${T.lineSoft}`, margin: '0 18px', marginBottom: 0 }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onSelect(t.id)} style={{
          flex: 1, padding: '10px 0', background: 'none', border: 'none',
          borderBottom: `2px solid ${active === t.id ? T.crimson : 'transparent'}`,
          fontFamily: '"JetBrains Mono", monospace', fontSize: 11, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.07em',
          color: active === t.id ? T.crimson : T.inkMute,
          cursor: 'pointer', transition: 'color .12s',
        }}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

function Stepper({ value, onChange, min, max, step = 1 }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min} style={{
        width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.line}`,
        background: T.paperHi, color: T.inkSoft, cursor: value <= min ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, fontWeight: 300, opacity: value <= min ? 0.35 : 1,
      }}>−</button>
      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 17, fontWeight: 700, color: T.ink, minWidth: 28, textAlign: 'center' }}>
        {value}
      </span>
      <button onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max} style={{
        width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.line}`,
        background: T.paperHi, color: T.inkSoft, cursor: value >= max ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, fontWeight: 300, opacity: value >= max ? 0.35 : 1,
      }}>+</button>
    </div>
  )
}

function ProgressBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 5, background: T.lineSoft, borderRadius: 999, overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', borderRadius: 999, background: color, width: `${Math.min(100, Math.round(pct * 100))}%`, transition: 'width .4s' }} />
    </div>
  )
}

// ─── GoalSheet ─────────────────────────────────────────────────────────────────

export default function GoalSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab,          setTab]          = useState<Tab>('goals')
  const [mode,         setMode]         = useState<GoalMode>('manual')
  const [learnTarget,  setLearnTargetRaw]  = useState(10)
  const [reviewTarget, setReviewTargetRaw] = useState(100)
  const [simOutput,    setSimOutput]    = useState<TodayTarget | null>(null)
  const [simLoading,   setSimLoading]   = useState(false)

  // Priority tab
  const [decks,        setDecks]        = useState<PriorityDeck[]>([])
  const [deckStats,    setDeckStats]    = useState<Record<string, DeckStat>>({})
  const [collections,  setCollections]  = useState<CollectionMeta[]>([])
  const [addPicker,       setAddPicker]       = useState(false)
  const [eparkExpanded,   setEparkExpanded]   = useState(false)
  const [capturesExpanded, setCapturesExpanded] = useState(false)
  const [captureOptions,  setCaptureOptions]  = useState<CaptureLangOption[] | null>(null)
  const [captureLoading,  setCaptureLoading]  = useState(false)
  const [priorityLoading, setPriorityLoading] = useState(false)

  // Simulate tab
  const [simDeadline,  setSimDeadline]  = useState('')
  const [simResult,    setSimResult]    = useState<SimulationCurve | null>(null)
  const [simRunning,   setSimRunning]   = useState(false)

  const [topOffset, setTopOffset] = useState<number | null>(null)

  // Lock body scroll + measure header bottom on open
  useEffect(() => {
    if (!open) return
    const header = document.querySelector('[data-id="dashboard-header"]')
    if (header) setTopOffset(header.getBoundingClientRect().bottom)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // Load on open — sequential so loadPriority can auto-recalc with correct learnTarget
  useEffect(() => {
    if (!open) return
    loadPrefs().then(({ mode, learnTarget: lt }) => loadPriority(mode, lt))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Lazy-load capture language options the first time the captures section expands
  useEffect(() => {
    if (!capturesExpanded || captureOptions !== null || captureLoading) return
    setCaptureLoading(true)
    listCaptureLanguages().then(opts => { setCaptureOptions(opts); setCaptureLoading(false) })
  }, [capturesExpanded, captureOptions, captureLoading])

  async function loadPrefs(): Promise<{ mode: GoalMode; learnTarget: number }> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { mode: 'manual', learnTarget: 10 }
    const { data } = await supabase.from('ind_profiles').select('preferences').eq('user_id', user.id).maybeSingle()
    const prefs = data?.preferences as Record<string, unknown> | null
    const lc = typeof prefs?.learn_target === 'number' ? prefs.learn_target : 10
    const rc = typeof prefs?.review_target === 'number' ? prefs.review_target : 100
    const goalMode: GoalMode = prefs?.goal_mode === 'calculated' ? 'calculated' : 'manual'
    setLearnTargetRaw(lc)
    setReviewTargetRaw(rc)
    setMode(goalMode)
    localStorage.setItem('srs_learn_target', String(lc))
    localStorage.setItem('srs_review_target', String(rc))
    return { mode: goalMode, learnTarget: lc }
  }

  async function loadPriority(initialMode?: GoalMode, initialLearnTarget?: number) {
    setPriorityLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setPriorityLoading(false); return }
    const [decksData, cols] = await Promise.all([
      listPriorityDecks(user.id),
      listCollections(),
    ])
    setDecks(decksData)
    setCollections(cols)
    setPriorityLoading(false)
    // Lazily load rooted stats for collection decks only
    for (const d of decksData) {
      if (!d.collection_id) continue
      const colId = d.collection_id
      getDeckRootedStats(colId).then(stats => {
        setDeckStats(prev => ({ ...prev, [colId]: stats }))
      })
    }
    // Pre-populate simulate deadlines from first sim deck
    const firstSim = decksData.find(d => d.in_simulation && d.simulation_deadline)
    if (firstSim?.simulation_deadline) setSimDeadline(firstSim.simulation_deadline)
    // Auto-recalculate when opening in calculated mode so Goals tab shows sim values
    if (initialMode === 'calculated') recalcWithDecks(decksData, initialLearnTarget)
  }

  function setLearnTarget(v: number) {
    setLearnTargetRaw(v)
    localStorage.setItem('srs_learn_target', String(v))
    patchPreferences({ learn_target: v })
    // Clear today's frozen learn_target so the dashboard re-computes on next refresh
    ;(async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      supabase.from('ind_daily_stats')
        .update({ learn_target: null }).eq('user_id', session.user.id).eq('date', getStudyDate()).then(() => {})
    })()
  }
  function setReviewTarget(v: number) {
    setReviewTargetRaw(v)
    localStorage.setItem('srs_review_target', String(v))
    patchPreferences({ review_target: v })
  }

  // ── Goals tab ──────────────────────────────────────────────────────────────

  async function recalcWithDecks(decksParam: PriorityDeck[], learnTargetOverride?: number) {
    setSimLoading(true)
    const simDecks = decksParam.filter(d => d.in_simulation)
    if (!simDecks.length) { setSimLoading(false); return }
    const deadline = simDecks.find(d => d.simulation_deadline)?.simulation_deadline
      ?? localDateStr(new Date(Date.now() + 30 * 86400000))
    const result = await projectSimulation({
      collectionIds: simDecks.map(d => d.collection_id).filter((id): id is string => id !== null),
      deadline,
      learnTarget: learnTargetOverride ?? learnTarget,
    })
    if (result) setSimOutput({ learnTarget: result.days[0]?.learn ?? result.learnTarget, reviewTarget: result.days[0]?.review ?? 0 })
    setSimLoading(false)
  }

  async function recalculate() {
    return recalcWithDecks(decks)
  }

  const LEARN_LEVELS = [
    { label: 'Chill',    value: 3  },
    { label: 'Regular',  value: 5  },
    { label: 'Serious',  value: 10 },
    { label: 'Hardcore', value: 20 },
  ]

  function GoalsTab() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 6, background: T.lineSoft, borderRadius: 10, padding: 4 }}>
          {(['manual', 'calculated'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); patchPreferences({ goal_mode: m }); if (m === 'calculated') recalculate() }} style={{
              flex: 1, height: 32, borderRadius: 7, border: 'none', cursor: 'pointer',
              background: mode === m ? T.paperHi : 'transparent',
              color: mode === m ? T.ink : T.inkMute,
              fontFamily: '"JetBrains Mono", monospace', fontSize: 11, fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              boxShadow: mode === m ? '0 1px 3px rgba(40,20,10,0.1)' : 'none',
              transition: 'background .12s',
            }}>
              {m}
            </button>
          ))}
        </div>

        {mode === 'manual' ? (
          <>
            {/* Learn cap */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, fontWeight: 600, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Learn target / day
                </label>
                <Stepper value={learnTarget} onChange={setLearnTarget} min={1} max={20} />
              </div>
              {/* Level labels */}
              <div style={{ display: 'flex', gap: 4 }}>
                {LEARN_LEVELS.map(lv => (
                  <button key={lv.label} onClick={() => setLearnTarget(lv.value)} style={{
                    flex: 1, padding: '5px 0', borderRadius: 7, border: `1px solid ${learnTarget === lv.value ? T.sage : T.lineSoft}`,
                    background: learnTarget === lv.value ? T.sageBg : T.paper,
                    color: learnTarget === lv.value ? '#566234' : T.inkMute,
                    fontFamily: '"JetBrains Mono", monospace', fontSize: 9, fontWeight: 600,
                    textTransform: 'uppercase', letterSpacing: '0.05em', cursor: 'pointer',
                  }}>
                    {lv.label}
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'inherit', marginTop: 1 }}>{lv.value}</div>
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 12, color: T.inkFaint, marginTop: 6, lineHeight: 1.5 }}>
                Projected review load: ~{learnTarget * 2}/day after 1w · ~{learnTarget * 3}/day after 2w · ~{learnTarget * 2}/day long-term
              </div>
            </div>

            {/* Review cap */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 11, fontWeight: 600, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Review target / day
                </label>
                <Stepper value={reviewTarget} onChange={setReviewTarget} min={10} max={300} step={10} />
              </div>
            </div>
          </>
        ) : (
          <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 12, padding: '14px 16px' }}>
            {simLoading ? (
              <div style={{ fontSize: 13, color: T.inkMute, textAlign: 'center' }}>Calculating…</div>
            ) : simOutput ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 32, fontWeight: 600, color: T.sage, letterSpacing: '-0.03em' }}>{simOutput.learnTarget}</div>
                    <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>Learn/day</div>
                  </div>
                  <div style={{ width: 1, background: T.lineSoft }} />
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 32, fontWeight: 600, color: T.crimson, letterSpacing: '-0.03em' }}>{simOutput.reviewTarget}</div>
                    <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>Review/day</div>
                  </div>
                </div>
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
                  <button onClick={recalculate} style={{ fontSize: 12, color: T.crimson, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                    Recalculate
                  </button>
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: T.inkMute, textAlign: 'center', lineHeight: 1.5 }}>
                No simulation configured yet.<br />
                <button onClick={() => setTab('simulate')} style={{ fontSize: 12, color: T.crimson, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, marginTop: 4 }}>
                  Set up in Simulate tab →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Priority tab ───────────────────────────────────────────────────────────

  const addedVirtualSources = new Set(
    decks.filter(d => d.note_source && !d.filter_config).map(d => d.note_source!)
  )
  const availableVirtual = Object.keys(VIRTUAL_DECK_LABELS).filter(src => !addedVirtualSources.has(src))
  const availableToAdd = collections.filter(c => !decks.some(d => d.collection_id === c.id))

  const addedCurriculumSources = new Set(
    decks.filter(d => d.note_source === 'curriculum' && d.filter_config)
      .map(d => d.filter_config!.curriculum_source)
  )
  const availableEparkSources = EPARK_SOURCES.filter(s => !addedCurriculumSources.has(s.id))

  const addedCaptureKeys = new Set(
    decks.filter(d => d.note_source === 'captured' && d.filter_config)
      .map(d => `${d.filter_config!.language}:${d.filter_config!.dialect ?? ''}`)
  )
  const availableCaptureOptions = (captureOptions ?? []).filter(
    o => !addedCaptureKeys.has(`${o.language}:${o.dialect ?? ''}`)
  )

  function deckDisplayName(deck: PriorityDeck): string {
    if (deck.filter_config) return deck.filter_config.label
    if (deck.note_source) return VIRTUAL_DECK_LABELS[deck.note_source] ?? deck.note_source
    return collections.find(c => c.id === deck.collection_id)?.name ?? '…'
  }

  async function handleMoveUp(userId: string, idx: number) {
    if (idx === 0) return
    const newOrder = [...decks]
    ;[newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]]
    setDecks(newOrder)
    await reorderPriorityDecks(userId, newOrder.map(d => d.id))
  }

  async function handleMoveDown(userId: string, idx: number) {
    if (idx === decks.length - 1) return
    const newOrder = [...decks]
    ;[newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]]
    setDecks(newOrder)
    await reorderPriorityDecks(userId, newOrder.map(d => d.id))
  }

  async function handleAdd(userId: string, collectionId: string) {
    setAddPicker(false)
    await addPriorityDeck(userId, collectionId)
    await loadPriority()
  }

  async function handleAddVirtual(userId: string, noteSource: string) {
    setAddPicker(false)
    await addVirtualPriorityDeck(userId, noteSource)
    await loadPriority()
  }

  async function handleAddCurriculumSource(userId: string, id: string, label: string) {
    setAddPicker(false)
    setEparkExpanded(false)
    await addCurriculumSourceDeck(userId, id, label)
    await loadPriority()
  }

  async function handleAddCaptureFilter(userId: string, opt: CaptureLangOption) {
    setAddPicker(false)
    setCapturesExpanded(false)
    await addCaptureFilterDeck(userId, opt.language, opt.dialect, opt.label)
    await loadPriority()
  }

  async function unfreezeTodayIfNoReviews(userId: string) {
    const supabase = createClient()
    const today = getStudyDate()
    const { data } = await supabase
      .from('ind_daily_stats')
      .select('reviewed_count')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle()
    if ((data?.reviewed_count ?? 0) === 0) {
      supabase.from('ind_daily_stats')
        .update({ learn_target: null, review_target: null })
        .eq('user_id', userId)
        .eq('date', today)
        .then(() => {})
    }
  }

  async function handleRemove(userId: string, id: string) {
    let noSimLeft = false
    setDecks(prev => {
      const next = prev.filter(d => d.id !== id)
      if (next.every(d => !d.in_simulation)) { setMode('manual'); noSimLeft = true }
      return next
    })
    await removePriorityDeckById(userId, id)
    if (noSimLeft) await Promise.all([unfreezeTodayIfNoReviews(userId), patchPreferences({ goal_mode: 'manual' })])
  }

  async function handleToggleSim(userId: string, collectionId: string, inSim: boolean) {
    let noSimLeft = false
    setDecks(prev => {
      const next = prev.map(d => d.collection_id === collectionId ? { ...d, in_simulation: inSim } : d)
      if (!inSim && next.every(d => !d.in_simulation)) { setMode('manual'); noSimLeft = true }
      return next
    })
    await setPriorityDeckSimulation(userId, collectionId, inSim)
    if (noSimLeft) await Promise.all([unfreezeTodayIfNoReviews(userId), patchPreferences({ goal_mode: 'manual' })])
  }

  function PriorityTab() {
    const [userId, setUserId] = useState<string | null>(null)
    useEffect(() => {
      const supabase = createClient()
      supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null))
    }, [])

    if (priorityLoading) {
      return <div style={{ textAlign: 'center', padding: 24, fontSize: 13, color: T.inkMute }}>Loading…</div>
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {decks.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px 16px', background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 12, fontSize: 13, color: T.inkMute }}>
            No priority decks yet. Add one below.
          </div>
        )}
        {decks.map((deck, idx) => {
          const stat = deck.collection_id ? deckStats[deck.collection_id] : null
          const rootedPct = stat && stat.total > 0 ? stat.rooted / stat.total : 0
          const isVirtual = !deck.collection_id
          return (
            <div key={deck.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px', background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 12 }}>
              {/* Position arrows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
                <button onClick={() => userId && handleMoveUp(userId, idx)} disabled={idx === 0} style={{ width: 20, height: 20, borderRadius: 5, border: `1px solid ${T.lineSoft}`, background: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: T.inkFaint, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: idx === 0 ? 0.3 : 1 }}>
                  <Icon name="chevron" size={10} strokeWidth={2} style={{ transform: 'rotate(-90deg)' }} />
                </button>
                <button onClick={() => userId && handleMoveDown(userId, idx)} disabled={idx === decks.length - 1} style={{ width: 20, height: 20, borderRadius: 5, border: `1px solid ${T.lineSoft}`, background: 'none', cursor: idx === decks.length - 1 ? 'default' : 'pointer', color: T.inkFaint, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: idx === decks.length - 1 ? 0.3 : 1 }}>
                  <Icon name="chev-d" size={10} strokeWidth={2} />
                </button>
              </div>

              {/* Name + progress */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {deckDisplayName(deck)}
                </div>
                {!isVirtual && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                    <ProgressBar pct={rootedPct} color="#7B8C46" />
                    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, color: T.inkFaint, flexShrink: 0 }}>
                      {stat ? `${Math.round(rootedPct * 100)}% rooted` : '…'}
                    </span>
                  </div>
                )}
                {isVirtual && (
                  <div style={{ fontSize: 11, color: T.inkFaint, marginTop: 3 }}>review only</div>
                )}
              </div>

              {/* Sim toggle — collection decks only */}
              {!isVirtual && (
                <button onClick={() => userId && deck.collection_id && handleToggleSim(userId, deck.collection_id, !deck.in_simulation)} style={{
                  width: 36, height: 20, borderRadius: 999, flexShrink: 0, position: 'relative',
                  background: deck.in_simulation ? T.crimson : T.line, border: 'none', cursor: 'pointer', transition: 'background .15s',
                }}>
                  <span style={{
                    position: 'absolute', top: 2, left: deck.in_simulation ? 18 : 2, width: 16, height: 16,
                    borderRadius: 999, background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left .15s',
                  }} />
                </button>
              )}

              {/* Remove */}
              <button onClick={() => userId && handleRemove(userId, deck.id)} style={{
                width: 26, height: 26, borderRadius: 7, border: `1px solid ${T.lineSoft}`, background: 'none',
                color: T.inkFaint, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Icon name="x" size={12} strokeWidth={2.5} />
              </button>
            </div>
          )
        })}

        {/* Add deck — show unless nothing is available in any category */}
        {(availableToAdd.length > 0 || availableVirtual.length > 0 || availableEparkSources.length > 0
          || captureOptions === null || availableCaptureOptions.length > 0) && (
          <div>
            {addPicker ? (
              <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 12, overflow: 'hidden' }}>
                {availableVirtual.length > 0 && (
                  <>
                    <div style={{ padding: '8px 14px 4px', fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      Virtual decks
                    </div>
                    {availableVirtual.map(src => (
                      <button key={src} onClick={() => { if (!userId) return; handleAddVirtual(userId, src) }} style={{
                        display: 'block', width: '100%', padding: '11px 14px', background: 'none', border: 'none',
                        borderBottom: `1px solid ${T.lineSoft}`, cursor: 'pointer', textAlign: 'left',
                        fontSize: 14, color: T.ink,
                      }}>
                        {VIRTUAL_DECK_LABELS[src]}
                        <span style={{ fontSize: 11.5, color: T.inkMute, marginLeft: 8 }}>review only</span>
                      </button>
                    ))}
                  </>
                )}
                {/* ePark curriculum sources — collapsed by default */}
                {availableEparkSources.length > 0 && (
                  <>
                    <button
                      onClick={() => setEparkExpanded(p => !p)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', padding: '10px 14px', background: 'none', border: 'none',
                        borderBottom: `1px solid ${T.lineSoft}`, cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        ePark curriculum
                      </span>
                      <Icon name={eparkExpanded ? 'chev-d' : 'chevron'} size={12} color={T.inkFaint} strokeWidth={2}
                        style={eparkExpanded ? undefined : { transform: 'rotate(90deg)' }} />
                    </button>
                    {eparkExpanded && availableEparkSources.map(s => (
                      <button key={s.id} onClick={() => { if (!userId) return; handleAddCurriculumSource(userId, s.id, s.label) }} style={{
                        display: 'block', width: '100%', padding: '10px 14px 10px 22px', background: 'none', border: 'none',
                        borderBottom: `1px solid ${T.lineSoft}`, cursor: 'pointer', textAlign: 'left',
                        fontSize: 14, color: T.ink,
                      }}>
                        {s.label}
                        <span style={{ fontSize: 11.5, color: T.inkMute, marginLeft: 8 }}>review only</span>
                      </button>
                    ))}
                  </>
                )}
                {/* Captures — language/dialect filter decks, collapsed by default */}
                {(captureOptions === null || availableCaptureOptions.length > 0) && (
                  <>
                    <button
                      onClick={() => setCapturesExpanded(p => !p)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', padding: '10px 14px', background: 'none', border: 'none',
                        borderBottom: `1px solid ${T.lineSoft}`, cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                        Captures
                      </span>
                      <Icon name={capturesExpanded ? 'chev-d' : 'chevron'} size={12} color={T.inkFaint} strokeWidth={2}
                        style={capturesExpanded ? undefined : { transform: 'rotate(90deg)' }} />
                    </button>
                    {capturesExpanded && (
                      captureLoading
                        ? <div style={{ padding: '10px 22px', fontSize: 13, color: T.inkMute }}>Loading…</div>
                        : availableCaptureOptions.map(opt => (
                          <button key={`${opt.language}:${opt.dialect ?? ''}`}
                            onClick={() => { if (!userId) return; handleAddCaptureFilter(userId, opt) }}
                            style={{
                              display: 'block', width: '100%', padding: '10px 14px 10px 22px',
                              background: 'none', border: 'none',
                              borderBottom: `1px solid ${T.lineSoft}`, cursor: 'pointer', textAlign: 'left',
                              fontSize: 14, color: T.ink,
                            }}>
                            {opt.label}
                            <span style={{ fontSize: 11.5, color: T.inkMute, marginLeft: 8 }}>review only</span>
                          </button>
                        ))
                    )}
                  </>
                )}
                {availableToAdd.length > 0 && (
                  <>
                    <div style={{ padding: '8px 14px 4px', fontFamily: '"JetBrains Mono", monospace', fontSize: 9.5, color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      Collections
                    </div>
                    {availableToAdd.map(c => (
                      <button key={c.id} onClick={() => { if (!userId) return; handleAdd(userId, c.id) }} style={{
                        display: 'block', width: '100%', padding: '11px 14px', background: 'none', border: 'none',
                        borderBottom: `1px solid ${T.lineSoft}`, cursor: 'pointer', textAlign: 'left',
                        fontSize: 14, color: T.ink,
                      }}>
                        {c.name}
                        <span style={{ fontSize: 11.5, color: T.inkMute, marginLeft: 8 }}>{c.card_count} cards</span>
                      </button>
                    ))}
                  </>
                )}
                <button onClick={() => { setAddPicker(false); setEparkExpanded(false); setCapturesExpanded(false) }} style={{ display: 'block', width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: T.inkMute }}>
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setAddPicker(true)} style={{
                width: '100%', height: 42, borderRadius: 12,
                border: `1px dashed ${T.line}`, background: 'none',
                color: T.inkSoft, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <Icon name="plus" size={14} strokeWidth={2} color={T.inkFaint} /> Add deck
              </button>
            )}
          </div>
        )}

        {decks.length > 0 && (
          <div style={{ fontSize: 11.5, color: T.inkFaint, lineHeight: 1.5 }}>
            Toggle the red switch to include a deck in the simulation.
          </div>
        )}
      </div>
    )
  }

  // ── Simulate tab ───────────────────────────────────────────────────────────

  async function handleRunSimulation() {
    const simDecks = decks.filter(d => d.in_simulation)
    if (!simDecks.length || !simDeadline) return
    setSimRunning(true)
    const result = await projectSimulation({
      collectionIds: simDecks.map(d => d.collection_id).filter((id): id is string => id !== null),
      deadline:      simDeadline,
      learnTarget,
    })
    if (result) setSimResult(buildCurveFromDays(result.days))
    setSimRunning(false)
  }

  async function handleApplySimulation() {
    if (!simResult) return
    setMode('calculated')
    setSimOutput({ learnTarget: simResult[0].learnTarget, reviewTarget: simResult[0].reviewTarget })
    // Persist mode and deadline — learn_target/review_target prefs stay as the user's manual values
    await patchPreferences({ goal_mode: 'calculated' })
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    for (const d of decks.filter(dk => dk.in_simulation && dk.collection_id)) {
      await setPriorityDeckSimulation(user.id, d.collection_id!, true, simDeadline)
    }
    setDecks(prev => prev.map(d => d.in_simulation ? { ...d, simulation_deadline: simDeadline } : d))
    setTab('goals')
  }

  function SimulateTab() {
    const simDecks = decks.filter(d => d.in_simulation)
    const canRun = simDecks.length > 0 && simDeadline

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Sim decks display */}
        <div>
          <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, fontWeight: 600, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
            Decks in simulation
          </div>
          {simDecks.length === 0 ? (
            <div style={{ fontSize: 12.5, color: T.inkMute, lineHeight: 1.5 }}>
              No decks marked for simulation. Enable the toggle on decks in the Priority tab.
              <button onClick={() => setTab('priority')} style={{ fontSize: 12, color: T.crimson, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, marginLeft: 4 }}>→ Priority</button>
            </div>
          ) : simDecks.map(d => (
            <div key={d.id} style={{ fontSize: 13, color: T.ink, padding: '5px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: T.crimson, flexShrink: 0 }} />
              {deckDisplayName(d)}
            </div>
          ))}
        </div>

        {/* Deadline */}
        <div>
          <label style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 10, fontWeight: 600, color: T.inkMute, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
            Deadline
          </label>
          <input type="date" value={simDeadline} onChange={e => setSimDeadline(e.target.value)} style={{
            display: 'block', width: '100%', padding: '11px 12px', borderRadius: 10,
            background: T.paperHi, border: `1px solid ${T.line}`,
            fontSize: 15, color: simDeadline ? T.ink : T.inkFaint, fontFamily: 'inherit', boxSizing: 'border-box',
          }} />
        </div>

        {/* Run button */}
        <button onClick={handleRunSimulation} disabled={!canRun || simRunning} style={{
          height: 46, borderRadius: 12, background: canRun ? T.crimson : T.lineSoft,
          color: canRun ? '#fff' : T.inkFaint, border: 'none', fontSize: 14.5, fontWeight: 600,
          cursor: canRun ? 'pointer' : 'default',
          boxShadow: canRun ? '0 1px 0 rgba(255,255,255,0.18) inset, 0 3px 8px rgba(120,30,15,0.2)' : 'none',
        }}>
          {simRunning ? 'Running…' : 'Run simulation'}
        </button>

        {/* Output curve */}
        {simResult && (
          <>
            <div style={{ background: T.paperHi, border: `1px solid ${T.lineSoft}`, borderRadius: 12, overflow: 'hidden' }}>
              {/* Header */}
              <div style={{ display: 'flex', padding: '8px 14px', borderBottom: `1px solid ${T.lineSoft}` }}>
                <div style={{ flex: 2, fontFamily: '"JetBrains Mono", monospace', fontSize: 9, color: T.inkFaint, textTransform: 'uppercase', letterSpacing: '0.07em' }} />
                <div style={{ flex: 1, textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontSize: 9, color: T.sage, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 }}>Learn</div>
                <div style={{ flex: 1, textAlign: 'right', fontFamily: '"JetBrains Mono", monospace', fontSize: 9, color: T.crimson, textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 }}>Review</div>
              </div>
              {simResult.map((row, i) => (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: i < simResult.length - 1 ? `1px solid ${T.lineSoft}` : 'none' }}>
                  <div style={{ flex: 2, fontSize: 13, color: T.inkSoft, fontWeight: 500 }}>{row.label}</div>
                  <div style={{ flex: 1, textAlign: 'right', fontFamily: 'Newsreader, Georgia, serif', fontSize: 18, fontWeight: 600, color: T.sage, letterSpacing: '-0.02em' }}>{row.learnTarget}</div>
                  <div style={{ flex: 1, textAlign: 'right', fontFamily: 'Newsreader, Georgia, serif', fontSize: 18, fontWeight: 600, color: T.crimson, letterSpacing: '-0.02em' }}>{row.reviewTarget}</div>
                </div>
              ))}
            </div>
            <button onClick={handleApplySimulation} style={{
              height: 46, borderRadius: 12, background: T.sageBg,
              color: '#566234', border: `1px solid #D2D8AE`,
              fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
            }}>
              Apply as my daily targets →
            </button>
          </>
        )}
      </div>
    )
  }

  // ── Sheet render ───────────────────────────────────────────────────────────

  if (!open) return null

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(30,18,10,0.35)', zIndex: 70 }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        top: topOffset ?? 'env(safe-area-inset-top)',
        background: T.paper, borderRadius: '20px 20px 0 0',
        border: `1px solid ${T.line}`, zIndex: 71,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 -8px 32px rgba(40,20,10,0.12)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0' }}>
          <div style={{ width: 36, height: 4, borderRadius: 999, background: T.lineSoft }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 18px 0' }}>
          <span style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: 18, fontWeight: 500, color: T.ink }}>
            Goals
          </span>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 999, background: T.paperHi, border: `1px solid ${T.lineSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T.inkMute }}>
            <Icon name="x" size={14} strokeWidth={2} />
          </button>
        </div>

        {/* Tab bar */}
        <TabBar active={tab} onSelect={setTab} />

        {/* Tab content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 18px 24px' }}>
          {tab === 'goals'    && <GoalsTab />}
          {tab === 'priority' && <PriorityTab />}
          {tab === 'simulate' && <SimulateTab />}
        </div>
      </div>
    </>
  )
}
