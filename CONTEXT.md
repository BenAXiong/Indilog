# Indivore

A spaced-repetition language learning app for Formosan languages. Users capture vocabulary and sentences from real-life encounters, study them through SRS review sessions, and track daily progress toward structured goals.

## Language

### Notes and Cards

**Note**:
The underlying knowledge unit — a word, sentence, or phrase captured by the user. One row in `ind_items`.
_Avoid_: item (in user-facing copy), entry, card

**Card**:
One reviewable unit derived from a Note; carries its own SRS schedule. One row in `ind_flashcards`. A Note has exactly one Card.
_Avoid_: flashcard (in user-facing copy)

**New card**:
A Card whose `repetitions === 0` — it has never graduated from a Learn session. The Learn session exclusively handles New cards.
_Avoid_: unseen, unreviewed

**Graduation**:
The transition of a Card from New (Learn queue) to the Review queue, triggered when the user earns the required consecutive Good responses or taps Easy. Sets `repetitions = 1` and a first SRS interval.
_Avoid_: promotion, completion

### Sessions

**Learn session**:
An SRS session that exclusively loads New cards (`repetitions === 0`). Cards progress through an Exposure pass then Test passes before graduating. Capped separately from Review sessions.
_Avoid_: study session, new-card session

**Review session**:
An SRS session that exclusively loads due cards with `repetitions > 0`. Never contains New cards.
_Avoid_: practice session

**Exposure pass**:
The first encounter with a card in a Learn session — card is shown fully revealed (front + back), user taps "OK" or swipes to advance. No rating recorded. Happens once per card per session.
_Avoid_: preview, reveal pass

**Test pass**:
A rated encounter with a card in a Learn session after its Exposure pass — card shown front-only, user reveals and rates (Again / Good / Easy). Two consecutive Good ratings = graduation at 12h. Easy = graduation at 4d. Again resets the consecutive-Good counter.
_Avoid_: quiz pass, learning pass

**Consecutive-good counter**:
Internal per-card counter tracking how many uninterrupted Good ratings have been given in Test passes during a Learn session. Resets to 0 on Again. Not shown as a label; rendered as pass dots in UI.
_Avoid_: streak (reserved for daily streak), pass streak

### Goals and Progress

**Priority list**:
An ordered list of decks the user has flagged as study priorities. Cards from priority decks are surfaced first in both Learn and Review sessions. Non-priority decks fill remaining session slots after priority content is exhausted.
_Avoid_: goal decks, focus list

**Priority deck**:
A deck that appears in the Priority list.

**Simulation**:
A dynamic computation run on dashboard/session load that calculates the required Learn cards/day and Review cards/day to bring selected priority decks to Rooted by a user-set deadline. Any subset of the priority list (1 to all decks) can be included. Output feeds the Learn and Review ring targets directly — targets are never stored.
_Avoid_: forecast, projection (use "simulation" consistently)

**Daily target**:
The Learn or Review count the Simulation says the user must hit today to stay on track. Recomputed on each session load. Distinct from the daily cap.
_Avoid_: daily goal (overloaded), daily quota

**Daily cap**:
The hard maximum number of new cards (Learn cap, default 10 max 20) or reviews (Review cap) per day. Set by the user in settings. When no Simulation is active, the cap IS the effective daily target for streak purposes.
_Avoid_: limit, maximum

**Streak**:
Count of consecutive days on which the user met their daily targets. When a Simulation is active: streak fires if both the Learn daily target AND the Review daily target are met. When no Simulation is active: streak fires if either cap is hit. The streak is a goal-realism feedback signal — if it breaks repeatedly, the Simulation deadline or scope is too aggressive.
_Avoid_: combo, chain (chain is reserved for the 7-day visual widget)

**Content pack**:
A per-dialect JSON bundle of all ePark study content (lessons, patterns, essays, dialogues,
conversations), CDN-served and cached in IndexedDB so content renders with zero network and works
offline. Built by `scripts/build-content-packs.mjs`; dialects without a pack fall back to the API.
_Avoid_: offline bundle, cache file

**Mastery grade**:
A four-tier classification of a card's long-term retention strength, derived entirely from existing SRS columns. Displayed in the browser and Stats; used by the Simulation as a finish-line target.

| Grade | Condition |
|---|---|
| **Seed** | `repetitions === 0` — card has never left a Learn session |
| **Planted** | `repetitions >= 1` and `interval_days < 21` — in active review, building interval |
| **Rooted** | `interval_days >= 21 AND repetitions >= 5 AND ease_factor >= 2.5` — fully established; Simulation finish line |
| **Blooming** | `interval_days >= 60` — longevity-only signal; no ease gate; aspirational, beyond simulation scope |

_Avoid_: mature, mastered (legacy Stats label — now maps to Rooted)

### Screens

**Browser**:
The screen for searching, inspecting, and batch-editing existing Notes and
their Cards outside of a Learn/Review session. Deliberately a search/manage
tool, not a skim/triage tool — Review already owns the job of going through
cards in sequence.
_Avoid_: browse mode, card manager
