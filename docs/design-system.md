# Indivore — Design System

Extracted from `design-handoff/indivore/project/indivore-tokens.jsx` and `indivore-system.jsx`.
Source of truth: always prefer the handoff files over this doc if they diverge.

---

## Visual concept

"A warm field notebook for studying Formosan languages."
Palette drawn from a woven-tree reference: cream paper, crimson primary, terracotta + amber + sage accents. Never pure white or pure black.

---

## Color tokens

### Surfaces
| Token | Hex | Use |
|-------|-----|-----|
| `cream` | `#F5EEDF` | Canvas / page background |
| `paper` | `#FBF5E7` | Card surface |
| `paperHi` | `#FFFCF3` | Raised card / input background |
| `line` | `#E6DAC0` | Hairline divider |
| `lineSoft` | `#EFE5CF` | Softer divider |

### Ink (warm dark brown, not black)
| Token | Hex | Use |
|-------|-----|-----|
| `ink` | `#2B221A` | Primary text |
| `inkSoft` | `#5C4E3F` | Secondary text |
| `inkMute` | `#8B7B68` | Muted / metadata text |
| `inkFaint` | `#B5A691` | Faint / disabled text |

### Brand
| Token | Hex | Use |
|-------|-----|-----|
| `crimson` | `#A8351F` | Primary action, active tab, CTA |
| `crimsonDp` | `#7C2113` | Hover / pressed crimson |
| `crimsonHi` | `#C75038` | Highlight crimson |
| `crimsonBg` | `#F6E0D6` | Tinted crimson background |
| `terra` | `#D2773A` | Accent (terracotta) |
| `terraBg` | `#F6E2CE` | |
| `amber` | `#D9A12F` | Accent / warning |
| `amberBg` | `#F6E5BA` | |
| `sage` | `#7B8C46` | Success / good |
| `sageBg` | `#E4E7CC` | |
| `sageDp` | `#566234` | Deep sage |

### Functional
| Token | Use |
|-------|-----|
| `good` = sage | Positive states |
| `warn` = amber | Warnings |
| `danger` = crimson | Destructive / errors |

---

## Typography

Three families:

| Role | Family | Usage |
|------|--------|-------|
| Serif (`fSerif`) | Newsreader, Source Serif Pro, Iowan Old Style, Georgia | Display text, card headings, captured language content, flashcard fronts |
| Sans (`fSans`) | Manrope, Helvetica Neue, system-ui | UI labels, buttons, body copy |
| Mono (`fMono`) | JetBrains Mono, SF Mono, Menlo | Metadata labels, codes, uppercase caps text |

Type scale:
| Level | Size | Weight | Family | Notes |
|-------|------|--------|--------|-------|
| Display | 32–38px | 500–600 | Serif | Screen titles, flashcard front word |
| Title | 22–26px | 500–600 | Serif | Section titles, dashboard greeting |
| Heading | 17–20px | 500 | Serif | Card headings, screen sub-headers |
| Body | 14–16px | 400–500 | Sans | Regular UI text |
| Caption | 12–13px | 400 | Sans italic | Glosses, secondary info |
| Label | 11px | 500–600 | Mono uppercase | Metadata, source labels, section headers |
| Micro | 10–10.5px | 500–600 | Mono uppercase | Tab labels, chips, timestamps |

Letter spacing:
- Serif: `-0.02em` to `-0.03em`
- Sans: `-0.005em`
- Mono labels: `+0.08em` (uppercase)

---

## Spacing and shape

- Border radius: `999px` (pills), `18–22px` (large cards), `14–16px` (medium cards), `10–12px` (small cards/buttons), `8–9px` (chips/small buttons)
- Card shadows (raised): `0 1px 0 rgba(255,255,255,0.6) inset, 0 1px 2px rgba(80,40,20,0.04), 0 4px 18px rgba(80,40,20,0.06)`
- Primary button shadow: `0 1px 0 rgba(255,255,255,0.18) inset, 0 1px 2px rgba(120,30,15,0.2), 0 6px 14px rgba(120,30,15,0.18)`
- Paper grain texture on body (subtle radial dot pattern)

---

## Components

### Button

Variants: `primary` (crimson), `secondary` (paperHi), `ghost`, `sage`, `amber`, `danger`
Sizes: `sm` (h32), `md` (h42), `lg` (h52)
- Press scale: `0.98` on mousedown
- Disabled: `opacity: 0.45`, `cursor: not-allowed`
- Always `font-weight: 600`

### Chip

Variants: `default`, `crimson`, `sage`, `amber`, `terra`, `ghost`, `ink`
Sizes: `sm` (h22), `md` (h28), `lg` (h34)
- All pill-shaped (`border-radius: 999`)
- `active` prop inverts to ink background

### Card

- Background: `paperHi`
- Border radius: `18px`
- Two elevations: flat and raised (different box-shadow)
- Optional `accent` top bar (2px strip in accent color)

### Input

- Background: `paperHi`, border `line`
- On focus: border turns `crimson`, box-shadow `crimsonBg` glow
- Border radius: `14px`
- Heights: standard `44px`, big `52px`

### Bottom navigation (mobile)

- 5 tabs: Learn | Review | **Capture** | Dictionary | Translate
- Capture tab: raised circular FAB, 60×60, `crimson`, `translateY(-18px)`, `border: 3px solid cream`
- Active tab: `crimson` text + stroke weight `2` (inactive: `inkMute`, stroke `1.6`)
- Background: gradient fade `cream → transparent` above nav

### Sidebar navigation (desktop)

- Width: `232px`, background `paper`, border-right `line`
- Contains: wordmark, active language card, Capture primary button (⌘K), nav items, streak mini, settings
- Active nav item: `crimsonBg` background, `crimsonDp` text

### LangAvatar

- Circular, color from language palette
- Letter is first letter of language name
- Font: Serif, `font-weight: 600`

### Stat tile

- White-ish card with large serif number + small sans label
- Optional accent icon top-right

### Toast

- Bottom center, ink background, cream text, pill-shaped
- Slide-up animation (`iv-toast`), auto-dismiss after 2s

### Section header

- 11px Mono uppercase, `inkMute`, `+0.08em` tracking
- Optional right action in `crimson`

---

## Animations

| Name | Use |
|------|-----|
| `iv-rise` | Elements appearing (token chips, review revealed answer) |
| `iv-flip` | Flashcard flip (rotateY) |
| `iv-toast` | Toast notification slide-up + fade |
| `iv-pulse` | Stat count update |
| `iv-shimmer` | Loading skeleton |

---

## States

### Empty
- Dashed circle container, leaf icon, serif heading, sans body
- "Nothing saved yet · Capture your first word to begin."

### Loading
- Shimmer skeleton bars at 100%, 85%, 60% width

### Unsupported translation pair
- Target language shown with `line-through`, `· soon` suffix, `cursor: not-allowed`
- Source language chip shown as `ink` active, unsupported targets greyed out

---

## Fonts to load (Google Fonts)

- Newsreader (ital, opsz 6–72, wght 400–700)
- Manrope (wght 300–800)
- Source Serif 4 (ital, opsz 8–60, wght 400–600)
- JetBrains Mono (wght 400–600)
- (Lora, Cormorant Garamond, Public Sans, DM Sans, Inter Tight loaded as fallbacks in prototype)
