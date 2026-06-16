# Indivore — Beyond v1

Ideas, deferred features, and future directions not yet scoped into a milestone. Nothing here is committed or prioritised.

- Refactor (see skill and doc)

- Amis 1k: create v1 from ePark content. Save broad then filter on indi ws
    see if learn 12 units content corresponds to eassays and dialogue
    Find how many gaoji vocab have exsent in ePark

- Curriculum: add "play all" buttons
- Improve tooltips: speed, info and save (app-wide)
- Fix curriculum default layout according to deck
- Study goal for curriculum with on-track/late pills and progression graphs
- consider nice mining reports
    https://github.com/L-M-Sherlock/japanese-mining-report
- FSRS
- late review handling
- Big cleanup of the docs
- Share card: aesthetic, motivating, and only available when target completed
- Revamp Browser
- Dashboard revamp, focus on streak and dailies redesign (double-strands)
- Add zh to ab MT in capture (check dialects)
- Add language-dep dialects in capture context
- Add a celebration/goal complete message
- Design dash CTAs when deck are done, esp in no-prio mode and tmrdue less than target
    and fix 0/0 if all priority cards are Rooted
- Add motivation stats/progression to Learn session end
- Add motivation stats/progression to Review session end
- SRS: Again requeue 5min then 12h then 50% even young
- **SRS test suite (two-layer):**
  - *Pure-function layer* (Vitest, no DB): unit tests per grade/edge-case + 90-day population simulations with a fixed seed to catch algo regressions and long-term curve health (ease collapse, due-count growth, blooming rate)
  - *In-vivo integration layer* (Vitest + dedicated Supabase test project): call real service functions (`rateCard`, `graduateLearnCard`, `flushReviewEvents`) against a seeded test DB, query actual rows, assert correct `interval_days / ease_factor / due_at / phase`; catches DB-layer bugs (missing `.eq('user_id')`, RLS failures, wrong column writes) that pure tests miss; ~20–30 key scenarios, test user cleaned up in teardown

- GoalsSheet revamps: especially calculated display, add charts
- Capture: option or tag to exclude from flashcards (when data undure or incomplete)
- Advanced SRS modes: first comp then prod (auto-shifts when mature)
- Advanced SRS tab (beware, modify only if you understand)
- 3rd dashboard ring for Captures (alongside Learn + Review rings) — deferred until capture goals are designed
- Configurable streak: hitting any/all/combination of caps selectable per goal type — deferred until 3-ring dashboard exists (E-option; v1 streak = any cap hit)
- Amis100 - useful fun version
- generate IP-stable manga images
- Think dialogue layout & make Dialogue_001
- **Offline / no-signal review**: every scheduled rating (`rateCard`, `rateCardRelearn`, `graduateLearnCard`) is a live `await supabase.update()` — no queue, no cache. Network failure silently drops the write; card resets to pre-session state on next load. Fix requires local-first layer: optimistic in-memory state + background sync queue (e.g. IndexedDB write-ahead log or Supabase offline mode). Buffered non-algo events (`flushReviewEvents`) are already fire-and-forget and acceptable to lose, but scheduled algo writes are not.
- Use disctionary to explore affixes (examples)
- Icons: capture = fish net, dash = stone house, study = ?, trans = stars, dict = ?
- Add MoE dict roots + affix drill (V2 of MoE expansion above)
- Add ILRDF dict
- Add ILRDF colloquial corpus
- TDL to capture: list of things you wanna learn (eg it's my treat, get lost, etc)
- Video capture — v2 new feature
- Daily streak push notification
- Cards swipe animations
- SRS: consider option to populate 1k reviews from curriculum progress
    or just extract amap for curri
- feature for dialogue display and practice
- Import: stash hash in sessionStorage before login redirect so unauthenticated users land back on /import after sign-up (currently requires re-opening from extension)
- AI opacity: drop modelId from /api/translate response (currently visible in DevTools network tab despite invisible in UI)
- AI opacity: proxy TTS audio bytes through /api/tts instead of returning ILRDF file URL to client
- Vocabulary + frequency analysis: Klokah vs ILRDF 1k
- history buttons in capture and other tabs
- Amis1k: add simple example sentences
- Add ex sentences to word cards (?) esp Amis 1k - lookup from browser?
- Add TTS to Amis1k deck
- Freq analysis of curriculum x4-6 and Amis1k
- Icons: align with CD design handoff
- 階層×10 system (tadpole - crab - mangcel - fafoy - bear - kawas?)
- User contributions — send to pending DB
- Trilingual
- OCR capture
- AI-formatted json from other formats (txt, csv, pdf) for teachers
- How to tutorial (instructions for SRS, tabs workflow)
- streak freeze: get one free "rest day" after streak=6
- leeches: can derived a lapse_count from ind_reviews
- UX idea: flashcard session are empty until the user DnDs their selected decks in a box
- **SRS analytics:** store `learn_attempts` (total test-pass ratings before graduation) and `learn_avg_ms` (avg ms flip→rating) on `ind_flashcards` at graduation; correlate with review outcomes (first-review rating, ease drift, interval to rooted threshold)
- **Learn test mode: forward+type** — 5th review mode alongside forward/reverse/audio/STS; user types the target word rather than tapping a rating button; useful for production practice
