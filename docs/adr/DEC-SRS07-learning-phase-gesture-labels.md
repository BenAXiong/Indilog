---
status: accepted
---

# Learning phase gesture + label design

**Date:** 2026-06-05

**Before reveal:**
- ↑ swipe = Easy (fast-forward: "I already know this, skip the flip")
- ↓ swipe = Suspend
- ← → = nothing
- Button shown: "Easy" only

**After reveal:**
- ← swipe = Repeat (Again)
- → swipe = Good (non-final pass) or Got it! (final pass / relearn)
- ↓ swipe = Suspend
- ↑ swipe = **disabled** (up gesture removed after reveal in learning)
- ↑ hint hidden after reveal in learning (opacity 0, space preserved)
- Buttons: Repeat + Good (non-final) or Repeat + Got it! (final / relearn)

**Rationale:** "Easy" before the flip is a self-assessment shortcut — user hasn't seen the answer yet. After the flip, the user has seen the card; there's no longer a meaningful "easy" self-assessment. The only question is "did I get it right?" (Good/Got it!) or "do I need to repeat?" (Repeat). Having both ↑ and → do the same action after reveal was confusing and redundant.

**Rating sent to DB:** unchanged — non-final pass still sends `'easy'`, final pass/restart sends `'good'`. Label change is display-only.
