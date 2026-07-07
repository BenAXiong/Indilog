---
status: accepted
---

# Audio surfacing — every session mode plays audio when present

All four session modes surface a card's audio (button + autoplay); the surface is the prompt for `audio`/`sts` and the reveal for `forward`/`reverse`. Fallbacks chain through the zh check.

**Date:** 2026-07-08

**Context:** DEC-SRS06 defined the 4-mode table with audio surfaced only in `audio` mode (player prompt) and, incidentally, a play button on the `forward` prompt. Cards from curriculum/collection sources almost always carry audio, but `reverse` and `sts` gave no access to it, and Learn sessions never autoplayed. Separately, the `sts`/`audio` fallbacks returned `reverse` without checking zh, so a zh-less card rendered the `—` placeholder as its prompt.

**Decision 1 — audio on every mode, placed on its surface:**

| Mode | Prompt | Reveal | Autoplay fires |
|------|--------|--------|----------------|
| `forward` | `ab` | `zh` + audio | on reveal |
| `reverse` | `zh` | `ab` + audio | on reveal |
| `audio` | player (persists as replay) | `ab` + `zh` | on card advance |
| `sts` | highlighted `ab` + audio | `zh` | on card advance |

`forward`/`reverse` put audio on the reveal because the recording speaks the `ab` — on a `reverse` prompt that is the answer. `audio`/`sts` prompts already expose the ab (aurally / visually), so they play immediately. The `forward` prompt's play button (pre-existing) moves to the reveal.

**Decision 2 — Learn sessions autoplay too.** The exposure pass shows front + back together (CONTEXT.md: fully revealed), so reveal-surfaced audio autoplays on card advance during exposure; test passes autoplay on reveal, same as Review.

**Decision 3 — fallbacks chain.** `sts` (no target_word) and `audio` (no audio) degrade to `reverse` only when the card has zh, otherwise to `forward` — a mode is never resolved whose prompt field is empty.

**Amends:** DEC-SRS06 Decision 2 (mode table + fallback column). Rendering lives in `components/study/CardContent.tsx` (`resolveEffectiveMode`, `CardFront`, `CardBack`, `PlayChip`); autoplay effects in `learn/page.tsx` + `review/page.tsx`.
