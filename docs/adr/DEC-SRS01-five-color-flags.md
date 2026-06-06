---
status: accepted
---

# Five-color flag system (not boolean)

Flashcard flags are stored as `flag_color text` (null = no flag; values: `red`, `orange`, `yellow`, `green`, `blue`) rather than a `flagged boolean`. No meaning is assigned to specific colors by the app — the user decides. Five colors cover all practical tagging needs without imposing structure.

**Date:** 2026-05-30

**Why:** A single boolean flag has one dimension of meaning. A 5-color system acts as a lightweight tag set: e.g. red = "confused", green = "interesting", blue = "needs audio". The app should not assign semantics — that's the user's call. Five is the Anki convention and a reasonable upper bound before it becomes unwieldy.

**How it surfaces:** Review session bookmark icon opens an inline color picker (5 dots + clear). Browser Flagged filter adds a color sub-filter row. `/review?filter=flagged` or `/review?flag=red` targets sessions by flag. `setFlagColor(id, color | null)` is the single write path.
