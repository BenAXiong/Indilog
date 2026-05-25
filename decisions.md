# Indivore — Decisions

Tracks open questions and resolved architectural/product decisions.

---

## Open

### DEC-001 · Dictionary API contract
**Question:** What is the URL and response schema of the "existing Vercel SQLite dictionary API"?
**Needed for:** Phase 5 (Dictionary integration, token chips in Capture)
**Blocking:** Yes — cannot build the dictionary client without knowing the endpoint and response shape.
**Action:** Ask user to provide the base URL and a sample response, or link to existing client code.

---

### DEC-002 · Supported translation pairs
**Question:** Which Formosan-language translation pairs are actually supported by the translation API?
**Needed for:** Phase 6 (Translate page, Capture translation action, disabled-state logic)
**Blocking:** Yes — the supported-pair constant that drives enabled/disabled UI cannot be populated without this list.
**Action:** Ask user to enumerate supported source → target pairs, or link to existing pair config.

---

### DEC-R08 · Dialogue drill is v0 scope
**Decision:** Dialogue drill IS v0 (confirmed by user 2026-05-25). Build as designed — two sample dialogues in Review landing, with session view. Content can be static for v0.
**Date:** 2026-05-25

---

### DEC-R10 · 16 Formosan languages confirmed
**Decision:** Use the 16 official CIP languages: Amis, Atayal, Paiwan, Bunun, Puyuma, Rukai, Tsou, Saisiyat, Tao, Thao, Kavalan, Truku, Sakizaya, Sediq, Kanakanavu, Saaroa. Confirmed by user 2026-05-25.
**Date:** 2026-05-25

---

### DEC-005 · Existing Supabase project
**Question:** Is there an existing Supabase project to connect to, or should a new one be created?
**Needed for:** Phase 2 (auth setup, migrations)
**Blocking:** Yes for Phase 2.
**Action:** Ask user for the Supabase project URL and anon key, or confirm a new project should be created.

---

### DEC-R09 · Both review modes are v0 scope
**Decision:** Both Comprehension ("see meaning → produce sentence") and Expression ("hear sentence → recall sentence") modes are v0 (confirmed by user 2026-05-25). Both use Again/Hard/Good/Easy ratings but present the card differently.
**Date:** 2026-05-25

---

## Resolved

### DEC-R03b · Design access method
**Decision:** Claude Design handoff is provided as a downloaded zip bundle (`Indivore-design_handoff_v2.zip`) dropped in the repo root, extracted to `design-handoff/`. Read design files directly from disk — no API call needed.
**Source:** User provided the zip; bundle extracted to `design-handoff/indivore/project/`.
**Date:** 2026-05-25

---

### DEC-R01 · Tech stack
**Decision:** Next.js App Router, TypeScript, Tailwind CSS, Supabase Auth + Postgres, Vercel.
**Source:** Workflow doc — "Recommended stack" section.
**Date:** 2026-05-25

---

### DEC-R02 · Table prefix
**Decision:** All Indivore Supabase tables use the `ind_` prefix.
**Source:** Workflow doc — "Supabase table prefix" section.
**Date:** 2026-05-25

---

### DEC-R03 · Translation direction ≠ active study language
**Decision:** Changing the Translate source/target pair must NOT silently update the app-wide active study language. These are separate settings.
**Source:** Workflow doc — "Key product concepts" section.
**Date:** 2026-05-25

---

### DEC-R04 · Place heard/seen is observational metadata, not dialect
**Decision:** Place and dialect are separate fields. Place is not used to auto-infer dialect.
**Source:** Workflow doc — "Key product concepts" section.
**Date:** 2026-05-25

---

### DEC-R05 · Learn tab is a placeholder in v0
**Decision:** The Learn tab needs only a minimal placeholder. Full lesson system is explicitly out of scope.
**Source:** Workflow doc — Phase 8, "Keep lessons light."
**Date:** 2026-05-25

---

### DEC-R06 · Spaced repetition stays simple
**Decision:** v0 flashcard scheduling uses a simple interval multiplier algorithm. No full SRS (SM-2, FSRS, etc.).
**Source:** Workflow doc — Phase 7, "Keep simple."
**Date:** 2026-05-25
