// Tokens and types scoped to ePark curriculum views only.
// Do not use these outside components/epark/ — global UI uses T from lib/tokens.

export const EP = {
  fontAb:    '"Caveat", cursive',
  fontTrans: '"Kalam", cursive',
  fontMono:  '"Space Mono", monospace',
} as const

export type LayoutMode = 'standard' | 'compact' | 'single' | 'bubbles' | 'legacy'

export const LAYOUT_CYCLE: LayoutMode[] = ['standard', 'compact', 'single', 'bubbles', 'legacy']

// Icon name and label shown on the cycle button for each mode (shows current mode)
export const LAYOUT_META: Record<LayoutMode, { icon: 'word' | 'layers' | 'card' | 'note' | 'chat'; label: string }> = {
  standard: { icon: 'word',   label: 'Standard' },
  compact:  { icon: 'layers', label: 'Compact'  },
  single:   { icon: 'card',   label: 'Single'   },
  bubbles:  { icon: 'chat',   label: 'Bubbles'  },
  legacy:   { icon: 'note',   label: 'Legacy'   },
}
