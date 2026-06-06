---
status: resolved
---

# Note unification deferred — trigger condition defined

**Date:** 2026-05-30 · Resolved 2026-05-30 (T-UNIFY completed)

`ind_items` and `ind_learn_cards` remained separate tables until the STS Card Template was implemented. T-UNIFY migration completed 2026-05-30 — `ind_learn_cards` merged into `ind_items`. This decision is resolved.

**Why it was deferred:** `ind_items` had 10+ dependent files. Migrating everything before knowing the final schema risked a second migration. Audio cards worked fine via join without unification.

**Trigger condition that unblocked it:** STS Card Template needed `target_word` on a Note, making the field-mismatch between `ind_items` and `ind_learn_cards` genuinely blocking. Schema requirements became concrete and the migration had clear payoff.
