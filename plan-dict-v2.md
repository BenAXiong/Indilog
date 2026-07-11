# Dict tab — v2 work plan (temp doc, revise freely)

## Context

Following the merge-mode/2-col-picker/funnel-removal work (see recent commits on
`main`), a further batch of dict-tab issues and ideas came up. This doc captures
the plan for that batch so a fresh session (context here is nearly full) can pick
up implementation without re-deriving what's already been investigated.

Old ad-hoc numbering used during discussion (kept here for cross-reference only):
item 1 = fuzzy fix, item 2 = exact-mode root contamination, item 3 = language-
direction button, item 4 = sentence UX, item 5 = capture without dict entry,
item 6 = merge Dict+Translate tabs.

---

## Phase 1 — Capture without a dict entry (was item 5)

**Status: agreed, no open questions.**

Let users save/capture a word directly from the dict page even when there's no
matching entry (or none good enough), instead of forcing a trip to the Capture
tab and re-typing the word. Likely: a "Capture this" affordance in the dict
page's empty/no-results state (and possibly always-available alongside results),
pre-filling the capture form with the searched text.

Independent of everything else below — safe to do first, in isolation.

---

## Phase 2 — Fuzzy fix + result-quality filtering (was items 1 & 3)

**Status: root cause found, verified against the live Kilang API — ready to plan concretely.**

### What's actually happening

`fetchMoeWords` (`apps/web/app/api/dict/search/route.ts`) hardcodes
`exact=false` in the Kilang request regardless of our local `fuzzy` toggle —
Kilang's own backend is always in its loosest mode.

Verified via direct API calls:
- `keyword=make&exact=false` → 207 rows. Filtering to rows where `word_ab`
  actually contains "make" → only **114** are real (e.g. `makero`, `makeca'`);
  the other **93** matched purely because their English gloss text contains
  "make" (e.g. `'amitir`'s definition says "...makes he[r]...", nothing to do
  with the word `'amitir` itself). This is the source of the "messy list"
  complaint (was item 3).
- `keyword=make&exact=true` → **0 rows**. Kilang's "exact" mode requires a
  literal full-string headword match, so it's too strict to use as our
  general "less noisy" mode — flipping our `fuzzy` toggle straight onto their
  `exact` param would mostly return nothing, not a cleaner list. **This isn't
  a clean 1:1 mapping; don't just do `exact=${!fuzzy}` and call it done.**

### Reference implementation exists — port, don't reinvent

The Grimoire browser extension (`族語魔書\Ext_族語魔書_PopupDict\background.js`,
documented in `dev\FEATURES.md` "Kilang Morphology And Sense UI" /
"Direction Support" tables) already solved this exact problem against the
same Kilang API, shipped and in production (v1.6.4). Its approach is not
"tune the fuzzy/exact param" at all — it's a different architecture:

- **AB-direction lookups always use `exact=true` first**
  (`fetchMoeRows(word, exact=true)`, default). If that returns rows, done —
  no fuzzy/definition-text noise possible, since exact=true only matches a
  literal headword.
- **If exact=true returns nothing**, it tries a *generated* candidate list
  via `makeMoeFallbackCandidates()`, each still looked up with `exact=true`
  (never falling back to `exact=false` for AB search):
  - `makeMoeAltSpellings()` — swaps letters per `MOE_ALT_SWAPS = { u:'o', o:'u', l:'r', r:'l', f:'v', v:'f' }`
    (note: **no `b`** — only f/v is swapped, worth confirming whether that's
    deliberate or a gap before porting, since the ask mentioned b/v/f).
    Tries every subset of up to 4 swappable positions (bitmask), capped at
    `MAX_MOE_ALT_POSITIONS = 4`.
  - `makeMoeGlottalRepairs()` — inserts an apostrophe (glottal stop) at the
    start/end of the word if it begins/ends in a vowel, or right after a
    known prefix if what follows starts with a vowel
    (`MOE_COMMON_PREFIXES`). **This does not handle schwa/e-insertion**
    (the "demak vs dmak" case from the original ask) — it's specifically
    about the glottal stop, a different phenomenon. That gap is still open.
  - `makeMoeStrippedStates()` — bounded BFS affix-stripping using explicit
    `MOE_COMMON_PREFIXES`/`MOE_COMMON_SUFFIXES` lists (max 2 prefix strips +
    1 suffix strip), generating real candidate roots.
  - All candidates scored and capped at `MAX_MOE_FALLBACK_CANDIDATES = 20`,
    tried in order until one yields real rows (`fetchMoeInsights()`).
- **ZH/EN-direction lookups deliberately use `exact=false`**
  (`fetchMoeZhInsights()`), accepting that "Chinese terms can match unrelated
  words" (their words, from `FEATURES.md`) — mitigated by enriching up to
  **8** roots instead of 1 (`enrichMoeRows(rows, { maxRoots: 8 })`), i.e. they
  don't try to eliminate the ambiguity, they surface more of it deliberately.

This reframes both Phase 2 and Phase 3 below: the "fix" isn't a param tweak
or a post-hoc filter, it's adopting this two-mode architecture (exact-first +
smart candidates for AB; accept-and-enrich for ZH/EN) — which also happens to
solve most of Phase 3's root-contamination problem for free, since candidate
generation never does a broad substring/contains search in the first place.

### Open architectural question: curated swap table vs. agnostic fuzzy matching — NOT DECIDED

Grimoire's `MOE_ALT_SWAPS` is a hand-curated table of Amis-specific
phonetic variation (u/o, l/r, f/v), and Kilang itself is Amis-only. Indivore's
dict serves **16 languages**. Before porting this approach, explicitly decide
between:

1. **Curated per-language swap tables** (Grimoire's approach) — precise,
   linguistically correct, but requires someone who knows each language's
   actual variation patterns to build and maintain a table per language.
   Doesn't generalize automatically to Atayal, Paiwan, Bunun, etc.
2. **A generic, language-agnostic fuzzy mechanism** (e.g. bounded edit
   distance / Levenshtein ≤ 1–2 on candidate generation, or a generic
   consonant/vowel-class swap not tied to specific letters) — works for any
   language with no per-language curation, but is a blunter instrument: may
   both over-match (unrelated words within edit distance 1) and under-match
   (real phonetic variants that aren't a simple 1-letter edit, like affix-
   stripped forms) compared to a curated table.
3. Some hybrid — e.g. agnostic edit-distance as the default for all
   languages, with curated swap tables layered on top only for
   languages/dialects someone has actually built one for (Amis first, via
   Grimoire's table, since it already exists).

This wasn't re-reviewed before the last plan update — flagging explicitly so
the new session treats it as open, not settled. The "recommended direction"
below assumes porting Grimoire's curated approach *for Amis/Kilang
specifically* (where the table already exists and is proven), and leaves
open whether ePark's other 15 languages get the same treatment, an agnostic
fallback, or nothing for now.

### Leading candidate direction for Kilang specifically (not a final decision — see open question above)

Port `makeMoeAltSpellings` / `makeMoeGlottalRepairs` / `makeMoeStrippedStates`
/ `makeMoeFallbackCandidates` (or an adapted equivalent) into
`apps/web/app/api/dict/search/route.ts`'s `fetchMoeWords`, replacing the
always-`exact=false` call with exact-first + fallback-candidates for AB
queries. Keep `exact=false` (with wider root enrichment) for CJK-direction
queries, matching Grimoire's split — which may be most of what "item 3"
(language direction) actually needed, without necessarily requiring a new
header button (the *behavior* already differs by direction; a button may
only be needed if we want to let users force one mode over the other).

Cheaper fallback if full porting is out of scope for the first pass: the
"post-filter word_ab" idea (keep only rows where word_ab actually
contains/starts-with the query, drop pure-definition matches) still removes
~45% of observed noise with much less code — worth keeping as a documented
fallback option, not the primary plan anymore.

### Open questions for the new session
- Is `f`/`v`-only (no `b`) in `MOE_ALT_SWAPS` intentional? Confirm before
  deciding whether to add `b` when porting.
- Schwa/e-insertion ("demak"/"dmak") isn't handled by any of Grimoire's
  existing recovery functions — still needs its own solution if that case
  matters enough to build.
- Does this same exact-first/fallback-candidates approach make sense for
  **ePark** word search too (not just Kilang), given Phase 3 shows ePark has
  the identical root-contamination problem and no stem/root metadata to lean
  on? Candidate-generation (alt spellings, glottal repair) doesn't need
  stem data — it could apply to ePark's plain `corpus_vocabulary` lookups
  the same way, tried as `ilike` exact/prefix matches instead of API calls.

---

## Phase 3 — Root-contamination in exact/fuzzy word results (was item 2)

**Status: confirmed real and reproducible in ePark too (not just Kilang) — now has a likely answer via Phase 2's Grimoire finding, not just options.**

Verified: searching "icep" in ePark's `corpus_vocabulary` with fuzzy on
returns `sicepo'ay` — a genuinely different, unrelated root that only
coincidentally contains "icep" as a substring (confirmed: it's the only
`sicep%`-prefixed entry, not a derived form of `icep`). ePark's corpus has no
stem/root metadata to distinguish "real derivation" from "coincidental
substring," so this can't be reliably filtered by data alone. (Kilang *does*
carry `stem`/`ultimate_root` per entry, which correctly groups real
derivations — e.g. `'icepen`, `ma'icep`, `mapa'icep` all resolve to root
`icep` — but ePark, our primary word source, doesn't have this.)

**Likely answer, pending the new session's investigation:** adopting
Phase 2's exact-first + generated-candidates approach for ePark word search
too would likely prevent this class of contamination outright — `sicepo'ay`
would never be generated as a candidate from "icep" (it isn't a real alt
spelling, glottal repair, or affix-stripped form of it), so it would simply
never be looked up, rather than needing to be filtered out after the fact.
If that holds up, the dropdown/typeahead idea below becomes optional polish
rather than the necessary fix.

### Options to consider (not decided — list only, per instruction)
1. **Typeahead/autocomplete dropdown**: as the user types, show a short list
   of actual distinct headwords (not full search results) to pick from before
   running the real lookup — puts a human in the loop for disambiguation
   instead of trying to algorithmically detect "same root." Biggest UX change
   of the three options; changes the core interaction from "type → scan a
   results list" to "type → pick from a narrow list → see one entry." Still
   useful even with Phase 2's fix ported, e.g. for genuinely ambiguous short
   words with multiple real unrelated senses.
2. **Keep current flow, but rank/group by whether the match is a real prefix
   vs. a substring-only hit** — cheaper, doesn't fully solve the "different
   root" problem but demotes the worst offenders visually.
3. **Use Kilang's `stem`/`ultimate_root` where available** to label/group
   Kilang results by real derivation, while leaving ePark results as plain
   substring matches (since it has no equivalent data) — a partial, source-
   asymmetric fix. Largely superseded if Phase 2's candidate-generation
   approach is ported to ePark too.

---

## Phase 4 — Sentence tab UX (was item 4)

**Status: needs discussion — one concrete base test agreed on, rest open.**

Goal: make sentence search convenient on its own, *and* make per-word example
sentences easy to reach from a word result — some redundancy between the two
paths is acceptable.

**Agreed base test to start from:** keep the current Sentences tab as-is, and
additionally show example sentences inline on each *word* result, revealed on
tap (expandable), rather than requiring a trip to the Sentences tab. This
already has a natural data source for Kilang entries (the `examples_json`
already being parsed for the Sentences tab — see the recent "surface Kilang's
example sentences" commit) and could pull from `corpus_sentences` for ePark
entries by matching on the word.

Other ideas floated, not yet designed: making sentence result cards
expandable for more context, other header-level controls. Worth looking at
what mature dict apps (e.g. established Bible-translation or minority-
language dictionary apps) do for word ↔ sentence linking before designing
further — flagged as a research task for the new session, not done here.

---

## Phase 5 — Merge Dict + Translate tabs (was item 6, optional/last)

**Status: listed only, not scoped.**

Combine the Dictionary and Translate top-level tabs, with sentence
translation likely becoming a sub-tab of the merged surface. Largest-scope,
most structural item on this list (navigation/IA change, not just dict
internals) — do this only after phases 1–4 have landed and settled, and
treat it as its own planning discussion rather than folding it into this doc's
scope.

---

## Notes for whoever picks this up

- Header can carry up to ~3 buttons comfortably (fuzzy toggle + settings gear
  is 2 today; a possible 3rd for language-direction is fine if Phase 2's
  filter approach turns out insufficient — not a real constraint).
- Kilang is an external, undocumented API (`https://ycm-citadel.vercel.app/api/moe_shadow`) —
  verify behavior empirically via curl before designing around any assumption
  about it, the same way Phase 2's findings were obtained.
