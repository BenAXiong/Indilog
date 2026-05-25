# Indivore — UI Screens

Extracted from `design-handoff/indivore/project/indivore-screens-v2.jsx` and `indivore-desktop.jsx`.
Source of truth: always prefer the handoff files over this doc if they diverge.

---

## Shared: Screen header (non-dashboard screens)

- Top-left: Indivore logo (uploaded woven-tree image, 36×36) → taps back to dashboard
- Middle: mono uppercase eyebrow `{language} · {dialect}` + serif h1 tab name (26px)
- Top-right: settings gear button (36×36, `paperHi` background, `line` border)

---

## Shared: Bottom navigation (mobile)

```
Learn | Review | [Capture FAB] | Dictionary | Translate
```

- Capture is a raised crimson circle (60px, translateY -18px, 3px cream border)
- Active tab: crimson color, stroke weight 2
- Inactive: inkMute, stroke 1.6
- Gradient fade from cream at bottom

---

## 1. Dashboard

### Header
- Left: woven-tree logo (32px) + "Indivore" serif wordmark (22px)
- Right: settings button

### Active language card (raised)
- `LangAvatar` + "Studying" mono label + language name serif + dialect if set + "Change" button

### Streak banner
- Crimson gradient `(135deg, crimson → crimsonDp)`
- Large ghost flame icon right (opacity 0.18)
- Circular icon button left (opacity 0.18 background)
- Serif number (32px) + "day streak" + "Capture today to keep it going"
- Box shadow: `0 8px 22px rgba(120,30,15,0.22)`

### Stats grid (2×2)
- `Stat` tiles: Captures, Reviewed, Due today, Lessons (x of 24)
- Accents: crimson, sage, amber, terra

### Activity heatmap
- 18-week × 7-day grid
- Cell size: 13×13px, gap: 3px, borderRadius: 3px
- 5 intensity levels: lineSoft → #F1D8C6 → #E5A88E → #C66848 → crimsonDp
- Today: outlined with crimson ring (no fill if not captured)
- Month markers above columns (every ~4 weeks)
- Legend bottom-right: less → more

---

## 2. Capture

### Header
Standard screen header (logo → home, gear → settings).

### Capture input
- Large textarea (`paperHi` background, 1.5px `line` border, borderRadius 18px)
- Serif font, 20px, lineHeight 1.35
- Placeholder: "A word, sentence, or note you want to keep…"
- Bottom-right: mic icon button + sparkle (translate shortcut) icon button (30×30, `paper` bg)

### Token chips (shown after lookup)
- Section label: "tap to add gloss" (mono 11px uppercase) + re-lookup circular button
- Right: "See all · {n}" toggle if > 4 tokens
- Each token row: serif word (15px 500) + italic gloss (12px inkSoft) + sage "match" chip
- Background: `paperHi`, border `lineSoft`, borderRadius 12px
- Entrance: `iv-rise` animation

### Quick actions row
- "Lookup" button (secondary, flex 1) + "Translate" button (secondary, flex 1)

### Context section
- Section header: "Context"
- Grouped list in `paperHi` container (borderRadius 14px):
  - Source (bookmark icon) — dropdown/selector
  - Speaker (user icon) — text input
  - Place (pin icon) — text input "Where heard / seen"
  - Notes (pen icon) — textarea

### Save bar
- "Clear" secondary button (flex 1) + "Save" primary button with check icon (flex 2)
- Save triggers toast: "Saved to your notebook" (sage tone)

---

## 3. Review

### Landing view

**Header:** standard

**Due today card** (raised):
- Mono label "Due today" + amber chip "X / Y done"
- Serif number (38px) + "cards · ~X min"
- Progress bar: gradient amber → terra → crimson

**Start review grid (2 columns):**
- Comprehension card: crimson tone, dict icon, "See the meaning — say the sentence", due count, crimson play button
- Expression card: sageDp tone, mic icon, "Hear the sentence — guess the sentence", due count, sage play button
- Press: scale(0.98)

**Dialogue drill list:**
- Each: icon in tinted box + title (serif 16px 500) + subtitle + phrase count + chevron
- "Meeting an elder" (terra tone), "At the market" (amber tone)

### Flashcard / session view

**Session header:**
- Back arrow button → returns to landing
- Mode label (mono uppercase in mode color) + language serif
- Progress counter "X / Y" (mono, inkMute)

**Progress dots:**
- Full-width flex, 4px height pills
- Done: sage · Current: mode color · Remaining: lineSoft

**Flashcard:**
- `paperHi` card, borderRadius 22px, minHeight 240px
- POS label top-right (mono 10px inkFaint)
- Word: serif 38px 500
- "Hear it" audio button (paper bg, lineSoft border, speaker icon)
- Before reveal: dark (ink bg, cream text) "Reveal answer" button
- After reveal (`iv-rise`): divider → definition (17px 500) → example quote (serif italic, left border in mode color)

**Rating buttons (after reveal, 4 columns):**
- Again (crimson) · Hard (terra) · Good (sage) · Easy (amber)
- Each: label + mono interval sub-label (`<10m`, `1d`, `3d`, `7d`)
- Hover: fills with color, text turns white

---

## 4. Dictionary

### Header
Standard screen header.

### Search row
- Input (big, mono, search icon left, mic icon right) + "Sources" button (52×52, `paperHi`, library icon + "Sources" mono label)

### Exact match card (raised, no padding wrapper)
- Word: serif 30px 500
- POS: mono 11px crimson uppercase + dialect label
- "exact" chip (sage)
- Definitions list: numbered (mono inkFaint) + primary bold + secondary body
- Examples section (paper bg): "Examples" mono header + italic serif example + english translation
- Actions row (paper bg, borderTop): "Save word" primary + "Add context" secondary with arrow

### Also matches list
- Each: serif word (16px 500) + mono POS + italic gloss + dict icon button + bookmark icon button

---

## 5. Translate

### Header
Standard screen header + subtitle: "Independent of your study language · supported pairs only" (12px inkMute)

### Pair selector
- 3-column grid: From panel | swap button | To panel
- From/To panels: mono "From"/"To" label + serif language name (17px 500)
- Swap button: crimson, `swap` icon, paperHi bg, borders on sides
- borderRadius 16px, lineSoft border, overflow hidden

### Source panel
- paperHi bg, 1.5px `line` border, borderRadius 18px
- Mono language label + "Clear" button top row
- Textarea: sans 16px

### Output panel
- Gradient bg `(cream → paper)`, crimsonBg border
- Crimson top accent bar (3px, 36px wide, centered left)
- Mono language name in crimson + "AI" ghost chip
- Serif italic output text (19px)
- Action row: Copy · Listen · Save (crimson bg)
- Footer disclaimer: sparkle icon + "AI translations approximate. Verify with a fluent speaker."

### Unsupported pair
- Disabled target languages: line-through text, `· soon` suffix, `cursor: not-allowed`

---

## 6. Settings

### Profile card
- Avatar circle (amberBg, amber border, user icon) + name + email + "synced" chip

### Active study language (featured section)
- List: LangAvatar + language name (serif) + dialect if set + checkmark or chevron
- Active: crimsonBg background + crimson filled circle checkmark
- "See all 16 Formosan languages" link at bottom

### Preferences
- Interface language: English (active, ink bg) | 繁體中文 · soon (disabled)
- Daily review goal: range slider 5–50, accentColor crimson, current value in serif crimson

### Account
- Export notebook · About Indivore · Sign out (crimson, danger)

### Footer
- Mono 10.5px inkFaint: "Indivore v0.1 · 行動族語筆記本"

---

## Desktop layout

### Shell
- Grid: `232px sidebar | 1fr main`

### Sidebar
- Wordmark top
- Active language card (compact, with chev-d)
- Capture primary button full-width with ⌘K shortcut label
- Nav items: active = crimsonBg bg + crimsonDp text, review badge count
- Streak mini card (crimson gradient, inline)
- Settings text button at bottom

### Main area
- Top bar: date (mono) + greeting serif h1 ("Maolah ko misang—welcome back, Panay.") + search bar (⌘/) + user avatar
- Stats row: 4 Stat tiles
- Two-column body (1.4fr | 1fr):
  - Left: Recent captures list (full height)
  - Right: Today's review card + Quick capture card (accent crimson) + Continue lesson card

---

## Languages in design (10 shown, 16 total)

| Code | Name | Color |
|------|------|-------|
| ami | Amis | crimson |
| tay | Atayal | terra |
| bnn | Bunun | amber |
| pyu | Puyuma | sage |
| pwn | Paiwan | crimsonDp |
| tao | Tao | #8E4516 |
| sai | Saisiyat | #A8351F |
| ckv | Kavalan | sageDp |
| tsu | Tsou | #8C6515 |
| rkb | Rukai | terra |

Note: design shows 10 but UI says "See all 16 Formosan languages" — remaining 6 need confirmation (see `decisions.md` DEC-004).

---

## Translation pairs in design (mock data — needs confirmation)

| Source | Supported targets |
|--------|------------------|
| English | Amis, Atayal |
| 中文 | Amis, Atayal, Bunun |
| Amis | English, 中文 |
| Atayal | English, 中文 |
| Bunun | 中文 only |
| Puyuma, Paiwan | none (shown as unsupported) |

**These are prototype mock values. Confirm actual supported pairs before Phase 6 (see `decisions.md` DEC-002).**
