---
status: accepted
---

# Note / Card / Note Type / Card Template — canonical terminology

Adopt standard SRS terminology throughout all docs and code going forward.

**Date:** 2026-05-30

| Term | Meaning | Indivore equivalent |
|---|---|---|
| **Note** | The underlying knowledge unit — a word, sentence, or fact | `ind_items` row |
| **Card** | One review question derived from a Note; has its own SRS schedule | `ind_flashcards` row |
| **Note Type** | Schema defining a Note's fields (e.g., text+meaning+audio) | implicit — not yet modeled |
| **Card Template** | How a Note's fields map to a Card's front/back/prompt | session mode (`forward \| reverse \| audio \| sts`) |

Current presentation is fully determined by session mode + `ind_items.target_word`. No card-level template stored (card_type + metadata dropped per DEC-SRS06, 2026-06-02).
